<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiderLedger extends Model
{
    use HasUuids;

    protected $table = 'rider_ledger';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'rider_id',
        'order_id',
        'type',   // 'advance' | 'collection'
        'amount',
        'note',
    ];

    public function rider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rider_id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
