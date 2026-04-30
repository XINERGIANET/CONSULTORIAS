<?php

namespace App\Services;

use App\Models\Client;
use App\Models\Expense;
use App\Models\Income;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use App\Support\AreaVisibility;
use Carbon\Carbon;

class DashboardService
{
    /**
     * @return array<string, mixed>
     */
    public function payload(?User $user): array
    {
        if ($user === null) {
            return [
                'kpi' => [],
                'orderStatus' => [],
                'orderTotal' => 0,
                'ordersMenuBadge' => 0,
            ];
        }

        $user->loadMissing(['role', 'areas']);

        $start = Carbon::now()->startOfMonth();
        $end = Carbon::now()->endOfMonth();

        $incomeQuery = Income::query()->whereBetween('recorded_on', [$start->toDateString(), $end->toDateString()]);
        AreaVisibility::applyIncomeScope($incomeQuery, $user);
        $monthlyIncome = (float) $incomeQuery->clone()->sum('amount');

        $expenseQuery = Expense::query()->whereBetween('recorded_on', [$start->toDateString(), $end->toDateString()]);
        AreaVisibility::applyExpenseScope($expenseQuery, $user);
        $monthlyExpense = (float) $expenseQuery->clone()->sum('amount');

        $utility = $monthlyIncome - $monthlyExpense;

        $projectQuery = Project::query()->whereIn('status', ['pending', 'in_progress', 'paused']);
        AreaVisibility::applyProjectScope($projectQuery, $user);
        $activeProjects = (int) $projectQuery->count();

        $clientQuery = Client::query()->where('is_active', true);
        AreaVisibility::applyClientScope($clientQuery, $user);
        $activeClients = (int) $clientQuery->count();

        $overdueIncome = Income::query()
            ->where('payment_status', 'overdue')
            ->whereBetween('recorded_on', [$start->copy()->subMonths(12)->toDateString(), $end->toDateString()]);
        AreaVisibility::applyIncomeScope($overdueIncome, $user);
        $clientsMorosos = (int) $overdueIncome->clone()->distinct('client_id')->count('client_id');

        $lateProjects = Project::query()
            ->where('status', 'in_progress')
            ->whereNotNull('end_estimated')
            ->whereDate('end_estimated', '<', Carbon::today()->toDateString());
        AreaVisibility::applyProjectScope($lateProjects, $user);
        $lateProjectCount = (int) $lateProjects->count();

        $pendingTime = TimeEntry::query()->where('status', 'pending');
        AreaVisibility::applyTimeEntryScope($pendingTime, $user);

        $kpi = [
            [
                'id' => 'revenue',
                'title' => 'Ingresos del mes',
                'value' => 'S/. '.number_format($monthlyIncome, 2, '.', ','),
                'delta' => 'Mes en curso',
                'up' => $monthlyIncome >= $monthlyExpense,
            ],
            [
                'id' => 'active_users',
                'title' => 'Gastos del mes',
                'value' => 'S/. '.number_format($monthlyExpense, 2, '.', ','),
                'delta' => 'Mes en curso',
                'up' => false,
            ],
            [
                'id' => 'total_orders',
                'title' => 'Utilidad bruta mensual',
                'value' => 'S/. '.number_format($utility, 2, '.', ','),
                'delta' => 'Ingresos − Gastos',
                'up' => $utility >= 0,
            ],
            [
                'id' => 'customers',
                'title' => 'Proyectos activos',
                'value' => (string) $activeProjects,
                'delta' => 'Clientes activos: '.$activeClients,
                'up' => true,
            ],
        ];

        $byStatus = Project::query()
            ->selectRaw('status, COUNT(*) as c')
            ->tap(fn ($q) => AreaVisibility::applyProjectScope($q, $user))
            ->groupBy('status')
            ->pluck('c', 'status');

        $statusOrder = ['pending', 'in_progress', 'paused', 'finished', 'cancelled'];
        $meta = [
            'pending' => ['name' => 'Pendiente', 'color' => '#007BFF'],
            'in_progress' => ['name' => 'En proceso', 'color' => '#3399FF'],
            'paused' => ['name' => 'Pausado', 'color' => '#f59e0b'],
            'finished' => ['name' => 'Finalizado', 'color' => '#5BA3FF'],
            'cancelled' => ['name' => 'Cancelado', 'color' => '#94a3b8'],
        ];

        $projectTotal = (int) $byStatus->sum();
        $orderStatus = [];
        foreach ($statusOrder as $key) {
            $c = (int) ($byStatus[$key] ?? 0);
            $pct = $projectTotal > 0 ? (int) round($c / $projectTotal * 100) : 0;
            $orderStatus[] = [
                'name' => $meta[$key]['name'] ?? $key,
                'value' => $pct,
                'color' => $meta[$key]['color'] ?? '#64748b',
            ];
        }

        return [
            'kpi' => $kpi,
            'orderStatus' => $orderStatus,
            'orderTotal' => $projectTotal,
            'ordersMenuBadge' => $lateProjectCount + $clientsMorosos,
            'meta' => [
                'late_projects' => $lateProjectCount,
                'delinquent_clients' => $clientsMorosos,
                'active_clients' => $activeClients,
            ],
        ];
    }
}
