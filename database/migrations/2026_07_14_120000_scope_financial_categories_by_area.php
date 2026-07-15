<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $areas = DB::table('areas')->select('id', 'name', 'slug')->get();
        $xinergiaId = $this->findAreaId($areas, ['xinergia', 'xingeria'], ['xinergia', 'xingeria']);
        $xpandeId = $this->findAreaId($areas, ['xpande'], ['xpande']);
        $xangoId = $this->findAreaId($areas, ['xango'], ['xango']);

        $allAreaIds = array_values(array_filter([$xinergiaId, $xpandeId, $xangoId]));

        $this->ensureCategories('income', [
            'Servicio mensual' => $allAreaIds,
            'Suscripcion SaaS' => array_filter([$xinergiaId]),
            'Proyecto cerrado' => array_filter([$xinergiaId, $xpandeId]),
            'Consultoria por hora' => array_filter([$xpandeId]),
            'Desarrollo de software' => array_filter([$xinergiaId]),
            'Campana de marketing' => array_filter([$xangoId]),
            'Mantenimiento' => array_filter([$xinergiaId]),
            'Pago de contrato' => $allAreaIds,
            'Otro' => $allAreaIds,
        ]);

        $this->ensureCategories('expense', [
            'Sueldos' => $allAreaIds,
            'Publicidad' => array_filter([$xangoId]),
            'Software' => array_filter([$xinergiaId]),
            'Hosting' => array_filter([$xinergiaId]),
            'Dominio' => array_filter([$xinergiaId]),
            'Transporte' => $allAreaIds,
            'Viaticos' => $allAreaIds,
            'Diseno' => array_filter([$xangoId]),
            'Produccion audiovisual' => array_filter([$xangoId]),
            'Herramientas digitales' => $allAreaIds,
            'Servicios externos' => $allAreaIds,
            'Otros' => $allAreaIds,
        ]);

        DB::table('financial_categories')
            ->whereNull('area_id')
            ->update(['is_active' => false, 'updated_at' => now()]);
    }

    public function down(): void
    {
        // Data migration: keep user-visible scoped categories intact.
    }

    /**
     * @param  \Illuminate\Support\Collection<int, object>  $areas
     * @param  list<string>  $slugs
     * @param  list<string>  $nameParts
     */
    private function findAreaId($areas, array $slugs, array $nameParts): ?int
    {
        foreach ($areas as $area) {
            $slug = strtolower((string) $area->slug);
            if (in_array($slug, $slugs, true)) {
                return (int) $area->id;
            }
        }

        foreach ($areas as $area) {
            $name = strtolower((string) $area->name);
            foreach ($nameParts as $part) {
                if (str_contains($name, $part)) {
                    return (int) $area->id;
                }
            }
        }

        return null;
    }

    /**
     * @param  array<string, list<int>>  $categories
     */
    private function ensureCategories(string $type, array $categories): void
    {
        foreach ($categories as $name => $areaIds) {
            foreach (array_unique(array_map('intval', $areaIds)) as $areaId) {
                if ($areaId <= 0) {
                    continue;
                }

                $existing = DB::table('financial_categories')
                    ->where('name', $name)
                    ->where('type', $type)
                    ->where('area_id', $areaId)
                    ->first();

                if ($existing !== null) {
                    DB::table('financial_categories')
                        ->where('id', $existing->id)
                        ->update(['is_active' => true, 'updated_at' => now()]);

                    continue;
                }

                DB::table('financial_categories')->insert([
                    'name' => $name,
                    'type' => $type,
                    'area_id' => $areaId,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }
};
