<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::disableForeignKeyConstraints();

        foreach ([
            'document_versions',
            'documents',
            'time_entries',
            'xpande_notifications',
            'performance_reviews',
            'expenses',
            'incomes',
            'quotation_lines',
            'quotation_area',
            'quotations',
            'project_user',
            'project_area',
            'projects',
            'opportunities',
            'crm_activities',
            'client_contacts',
            'client_area',
            'clients',
            'tariff_configs',
            'area_user',
            'services',
            'status_catalogs',
            'financial_categories',
            'tax_rates',
            'currencies',
            'customers',
            'orders',
            'lab_samples',
            'lab_projects',
        ] as $t) {
            Schema::dropIfExists($t);
        }

        Schema::enableForeignKeyConstraints();

        Schema::create('roles', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('description')->nullable();
            $table->timestamps();
        });

        Schema::create('areas', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('cargos', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('currencies', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 8)->unique();
            $table->string('name');
            $table->string('symbol', 8)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('tax_rates', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->decimal('rate_percent', 8, 4)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('financial_categories', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->enum('type', ['income', 'expense']);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('status_catalogs', function (Blueprint $table): void {
            $table->id();
            $table->string('category');
            $table->string('code');
            $table->string('label');
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['category', 'code']);
        });

        Schema::create('services', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->foreignId('area_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->foreignId('role_id')->nullable()->after('is_superadmin')->constrained()->nullOnDelete();
            $table->foreignId('cargo_id')->nullable()->after('role_id')->constrained()->nullOnDelete();
            $table->string('phone')->nullable()->after('email');
            $table->boolean('is_active')->default(true)->after('phone');
            $table->string('contract_type')->nullable();
            $table->decimal('salary', 14, 2)->nullable();
            $table->decimal('cost_per_hour', 14, 2)->nullable();
            $table->string('availability')->nullable();
            $table->text('specialty')->nullable();
        });

        Schema::create('area_user', function (Blueprint $table): void {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('area_id')->constrained()->cascadeOnDelete();
            $table->primary(['user_id', 'area_id']);
        });

        Schema::create('clients', function (Blueprint $table): void {
            $table->id();
            $table->string('legal_name');
            $table->string('trade_name')->nullable();
            $table->string('ruc')->nullable();
            $table->string('address')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('sector')->nullable();
            $table->string('company_size')->nullable();
            $table->string('client_type')->nullable();
            $table->string('industry')->nullable();
            $table->string('pipeline_stage')->default('lead');
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('client_area', function (Blueprint $table): void {
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('area_id')->constrained()->cascadeOnDelete();
            $table->primary(['client_id', 'area_id']);
        });

        Schema::create('client_contacts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('position')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->foreignId('area_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('crm_activities', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type');
            $table->string('subject')->nullable();
            $table->text('body')->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->timestamp('next_followup_at')->nullable();
            $table->timestamps();
        });

        Schema::create('opportunities', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('area_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->string('stage')->default('open');
            $table->unsignedTinyInteger('probability')->nullable();
            $table->decimal('expected_amount', 14, 2)->nullable();
            $table->date('expected_close')->nullable();
            $table->timestamp('next_followup_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('service_type')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_estimated')->nullable();
            $table->date('end_actual')->nullable();
            $table->string('status')->default('pending');
            $table->decimal('budget', 14, 2)->nullable();
            $table->foreignId('lead_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('description')->nullable();
            $table->text('objectives')->nullable();
            $table->text('deliverables')->nullable();
            $table->timestamps();
        });

        Schema::create('project_area', function (Blueprint $table): void {
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('area_id')->constrained()->cascadeOnDelete();
            $table->primary(['project_id', 'area_id']);
        });

        Schema::create('project_user', function (Blueprint $table): void {
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['project_id', 'user_id']);
        });

        Schema::create('quotations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('number')->unique();
            $table->string('status')->default('draft');
            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('tax_amount', 14, 2)->default(0);
            $table->decimal('discount', 14, 2)->default(0);
            $table->decimal('total', 14, 2)->default(0);
            $table->foreignId('currency_id')->nullable()->constrained()->nullOnDelete();
            $table->date('valid_until')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('accepted_project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('opportunity_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('accepted_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('quotation_area', function (Blueprint $table): void {
            $table->foreignId('quotation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('area_id')->constrained()->cascadeOnDelete();
            $table->primary(['quotation_id', 'area_id']);
        });

        Schema::create('quotation_lines', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('quotation_id')->constrained()->cascadeOnDelete();
            $table->string('description');
            $table->decimal('quantity', 12, 3)->default(1);
            $table->decimal('unit_price', 14, 2)->default(0);
            $table->decimal('line_total', 14, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('incomes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('area_id')->constrained()->cascadeOnDelete();
            $table->foreignId('financial_category_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 14, 2);
            $table->date('recorded_on');
            $table->string('payment_status')->default('pending');
            $table->foreignId('quotation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('receipt_path')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('expenses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('area_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('financial_category_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 14, 2);
            $table->date('recorded_on');
            $table->foreignId('responsible_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('receipt_path')->nullable();
            $table->text('observation')->nullable();
            $table->timestamps();
        });

        Schema::create('time_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('area_id')->constrained()->cascadeOnDelete();
            $table->date('work_date');
            $table->time('started_at')->nullable();
            $table->time('ended_at')->nullable();
            $table->decimal('hours', 10, 3);
            $table->text('description')->nullable();
            $table->boolean('billable')->default(true);
            $table->string('status')->default('pending');
            $table->timestamps();
        });

        Schema::create('documents', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('area_id')->nullable()->constrained()->nullOnDelete();
            $table->string('doc_type');
            $table->string('title');
            $table->string('path');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
        });

        Schema::create('document_versions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('path');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('note')->nullable();
            $table->timestamps();
        });

        Schema::create('tariff_configs', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('rate_type');
            $table->decimal('amount', 14, 2)->default(0);
            $table->foreignId('currency_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('area_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('performance_reviews', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('period');
            $table->unsignedTinyInteger('score')->nullable();
            $table->text('comments')->nullable();
            $table->timestamps();
        });

        Schema::create('xpande_notifications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('body')->nullable();
            $table->string('severity')->default('info');
            $table->timestamp('read_at')->nullable();
            $table->string('related_type')->nullable();
            $table->unsignedBigInteger('related_id')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        foreach ([
            'xpande_notifications',
            'performance_reviews',
            'tariff_configs',
            'document_versions',
            'documents',
            'time_entries',
            'expenses',
            'incomes',
            'quotation_lines',
            'quotation_area',
            'quotations',
            'project_user',
            'project_area',
            'projects',
            'opportunities',
            'crm_activities',
            'client_contacts',
            'client_area',
            'clients',
            'area_user',
        ] as $t) {
            Schema::dropIfExists($t);
        }

        Schema::table('users', function (Blueprint $table): void {
            $table->dropForeign(['role_id']);
            $table->dropForeign(['cargo_id']);
            $table->dropColumn([
                'role_id',
                'cargo_id',
                'phone',
                'is_active',
                'contract_type',
                'salary',
                'cost_per_hour',
                'availability',
                'specialty',
            ]);
        });

        foreach ([
            'services',
            'status_catalogs',
            'financial_categories',
            'tax_rates',
            'currencies',
            'cargos',
            'areas',
            'roles',
        ] as $t) {
            Schema::dropIfExists($t);
        }
        Schema::enableForeignKeyConstraints();
    }
};
