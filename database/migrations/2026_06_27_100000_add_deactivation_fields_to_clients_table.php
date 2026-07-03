<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table): void {
            $table->text('deactivation_reason')->nullable()->after('is_active');
            $table->timestamp('deactivated_at')->nullable()->after('deactivation_reason');
            $table->foreignId('deactivated_by')->nullable()->after('deactivated_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('deactivated_by');
            $table->dropColumn(['deactivation_reason', 'deactivated_at']);
        });
    }
};
