<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClientContract extends Model
{
    protected $fillable = [
        'client_id',
        'document_id',
        'area_id',
        'project_id',
        'title',
        'total_amount',
        'installment_amount',
        'installments_count',
        'billing_frequency',
        'start_date',
        'end_date',
        'first_due_on',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'installment_amount' => 'decimal:2',
            'start_date' => 'date',
            'end_date' => 'date',
            'first_due_on' => 'date',
        ];
    }

    /** @return BelongsTo<Client, ClientContract> */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /** @return BelongsTo<Document, ClientContract> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    /** @return BelongsTo<Area, ClientContract> */
    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    /** @return HasMany<AccountReceivable, ClientContract> */
    public function receivables(): HasMany
    {
        return $this->hasMany(AccountReceivable::class);
    }
}
