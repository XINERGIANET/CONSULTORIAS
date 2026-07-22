<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Area;
use App\Models\Client;
use App\Models\CrmActivity;
use App\Models\Expense;
use App\Models\Income;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use App\Support\AreaVisibility;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportsController extends Controller
{
    /** Comparacion de costos: mes actual vs mes anterior, con desglose por categoria. */
    public function costComparison(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user === null) {
            abort(401);
        }

        $curStart = Carbon::now()->startOfMonth();
        $curEnd = Carbon::now()->endOfMonth();
        $prevStart = Carbon::now()->subMonthNoOverflow()->startOfMonth();
        $prevEnd = Carbon::now()->subMonthNoOverflow()->endOfMonth();

        $curQ = Expense::query()->whereBetween('recorded_on', [$curStart->toDateString(), $curEnd->toDateString()]);
        AreaVisibility::applyExpenseScope($curQ, $user);
        $curTotal = (float) $curQ->clone()->sum('amount');

        $prevQ = Expense::query()->whereBetween('recorded_on', [$prevStart->toDateString(), $prevEnd->toDateString()]);
        AreaVisibility::applyExpenseScope($prevQ, $user);
        $prevTotal = (float) $prevQ->clone()->sum('amount');

        $deltaPct = $prevTotal > 0 ? round((($curTotal - $prevTotal) / $prevTotal) * 100, 1) : ($curTotal > 0 ? 100.0 : 0.0);

        $curByCat = $curQ->clone()
            ->selectRaw('financial_category_id, SUM(amount) as total')
            ->groupBy('financial_category_id')
            ->pluck('total', 'financial_category_id');

        $prevByCat = $prevQ->clone()
            ->selectRaw('financial_category_id, SUM(amount) as total')
            ->groupBy('financial_category_id')
            ->pluck('total', 'financial_category_id');

        $catIds = $curByCat->keys()->merge($prevByCat->keys())->unique()->filter();
        $catNames = \App\Models\FinancialCategory::query()->whereIn('id', $catIds)->pluck('name', 'id');

        $categories = $catIds->map(function ($id) use ($curByCat, $prevByCat, $catNames) {
            return [
                'name' => $catNames[$id] ?? 'Sin categoria',
                'current' => (float) ($curByCat[$id] ?? 0),
                'previous' => (float) ($prevByCat[$id] ?? 0),
            ];
        })->sortByDesc('current')->values()->take(5);

        return response()->json([
            'current_total' => $curTotal,
            'previous_total' => $prevTotal,
            'delta_pct' => $deltaPct,
            'categories' => $categories,
        ]);
    }

    /** Ultima actividad CRM real (llamadas, reuniones, notas) dentro del alcance del usuario. */
    public function recentActivity(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user === null) {
            abort(401);
        }

        $q = CrmActivity::query()->with(['client:id,legal_name', 'user:id,name'])->orderByDesc('occurred_at');
        AreaVisibility::applyCrmActivityScope($q, $user);
        $rows = $q->limit(6)->get();

        $items = $rows->map(fn (CrmActivity $a) => [
            'id' => $a->id,
            'type' => $a->type,
            'subject' => $a->subject ?? $a->client?->legal_name ?? 'Actividad',
            'client' => $a->client?->legal_name,
            'user' => $a->user?->name,
            'occurred_at' => optional($a->occurred_at)->toIso8601String(),
        ]);

        return response()->json(['items' => $items]);
    }

    public function cashFlow(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'granularity' => ['nullable', 'string', 'in:month,week,day'],
        ]);

        $from = $request->input('from') ? Carbon::parse($request->string('from')) : Carbon::now()->startOfYear();
        $to = $request->input('to') ? Carbon::parse($request->string('to')) : Carbon::now()->endOfMonth();

        $incomes = Income::query()
            ->selectRaw('DATE_FORMAT(recorded_on, \'%Y-%m\') as period, SUM(amount) as total')
            ->whereBetween('recorded_on', [$from->toDateString(), $to->toDateString()])
            ->groupBy('period');
        AreaVisibility::applyIncomeScope($incomes, $request->user());

        $expenses = Expense::query()
            ->selectRaw('DATE_FORMAT(recorded_on, \'%Y-%m\') as period, SUM(amount) as total')
            ->whereBetween('recorded_on', [$from->toDateString(), $to->toDateString()])
            ->groupBy('period');
        AreaVisibility::applyExpenseScope($expenses, $request->user());

        $rangeStart = $from->toDateString();
        $rangeEnd = $to->toDateString();

        $incomeTotalRow = Income::query()->whereBetween('recorded_on', [$rangeStart, $rangeEnd]);
        AreaVisibility::applyIncomeScope($incomeTotalRow, $request->user());

        $expenseTotalRow = Expense::query()->whereBetween('recorded_on', [$rangeStart, $rangeEnd]);
        AreaVisibility::applyExpenseScope($expenseTotalRow, $request->user());

        return response()->json([
            'ingresos' => $incomes->get(),
            'gastos' => $expenses->get(),
            'totales' => [
                'ingresos' => (float) $incomeTotalRow->sum('amount'),
                'gastos' => (float) $expenseTotalRow->sum('amount'),
                'balance' => round((float) $incomeTotalRow->sum('amount') - (float) $expenseTotalRow->sum('amount'), 2),
            ],
        ]);
    }

    /**
     * Flujo mensual detallado (Ene-Dic) con desglose de ingresos/egresos por categoria,
     * total neto por mes y saldo acumulado corriendo mes a mes.
     */
    public function cashFlowMonthly(Request $request): JsonResponse
    {
        $request->validate([
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
        ]);

        $user = $request->user();
        if ($user === null) {
            abort(401);
        }

        $year = (int) ($request->input('year') ?: Carbon::now()->year);

        $incomeQ = Income::query()->whereYear('recorded_on', $year);
        AreaVisibility::applyIncomeScope($incomeQ, $user);
        if ($request->filled('area_id')) {
            $incomeQ->where('area_id', (int) $request->input('area_id'));
        }

        $expenseQ = Expense::query()->whereYear('recorded_on', $year);
        AreaVisibility::applyExpenseScope($expenseQ, $user);
        if ($request->filled('area_id')) {
            $expenseQ->where('area_id', (int) $request->input('area_id'));
        }

        $incomeRows = $incomeQ->selectRaw('financial_category_id, MONTH(recorded_on) as m, SUM(amount) as total')
            ->groupBy('financial_category_id', 'm')
            ->get();

        $expenseRows = $expenseQ->selectRaw('financial_category_id, MONTH(recorded_on) as m, SUM(amount) as total')
            ->groupBy('financial_category_id', 'm')
            ->get();

        $buildByCategory = function ($rows): array {
            $byCategory = [];
            foreach ($rows as $r) {
                $catId = (int) ($r->financial_category_id ?? 0);
                if (! isset($byCategory[$catId])) {
                    $byCategory[$catId] = array_fill(1, 12, 0.0);
                }
                $byCategory[$catId][(int) $r->m] = (float) $r->total;
            }

            return $byCategory;
        };

        $incomeByCategory = $buildByCategory($incomeRows);
        $expenseByCategory = $buildByCategory($expenseRows);

        $catIds = array_values(array_unique(array_merge(array_keys($incomeByCategory), array_keys($expenseByCategory))));
        $catNames = \App\Models\FinancialCategory::query()->whereIn('id', $catIds)->pluck('name', 'id');

        $toCategoryList = function (array $byCategory) use ($catNames): array {
            $list = [];
            foreach ($byCategory as $catId => $monthly) {
                $list[] = [
                    'id' => $catId,
                    'name' => $catId > 0 ? ($catNames[$catId] ?? 'Sin categoría') : 'Sin categoría',
                    'monthly' => array_map(fn ($v) => round($v, 2), array_values($monthly)),
                ];
            }
            usort($list, fn ($a, $b) => strcmp($a['name'], $b['name']));

            return $list;
        };

        $incomeCategories = $toCategoryList($incomeByCategory);
        $expenseCategories = $toCategoryList($expenseByCategory);

        $sumMonthly = function (array $categories): array {
            $totals = array_fill(0, 12, 0.0);
            foreach ($categories as $c) {
                foreach ($c['monthly'] as $i => $v) {
                    $totals[$i] += $v;
                }
            }

            return array_map(fn ($v) => round($v, 2), $totals);
        };

        $incomeTotal = $sumMonthly($incomeCategories);
        $expenseTotal = $sumMonthly($expenseCategories);

        $netTotal = [];
        for ($i = 0; $i < 12; $i++) {
            $netTotal[] = round($incomeTotal[$i] - $expenseTotal[$i], 2);
        }

        $cumulative = [];
        $running = 0.0;
        foreach ($netTotal as $v) {
            $running += $v;
            $cumulative[] = round($running, 2);
        }

        return response()->json([
            'year' => $year,
            'months' => ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'],
            'income_categories' => $incomeCategories,
            'income_total' => $incomeTotal,
            'expense_categories' => $expenseCategories,
            'expense_total' => $expenseTotal,
            'net_total' => $netTotal,
            'cumulative' => $cumulative,
        ]);
    }

    public function profitabilityProjects(Request $request): JsonResponse
    {
        $q = Project::query()->with([
            'client:id,legal_name',
            'areas:id,name',
            'leadUser:id,name',
            'users:id,name,cost_per_hour',
        ]);

        AreaVisibility::applyProjectScope($q, $request->user());
        $rows = $q->orderByDesc('id')->limit(400)->get();

        $payload = [];
        foreach ($rows as $p) {
            $incomes = Income::query()->where('project_id', $p->id);
            AreaVisibility::applyIncomeScope($incomes, $request->user());

            $expensesMoney = Expense::query()->where('project_id', $p->id);
            AreaVisibility::applyExpenseScope($expensesMoney, $request->user());

            $timeRows = TimeEntry::query()->where('project_id', $p->id)->with('user:id,cost_per_hour,name');
            AreaVisibility::applyTimeEntryScope($timeRows, $request->user());

            $incomeSum = (float) $incomes->sum('amount');
            $expenseSum = (float) $expensesMoney->sum('amount');

            $laborCost = 0.0;
            foreach ($timeRows->clone()->get() as $te) {
                $rate = (float) ($te->user->cost_per_hour ?? 0);
                $laborCost += ((float) $te->hours) * $rate;
            }

            $totalCost = $expenseSum + $laborCost;
            $util = $incomeSum - $totalCost;
            $marginPct = $incomeSum > 0 ? round($util / $incomeSum * 100, 2) : 0.0;

            $payload[] = [
                'project_id' => $p->id,
                'name' => $p->name,
                'client' => $p->client->legal_name ?? '',
                'ingresos' => $incomeSum,
                'gastos_directos' => $expenseSum,
                'costo_horas_estimado' => round($laborCost, 2),
                'utilidad_neta_estimada' => round($util, 2),
                'margen_pct' => $marginPct,
            ];
        }

        usort($payload, fn ($a, $b) => $b['utilidad_neta_estimada'] <=> $a['utilidad_neta_estimada']);

        return response()->json([
            'data' => array_slice($payload, 0, 100),
            'formula' => 'Utilidad estimada = Ingresos del proyecto − (Costos directos + Horas registradas × costo/hora)',
        ]);
    }

    public function profitabilityClients(Request $request): JsonResponse
    {
        $q = Client::query();
        AreaVisibility::applyClientScope($q, $request->user());
        $clients = $q->with('areas')->orderByDesc('id')->limit(300)->get();

        $payload = [];

        foreach ($clients as $c) {
            $projectIds = $c->projects()->pluck('id');

            $incomeSum = Income::query()->where(function ($w) use ($c, $projectIds) {
                $w->where('client_id', $c->id)->orWhereIn('project_id', $projectIds);
            });
            AreaVisibility::applyIncomeScope($incomeSum, $request->user());
            $iVal = (float) $incomeSum->sum('amount');

            $expenseSum = Expense::query()->where('client_id', $c->id);
            AreaVisibility::applyExpenseScope($expenseSum, $request->user());
            $eVal = (float) $expenseSum->sum('amount');

            $util = $iVal - $eVal;

            $payload[] = [
                'client_id' => $c->id,
                'legal_name' => $c->legal_name,
                'ingresos' => $iVal,
                'gastos_declarados' => $eVal,
                'utilidad' => round($util, 2),
                'areas' => $c->areas->pluck('name')->values()->all(),
            ];
        }

        usort($payload, fn ($a, $b) => $b['utilidad'] <=> $a['utilidad']);

        return response()->json([
            'data' => array_slice($payload, 0, 100),
            'formula' => 'Rentabilidad = Ingresos asociados al cliente − Costos registrados contra el cliente',
        ]);
    }

    public function profitabilityAreas(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user === null) {
            abort(401);
        }

        $aidList = AreaVisibility::canSeeAll($user)
            ? Area::query()->where('is_active', true)->orderBy('name')->pluck('id')
            : collect(AreaVisibility::userAreaIds($user));

        $data = [];

        foreach ($aidList as $aid) {
            $incomes = Income::query()->where('area_id', $aid);
            AreaVisibility::applyIncomeScope($incomes, $user);
            $iVal = (float) $incomes->sum('amount');

            $expenses = Expense::query()->where('area_id', $aid);
            AreaVisibility::applyExpenseScope($expenses, $user);
            $eVal = (float) $expenses->sum('amount');

            $areaRow = Area::query()->find($aid);

            $data[] = [
                'area_id' => $aid,
                'area_name' => $areaRow ? $areaRow->name : '',
                'ingresos' => $iVal,
                'gastos' => $eVal,
                'utilidad' => round($iVal - $eVal, 2),
            ];
        }

        usort($data, fn ($a, $b) => $b['utilidad'] <=> $a['utilidad']);

        return response()->json(['data' => $data]);
    }

    public function consultantWorkload(Request $request): JsonResponse
    {
        $q = TimeEntry::query()
            ->selectRaw('user_id, SUM(hours) as total_hours')
            ->groupBy('user_id');
        AreaVisibility::applyTimeEntryScope($q, $request->user());
        $rows = $q->orderByDesc('total_hours')->get();

        $users = User::query()
            ->whereIn('id', $rows->pluck('user_id')->filter()->all())
            ->get()
            ->keyBy('id');

        $payload = $rows->map(function ($r) use ($users) {
            $u = $users->get($r->user_id);

            return [
                'user_id' => $r->user_id,
                'nombre' => $u?->name,
                'total_horas' => (float) $r->total_hours,
            ];
        });

        return response()->json([
            'data' => $payload->values()->all(),
        ]);
    }

    /** Top clientes con más ingresos (mes actual). */
    public function insights(Request $request): JsonResponse
    {
        $from = Carbon::now()->startOfMonth()->toDateString();
        $to = Carbon::now()->endOfMonth()->toDateString();

        $incomeClient = Income::query()
            ->selectRaw('client_id, SUM(amount) as t')
            ->whereBetween('recorded_on', [$from, $to])
            ->whereNotNull('client_id')
            ->groupBy('client_id');

        AreaVisibility::applyIncomeScope($incomeClient, $request->user());

        $topRows = $incomeClient->clone()->orderByDesc('t')->limit(10)->get();

        $payload = [];
        foreach ($topRows as $row) {
            $c = Client::query()->find($row->client_id);

            $payload[] = [
                'client_id' => $row->client_id,
                'legal_name' => $c?->legal_name,
                'total' => (float) $row->t,
            ];
        }

        $quotationsPending = \App\Models\Quotation::query()
            ->whereIn('status', ['draft', 'sent'])
            ->tap(fn ($qr) => AreaVisibility::applyQuotationScope($qr, $request->user()))
            ->count();

        return response()->json([
            'period' => [$from, $to],
            'top_clients' => $payload,
            'cotizaciones_pendientes' => $quotationsPending,
        ]);
    }
}
