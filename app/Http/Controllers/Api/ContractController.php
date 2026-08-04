<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientContract;
use App\Models\Project;
use App\Services\ContractBillingService;
use App\Support\AreaVisibility;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ContractController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // Auto update expired contracts
        ClientContract::query()
            ->where('status', 'active')
            ->whereNotNull('end_date')
            ->whereDate('end_date', '<', now()->toDateString())
            ->update(['status' => 'expired']);

        $q = ClientContract::query()
            ->with(['client:id,legal_name', 'project:id,name', 'area:id,name', 'receivables'])
            ->withCount('receivables');

        if ($request->user()) {
            AreaVisibility::applyClientScope($q, $request->user());
        }

        if ($request->filled('project_id')) {
            $q->where('project_id', (int) $request->input('project_id'));
        }

        if ($request->filled('client_id')) {
            $q->where('client_id', (int) $request->input('client_id'));
        }

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $q->where('status', $request->input('status'));
        }

        if ($request->filled('q')) {
            $s = '%'.$request->string('q').'%';
            $q->where(function ($sub) use ($s) {
                $sub->where('title', 'like', $s)
                    ->orWhereHas('client', fn ($c) => $c->where('legal_name', 'like', $s))
                    ->orWhereHas('project', fn ($p) => $p->where('name', 'like', $s));
            });
        }

        $sort = $request->string('sort', 'id')->toString();
        $dir = strtolower($request->string('dir', 'desc')->toString()) === 'asc' ? 'asc' : 'desc';

        if (in_array($sort, ['id', 'title', 'total_amount', 'start_date', 'end_date', 'status'], true)) {
            $q->orderBy($sort, $dir);
        } else {
            $q->orderByDesc('id');
        }

        $perPage = max(5, min(100, (int) $request->input('per_page', 30)));
        $paginated = $q->paginate($perPage);

        $today = now()->startOfDay();
        $paginated->getCollection()->transform(function (ClientContract $contract) use ($today) {
            if ($contract->end_date) {
                $endDate = Carbon::parse($contract->end_date)->startOfDay();
                $contract->dias_restantes = (int) $today->diffInDays($endDate, false);
            } else {
                $contract->dias_restantes = null;
            }

            return $contract;
        });

        return response()->json($paginated);
    }

    public function show(Request $request, ClientContract $contract): JsonResponse
    {
        $this->assertContractVisible($request, $contract);

        return response()->json($contract->load([
            'client',
            'project',
            'area',
            'document',
            'receivables',
        ]));
    }

    public function store(Request $request, ContractBillingService $billing): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'area_id' => ['required', 'integer', 'exists:areas,id'],
            'title' => ['required', 'string', 'max:255'],
            'total_amount' => ['required', 'numeric', 'min:0.01'],
            'installments_count' => ['nullable', 'integer', 'min:1'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'first_due_on' => ['required', 'date'],
            'billing_frequency' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'custom_schedule' => ['nullable', 'array', 'min:1'],
            'custom_schedule.*.due_on' => ['required', 'date'],
            'custom_schedule.*.amount' => ['required', 'numeric', 'min:0.01'],
            'custom_schedule.*.notes' => ['nullable', 'string', 'max:255'],
        ]);

        $client = Client::query()->findOrFail($data['client_id']);

        if (! empty($data['custom_schedule'])) {
            $contract = $billing->createContractAndCustomSchedule(
                $client,
                $data,
                $data['custom_schedule'],
                $request->user()?->id
            );
        } else {
            $data['installments_count'] = $data['installments_count'] ?? 1;
            $contract = $billing->createContractAndSchedule(
                $client,
                $data,
                $request->user()?->id
            );
        }

        return response()->json($contract->load(['client', 'project', 'area', 'receivables']), 201);
    }

    public function generatePdf(Request $request, ClientContract $contract): Response
    {
        $this->assertContractVisible($request, $contract);

        $contract->load([
            'client',
            'project',
            'area',
            'receivables' => fn ($q) => $q->orderBy('installment_number'),
        ]);

        $pdf = Pdf::loadView('pdf.contract', compact('contract'));
        $filename = sprintf('Contrato_%s_%d.pdf', preg_replace('/[^A-Za-z0-9_-]/', '_', $contract->client?->legal_name ?? 'Cliente'), $contract->id);

        if ($request->boolean('stream')) {
            return $pdf->stream($filename);
        }

        return $pdf->download($filename);
    }

    public function renew(Request $request, ClientContract $contract, ContractBillingService $billing): JsonResponse
    {
        $this->assertContractVisible($request, $contract);

        $data = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'first_due_on' => ['required', 'date'],
            'total_amount' => ['required', 'numeric', 'min:0.01'],
            'installments_count' => ['nullable', 'integer', 'min:1'],
            'notes' => ['nullable', 'string'],
            'custom_schedule' => ['nullable', 'array', 'min:1'],
            'custom_schedule.*.due_on' => ['required', 'date'],
            'custom_schedule.*.amount' => ['required', 'numeric', 'min:0.01'],
            'custom_schedule.*.notes' => ['nullable', 'string', 'max:255'],
        ]);

        $contract->update(['status' => 'renewed']);

        $client = Client::query()->findOrFail($contract->client_id);
        $title = 'Renovación de Contrato #'.$contract->id.' — '.($contract->project?->name ?? $contract->title);

        $payload = array_merge($data, [
            'client_id' => $contract->client_id,
            'project_id' => $contract->project_id,
            'area_id' => $contract->area_id,
            'title' => $title,
            'notes' => trim(($data['notes'] ?? '')."\nRenovación directa del contrato #".$contract->id),
        ]);

        if (! empty($data['custom_schedule'])) {
            $newContract = $billing->createContractAndCustomSchedule(
                $client,
                $payload,
                $data['custom_schedule'],
                $request->user()?->id
            );
        } else {
            $payload['installments_count'] = $data['installments_count'] ?? 1;
            $newContract = $billing->createContractAndSchedule(
                $client,
                $payload,
                $request->user()?->id
            );
        }

        return response()->json([
            'message' => 'El contrato se renovó exitosamente.',
            'previous_contract_id' => $contract->id,
            'new_contract' => $newContract->load(['client', 'project', 'area', 'receivables']),
        ]);
    }

    private function assertContractVisible(Request $request, ClientContract $contract): void
    {
        $q = ClientContract::query()->whereKey($contract->id);
        if ($request->user()) {
            AreaVisibility::applyClientScope($q, $request->user());
        }
        if (! $q->exists()) {
            abort(404);
        }
    }
}
