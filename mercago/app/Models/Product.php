<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Product extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'product_name',
        'category',
        'price',
        'unit',
        'stock_qty',
        'vendor_id',
        'image',
        'is_flash_sale',
        'flash_price',
        'flash_expires_at',
    ];

    protected $casts = [
        'is_flash_sale'    => 'boolean',
        'flash_price'      => 'decimal:2',
        'flash_expires_at' => 'datetime',
    ];

    protected $appends = ['image_url', 'effective_price', 'flash_active'];

    /**
     * Returns the active selling price:
     * flash_price if a flash sale is currently active, otherwise the regular price.
     */
    public function getEffectivePriceAttribute(): float
    {
        if ($this->is_flash_sale && $this->flash_price && $this->flash_expires_at && now()->lt($this->flash_expires_at)) {
            return (float) $this->flash_price;
        }
        return (float) $this->price;
    }

    /**
     * True only when the flash sale is currently active (not expired).
     */
    public function getFlashActiveAttribute(): bool
    {
        return $this->is_flash_sale
            && $this->flash_price !== null
            && $this->flash_expires_at !== null
            && now()->lt($this->flash_expires_at);
    }

    public function getImageUrlAttribute()
    {
        if (!$this->image) {
            return null;
        }

        if (str_starts_with($this->image, 'http')) {
            return $this->image;
        }

        return asset('storage/' . $this->image);
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'vendor_id');
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }
}
