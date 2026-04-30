<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('is_superadmin')->default(false)->after('password');
        });

        $firstId = DB::table('users')->orderBy('id')->value('id');
        if ($firstId !== null) {
            DB::table('users')->where('id', $firstId)->update(['is_superadmin' => true]);
            return;
        }

        DB::table('users')->insert([
            'name' => env('SUPERADMIN_NAME', 'Super Admin'),
            'email' => env('SUPERADMIN_EMAIL', 'admin@garzasoft.local'),
            'password' => Hash::make(env('SUPERADMIN_PASSWORD', 'ChangeMe123!')),
            'is_superadmin' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('is_superadmin');
        });
    }
};
