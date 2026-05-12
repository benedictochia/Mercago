<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // 'cod' = Cash on Delivery, 'gcash' = mock GCash, 'maya' = mock Maya
            $table->string('payment_method')->default('cod')->after('delivery_status');
            // 'pending' → 'collected' (rider got cash) → 'settled' (vendor acknowledged)
            $table->string('payment_status')->default('pending')->after('payment_method');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['payment_method', 'payment_status']);
        });
    }
};
