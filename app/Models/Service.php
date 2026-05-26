<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Service extends Model
{
    protected $fillable = [
        'name',
        'kind',
        'slug',
        'area_id',
        'description',
        'billing_cycle',
        'base_price',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'base_price' => 'decimal:2',
        ];
    }

    /** @return BelongsTo<Area, Service> */
    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    public function projects(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_service')
            ->withPivot(['quantity', 'unit_price', 'notes'])
            ->withTimestamps();
    }
}
