<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountPayable;
use App\Models\Expense;
use App\Models\FinancialCategory;
use App\Support\AreaVisibility;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Expense::query()->with(['area:id,name', 'project:id,name', 'client:id,legal_name', 'financialCategory', 'responsibleUser:id,name']);
        $this->applyFinanceScope($q, $request);

        if ($request->filled('area_id')) {
            $q->where('area_id', (int) $request->input('area_id'));
        }
        if ($request->filled('project_id')) {
            $q->where('project_id', (int) $request->input('project_id'));
        }
        if ($request->filled('from')) {
            $q->whereDate('recorded_on', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $q->whereDate('recorded_on', '<=', $request->input('to'));
        }

        return response()->json($q->orderByDesc('recorded_on')->paginate(40));
    }

    public function show(Request $request, Expense $expense): JsonResponse
    {
        $this->assertExpense($request, $expense);

        return response()->json($expense->load(['client', 'project', 'area', 'financialCategory', 'responsibleUser']));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'financial_category_id' => ['required', 'integer', 'exists:financial_categories,id'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'amount' => ['required', 'numeric', 'min:0'],
            'recorded_on' => ['required', 'date'],
            'responsible_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'observation' => ['nullable', 'string'],
            'payment_method' => ['nullable', 'string', 'max:64'],
            'schedule_payable' => ['sometimes', 'boolean'],
            'payable_type' => ['nullable', 'string', 'in:supplier,payroll,other'],
            'payable_frequency' => ['nullable', 'string', 'in:one_time,monthly'],
            'vendor_name' => ['nullable', 'string', 'max:255'],
            'projected_due_on' => ['nullable', 'date'],
            'requires_invoice' => ['sometimes', 'boolean'],
            'payable_description' => ['nullable', 'string', 'max:500'],
        ]);

        $data['area_id'] = $this->resolveAreaId($request);
        $this->assertCostCategoryBelongsToArea((int) $data['financial_category_id'], (int) $data['area_id']);

        $schedule = $request->boolean('schedule_payable');
        $payableMeta = [
            'payable_type' => $request->input('payable_type', 'supplier'),
            'payable_frequency' => $request->input('payable_frequency', 'one_time'),
            'vendor_name' => $request->input('vendor_name'),
            'projected_due_on' => $request->input('projected_due_on') ?? $data['recorded_on'],
            'requires_invoice' => $request->boolean('requires_invoice'),
            'description' => $request->input('payable_description') ?? ($data['observation'] ?? 'Cuenta por pagar programada'),
        ];
        unset($data['schedule_payable'], $data['payable_type'], $data['payable_frequency'], $data['vendor_name'], $data['projected_due_on'], $data['requires_invoice'], $data['payable_description']);

        if ($schedule && $data['area_id']) {
            $payables = $this->createScheduledPayables($data, $payableMeta);

            return response()->json([
                'scheduled_payables' => $payables,
                'scheduled_payable' => $payables[0] ?? null,
            ], 201);
        }

        $expense = Expense::query()->create($data);

        return response()->json($expense, 201);
    }

    public function update(Request $request, Expense $expense): JsonResponse
    {
        $this->assertExpense($request, $expense);
        $data = $request->validate([
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'financial_category_id' => ['sometimes', 'required', 'integer', 'exists:financial_categories,id'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'amount' => ['sometimes', 'numeric', 'min:0'],
            'recorded_on' => ['sometimes', 'date'],
            'responsible_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'observation' => ['nullable', 'string'],
            'payment_method' => ['nullable', 'string', 'max:64'],
        ]);
        if (array_key_exists('area_id', $data)) {
            $data['area_id'] = $this->resolveAreaId($request);
        }
        if (array_key_exists('financial_category_id', $data) || array_key_exists('area_id', $data)) {
            $this->assertCostCategoryBelongsToArea(
                (int) ($data['financial_category_id'] ?? $expense->financial_category_id),
                (int) ($data['area_id'] ?? $expense->area_id)
            );
        }
        $expense->update($data);

        return response()->json($expense->fresh()->load(['area', 'project']));
    }

    public function destroy(Request $request, Expense $expense): JsonResponse
    {
        $this->assertExpense($request, $expense);
        $expense->delete();

        return response()->json(null, 204);
    }

    private function assertExpense(Request $request, Expense $expense): void
    {
        $q = Expense::query()->whereKey($expense->id);
        $this->applyFinanceScope($q, $request);
        if (! $q->exists()) {
            abort(404);
        }
    }

    private function resolveAreaId(Request $request): int
    {
        $user = $request->user();
        if ($user === null) {
            abort(401);
        }

        if ($user->isSuperadmin()) {
            $areaId = $request->integer('area_id');
            if ($areaId <= 0) {
                abort(422, 'Seleccione la empresa del costo.');
            }

            return $areaId;
        }

        $areaId = $user->areas()->first()?->id;
        if ($areaId === null) {
            abort(422, 'Tu usuario no tiene empresa asignada.');
        }

        return (int) $areaId;
    }

    private function assertCostCategoryBelongsToArea(int $categoryId, int $areaId): void
    {
        $category = FinancialCategory::query()->find($categoryId);
        if ($category === null || $category->type !== 'expense' || ! $category->is_active) {
            abort(422, 'Seleccione una categoria de costos valida.');
        }

        if ((int) $category->area_id !== $areaId) {
            abort(422, 'La categoria de costos no pertenece a la empresa seleccionada.');
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $payableMeta
     * @return list<AccountPayable>
     */
    private function createScheduledPayables(array $data, array $payableMeta): array
    {
        $frequency = (string) ($payableMeta['payable_frequency'] ?? 'one_time');
        $start = Carbon::parse((string) $data['recorded_on'])->startOfDay();
        $end = Carbon::parse((string) $payableMeta['projected_due_on'])->startOfDay();

        $dueDates = [$end->copy()];
        if ($frequency === 'monthly' && $end->greaterThan($start)) {
            $dueDates = [];
            $cursor = $start->copy()->addMonthNoOverflow();
            while ($cursor->lessThan($end)) {
                $dueDates[] = $cursor->copy();
                $cursor->addMonthNoOverflow();
            }
            $dueDates[] = $end->copy();
        }

        $total = round((float) $data['amount'], 2);
        $count = max(1, count($dueDates));
        $baseAmount = round($total / $count, 2);
        $remainder = round($total - ($baseAmount * $count), 2);
        $description = (string) $payableMeta['description'];

        return DB::transaction(function () use ($data, $payableMeta, $dueDates, $baseAmount, $remainder, $description, $count, $frequency): array {
            $created = [];
            foreach ($dueDates as $index => $dueDate) {
                $amount = $baseAmount;
                if ($index === $count - 1) {
                    $amount = round($baseAmount + $remainder, 2);
                }

                $created[] = AccountPayable::query()->create([
                    'payable_type' => $payableMeta['payable_type'],
                    'vendor_name' => $payableMeta['vendor_name'],
                    'user_id' => $data['responsible_user_id'] ?? null,
                    'area_id' => $data['area_id'],
                    'project_id' => $data['project_id'] ?? null,
                    'financial_category_id' => $data['financial_category_id'],
                    'total_amount' => $amount,
                    'paid_amount' => 0,
                    'balance_amount' => $amount,
                    'projected_due_on' => $dueDate->toDateString(),
                    'requires_invoice' => $payableMeta['requires_invoice'],
                    'status' => 'pending',
                    'description' => $count > 1 ? sprintf('%s - cuota %d/%d', $description, $index + 1, $count) : $description,
                    'notes' => $frequency === 'monthly'
                        ? 'Programada desde movimiento con frecuencia mensual (sin egreso inmediato).'
                        : 'Programada desde movimiento (sin egreso inmediato).',
                    'period_year' => (int) $dueDate->format('Y'),
                    'period_month' => (int) $dueDate->format('m'),
                ]);
            }

            return $created;
        });
    }

    private function applyFinanceScope($q, Request $request): void
    {
        $user = $request->user();
        if ($user === null) {
            abort(401);
        }

        if ($user->isSuperadmin()) {
            return;
        }

        $ids = AreaVisibility::userAreaIds($user);
        if ($ids === []) {
            $q->whereRaw('1 = 0');

            return;
        }

        $q->whereIn('area_id', $ids);
    }
}
