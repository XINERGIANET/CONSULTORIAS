<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountReceivable extends Model
{
    protected $table = 'accounts_receivable';

    protected $fillable = [
        'client_id',
        'document_id',
        'client_contract_id',
        'installment_number',
        'project_id',
        'area_id',
        'total_amount',
        'paid_amount',
        'balance_amount',
        'issued_on',
        'due_on',
        'projected_due_on',
        'collected_on',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'balance_amount' => 'decimal:2',
            'issued_on' => 'date',
            'due_on' => 'date',
            'projected_due_on' => 'date',
            'collected_on' => 'date',
        ];
    }

    /** @return BelongsTo<Client, AccountReceivable> */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /** @return BelongsTo<Document, AccountReceivable> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    /** @return BelongsTo<Project, AccountReceivable> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return BelongsTo<Area, AccountReceivable> */
    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    /** @return BelongsTo<ClientContract, AccountReceivable> */
    public function clientContract(): BelongsTo
    {
        return $this->belongsTo(ClientContract::class);
    }

    /** @return HasMany<AccountReceivablePayment> */
    public function payments(): HasMany
    {
        return $this->hasMany(AccountReceivablePayment::class);
    }
}
