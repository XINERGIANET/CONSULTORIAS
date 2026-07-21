<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_methods', function (Blueprint $table): void {
            $table->dropUnique(['code']);
            $table->foreignId('area_id')->nullable()->after('name')->constrained()->nullOnDelete();
            $table->unique(['area_id', 'code']);
        });

        // Los metodos de pago existentes eran compartidos (sin empresa). Se replican por
        // cada empresa activa y los originales quedan desactivados, igual que se hizo con
        // las categorias financieras: cada empresa administra los suyos desde ahora.
        $methods = DB::table('payment_methods')->whereNull('area_id')->get(['id', 'code', 'name']);
        $areaIds = DB::table('areas')->where('is_active', true)->pluck('id');

        foreach ($methods as $method) {
            foreach ($areaIds as $areaId) {
                $exists = DB::table('payment_methods')
                    ->where('area_id', $areaId)
                    ->where('code', $method->code)
                    ->exists();

                if ($exists) {
                    continue;
                }

                DB::table('payment_methods')->insert([
                    'code' => $method->code,
                    'name' => $method->name,
                    'area_id' => $areaId,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        DB::table('payment_methods')->whereNull('area_id')->update(['is_active' => false, 'updated_at' => now()]);
    }

    public function down(): void
    {
        // Migracion de datos: se conserva el estado escopeado por empresa.
    }
};
