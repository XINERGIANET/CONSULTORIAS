<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountReceivablePayment extends Model
{
    protected $table = 'accounts_receivable_payments';

    protected $fillable = [
        'account_receivable_id',
        'income_id',
        'amount',
        'paid_on',
        'method',
        'reference',
        'notes',
        'registered_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_on' => 'date',
        ];
    }

    /** @return BelongsTo<AccountReceivable, AccountReceivablePayment> */
    public function accountReceivable(): BelongsTo
    {
        return $this->belongsTo(AccountReceivable::class);
    }

    /** @return BelongsTo<Income, AccountReceivablePayment> */
    public function income(): BelongsTo
    {
        return $this->belongsTo(Income::class);
    }

    /** @return BelongsTo<User, AccountReceivablePayment> */
    public function registeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registered_by');
    }
}
