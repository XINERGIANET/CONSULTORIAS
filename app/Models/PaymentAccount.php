<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentAccount extends Model
{
    protected $fillable = [
        'name',
        'type',
        'bank_name',
        'account_number',
        'cci',
        'currency',
        'holder_name',
        'icon',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
