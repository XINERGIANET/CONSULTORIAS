<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientLocation extends Model
{
    protected $fillable = [
        'client_id',
        'name',
        'address',
        'phone',
        'responsible_person',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /** @return BelongsTo<Client, ClientLocation> */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
