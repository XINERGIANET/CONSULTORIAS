<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_contracts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('document_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('area_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->decimal('total_amount', 14, 2);
            $table->decimal('installment_amount', 14, 2);
            $table->unsignedSmallInteger('installments_count');
            $table->string('billing_frequency')->default('monthly');
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->date('first_due_on');
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::table('accounts_receivable', function (Blueprint $table): void {
            $table->foreignId('client_contract_id')->nullable()->after('document_id')->constrained('client_contracts')->nullOnDelete();
            $table->unsignedSmallInteger('installment_number')->nullable()->after('client_contract_id');
            $table->date('projected_due_on')->nullable()->after('due_on');
            $table->date('collected_on')->nullable()->after('projected_due_on');
        });

        Schema::create('accounts_payable', function (Blueprint $table): void {
            $table->id();
            $table->string('payable_type');
            $table->string('vendor_name')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('area_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('expense_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('document_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('total_amount', 14, 2);
            $table->decimal('paid_amount', 14, 2)->default(0);
            $table->decimal('balance_amount', 14, 2);
            $table->date('projected_due_on');
            $table->date('paid_on')->nullable();
            $table->date('invoiced_on')->nullable();
            $table->boolean('requires_invoice')->default(false);
            $table->string('status')->default('pending');
            $table->string('description');
            $table->text('notes')->nullable();
            $table->unsignedSmallInteger('period_year')->nullable();
            $table->unsignedTinyInteger('period_month')->nullable();
            $table->timestamps();
        });

        Schema::create('accounts_payable_payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('account_payable_id')->constrained('accounts_payable')->cascadeOnDelete();
            $table->foreignId('expense_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('amount', 14, 2);
            $table->date('paid_on');
            $table->string('method')->nullable();
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('registered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounts_payable_payments');
        Schema::dropIfExists('accounts_payable');
        Schema::table('accounts_receivable', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('client_contract_id');
            $table->dropColumn(['installment_number', 'projected_due_on', 'collected_on']);
        });
        Schema::dropIfExists('client_contracts');
    }
};
