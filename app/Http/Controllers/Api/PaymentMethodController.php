<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesPrivileged;
use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use App\Support\AreaVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentMethodController extends Controller
{
    use AuthorizesPrivileged;

    public function index(Request $request): JsonResponse
    {
        $q = PaymentMethod::query()->with('area:id,name')->orderBy('name');

        if ($request->boolean('active_only', true)) {
            $q->where('is_active', true);
        }

        $user = $request->user();
        if ($request->filled('area_id')) {
            $areaId = AreaVisibility::resolveAreaIdOrFail($user, $request->input('area_id'));
            $q->where('area_id', $areaId);
        } elseif ($user !== null && ! $user->isSuperadmin()) {
            $areaIds = AreaVisibility::userAreaIds($user);
            $q->whereIn('area_id', $areaIds);
        }

        return response()->json($q->get());
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->authorizePrivileged($request);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:255'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $data['area_id'] = AreaVisibility::resolveAreaIdOrFail($user, $data['area_id'] ?? null);
        if ($data['area_id'] === null) {
            abort(422, 'Seleccione la empresa para el metodo de pago.');
        }

        if (PaymentMethod::query()->where('area_id', $data['area_id'])->where('code', $data['code'])->exists()) {
            abort(422, 'Ya existe un metodo de pago con ese codigo para esta empresa.');
        }

        return response()->json(PaymentMethod::query()->create($data), 201);
    }

    public function update(Request $request, PaymentMethod $paymentMethod): JsonResponse
    {
        $user = $this->authorizePrivileged($request);

        $data = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:64'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $data['area_id'] = AreaVisibility::resolveAreaIdOrFail($user, $data['area_id'] ?? $paymentMethod->area_id);
        $areaId = (int) $data['area_id'];
        if (! $user->isSuperadmin()) {
            $areaIds = AreaVisibility::userAreaIds($user);
            if (! in_array($areaId, $areaIds, true)) {
                abort(403, 'No puedes editar metodos de pago de otra empresa.');
            }
        }

        $code = $data['code'] ?? $paymentMethod->code;
        $conflict = PaymentMethod::query()
            ->where('area_id', $areaId)
            ->where('code', $code)
            ->where('id', '!=', $paymentMethod->id)
            ->exists();
        if ($conflict) {
            abort(422, 'Ya existe un metodo de pago con ese codigo para esta empresa.');
        }

        $paymentMethod->update($data);

        return response()->json($paymentMethod->fresh()->load('area:id,name'));
    }

    public function destroy(Request $request, PaymentMethod $paymentMethod): JsonResponse
    {
        $user = $this->authorizePrivileged($request);
        if ($paymentMethod->area_id !== null) {
            AreaVisibility::resolveAreaIdOrFail($user, $paymentMethod->area_id);
        }
        $paymentMethod->update(['is_active' => false]);

        return response()->json(null, 204);
    }
}
