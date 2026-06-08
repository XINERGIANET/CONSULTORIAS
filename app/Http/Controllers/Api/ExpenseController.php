<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountPayable;
use App\Models\Expense;
use App\Support\AreaVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Expense::query()->with(['area:id,name', 'project:id,name', 'client:id,legal_name', 'financialCategory', 'responsibleUser:id,name']);
        AreaVisibility::applyExpenseScope($q, $request->user());

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
            'amount' => ['required', 'numeric', 'min:0'],
            'recorded_on' => ['required', 'date'],
            'responsible_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'observation' => ['nullable', 'string'],
            'schedule_payable' => ['sometimes', 'boolean'],
            'payable_type' => ['nullable', 'string', 'in:supplier,payroll,other'],
            'vendor_name' => ['nullable', 'string', 'max:255'],
            'projected_due_on' => ['nullable', 'date'],
            'requires_invoice' => ['sometimes', 'boolean'],
            'payable_description' => ['nullable', 'string', 'max:500'],
        ]);

        $data['area_id'] = $request->user()->areas()->first()?->id;

        $schedule = $request->boolean('schedule_payable');
        $payableMeta = [
            'payable_type' => $request->input('payable_type', 'supplier'),
            'vendor_name' => $request->input('vendor_name'),
            'projected_due_on' => $request->input('projected_due_on') ?? $data['recorded_on'],
            'requires_invoice' => $request->boolean('requires_invoice'),
            'description' => $request->input('payable_description') ?? ($data['observation'] ?? 'Cuenta por pagar programada'),
        ];
        unset($data['schedule_payable'], $data['payable_type'], $data['vendor_name'], $data['projected_due_on'], $data['requires_invoice'], $data['payable_description']);

        if ($schedule && $data['area_id']) {
            $payable = AccountPayable::query()->create([
                'payable_type' => $payableMeta['payable_type'],
                'vendor_name' => $payableMeta['vendor_name'],
                'user_id' => $data['responsible_user_id'] ?? null,
                'area_id' => $data['area_id'],
                'project_id' => $data['project_id'] ?? null,
                'total_amount' => $data['amount'],
                'paid_amount' => 0,
                'balance_amount' => $data['amount'],
                'projected_due_on' => $payableMeta['projected_due_on'],
                'requires_invoice' => $payableMeta['requires_invoice'],
                'status' => 'pending',
                'description' => $payableMeta['description'],
                'notes' => 'Programada desde movimiento (sin egreso inmediato).',
            ]);

            return response()->json(['scheduled_payable' => $payable], 201);
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
            'amount' => ['sometimes', 'numeric', 'min:0'],
            'recorded_on' => ['sometimes', 'date'],
            'responsible_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'observation' => ['nullable', 'string'],
        ]);
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
        AreaVisibility::applyExpenseScope($q, $request->user());
        if (! $q->exists()) {
            abort(404);
        }
    }
}
