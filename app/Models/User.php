<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use App\Models\Permission;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'is_superadmin',
        'role_id',
        'cargo_id',
        'phone',
        'is_active',
        'contract_type',
        'salary',
        'cost_per_hour',
        'availability',
        'specialty',
        'permissions',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_superadmin' => 'boolean',
            'is_active' => 'boolean',
            'salary' => 'decimal:2',
            'cost_per_hour' => 'decimal:2',
            'permissions' => 'array',
        ];
    }

    public function isSuperadmin(): bool
    {
        return (bool) $this->is_superadmin;
    }

    public function hasPermission(string $code): bool
    {
        if ($this->isSuperadmin()) {
            return true;
        }

        $this->loadMissing('role.permissions');

        $rolePerms = $this->role !== null ? $this->role->permissions->pluck('code')->values()->all() : [];
        $userPerms = $this->permissions ?? [];

        // Start with role permissions
        $set = array_values($rolePerms);

        // Apply per-user overrides: true => allow, false => deny
        foreach ($userPerms as $k => $v) {
            if ($v === true || $v === 1) {
                if (! in_array($k, $set, true)) {
                    $set[] = $k;
                }
            } elseif ($v === false || $v === 0) {
                $set = array_values(array_filter($set, fn ($c) => $c !== $k));
            }
        }

        return in_array($code, $set, true);
    }

    /** @return BelongsTo<Role, User> */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /** @return BelongsTo<Cargo, User> */
    public function cargo(): BelongsTo
    {
        return $this->belongsTo(Cargo::class);
    }

    /** @return BelongsToMany<Area, User> */
    public function areas(): BelongsToMany
    {
        return $this->belongsToMany(Area::class, 'area_user');
    }

    /** @return BelongsToMany<Project, User> */
    public function projects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_user');
    }

    /**
     * @return array<string, mixed>
     */
    public function authPayload(): array
    {
        $this->loadMissing(['role.permissions', 'areas']);

        $rolePerms = $this->role !== null ? $this->role->permissions->pluck('code')->values()->all() : [];
        $userPerms = $this->permissions ?? [];

        $effective = array_values($rolePerms);
        foreach ($userPerms as $k => $v) {
            if ($v === true || $v === 1) {
                if (! in_array($k, $effective, true)) $effective[] = $k;
            } elseif ($v === false || $v === 0) {
                $effective = array_values(array_filter($effective, fn ($c) => $c !== $k));
            }
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'is_superadmin' => $this->is_superadmin,
            'role_slug' => $this->role !== null ? $this->role->slug : null,
            'role_name' => $this->role !== null ? $this->role->name : null,
            'permissions' => $this->isSuperadmin() ? array_keys(Permission::CATALOG) : $effective,
            'area_ids' => $this->areas->pluck('id')->values()->all(),
            'phone' => $this->phone,
            'is_active' => $this->is_active,
            'cargo_id' => $this->cargo_id,
            'cost_per_hour' => $this->cost_per_hour,
        ];
    }

}
