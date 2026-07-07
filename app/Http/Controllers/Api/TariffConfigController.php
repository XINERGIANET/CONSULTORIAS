<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\AuthorizesPrivileged;
use App\Models\TariffConfig;
use App\Support\AreaVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TariffConfigController extends Controller
{
    use AuthorizesPrivileged;

    public function index(Request $request): JsonResponse
    {
        $q = TariffConfig::query()->with(['currency', 'area'])->orderBy('name');
        if ($request->user() !== null && ! $request->user()->isSuperadmin()) {
            $q->whereIn('area_id', AreaVisibility::userAreaIds($request->user()));
        }

        return response()->json($q->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePrivileged($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'rate_type' => ['required', 'string', 'max:64'],
            'amount' => ['required', 'numeric', 'min:0'],
            'currency_id' => ['nullable', 'integer', 'exists:currencies,id'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        if (array_key_exists('area_id', $data) && $data['area_id'] !== null) {
            $data['area_id'] = AreaVisibility::resolveAreaIdOrFail($request->user(), $data['area_id']);
        } elseif (! $request->user()->isSuperadmin()) {
            $data['area_id'] = AreaVisibility::resolveAreaIdOrFail($request->user(), null);
        }

        return response()->json(TariffConfig::query()->create($data), 201);
    }

    public function update(Request $request, TariffConfig $tariffConfig): JsonResponse
    {
        $this->authorizePrivileged($request);
        if (! $request->user()->isSuperadmin() && $tariffConfig->area_id !== null) {
            AreaVisibility::resolveAreaIdOrFail($request->user(), $tariffConfig->area_id);
        }
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'rate_type' => ['sometimes', 'required', 'string', 'max:64'],
            'amount' => ['sometimes', 'numeric', 'min:0'],
            'currency_id' => ['nullable', 'integer', 'exists:currencies,id'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        if (array_key_exists('area_id', $data)) {
            $data['area_id'] = AreaVisibility::resolveAreaIdOrFail($request->user(), $data['area_id']);
        }
        $tariffConfig->update($data);

        return response()->json($tariffConfig->fresh()->load(['currency', 'area']));
    }

    public function destroy(Request $request, TariffConfig $tariffConfig): JsonResponse
    {
        $this->authorizePrivileged($request);
        if (! $request->user()->isSuperadmin() && $tariffConfig->area_id !== null) {
            AreaVisibility::resolveAreaIdOrFail($request->user(), $tariffConfig->area_id);
        }
        $tariffConfig->update(['is_active' => false]);

        return response()->json(null, 204);
    }
}
