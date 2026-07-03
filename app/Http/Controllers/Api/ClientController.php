<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Services\ContractBillingService;
use App\Support\AreaVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ClientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Client::query()->with('areas:id,name,slug')->whereNull('deactivated_at');
        AreaVisibility::applyClientScope($q, $request->user());

        if ($request->filled('area_id')) {
            $areaId = (int) $request->input('area_id');
            $q->whereHas('areas', fn ($b) => $b->where('areas.id', $areaId));
        }

        if ($request->filled('q')) {
            $s = '%'.$request->string('q').'%';
            $q->where(function ($w) use ($s) {
                $w->where('legal_name', 'like', $s)->orWhere('trade_name', 'like', $s)->orWhere('ruc', 'like', $s);
            });
        }

        $perPage = (int) $request->input('per_page', 30);

        return response()->json($q->orderByDesc('id')->paginate(max(5, min(200, $perPage))));
    }

    public function show(Request $request, Client $client): JsonResponse
    {
        $this->assertClientScope($request, $client);

        $user = $request->user();

        return response()->json($client->load([
            'areas',
            'locations',
            'contacts.area',
            'crmActivities' => fn ($r) => $r->orderByDesc('occurred_at')->limit(100),
            'opportunities',
            'projects' => function ($r) use ($user) {
                $r->with(['areas:id,name', 'services:id,name,kind,billing_cycle,base_price'])
                    ->where('status', '!=', 'cancelled')
                    ->orderByDesc('id')
                    ->limit(50);
                if (!\App\Support\AreaVisibility::canSeeAll($user)) {
                    $ids = \App\Support\AreaVisibility::userAreaIds($user);
                    $r->whereHas('areas', fn ($b) => $b->whereIn('areas.id', $ids));
                }
            },
        ]));
    }

    public function store(Request $request, ContractBillingService $billing): JsonResponse
    {
        $data = $request->validate([
            'legal_name' => ['required', 'string', 'max:255'],
            'trade_name' => ['nullable', 'string', 'max:255'],
            'ruc' => ['nullable', 'string', 'max:32'],
            'address' => ['nullable', 'string', 'max:500'],
            'phone' => ['nullable', 'string', 'max:64'],
            'email' => ['nullable', 'email', 'max:255'],
            'sector' => ['nullable', 'string', 'max:255'],
            'company_size' => ['nullable', 'string', 'max:255'],
            'client_type' => ['nullable', 'string', 'max:255'],
            'industry' => ['nullable', 'string', 'max:255'],
            'rubro' => ['nullable', 'string', 'max:255'],
            'pipeline_stage' => ['nullable', 'string', 'in:lead,prospect,active_client'],
            'presentation_date' => ['nullable', 'date'],
            'tentative_response_date' => ['nullable', 'date'],
            'is_active' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string'],
            'billing' => ['sometimes', 'array'],
            'billing.activate' => ['sometimes', 'boolean'],
            'billing.total_amount' => ['required_with:billing.activate', 'numeric', 'min:0.01'],
            'billing.installments_count' => ['required_with:billing.activate', 'integer', 'min:1', 'max:360'],
            'billing.start_date' => ['required_with:billing.activate', 'date'],
            'billing.first_due_on' => ['required_with:billing.activate', 'date'],
            'billing.area_id' => ['required_with:billing.activate', 'integer', 'exists:areas,id'],
            'billing.project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'billing.title' => ['nullable', 'string', 'max:255'],
            'billing.notes' => ['nullable', 'string'],
        ]);

        $billingPayload = $data['billing'] ?? null;
        unset($data['billing']);

        $client = DB::transaction(function () use ($data, $request, $billing, $billingPayload) {
            $areaIds = $request->user()->areas()->pluck('areas.id')->toArray();
            $c = Client::query()->create($data);
            $c->areas()->sync($areaIds);

            if (! empty($billingPayload['activate'])) {
                $billing->createContractAndSchedule($c, [
                    'client_id' => $c->id,
                    'area_id' => (int) $billingPayload['area_id'],
                    'project_id' => $billingPayload['project_id'] ?? null,
                    'title' => $billingPayload['title'] ?? null,
                    'total_amount' => $billingPayload['total_amount'],
                    'installments_count' => (int) $billingPayload['installments_count'],
                    'start_date' => $billingPayload['start_date'],
                    'first_due_on' => $billingPayload['first_due_on'],
                    'notes' => $billingPayload['notes'] ?? null,
                ], $request->user()?->id);
            }

            return $c;
        });

        return response()->json($client->load(['areas', 'contracts.receivables']), 201);
    }

    public function update(Request $request, Client $client, ContractBillingService $billing): JsonResponse
    {
        $this->assertClientScope($request, $client);
        $data = $request->validate([
            'legal_name' => ['sometimes', 'required', 'string', 'max:255'],
            'trade_name' => ['nullable', 'string', 'max:255'],
            'ruc' => ['nullable', 'string', 'max:32'],
            'address' => ['nullable', 'string', 'max:500'],
            'phone' => ['nullable', 'string', 'max:64'],
            'email' => ['nullable', 'email', 'max:255'],
            'sector' => ['nullable', 'string', 'max:255'],
            'company_size' => ['nullable', 'string', 'max:255'],
            'client_type' => ['nullable', 'string', 'max:255'],
            'industry' => ['nullable', 'string', 'max:255'],
            'rubro' => ['nullable', 'string', 'max:255'],
            'pipeline_stage' => ['nullable', 'string', 'in:lead,prospect,active_client'],
            'presentation_date' => ['nullable', 'date'],
            'tentative_response_date' => ['nullable', 'date'],
            'is_active' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string'],
            'billing' => ['sometimes', 'array'],
            'billing.activate' => ['sometimes', 'boolean'],
            'billing.total_amount' => ['required_with:billing.activate', 'numeric', 'min:0.01'],
            'billing.installments_count' => ['required_with:billing.activate', 'integer', 'min:1', 'max:360'],
            'billing.start_date' => ['required_with:billing.activate', 'date'],
            'billing.first_due_on' => ['required_with:billing.activate', 'date'],
            'billing.area_id' => ['required_with:billing.activate', 'integer', 'exists:areas,id'],
            'billing.project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'billing.title' => ['nullable', 'string', 'max:255'],
            'billing.notes' => ['nullable', 'string'],
        ]);

        $billingPayload = $data['billing'] ?? null;
        unset($data['billing']);

        DB::transaction(function () use ($client, $data, $request, $billing, $billingPayload) {
            $client->update($data);

            $shouldBill = ! empty($billingPayload['activate']);
            $isActive = ($data['pipeline_stage'] ?? $client->pipeline_stage) === 'active_client';

            if ($shouldBill && $isActive && ! $client->contracts()->where('status', 'active')->exists()) {
                $billing->createContractAndSchedule($client, [
                    'client_id' => $client->id,
                    'area_id' => (int) $billingPayload['area_id'],
                    'project_id' => $billingPayload['project_id'] ?? null,
                    'title' => $billingPayload['title'] ?? null,
                    'total_amount' => $billingPayload['total_amount'],
                    'installments_count' => (int) $billingPayload['installments_count'],
                    'start_date' => $billingPayload['start_date'],
                    'first_due_on' => $billingPayload['first_due_on'],
                    'notes' => $billingPayload['notes'] ?? null,
                ], $request->user()?->id);
            }
        });

        return response()->json($client->fresh()->load(['areas', 'contracts.receivables']));
    }

    public function destroy(Request $request, Client $client): JsonResponse
    {
        $this->assertClientScope($request, $client);
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);
        $client->update([
            'is_active' => false,
            'deactivation_reason' => $data['reason'],
            'deactivated_at' => now(),
            'deactivated_by' => $request->user()?->id,
        ]);

        return response()->json(null, 204);
    }

    public function searchRuc(string $ruc): JsonResponse
    {
        $response = Http::withToken((string) config('apireniec.key'))
            ->timeout(15)
            ->post((string) config('apireniec.ruc_url'), [
                'ruc' => $ruc,
            ]);

        if (! $response->successful()) {
            return response()->json([
                'error' => 'No se pudo consultar el RUC',
                'details' => $response->json(),
            ], $response->status());
        }

        $data = (array) $response->json();
        $estado = (bool) ($data['success'] ?? false);
        $resultado = (array) ($data['data'] ?? []);

        if ($estado) {
            $resultado['razon_social'] = $resultado['razon_social'] ?? ($resultado['nombre_o_razon_social'] ?? null);
            $resultado['direccion'] = $resultado['direccion'] ?? ($resultado['direccion_completa'] ?? null);
        }

        return response()->json([
            'estado' => $estado,
            'resultado' => $resultado,
        ]);
    }

    public function searchDni(string $dni): JsonResponse
    {
        $response = Http::withToken((string) config('apireniec.key'))
            ->timeout(15)
            ->post((string) config('apireniec.url'), [
                'dni' => $dni,
            ]);

        if (! $response->successful()) {
            return response()->json([
                'error' => 'No se pudo consultar el DNI',
                'details' => $response->json(),
            ], $response->status());
        }

        $data = (array) $response->json();
        $estado = (bool) ($data['success'] ?? false);
        $resultado = (array) ($data['data'] ?? []);

        return response()->json([
            'estado' => $estado,
            'resultado' => $resultado,
        ]);
    }

    private function assertClientScope(Request $request, Client $client): void
    {
        $q = Client::query()->whereKey($client->id);
        AreaVisibility::applyClientScope($q, $request->user());
        if (! $q->exists()) {
            abort(404);
        }
    }
}
