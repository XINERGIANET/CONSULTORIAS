<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Area;
use App\Support\AreaVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AreaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Area::query()->orderBy('name');
        $user = $request->user();
        if ($user !== null && ! $user->isSuperadmin()) {
            $ids = AreaVisibility::userAreaIds($user);
            $q->whereIn('id', $ids);
        }
        if ($request->boolean('active_only', false)) {
            $q->where('is_active', true);
        }

        return response()->json($q->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeSuperadmin($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:191'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        if (empty($data['slug'])) {
            $data['slug'] = Str::slug($data['name']);
        }

        return response()->json(Area::query()->create($data), 201);
    }

    public function update(Request $request, Area $area): JsonResponse
    {
        $this->authorizeSuperadmin($request);
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:191'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        if (isset($data['slug']) && $data['slug'] === '') {
            $data['slug'] = Str::slug($area->name);
        }
        $area->update($data);

        return response()->json($area->fresh());
    }

    public function destroy(Request $request, Area $area): JsonResponse
    {
        $this->authorizeSuperadmin($request);
        $area->update(['is_active' => false]);

        return response()->json(null, 204);
    }

    private function authorizeSuperadmin(Request $request): void
    {
        if (! $request->user()?->isSuperadmin()) {
            abort(403);
        }
    }
}
