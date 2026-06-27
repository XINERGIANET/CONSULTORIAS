<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table): void {
            $table->date('presentation_date')->nullable()->after('pipeline_stage');
            $table->date('tentative_response_date')->nullable()->after('presentation_date');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table): void {
            $table->dropColumn(['presentation_date', 'tentative_response_date']);
        });
    }
};
