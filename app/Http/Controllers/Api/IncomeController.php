<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FinancialCategory;
use App\Models\Income;
use App\Support\AreaVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IncomeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Income::query()->with(['client:id,legal_name', 'project:id,name', 'area:id,name', 'financialCategory', 'quotation']);
        $this->applyFinanceScope($q, $request);

        if ($request->filled('area_id')) {
            $q->where('area_id', (int) $request->input('area_id'));
        }
        if ($request->filled('client_id')) {
            $q->where('client_id', (int) $request->input('client_id'));
        }
        if ($request->filled('project_id')) {
            $q->where('project_id', (int) $request->input('project_id'));
        }
        if ($request->filled('payment_status')) {
            $q->where('payment_status', $request->input('payment_status'));
        }
        if ($request->filled('from')) {
            $q->whereDate('recorded_on', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $q->whereDate('recorded_on', '<=', $request->input('to'));
        }

        return response()->json($q->orderByDesc('recorded_on')->paginate(40));
    }

    public function show(Request $request, Income $income): JsonResponse
    {
        $this->assertIncome($request, $income);

        return response()->json($income->load(['client', 'project', 'area', 'financialCategory', 'quotation']));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'financial_category_id' => ['required', 'integer', 'exists:financial_categories,id'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'amount' => ['required', 'numeric', 'min:0'],
            'recorded_on' => ['required', 'date'],
            'payment_status' => ['nullable', 'string', 'max:64'],
            'quotation_id' => ['nullable', 'integer', 'exists:quotations,id'],
            'description' => ['nullable', 'string'],
        ]);
        $data['area_id'] = $this->resolveAreaId($request);
        $this->assertIncomeCategory((int) $data['financial_category_id']);

        return response()->json(Income::query()->create($data), 201);
    }

    public function update(Request $request, Income $income): JsonResponse
    {
        $this->assertIncome($request, $income);
        $data = $request->validate([
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'financial_category_id' => ['sometimes', 'required', 'integer', 'exists:financial_categories,id'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'amount' => ['sometimes', 'numeric', 'min:0'],
            'recorded_on' => ['sometimes', 'date'],
            'payment_status' => ['nullable', 'string', 'max:64'],
            'quotation_id' => ['nullable', 'integer', 'exists:quotations,id'],
            'description' => ['nullable', 'string'],
        ]);
        if (array_key_exists('area_id', $data)) {
            $data['area_id'] = $this->resolveAreaId($request);
        }
        if (array_key_exists('financial_category_id', $data)) {
            $this->assertIncomeCategory((int) $data['financial_category_id']);
        }
        $income->update($data);

        return response()->json($income->fresh()->load(['client', 'project', 'area']));
    }

    public function destroy(Request $request, Income $income): JsonResponse
    {
        $this->assertIncome($request, $income);
        $income->update(['payment_status' => 'annulled']);

        return response()->json(null, 204);
    }

    private function assertIncome(Request $request, Income $income): void
    {
        $q = Income::query()->whereKey($income->id);
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
                abort(422, 'Seleccione la empresa del ingreso.');
            }

            return $areaId;
        }

        $areaId = $user->areas()->first()?->id;
        if ($areaId === null) {
            abort(422, 'Tu usuario no tiene empresa asignada.');
        }

        return (int) $areaId;
    }

    private function assertIncomeCategory(int $categoryId): void
    {
        $category = FinancialCategory::query()->find($categoryId);
        if ($category === null || $category->type !== 'income') {
            abort(422, 'Seleccione una categoria de ingresos valida.');
        }
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
