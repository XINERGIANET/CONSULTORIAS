<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Client extends Model
{
    protected $fillable = [
        'legal_name',
        'trade_name',
        'ruc',
        'address',
        'phone',
        'email',
        'sector',
        'company_size',
        'client_type',
        'industry',
        'rubro',
        'pipeline_stage',
        'is_active',
        'deactivation_reason',
        'deactivated_at',
        'deactivated_by',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'deactivated_at' => 'datetime',
        ];
    }

    /** @return BelongsToMany<Area, Client> */
    public function areas(): BelongsToMany
    {
        return $this->belongsToMany(Area::class, 'client_area');
    }

    /** @return HasMany<ClientContact, Client> */
    public function contacts(): HasMany
    {
        return $this->hasMany(ClientContact::class);
    }

    /** @return HasMany<ClientLocation, Client> */
    public function locations(): HasMany
    {
        return $this->hasMany(ClientLocation::class);
    }

    /** @return HasMany<Project, Client> */
    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function saasAffiliations(): HasMany
    {
        return $this->hasMany(Project::class)->where('engagement_type', 'saas');
    }

    /** @return HasMany<CrmActivity, Client> */
    public function crmActivities(): HasMany
    {
        return $this->hasMany(CrmActivity::class);
    }

    /** @return HasMany<Opportunity, Client> */
    public function opportunities(): HasMany
    {
        return $this->hasMany(Opportunity::class);
    }

    /** @return HasMany<Quotation, Client> */
    public function quotations(): HasMany
    {
        return $this->hasMany(Quotation::class);
    }

    /** @return HasMany<ClientContract, Client> */
    public function contracts(): HasMany
    {
        return $this->hasMany(ClientContract::class);
    }
}
