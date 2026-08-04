<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounts_receivable_payments', function (Blueprint $table): void {
            if (! Schema::hasColumn('accounts_receivable_payments', 'receipt_path')) {
                $table->string('receipt_path')->nullable()->after('notes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('accounts_receivable_payments', function (Blueprint $table): void {
            if (Schema::hasColumn('accounts_receivable_payments', 'receipt_path')) {
                $table->dropColumn('receipt_path');
            }
        });
    }
};
