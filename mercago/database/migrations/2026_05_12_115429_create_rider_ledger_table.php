<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rider_ledger', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('rider_id');
            $table->uuid('order_id');
            // 'advance' = rider paid vendor upfront (debit, rider is owed)
            // 'collection' = rider collected cash from shopper (credit, settles advance)
            $table->enum('type', ['advance', 'collection']);
            $table->decimal('amount', 10, 2);
            $table->string('note')->nullable();
            $table->timestamps();

            $table->foreign('rider_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rider_ledger');
    }
};
