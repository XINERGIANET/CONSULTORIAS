<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountReceivable;
use App\Models\Client;
use App\Models\ClientContract;
use App\Models\Project;
use App\Services\ContractBillingService;
use App\Support\AreaVisibility;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Project::query()->with(['client:id,legal_name', 'areas:id,name', 'leadUser:id,name', 'services:id,name,kind,billing_cycle,base_price']);
        AreaVisibility::applyProjectScope($q, $request->user());

        if ($request->filled('area_id')) {
            $aid = (int) $request->input('area_id');
            $q->whereHas('areas', fn ($b) => $b->where('areas.id', $aid));
        }
        if ($request->filled('status')) {
            $q->where('status', $request->input('status'));
        }
        if ($request->filled('status_group')) {
            $group = $request->input('status_group');
            if ($group === 'active') {
                $q->whereIn('status', ['pending', 'in_progress', 'paused']);
            } elseif ($group === 'inactive') {
                $q->whereIn('status', ['finished', 'cancelled']);
            }
        }
        if ($request->filled('engagement_type')) {
            $q->where('engagement_type', $request->input('engagement_type'));
        }
        if ($request->filled('service_id')) {
            $sid = (int) $request->input('service_id');
            $q->whereHas('services', fn ($b) => $b->where('services.id', $sid));
        }

        if ($request->filled('q')) {
            $s = '%'.$request->string('q').'%';
            $q->where(function ($w) use ($s) {
                $w->where('name', 'like', $s)
                    ->orWhere('service_type', 'like', $s)
                    ->orWhereHas('client', fn ($c) => $c->where('legal_name', 'like', $s))
                    ->orWhereHas('services', fn ($svc) => $svc->where('name', 'like', $s));
            });
        }

        $sort = $request->string('sort', 'id')->toString();
        $allowed = ['id', 'name', 'status', 'start_date', 'created_at', 'client'];
        if (! in_array($sort, $allowed, true)) {
            $sort = 'id';
        }
        $dir = strtolower($request->string('dir', 'desc')->toString()) === 'asc' ? 'asc' : 'desc';
        if ($sort === 'client') {
            $q->select('projects.*')
                ->leftJoin('clients', 'clients.id', '=', 'projects.client_id')
                ->orderBy('clients.legal_name', $dir)
                ->orderByDesc('projects.id');
        } else {
            $q->orderBy($sort, $dir);
        }

        $perPage = max(5, min(100, (int) $request->input('per_page', 30)));

        return response()->json($q->paginate($perPage));
    }

    public function show(Request $request, Project $project): JsonResponse
    {
        $this->assertProject($request, $project);

        return response()->json($project->load(['client', 'areas', 'users', 'leadUser', 'services']));
    }

    public function store(Request $request, ContractBillingService $billing): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'engagement_type' => ['nullable', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:255'],
            'service_type' => ['nullable', 'string', 'max:255'],
            'start_date' => ['required', 'date'],
            'payment_start_date' => ['nullable', 'date'],
            'end_estimated' => ['required', 'date', 'after_or_equal:start_date'],
            'end_actual' => ['nullable', 'date'],
            'status' => ['nullable', 'string', 'max:64'],
            'subscription_status' => ['nullable', 'string', 'max:64'],
            'renewal_date' => ['nullable', 'date'],
            'budget' => ['required', 'numeric', 'min:0.01'],
            'billing_type' => ['nullable', 'string', 'in:mensual,anual,único,por partes'],
            'installments_count' => ['nullable', 'integer', 'min:1'],
            'lead_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'description' => ['nullable', 'string'],
            'objectives' => ['nullable', 'string'],
            'deliverables' => ['nullable', 'string'],
            'area_ids' => ['required', 'array', 'min:1'],
            'area_ids.*' => ['integer', 'exists:areas,id'],
            'user_ids' => ['sometimes', 'array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'service_ids' => ['sometimes', 'array'],
            'service_ids.*' => ['integer', 'exists:services,id'],
        ]);

        $this->assertClientVisible($request, (int) $data['client_id']);
        $aids = AreaVisibility::allowedAreaIdsOrFail($request->user(), $data['area_ids']);

        $project = DB::transaction(function () use ($data, $billing, $request, $aids) {
            $uids = $data['user_ids'] ?? [];
            $sids = $data['service_ids'] ?? [];
            $instCount = (int) ($data['installments_count'] ?? 2);
            unset($data['area_ids'], $data['user_ids'], $data['service_ids'], $data['installments_count']);

            $p = Project::query()->create($data);
            $p->areas()->sync($aids);
            $p->users()->sync($uids);
            $p->services()->sync($sids);

            $schedule = $this->computeBillingSchedule($p, $instCount);

            $billing->createContractAndSchedule(
                Client::query()->findOrFail($p->client_id),
                [
                    'client_id' => $p->client_id,
                    'area_id' => (int) $aids[0],
                    'project_id' => $p->id,
                    'title' => 'Proyecto — '.$p->name,
                    'total_amount' => $schedule['total'],
                    'installments_count' => $schedule['installments'],
                    'start_date' => $schedule['paymentStart']->toDateString(),
                    'first_due_on' => $schedule['paymentStart']->toDateString(),
                    'billing_frequency' => $schedule['frequency'],
                    'notes' => 'Cronograma generado automáticamente al crear el proyecto.',
                ],
                $request->user()?->id,
            );

            return $p;
        });

        return response()->json($project->load(['areas', 'users', 'services']), 201);
    }

    public function update(Request $request, Project $project): JsonResponse
    {
        $this->assertProject($request, $project);
        $data = $request->validate([
            'client_id' => ['sometimes', 'required', 'integer', 'exists:clients,id'],
            'engagement_type' => ['nullable', 'string', 'max:64'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'service_type' => ['nullable', 'string', 'max:255'],
            'start_date' => ['nullable', 'date'],
            'payment_start_date' => ['nullable', 'date'],
            'end_estimated' => ['nullable', 'date'],
            'end_actual' => ['nullable', 'date'],
            'status' => ['nullable', 'string', 'max:64'],
            'subscription_status' => ['nullable', 'string', 'max:64'],
            'renewal_date' => ['nullable', 'date'],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'billing_type' => ['nullable', 'string', 'in:mensual,anual,único,por partes'],
            'installments_count' => ['nullable', 'integer', 'min:1'],
            'lead_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'description' => ['nullable', 'string'],
            'objectives' => ['nullable', 'string'],
            'deliverables' => ['nullable', 'string'],
            'area_ids' => ['sometimes', 'array', 'min:1'],
            'area_ids.*' => ['integer', 'exists:areas,id'],
            'user_ids' => ['sometimes', 'array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'service_ids' => ['sometimes', 'array'],
            'service_ids.*' => ['integer', 'exists:services,id'],
        ]);

        if (isset($data['client_id'])) {
            $this->assertClientVisible($request, (int) $data['client_id']);
        }
        $aids = isset($data['area_ids']) ? AreaVisibility::allowedAreaIdsOrFail($request->user(), $data['area_ids']) : null;

        DB::transaction(function () use ($project, $data, $aids) {
            $uids = $data['user_ids'] ?? null;
            $sids = $data['service_ids'] ?? null;
            $instCount = $data['installments_count'] ?? null;
            unset($data['area_ids'], $data['user_ids'], $data['service_ids'], $data['installments_count']);

            $scheduleFields = ['payment_start_date', 'start_date', 'end_estimated', 'billing_type', 'budget'];
            $scheduleChanged = array_intersect(array_keys($data), $scheduleFields) !== [] || $instCount !== null;

            $project->update($data);

            if ($scheduleChanged) {
                $this->resyncReceivableSchedule($project, $instCount);
            }

            if (is_array($aids)) {
                $project->areas()->sync($aids);
            }
            if (is_array($uids)) {
                $project->users()->sync($uids);
            }
            if (is_array($sids)) {
                $project->services()->sync($sids);
            }
        });

        return response()->json($project->fresh()->load(['areas', 'users', 'client', 'services']));
    }

    public function destroy(Request $request, Project $project): JsonResponse
    {
        $this->assertProject($request, $project);

        DB::transaction(function () use ($project) {
            $project->areas()->detach();
            $project->users()->detach();
            $project->services()->detach();
            $project->delete();
        });

        return response()->json(null, 204);
    }

    /**
     * Recalcula la cantidad de cuotas, monto y fechas segun los datos actuales del proyecto
     * (mismas reglas que al crearlo). No decide que hacer con lo ya generado, solo dice
     * "como deberia verse" el cronograma ahora mismo.
     *
     * @return array{frequency:string, installments:int, total:float, perInstallment:float, recurring:bool, paymentStart:Carbon}
     */
    private function computeBillingSchedule(Project $p, int $instCount): array
    {
        $start = Carbon::parse($p->start_date)->startOfDay();
        $paymentStart = $p->payment_start_date ? Carbon::parse($p->payment_start_date)->startOfDay() : $start->copy();
        $end = Carbon::parse($p->end_estimated)->startOfDay();

        $billingType = $p->billing_type ?? 'mensual';
        $frequency = 'monthly';
        $installments = 1;
        $recurring = false;

        if ($billingType === 'mensual') {
            $frequency = 'monthly';
            $installments = max(1, ((int) $paymentStart->copy()->startOfMonth()->diffInMonths($end->copy()->startOfMonth())) + 1);
            $recurring = true;
        } elseif ($billingType === 'anual') {
            $frequency = 'yearly';
            $installments = max(1, ((int) $paymentStart->diffInYears($end)) + 1);
            $recurring = true;
        } elseif ($billingType === 'único') {
            $frequency = 'monthly';
            $installments = 1;
        } elseif ($billingType === 'por partes') {
            $frequency = 'monthly';
            $installments = max(1, $instCount);
        }

        $perInstallment = round((float) $p->budget, 2);
        $total = $recurring ? round($perInstallment * $installments, 2) : $perInstallment;

        return [
            'frequency' => $frequency,
            'installments' => $installments,
            'total' => $total,
            'perInstallment' => $perInstallment,
            'recurring' => $recurring,
            'paymentStart' => $paymentStart,
        ];
    }

    /**
     * Si cambian fechas/monto/tipo de cobranza del proyecto, recalcula las cuentas por
     * cobrar. Las cuotas que ya tienen un pago registrado (paid_amount > 0) nunca se
     * tocan; solo se regeneran las cuotas todavia libres (pendientes, sin ningun abono).
     */
    private function resyncReceivableSchedule(Project $project, ?int $instCount = null): void
    {
        $contract = ClientContract::query()->where('project_id', $project->id)->latest('id')->first();
        if ($contract === null) {
            return;
        }

        $schedule = $this->computeBillingSchedule($project, $instCount ?? $contract->installments_count);

        $existing = AccountReceivable::query()
            ->where('project_id', $project->id)
            ->orderBy('installment_number')
            ->get();

        $locked = $existing->filter(fn (AccountReceivable $ar) => (float) $ar->paid_amount > 0)->values();
        $free = $existing->filter(fn (AccountReceivable $ar) => (float) $ar->paid_amount <= 0)->values();

        $lockedCount = $locked->count();
        $lockedTotal = (float) $locked->sum('total_amount');
        $targetInstallments = max($schedule['installments'], $lockedCount);

        foreach ($free as $ar) {
            $ar->delete();
        }

        $remaining = $targetInstallments - $lockedCount;
        $contractTotal = $lockedTotal;

        if ($remaining > 0) {
            $remainingTotal = $schedule['recurring']
                ? round($schedule['perInstallment'] * $remaining, 2)
                : max(0.0, round($schedule['total'] - $lockedTotal, 2));

            $base = round($remainingTotal / $remaining, 2);
            $rem = round($remainingTotal - ($base * $remaining), 2);
            $issuedOn = now()->toDateString();

            for ($i = 0; $i < $remaining; $i++) {
                $installmentIndex = $lockedCount + $i;
                $due = $schedule['frequency'] === 'yearly'
                    ? $schedule['paymentStart']->copy()->addYears($installmentIndex)
                    : $schedule['paymentStart']->copy()->addMonths($installmentIndex);
                $amount = $i === $remaining - 1 ? round($base + $rem, 2) : $base;

                AccountReceivable::query()->create([
                    'client_id' => $project->client_id,
                    'document_id' => $contract->document_id,
                    'client_contract_id' => $contract->id,
                    'project_id' => $project->id,
                    'area_id' => $contract->area_id,
                    'installment_number' => $installmentIndex + 1,
                    'total_amount' => $amount,
                    'paid_amount' => 0,
                    'balance_amount' => $amount,
                    'issued_on' => $issuedOn,
                    'due_on' => $due->toDateString(),
                    'projected_due_on' => $due->toDateString(),
                    'collected_on' => null,
                    'status' => 'pending',
                    'notes' => sprintf(
                        'Cuota %d/%d del contrato #%d — vencimiento proyectado %s (recalculada)',
                        $installmentIndex + 1,
                        $targetInstallments,
                        $contract->id,
                        $due->format('d/m/Y')
                    ),
                ]);
                $contractTotal += $amount;
            }
        }

        $lastDue = $targetInstallments > 0
            ? ($schedule['frequency'] === 'yearly'
                ? $schedule['paymentStart']->copy()->addYears($targetInstallments - 1)
                : $schedule['paymentStart']->copy()->addMonths($targetInstallments - 1))
            : $schedule['paymentStart']->copy();

        $contract->update([
            'total_amount' => round($contractTotal, 2),
            'installment_amount' => $schedule['perInstallment'],
            'installments_count' => $targetInstallments,
            'billing_frequency' => $schedule['frequency'],
            'start_date' => $schedule['paymentStart']->toDateString(),
            'first_due_on' => $schedule['paymentStart']->toDateString(),
            'end_date' => $lastDue->toDateString(),
        ]);
    }

    private function assertProject(Request $request, Project $project): void
    {
        $q = Project::query()->whereKey($project->id);
        AreaVisibility::applyProjectScope($q, $request->user());
        if (! $q->exists()) {
            abort(404);
        }
    }

    private function assertClientVisible(Request $request, int $clientId): void
    {
        $q = Client::query()->whereKey($clientId);
        AreaVisibility::applyClientScope($q, $request->user());
        if (! $q->exists()) {
            abort(404);
        }
    }
}
