<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            Role::query()
                ->with('permissions:id,code,label')
                ->whereIn('slug', ['superadmin', 'admin', 'colaborador'])
                ->orderBy('name')
                ->get()
        );
    }

    public function permissions(): JsonResponse
    {
        $this->syncPermissionCatalog();

        return response()->json(Permission::query()->orderBy('label')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureSuperadmin($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:64', Rule::in(['superadmin', 'admin', 'colaborador'])],
            'description' => ['nullable', 'string', 'max:255'],
            'permission_codes' => ['sometimes', 'array'],
            'permission_codes.*' => ['string', Rule::in(array_keys(Permission::CATALOG))],
        ]);

        $role = DB::transaction(function () use ($data): Role {
            $role = Role::query()->create([
                'name' => $data['name'],
                'slug' => $data['slug'],
                'description' => $data['description'] ?? null,
            ]);
            $this->syncRolePermissions($role, $data['permission_codes'] ?? []);

            return $role;
        });

        return response()->json($role->load('permissions:id,code,label'), 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        $this->ensureSuperadmin($request);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:255'],
            'permission_codes' => ['sometimes', 'array'],
            'permission_codes.*' => ['string', Rule::in(array_keys(Permission::CATALOG))],
        ]);

        DB::transaction(function () use ($role, $data): void {
            $role->fill([
                'name' => $data['name'] ?? $role->name,
                'description' => $data['description'] ?? $role->description,
            ])->save();

            if (array_key_exists('permission_codes', $data)) {
                $this->syncRolePermissions($role, $data['permission_codes']);
            }
        });

        return response()->json($role->fresh()->load('permissions:id,code,label'));
    }

    public function destroy(Request $request, Role $role): JsonResponse
    {
        $this->ensureSuperadmin($request);

        if (in_array($role->slug, ['superadmin', 'admin', 'colaborador'], true)) {
            return response()->json(['message' => 'Los roles base no se eliminan.'], 422);
        }

        if ($role->users()->exists()) {
            return response()->json(['message' => 'No se puede eliminar un rol con usuarios asignados.'], 422);
        }

        $role->delete();

        return response()->json(null, 204);
    }

    private function ensureSuperadmin(Request $request): void
    {
        $user = $request->user();
        if ($user === null || ! $user->isSuperadmin()) {
            abort(403, 'Solo el Superadmin puede gestionar roles y permisos.');
        }
    }

    private function syncRolePermissions(Role $role, array $codes): void
    {
        $this->syncPermissionCatalog();
        $ids = Permission::query()->whereIn('code', $codes)->pluck('id')->all();
        $role->permissions()->sync($ids);
    }

    private function syncPermissionCatalog(): void
    {
        foreach (Permission::CATALOG as $code => $label) {
            Permission::query()->updateOrCreate(['code' => $code], ['label' => $label]);
        }
    }
}
