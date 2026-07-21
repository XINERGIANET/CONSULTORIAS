<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounts_payable', function (Blueprint $table): void {
            $table->foreignId('financial_category_id')->nullable()->after('project_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('accounts_payable', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('financial_category_id');
        });
    }
};
