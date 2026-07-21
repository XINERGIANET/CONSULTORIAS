<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountPayable extends Model
{
    protected $table = 'accounts_payable';

    protected $fillable = [
        'payable_type',
        'vendor_name',
        'user_id',
        'area_id',
        'project_id',
        'financial_category_id',
        'expense_id',
        'document_id',
        'total_amount',
        'paid_amount',
        'balance_amount',
        'projected_due_on',
        'paid_on',
        'invoiced_on',
        'requires_invoice',
        'status',
        'description',
        'notes',
        'period_year',
        'period_month',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'balance_amount' => 'decimal:2',
            'projected_due_on' => 'date',
            'paid_on' => 'date',
            'invoiced_on' => 'date',
            'requires_invoice' => 'boolean',
        ];
    }

    /** @return BelongsTo<User, AccountPayable> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Area, AccountPayable> */
    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    /** @return HasMany<AccountPayablePayment, AccountPayable> */
    public function payments(): HasMany
    {
        return $this->hasMany(AccountPayablePayment::class);
    }

    /** @return BelongsTo<Project, AccountPayable> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return BelongsTo<FinancialCategory, AccountPayable> */
    public function financialCategory(): BelongsTo
    {
        return $this->belongsTo(FinancialCategory::class);
    }
}
