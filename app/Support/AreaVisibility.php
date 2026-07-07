<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class AreaVisibility
{
    public static function canSeeAll(User $user): bool
    {
        return $user->isSuperadmin();
    }

    /**
     * @return list<int|string>
     */
    public static function userAreaIds(User $user): array
    {
        if (! $user->relationLoaded('areas')) {
            $user->load('areas');
        }

        return $user->areas->pluck('id')->all();
    }

    public static function firstUserAreaId(User $user): ?int
    {
        $id = self::userAreaIds($user)[0] ?? null;

        return $id !== null ? (int) $id : null;
    }

    public static function userCanUseArea(User $user, int $areaId): bool
    {
        return self::canSeeAll($user) || in_array($areaId, array_map('intval', self::userAreaIds($user)), true);
    }

    public static function canManageOwnAreas(User $user): bool
    {
        return self::canSeeAll($user) || ($user->role !== null && $user->role->slug === 'admin');
    }

    /**
     * @param  list<int|string>  $areaIds
     * @return list<int>
     */
    public static function allowedAreaIdsOrFail(User $user, array $areaIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $areaIds)));
        if ($ids === []) {
            abort(422, 'Empresa requerida.');
        }

        if (self::canSeeAll($user)) {
            return $ids;
        }

        $allowed = array_map('intval', self::userAreaIds($user));
        $denied = array_diff($ids, $allowed);
        if ($denied !== []) {
            abort(403, 'No puede operar con otra empresa.');
        }

        return $ids;
    }

    public static function resolveAreaIdOrFail(User $user, mixed $areaId): int
    {
        $id = $areaId !== null && $areaId !== '' ? (int) $areaId : self::firstUserAreaId($user);
        if ($id === null) {
            abort(422, 'Empresa requerida.');
        }

        return self::allowedAreaIdsOrFail($user, [$id])[0];
    }

    /** @param  Builder<\App\Models\Client>  $q */
    public static function applyClientScope(Builder $q, User $user): Builder
    {
        if (self::canSeeAll($user)) {
            return $q;
        }

        if ($user->role !== null && $user->role->slug === 'colaborador') {
            return $q->whereHas('projects.users', fn (Builder $b) => $b->where('users.id', $user->id));
        }

        $ids = self::userAreaIds($user);
        if ($ids === []) {
            return $q->whereRaw('1 = 0');
        }

        return $q->whereHas('areas', fn (Builder $b) => $b->whereIn('areas.id', $ids));
    }

    /** @param  Builder<\App\Models\Project>  $q */
    public static function applyProjectScope(Builder $q, User $user): Builder
    {
        if (self::canSeeAll($user)) {
            return $q;
        }

        if ($user->role !== null && $user->role->slug === 'colaborador') {
            return $q->whereHas('users', fn (Builder $b) => $b->where('users.id', $user->id));
        }

        $ids = self::userAreaIds($user);
        if ($ids === []) {
            return $q->whereRaw('1 = 0');
        }

        return $q->whereHas('areas', fn (Builder $b) => $b->whereIn('areas.id', $ids));
    }

    /** @param  Builder<\App\Models\Opportunity>  $q */
    public static function applyOpportunityScope(Builder $q, User $user): Builder
    {
        if (self::canSeeAll($user)) {
            return $q;
        }

        if ($user->role !== null && $user->role->slug === 'colaborador') {
            return $q->whereHas('client.projects.users', fn (Builder $b) => $b->where('users.id', $user->id));
        }

        $ids = self::userAreaIds($user);
        if ($ids === []) {
            return $q->whereRaw('1 = 0');
        }

        return $q->where(function (Builder $w) use ($ids) {
            $w->whereIn('area_id', $ids)->orWhereHas('client.areas', fn (Builder $b) => $b->whereIn('areas.id', $ids));
        });
    }

    /** @param  Builder<\App\Models\Income>  $q */
    public static function applyIncomeScope(Builder $q, User $user): Builder
    {
        if (self::canSeeAll($user)) {
            return $q;
        }

        if ($user->role !== null && $user->role->slug === 'colaborador') {
            $pids = $user->projects()->pluck('projects.id')->all();

            return $q->whereIn('project_id', $pids);
        }

        $ids = self::userAreaIds($user);
        if ($ids === []) {
            return $q->whereRaw('1 = 0');
        }

        return $q->whereIn('area_id', $ids);
    }

    /** @param  Builder<\App\Models\Expense>  $q */
    public static function applyExpenseScope(Builder $q, User $user): Builder
    {
        if (self::canSeeAll($user)) {
            return $q;
        }

        $ids = self::userAreaIds($user);
        if ($ids === []) {
            return $q->whereRaw('1 = 0');
        }

        return $q->whereIn('area_id', $ids);
    }

    /** @param  Builder<\App\Models\Quotation>  $q */
    public static function applyQuotationScope(Builder $q, User $user): Builder
    {
        if (self::canSeeAll($user)) {
            return $q;
        }

        $ids = self::userAreaIds($user);
        if ($ids === []) {
            return $q->whereRaw('1 = 0');
        }

        return $q->where(function (Builder $w) use ($ids) {
            $w->whereHas('areas', fn (Builder $b) => $b->whereIn('areas.id', $ids))
                ->orWhereHas('client.areas', fn (Builder $b) => $b->whereIn('areas.id', $ids));
        });
    }

    /** @param  Builder<\App\Models\TimeEntry>  $q */
    public static function applyTimeEntryScope(Builder $q, User $user): Builder
    {
        if (self::canSeeAll($user)) {
            return $q;
        }

        if ($user->role !== null && $user->role->slug === 'colaborador') {
            return $q->where('user_id', $user->id);
        }

        $ids = self::userAreaIds($user);
        if ($ids === []) {
            return $q->whereRaw('1 = 0');
        }

        return $q->whereIn('area_id', $ids);
    }

    /** @param  Builder<\App\Models\Document>  $q */
    public static function applyDocumentScope(Builder $q, User $user): Builder
    {
        if (self::canSeeAll($user)) {
            return $q;
        }

        $ids = self::userAreaIds($user);
        if ($ids === []) {
            return $q->whereRaw('1 = 0');
        }

        return $q->where(function (Builder $w) use ($ids) {
            $w->whereIn('area_id', $ids)
                ->orWhereHas('project.areas', fn (Builder $b) => $b->whereIn('areas.id', $ids))
                ->orWhereHas('client.areas', fn (Builder $b) => $b->whereIn('areas.id', $ids));
        });
    }

    /** @param  Builder<\App\Models\CrmActivity>  $q */
    public static function applyCrmActivityScope(Builder $q, User $user): Builder
    {
        if (self::canSeeAll($user)) {
            return $q;
        }

        if ($user->role !== null && $user->role->slug === 'colaborador') {
            return $q->whereHas('client.projects.users', fn (Builder $b) => $b->where('users.id', $user->id));
        }

        $ids = self::userAreaIds($user);
        if ($ids === []) {
            return $q->whereRaw('1 = 0');
        }

        return $q->whereHas('client.areas', fn (Builder $b) => $b->whereIn('areas.id', $ids));
    }
}
