<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountPayablePayment extends Model
{
    protected $table = 'accounts_payable_payments';

    protected $fillable = [
        'account_payable_id',
        'expense_id',
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

    /** @return BelongsTo<AccountPayable, AccountPayablePayment> */
    public function accountPayable(): BelongsTo
    {
        return $this->belongsTo(AccountPayable::class);
    }

    /** @return BelongsTo<Expense, AccountPayablePayment> */
    public function expense(): BelongsTo
    {
        return $this->belongsTo(Expense::class);
    }

    /** @return BelongsTo<User, AccountPayablePayment> */
    public function registeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registered_by');
    }
}
