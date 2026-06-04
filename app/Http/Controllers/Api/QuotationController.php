<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountReceivable;
use App\Models\Client;
use App\Models\Project;
use App\Services\AccountsReceivableService;
use App\Models\Quotation;
use App\Models\QuotationLine;
use App\Support\AreaVisibility;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class QuotationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Quotation::query()->with(['client:id,legal_name', 'areas:id,name']);
        AreaVisibility::applyQuotationScope($q, $request->user());

        if ($request->filled('status')) {
            $q->where('status', $request->input('status'));
        }

        return response()->json($q->orderByDesc('id')->paginate(25));
    }

    public function show(Request $request, Quotation $quotation): JsonResponse
    {
        $this->assertQuotation($request, $quotation);

        return response()->json($quotation->load(['client', 'areas', 'lines', 'currency']));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'status' => ['nullable', 'string', 'max:32'],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'currency_id' => ['nullable', 'integer', 'exists:currencies,id'],
            'valid_until' => ['nullable', 'date'],
            'opportunity_id' => ['nullable', 'integer', 'exists:opportunities,id'],
            'notes' => ['nullable', 'string'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.description' => ['required', 'string'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0'],
        ]);

        $this->assertClientVisible($request, (int) $data['client_id']);

        $quotation = DB::transaction(function () use ($request, $data) {
            $lines = $data['lines'];
            unset($data['lines']);
            $areaIds = $request->user()->areas()->pluck('areas.id')->toArray();

            $data['tax_amount'] = $data['tax_amount'] ?? 0;
            $data['discount'] = $data['discount'] ?? 0;
            $data['created_by'] = $request->user()?->id;
            $data['number'] = 'TMP';
            $data['status'] = $data['status'] ?? 'draft';
            $data['subtotal'] = 0;
            $data['total'] = 0;

            $qRow = Quotation::query()->create($data);

            self::persistLinesAndTotals($qRow, $lines);

            $qRow->areas()->sync($areaIds);

            $qRow->number = 'COT-' . date('Y') . '-' . str_pad((string) $qRow->id, 6, '0', STR_PAD_LEFT);
            $qRow->save();

            return $qRow->fresh(['lines', 'areas']);
        });

        return response()->json($quotation, 201);
    }

    public function update(Request $request, Quotation $quotation): JsonResponse
    {
        $this->assertQuotation($request, $quotation);
        $data = $request->validate([
            'status' => ['sometimes', 'string', 'max:32'],
            'tax_amount' => ['sometimes', 'numeric', 'min:0'],
            'discount' => ['sometimes', 'numeric', 'min:0'],
            'currency_id' => ['nullable', 'integer', 'exists:currencies,id'],
            'valid_until' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'lines' => ['sometimes', 'array', 'min:1'],
            'lines.*.description' => ['required', 'string'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($quotation, $data) {
            $linesData = $data['lines'] ?? null;
            unset($data['lines']);
            foreach (['tax_amount', 'discount', 'currency_id', 'valid_until', 'status', 'notes'] as $key) {
                if (array_key_exists($key, $data)) {
                    $quotation->{$key} = $data[$key];
                }
            }
            $quotation->save();
            if (is_array($linesData)) {
                self::persistLinesAndTotals($quotation, $linesData);
            }
        });

        return response()->json($quotation->fresh()->load(['lines', 'areas', 'client']));
    }

    public function accept(Request $request, Quotation $quotation): JsonResponse
    {
        $this->assertQuotation($request, $quotation);
        $data = $request->validate([
            'project_name'     => ['nullable', 'string', 'max:255'],
            'service_type'     => ['nullable', 'string', 'max:255'],
            'lead_user_id'     => ['nullable', 'integer', 'exists:users,id'],
            'due_on'           => ['nullable', 'date'],
            'ar_notes'         => ['nullable', 'string'],
            'immediate_payment'   => ['nullable', 'boolean'],
            'payment_amount'      => ['nullable', 'numeric', 'min:0.01'],
            'payment_paid_on'     => ['nullable', 'date'],
            'payment_method'      => ['nullable', 'string', 'max:64'],
            'payment_reference'   => ['nullable', 'string', 'max:255'],
            'payment_notes'       => ['nullable', 'string'],
        ]);

        $areaId = $request->user()?->areas()->first()?->id;

        if (!empty($data['immediate_payment']) && $areaId === null) {
            abort(422, 'Tu usuario no tiene área asignada. No se puede registrar el pago inmediato en finanzas.');
        }

        $result = DB::transaction(function () use ($quotation, $request, $data, $areaId) {
            $quotation->update([
                'status'      => 'accepted',
                'accepted_at' => now(),
            ]);

            $name = $data['project_name'] ?? ('Proyecto — ' . $quotation->number);

            $p = Project::query()->create([
                'client_id'    => $quotation->client_id,
                'name'         => $name,
                'service_type' => $data['service_type'] ?? null,
                'status'       => 'pending',
                'budget'       => $quotation->total,
                'lead_user_id' => $data['lead_user_id'] ?? $request->user()?->id,
                'description'  => $quotation->notes,
            ]);

            $p->areas()->sync($quotation->areas()->pluck('areas.id')->all());
            $quotation->update(['accepted_project_id' => $p->id]);

            $account = AccountReceivable::query()->create([
                'client_id'    => $quotation->client_id,
                'project_id'   => $p->id,
                'area_id'      => $areaId,
                'total_amount' => $quotation->total,
                'paid_amount'  => 0,
                'balance_amount' => $quotation->total,
                'issued_on'    => now()->toDateString(),
                'due_on'       => $data['due_on'] ?? null,
                'status'       => 'pending',
                'notes'        => $data['ar_notes'] ?? null,
            ]);

            if (!empty($data['immediate_payment'])) {
                $svc = new AccountsReceivableService();
                $svc->registerPayment($account, [
                    'amount'    => $data['payment_amount'] ?? (float) $quotation->total,
                    'paid_on'   => $data['payment_paid_on'] ?? now()->toDateString(),
                    'method'    => $data['payment_method'] ?? null,
                    'reference' => $data['payment_reference'] ?? null,
                    'notes'     => $data['payment_notes'] ?? null,
                ], $request->user()?->id ?? 0);
                $account = $account->fresh();
            }

            return [
                'project'            => $p->load(['areas']),
                'account_receivable' => $account->fresh()->load(['client', 'project']),
            ];
        });

        return response()->json([
            'quotation'          => $quotation->fresh()->load(['lines', 'areas']),
            'project'            => $result['project'],
            'account_receivable' => $result['account_receivable'],
        ]);
    }

    public function destroy(Request $request, Quotation $quotation): JsonResponse
    {
        $this->assertQuotation($request, $quotation);
        $quotation->update(['status' => 'rejected']);

        return response()->json(null, 204);
    }

    /**
     * @param  array<int, array<string, mixed>>  $lines
     */
    private static function persistLinesAndTotals(Quotation $quotation, array $lines): void
    {
        QuotationLine::query()->where('quotation_id', $quotation->id)->delete();
        $subtotal = 0.0;

        foreach ($lines as $l) {
            $qty = (float) $l['quantity'];
            $price = (float) $l['unit_price'];
            $lineTotal = round($qty * $price, 2);
            $subtotal += $lineTotal;

            QuotationLine::query()->create([
                'quotation_id' => $quotation->id,
                'description' => $l['description'],
                'quantity' => $qty,
                'unit_price' => $price,
                'line_total' => $lineTotal,
            ]);
        }

        $tax = (float) ($quotation->tax_amount ?? 0);
        $disc = (float) ($quotation->discount ?? 0);
        $total = round($subtotal + $tax - $disc, 2);

        $quotation->update([
            'subtotal' => round($subtotal, 2),
            'total' => max(0, $total),
        ]);
    }

    public function generatePdf(Request $request, Quotation $quotation)
    {
        $this->assertQuotation($request, $quotation);
        $quotation->load(['client.contacts', 'lines', 'currency', 'creator']);

        $pdf = Pdf::loadView('pdf.quotation', compact('quotation'));
        return $pdf->stream("cotizacion_{$quotation->number}.pdf");
    }

    public function generateExcel(Request $request, Quotation $quotation)
    {
        $this->assertQuotation($request, $quotation);
        $quotation->load(['client.contacts', 'lines', 'currency', 'creator']);

        $html = view('pdf.quotation_excel', compact('quotation'))->render();

        return response($html)
            ->header('Content-Type', 'application/vnd.ms-excel; charset=utf-8')
            ->header('Content-Disposition', 'attachment; filename="cotizacion_' . $quotation->number . '.xls"');
    }

    public function sendWhatsapp(Request $request, Quotation $quotation): JsonResponse
    {
        $this->assertQuotation($request, $quotation);
        $quotation->load(['client.contacts']);

        $this->advanceClientStageToProspect($quotation->client);
        if ($quotation->status === 'draft') {
            $quotation->update(['status' => 'sent']);
        }

        $contact = $quotation->client->contacts->first(fn($contact) => filled($contact->phone));
        $rawPhone = $contact?->phone ?: $quotation->client->phone;
        $phone = $rawPhone ? preg_replace('/[^0-9]/', '', $rawPhone) : '';
        $pdfUrl = url("/api/quotations/{$quotation->id}/pdf");

        $message = "Hola, te enviamos la cotizacion Nro. {$quotation->number}. Puedes revisarla aqui: {$pdfUrl}";

        return response()->json([
            'success' => true,
            'whatsapp_url' => "https://api.whatsapp.com/send?phone={$phone}&text=" . urlencode($message),
        ]);
    }

    public function sendEmail(Request $request, Quotation $quotation): JsonResponse
    {
        $this->assertQuotation($request, $quotation);
        $quotation->load(['client.contacts', 'lines', 'currency', 'creator']);

        $this->advanceClientStageToProspect($quotation->client);
        if ($quotation->status === 'draft') {
            $quotation->update(['status' => 'sent']);
        }

        $contact = $quotation->client->contacts->first(fn($contact) => filled($contact->email));
        $recipient = $contact?->email ?: $quotation->client->email;
        if (!$recipient) {
            abort(422, 'El cliente no tiene correo disponible para enviar la cotizacion.');
        }

        $pdfBytes = Pdf::loadView('pdf.quotation', compact('quotation'))->output();
        $fileName = "cotizacion_{$quotation->number}.pdf";

        Mail::raw("Adjuntamos la cotizacion {$quotation->number}.", function ($message) use ($recipient, $quotation, $pdfBytes, $fileName): void {
            $message
                ->to($recipient)
                ->subject("Cotizacion {$quotation->number}")
                ->attachData($pdfBytes, $fileName, ['mime' => 'application/pdf']);
        });

        return response()->json(['success' => true, 'message' => 'Cotizacion enviada por correo.']);
    }

    private function advanceClientStageToProspect(Client $client): void
    {
        if ($client->pipeline_stage === 'lead') {
            $client->update(['pipeline_stage' => 'prospect']);
        }
    }

    private function assertQuotation(Request $request, Quotation $quotation): void
    {
        $q = Quotation::query()->whereKey($quotation->id);
        AreaVisibility::applyQuotationScope($q, $request->user());
        if (!$q->exists()) {
            abort(404);
        }
    }

    private function assertClientVisible(Request $request, int $clientId): void
    {
        $q = Client::query()->whereKey($clientId);
        AreaVisibility::applyClientScope($q, $request->user());
        if (!$q->exists()) {
            abort(422, 'Cliente fuera del alcance de su usuario.');
        }
    }
}
