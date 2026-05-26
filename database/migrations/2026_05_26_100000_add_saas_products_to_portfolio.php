<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table): void {
            $table->string('kind')->default('service')->after('name');
            $table->string('slug')->nullable()->after('kind');
            $table->text('description')->nullable()->after('area_id');
            $table->string('billing_cycle')->nullable()->after('description');
            $table->decimal('base_price', 14, 2)->nullable()->after('billing_cycle');
            $table->unique(['slug']);
        });

        Schema::table('projects', function (Blueprint $table): void {
            $table->string('engagement_type')->default('project')->after('client_id');
            $table->string('subscription_status')->nullable()->after('status');
            $table->date('renewal_date')->nullable()->after('subscription_status');
        });

        Schema::create('project_service', function (Blueprint $table): void {
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('unit_price', 14, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->primary(['project_id', 'service_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_service');

        Schema::table('projects', function (Blueprint $table): void {
            $table->dropColumn(['engagement_type', 'subscription_status', 'renewal_date']);
        });

        Schema::table('services', function (Blueprint $table): void {
            $table->dropUnique(['slug']);
            $table->dropColumn(['kind', 'slug', 'description', 'billing_cycle', 'base_price']);
        });
    }
};
