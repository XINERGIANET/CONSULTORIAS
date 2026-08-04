<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Income extends Model
{
    protected $fillable = [
        'client_id',
        'project_id',
        'area_id',
        'financial_category_id',
        'amount',
        'recorded_on',
        'payment_status',
        'quotation_id',
        'receipt_path',
        'description',
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
            'recorded_on' => 'date',
        ];
    }

    /** @return BelongsTo<Client, Income> */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /** @return BelongsTo<Project, Income> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return BelongsTo<Area, Income> */
    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    /** @return BelongsTo<FinancialCategory, Income> */
    public function financialCategory(): BelongsTo
    {
        return $this->belongsTo(FinancialCategory::class);
    }

    /** @return BelongsTo<Quotation, Income> */
    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function receivablePayment(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(AccountReceivablePayment::class, 'income_id');
    }
}
