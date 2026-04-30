<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('notifications') && ! Schema::hasTable('xpande_notifications')) {
            Schema::rename('notifications', 'xpande_notifications');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('xpande_notifications')) {
            Schema::rename('xpande_notifications', 'notifications');
        }
    }
};
