<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Permission extends Model
{
    public const MANAGE_ROLES = 'manage_roles_permissions';

    public const CATALOG = [
        'view_clients' => 'Ver clientes',
        'create_clients' => 'Crear clientes',
        'edit_clients' => 'Editar clientes',
        'delete_clients' => 'Eliminar clientes',
        'view_quotations' => 'Ver cotizaciones',
        'send_quotations' => 'Enviar cotizaciones',
        'view_projects' => 'Ver proyectos',
        'manage_productivity' => 'Gestionar productividad',
        'view_finances' => 'Ver finanzas',
        'register_payments' => 'Registrar pagos',
        'manage_users' => 'Gestionar usuarios',
        self::MANAGE_ROLES => 'Gestionar roles y permisos',
    ];

    protected $fillable = [
        'code',
        'label',
    ];

    /** @return BelongsToMany<Role, Permission> */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'permission_role');
    }
}
