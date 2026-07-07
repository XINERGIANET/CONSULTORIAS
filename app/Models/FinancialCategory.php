<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinancialCategory extends Model
{
    protected $fillable = [
        'name',
        'type',
        'area_id',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /** @return BelongsTo<Area, FinancialCategory> */
    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }
}
