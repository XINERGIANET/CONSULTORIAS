<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\TimeEntry;
use App\Support\AreaVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    public function index(): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        $canSeeAll = AreaVisibility::canSeeAll($user);
        $areaIds   = $canSeeAll ? [] : AreaVisibility::userAreaIds($user);

        $today  = now()->toDateString();
        $inWeek = now()->addDays(7)->toDateString();

        $items = [];

        // ── Cuentas por cobrar vencidas o próximas ──────────────────────
        $arQ = AccountReceivable::query()
            ->with(['client:id,legal_name'])
            ->whereIn('status', ['pending', 'partial', 'overdue'])
            ->where('balance_amount', '>', 0)
            ->where(function ($q) use ($today, $inWeek) {
                $q->where(function ($q2) use ($today) {
                    $q2->whereNotNull('projected_due_on')
                       ->whereDate('projected_due_on', '<=', $today);
                })->orWhere(function ($q2) use ($today, $inWeek) {
                    $q2->whereNotNull('projected_due_on')
                       ->whereDate('projected_due_on', '>', $today)
                       ->whereDate('projected_due_on', '<=', $inWeek);
                })->orWhere(function ($q2) use ($today) {
                    $q2->whereNotNull('due_on')
                       ->whereDate('due_on', '<=', $today);
                });
            });

        if (! $canSeeAll) {
            if ($areaIds === []) {
                $arQ->whereRaw('1 = 0');
            } else {
                $arQ->whereIn('area_id', $areaIds);
            }
        }

        foreach ($arQ->orderByRaw("COALESCE(projected_due_on, due_on) ASC")->limit(10)->get() as $ar) {
            $dueDate  = $ar->projected_due_on ?? $ar->due_on;
            $overdue  = $dueDate && $dueDate <= $today;
            $items[] = [
                'id'       => 'ar_' . $ar->id,
                'type'     => 'cxc',
                'severity' => $overdue ? 'danger' : 'warning',
                'title'    => 'Cobro ' . ($overdue ? 'vencido' : 'próximo'),
                'body'     => ($ar->client?->legal_name ?? '—') . ' · S/. ' . number_format((float) $ar->balance_amount, 2),
                'date'     => $dueDate ? Carbon::parse($dueDate)->format('d/m/Y') : null,
                'link'     => '/cuentas-por-cobrar',
            ];
        }

        // ── Cuentas por pagar vencidas o próximas ───────────────────────
        $apQ = AccountPayable::query()
            ->with(['user:id,name'])
            ->whereIn('status', ['pending', 'partial', 'overdue'])
            ->where('balance_amount', '>', 0)
            ->whereNotNull('projected_due_on')
            ->where(function ($q) use ($today, $inWeek) {
                $q->whereDate('projected_due_on', '<=', $today)
                  ->orWhere(function ($q2) use ($today, $inWeek) {
                      $q2->whereDate('projected_due_on', '>', $today)
                         ->whereDate('projected_due_on', '<=', $inWeek);
                  });
            });

        if (! $canSeeAll) {
            if ($areaIds === []) {
                $apQ->whereRaw('1 = 0');
            } else {
                $apQ->whereIn('area_id', $areaIds);
            }
        }

        foreach ($apQ->orderBy('projected_due_on')->limit(10)->get() as $ap) {
            $overdue = $ap->projected_due_on <= $today;
            $typeLabel = match ($ap->payable_type) {
                'payroll'  => 'Planilla',
                'supplier' => 'Proveedor',
                default    => 'Pago',
            };
            $items[] = [
                'id'       => 'ap_' . $ap->id,
                'type'     => 'cxp',
                'severity' => $overdue ? 'danger' : 'warning',
                'title'    => $typeLabel . ' ' . ($overdue ? 'vencido' : 'próximo'),
                'body'     => ($ap->vendor_name ?? $ap->user?->name ?? $ap->description ?? '—') . ' · S/. ' . number_format((float) $ap->balance_amount, 2),
                'date'     => Carbon::parse($ap->projected_due_on)->format('d/m/Y'),
                'link'     => '/cuentas-por-pagar',
            ];
        }

        // ── Tiempos pendientes de aprobación (solo admin/superadmin) ────
        if ($canSeeAll) {
            $pendingTe = TimeEntry::query()->where('status', 'pending')->count();
            if ($pendingTe > 0) {
                $items[] = [
                    'id'       => 'te_pending',
                    'type'     => 'tiempos',
                    'severity' => 'info',
                    'title'    => 'Registros horarios pendientes',
                    'body'     => $pendingTe . ' registro' . ($pendingTe > 1 ? 's' : '') . ' esperando aprobación',
                    'date'     => null,
                    'link'     => '/tiempos',
                ];
            }
        }

        // danger → warning → info
        usort($items, static function (array $a, array $b): int {
            $order = ['danger' => 0, 'warning' => 1, 'info' => 2];
            return ($order[$a['severity']] ?? 9) <=> ($order[$b['severity']] ?? 9);
        });

        $sliced = array_slice($items, 0, 20);

        return response()->json([
            'count' => count($sliced),
            'items' => $sliced,
        ]);
    }
}
