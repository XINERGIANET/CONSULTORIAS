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
        'receipt_path',
        'registered_by',
    ];

    protected $appends = ['receipt_url'];

    public function getReceiptUrlAttribute(): ?string
    {
        if (! $this->receipt_path) {
            return null;
        }
        if (str_starts_with($this->receipt_path, 'http://') || str_starts_with($this->receipt_path, 'https://')) {
            return $this->receipt_path;
        }

        $cleanPath = $this->receipt_path;
        if (str_contains($cleanPath, 'vouchers/')) {
            $cleanPath = 'vouchers/' . basename($cleanPath);
        } else {
            $cleanPath = ltrim(preg_replace('#^.*storage/(app/public/)?#', '', $cleanPath), '/');
        }

        return asset('storage/' . $cleanPath);
    }


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
