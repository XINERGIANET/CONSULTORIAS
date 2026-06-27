<?php

namespace Database\Seeders;

use App\Models\Area;
use App\Models\Cargo;
use App\Models\Currency;
use App\Models\FinancialCategory;
use App\Models\PaymentMethod;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Service;
use App\Models\StatusCatalog;
use App\Models\TaxRate;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class XpandeSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['name' => 'Superadmin', 'slug' => 'superadmin', 'description' => 'Acceso total y gestion de roles, permisos y usuarios.'],
            ['name' => 'Admin', 'slug' => 'admin', 'description' => 'Administracion operativa segun permisos asignados.'],
            ['name' => 'Colaborador', 'slug' => 'colaborador', 'description' => 'Acceso de trabajo segun permisos asignados.'],
        ];

        foreach ($roles as $r) {
            Role::query()->updateOrCreate(['slug' => $r['slug']], $r);
        }
        Role::query()->whereNotIn('slug', ['superadmin', 'admin', 'colaborador'])->update(['description' => 'Rol fuera de uso']);

        foreach (Permission::CATALOG as $code => $label) {
            Permission::query()->updateOrCreate(['code' => $code], ['label' => $label]);
        }

        $adminRole = Role::query()->where('slug', 'admin')->first();
        if ($adminRole !== null) {
            $adminRole->permissions()->sync(Permission::query()->whereIn('code', [
                'view_clients',
                'create_clients',
                'edit_clients',
                'delete_clients',
                'view_quotations',
                'send_quotations',
                'view_projects',
                'manage_productivity',
                'create_tasks',
                'edit_tasks',
                'view_finances',
                'register_payments',
                'manage_users',
            ])->pluck('id'));
        }
        $collaboratorRole = Role::query()->where('slug', 'colaborador')->first();
        if ($collaboratorRole !== null) {
            $collaboratorRole->permissions()->sync(Permission::query()->whereIn('code', [
                'view_clients',
                'view_quotations',
                'view_projects',
                'manage_productivity',
                // by default colaboradores do not get create/edit tasks; can be granted per-user
            ])->pluck('id'));
        }

        $areas = [
            ['name' => 'Xingeria', 'slug' => 'xingeria', 'description' => 'Software y tecnologia.'],
            ['name' => 'Xpande', 'slug' => 'xpande', 'description' => 'Consultoria empresarial.'],
            ['name' => 'Xango', 'slug' => 'xango', 'description' => 'Marketing y contenido.'],
        ];

        foreach ($areas as $a) {
            Area::query()->updateOrCreate(['slug' => $a['slug']], $a);
        }

        Currency::query()->updateOrCreate(['code' => 'PEN'], ['name' => 'Sol peruano', 'symbol' => 'S/.', 'is_active' => true]);
        TaxRate::query()->updateOrCreate(['name' => 'IGV 18%'], ['rate_percent' => 18, 'is_active' => true]);

        foreach (['Servicio mensual', 'Suscripcion SaaS', 'Proyecto cerrado', 'Consultoria por hora', 'Desarrollo de software', 'Campana de marketing', 'Mantenimiento', 'Pago de contrato', 'Otro'] as $n) {
            FinancialCategory::query()->updateOrCreate(['name' => $n, 'type' => 'income'], ['is_active' => true]);
        }

        foreach (['Sueldos', 'Publicidad', 'Software', 'Hosting', 'Dominio', 'Transporte', 'Viaticos', 'Diseno', 'Produccion audiovisual', 'Herramientas digitales', 'Servicios externos', 'Otros'] as $n) {
            FinancialCategory::query()->updateOrCreate(['name' => $n, 'type' => 'expense'], ['is_active' => true]);
        }

        $statusRows = [
            ['category' => 'client_pipeline', 'code' => 'lead', 'label' => 'Lead', 'sort_order' => 1],
            ['category' => 'client_pipeline', 'code' => 'prospect', 'label' => 'Prospecto', 'sort_order' => 2],
            ['category' => 'client_pipeline', 'code' => 'active_client', 'label' => 'Cliente activo', 'sort_order' => 3],
            ['category' => 'client_pipeline', 'code' => 'inactive_client', 'label' => 'Cliente inactivo', 'sort_order' => 4],
            ['category' => 'project', 'code' => 'pending', 'label' => 'Pendiente', 'sort_order' => 1],
            ['category' => 'project', 'code' => 'in_progress', 'label' => 'En proceso', 'sort_order' => 2],
            ['category' => 'project', 'code' => 'paused', 'label' => 'Pausado', 'sort_order' => 3],
            ['category' => 'project', 'code' => 'finished', 'label' => 'Finalizado', 'sort_order' => 4],
            ['category' => 'project', 'code' => 'cancelled', 'label' => 'Cancelado', 'sort_order' => 5],
            ['category' => 'payment', 'code' => 'pending', 'label' => 'Pendiente', 'sort_order' => 1],
            ['category' => 'payment', 'code' => 'partial', 'label' => 'Pago parcial', 'sort_order' => 2],
            ['category' => 'payment', 'code' => 'paid', 'label' => 'Pagado', 'sort_order' => 3],
            ['category' => 'payment', 'code' => 'overdue', 'label' => 'Vencido', 'sort_order' => 4],
            ['category' => 'payment', 'code' => 'annulled', 'label' => 'Anulado', 'sort_order' => 5],
        ];

        foreach ($statusRows as $s) {
            StatusCatalog::query()->updateOrCreate(['category' => $s['category'], 'code' => $s['code']], array_merge($s, ['is_active' => true]));
        }

        Cargo::query()->updateOrCreate(['name' => 'Director general'], ['is_active' => true]);
        Cargo::query()->updateOrCreate(['name' => 'Consultor senior'], ['is_active' => true]);
        Cargo::query()->updateOrCreate(['name' => 'Ejecutivo comercial'], ['is_active' => true]);

        foreach ([
            ['code' => 'transferencia', 'name' => 'Transferencia bancaria'],
            ['code' => 'yape', 'name' => 'Yape'],
            ['code' => 'plin', 'name' => 'Plin'],
            ['code' => 'efectivo', 'name' => 'Efectivo'],
            ['code' => 'tarjeta', 'name' => 'Tarjeta'],
        ] as $method) {
            PaymentMethod::query()->updateOrCreate(
                ['code' => $method['code']],
                ['name' => $method['name'], 'is_active' => true]
            );
        }

        $xingeria = Area::query()->where('slug', 'xingeria')->first();
        $xpande = Area::query()->where('slug', 'xpande')->first();
        $xango = Area::query()->where('slug', 'xango')->first();

        $services = [
            ['name' => 'Desarrollo web', 'area_id' => $xingeria !== null ? $xingeria->id : null],
            ['name' => 'Automatizacion', 'area_id' => $xingeria !== null ? $xingeria->id : null],
            ['name' => 'Consultoria empresarial', 'area_id' => $xpande !== null ? $xpande->id : null],
            ['name' => 'Marketing digital', 'area_id' => $xango !== null ? $xango->id : null],
            ['name' => 'Branding', 'area_id' => $xango !== null ? $xango->id : null],
            ['name' => 'Xinergia ERP', 'kind' => 'saas', 'slug' => 'xinergia-erp', 'area_id' => $xingeria !== null ? $xingeria->id : null, 'billing_cycle' => 'monthly'],
            ['name' => 'Portal Inmobiliario', 'kind' => 'saas', 'slug' => 'portal-inmobiliario', 'area_id' => $xingeria !== null ? $xingeria->id : null, 'billing_cycle' => 'monthly'],
            ['name' => 'CRM Comercial SaaS', 'kind' => 'saas', 'slug' => 'crm-comercial-saas', 'area_id' => $xingeria !== null ? $xingeria->id : null, 'billing_cycle' => 'monthly'],
        ];

        foreach ($services as $s) {
            if ($s['area_id'] !== null) {
                Service::query()->firstOrCreate(
                    ['name' => $s['name']],
                    [
                        'kind' => $s['kind'] ?? 'service',
                        'slug' => $s['slug'] ?? null,
                        'area_id' => $s['area_id'],
                        'billing_cycle' => $s['billing_cycle'] ?? null,
                        'is_active' => true,
                    ]
                );
            }
        }

        $superadminRole = Role::query()->where('slug', 'superadmin')->first();

        User::query()->updateOrCreate(
            ['email' => env('XPANDE_ADMIN_EMAIL', 'admin@xpande.local')],
            [
                'name' => env('XPANDE_ADMIN_NAME', 'Administrador Xpande Corp'),
                'password' => Hash::make(env('XPANDE_ADMIN_PASSWORD', 'ChangeMe123!')),
                'is_superadmin' => true,
                'role_id' => $superadminRole !== null ? $superadminRole->id : null,
                'phone' => null,
                'is_active' => true,
                'cost_per_hour' => 120,
            ]
        );

        $u = User::query()->where('email', env('XPANDE_ADMIN_EMAIL', 'admin@xpande.local'))->first();

        if ($u !== null) {
            $u->areas()->sync(Area::query()->where('is_active', true)->pluck('id'));
        }
    }
}
