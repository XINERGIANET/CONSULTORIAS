<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\AuthorizesPrivileged;
use App\Models\Service;
use App\Support\AreaVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceCatalogController extends Controller
{
    use AuthorizesPrivileged;

    public function index(Request $request): JsonResponse
    {
        $q = Service::query()->with('area:id,name')->orderBy('name');
        if ($request->boolean('active_only', true)) {
            $q->where('is_active', true);
        }
        if ($request->user() !== null && ! $request->user()->isSuperadmin()) {
            $q->whereIn('area_id', AreaVisibility::userAreaIds($request->user()));
        }
        if ($request->filled('area_id')) {
            $areaId = AreaVisibility::resolveAreaIdOrFail($request->user(), $request->input('area_id'));
            $q->where('area_id', $areaId);
        }
        if ($request->filled('kind')) {
            $q->where('kind', $request->string('kind')->toString());
        }

        return response()->json($q->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePrivileged($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'kind' => ['nullable', 'string', 'max:64'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:services,slug'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'description' => ['nullable', 'string'],
            'billing_cycle' => ['nullable', 'string', 'max:64'],
            'base_price' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        if (array_key_exists('area_id', $data) && $data['area_id'] !== null) {
            $data['area_id'] = AreaVisibility::resolveAreaIdOrFail($request->user(), $data['area_id']);
        } elseif (! $request->user()->isSuperadmin()) {
            $data['area_id'] = AreaVisibility::resolveAreaIdOrFail($request->user(), null);
        }

        return response()->json(Service::query()->create($data), 201);
    }

    public function update(Request $request, Service $service): JsonResponse
    {
        $this->authorizePrivileged($request);
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'kind' => ['nullable', 'string', 'max:64'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:services,slug,'.$service->id],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'description' => ['nullable', 'string'],
            'billing_cycle' => ['nullable', 'string', 'max:64'],
            'base_price' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        if (! $request->user()->isSuperadmin() && $service->area_id !== null) {
            AreaVisibility::resolveAreaIdOrFail($request->user(), $service->area_id);
        }
        if (array_key_exists('area_id', $data)) {
            $data['area_id'] = AreaVisibility::resolveAreaIdOrFail($request->user(), $data['area_id']);
        }
        $service->update($data);

        return response()->json($service->fresh()->load('area'));
    }

    public function destroy(Request $request, Service $service): JsonResponse
    {
        $this->authorizePrivileged($request);
        if (! $request->user()->isSuperadmin() && $service->area_id !== null) {
            AreaVisibility::resolveAreaIdOrFail($request->user(), $service->area_id);
        }
        $service->delete();

        return response()->json(null, 204);
    }
}
