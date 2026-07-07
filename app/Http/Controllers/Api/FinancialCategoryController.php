<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\AuthorizesPrivileged;
use App\Models\FinancialCategory;
use App\Support\AreaVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinancialCategoryController extends Controller
{
    use AuthorizesPrivileged;

    public function index(Request $request): JsonResponse
    {
        $q = FinancialCategory::query()->with('area:id,name')->orderBy('type')->orderBy('name');
        if ($request->filled('type')) {
            $q->where('type', $request->input('type'));
        }
        $user = $request->user();
        if ($request->filled('area_id')) {
            $areaId = AreaVisibility::resolveAreaIdOrFail($user, $request->input('area_id'));
            $q->where(function ($w) use ($areaId): void {
                $w->where('area_id', $areaId)->orWhereNull('area_id');
            });
        } elseif ($request->input('type') === 'expense' && $user !== null && ! $user->isSuperadmin()) {
            $areaIds = AreaVisibility::userAreaIds($user);
            $q->where(function ($w) use ($areaIds): void {
                $w->whereIn('area_id', $areaIds)->orWhereNull('area_id');
            });
        }

        return response()->json($q->get());
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->authorizePrivileged($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'in:income,expense'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $data['area_id'] = $data['type'] === 'expense' ? AreaVisibility::resolveAreaIdOrFail($user, $data['area_id'] ?? null) : null;
        if ($data['type'] === 'expense' && $data['area_id'] === null) {
            abort(422, 'Seleccione la empresa para la categoria de costos.');
        }

        return response()->json(FinancialCategory::query()->create($data), 201);
    }

    public function update(Request $request, FinancialCategory $financialCategory): JsonResponse
    {
        $user = $this->authorizePrivileged($request);
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'type' => ['sometimes', 'required', 'string', 'in:income,expense'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $type = $data['type'] ?? $financialCategory->type;
        if ($type === 'income') {
            $data['area_id'] = null;
        } else {
            $data['area_id'] = AreaVisibility::resolveAreaIdOrFail($user, $data['area_id'] ?? $financialCategory->area_id);
        }
        $areaId = (int) ($data['area_id'] ?? $financialCategory->area_id);
        if ($type === 'expense' && ! $user->isSuperadmin()) {
            $areaIds = AreaVisibility::userAreaIds($user);
            if (! in_array($areaId, $areaIds, true)) {
                abort(403, 'No puedes editar categorias de costos de otra empresa.');
            }
        }
        $financialCategory->update($data);

        return response()->json($financialCategory->fresh()->load('area:id,name'));
    }

    public function destroy(Request $request, FinancialCategory $financialCategory): JsonResponse
    {
        $user = $this->authorizePrivileged($request);
        if ($financialCategory->type === 'expense') {
            AreaVisibility::resolveAreaIdOrFail($user, $financialCategory->area_id);
        }
        $financialCategory->update(['is_active' => false]);

        return response()->json(null, 204);
    }
}
