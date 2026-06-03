<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Task extends Model
{
    protected $fillable = [
        'title',
        'description',
        'project_id',
        'assigned_user_id',
        'created_by',
        'start_date',
        'due_date',
        'estimated_hours',
        'status',
        'priority',
    ];

    protected $appends = ['is_overdue'];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'due_date' => 'date',
            'estimated_hours' => 'decimal:2',
        ];
    }

    public function getIsOverdueAttribute(): bool
    {
        if ($this->status === 'finished') {
            return false;
        }
        if (! $this->due_date) {
            return false;
        }

        return $this->due_date->lt(now()->startOfDay());
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
