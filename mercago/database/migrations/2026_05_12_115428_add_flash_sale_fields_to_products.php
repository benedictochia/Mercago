<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('is_flash_sale')->default(false)->after('stock_qty');
            $table->decimal('flash_price', 10, 2)->nullable()->after('is_flash_sale');
            $table->timestamp('flash_expires_at')->nullable()->after('flash_price');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['is_flash_sale', 'flash_price', 'flash_expires_at']);
        });
    }
};
