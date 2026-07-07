<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountReceivable;
use App\Services\AccountsReceivableService;
use App\Support\AreaVisibility;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountReceivableController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        AccountReceivable::query()
            ->where('status', 'pending')
            ->whereNotNull('due_on')
            ->whereDate('due_on', '<', now()->toDateString())
            ->update(['status' => 'overdue']);

        $q = AccountReceivable::query()
            ->with(['client:id,legal_name', 'document:id,title,doc_type', 'project:id,name', 'area:id,name', 'clientContract:id,title,installments_count'])
            ->withSum('payments as payments_total', 'amount');

        $this->applyScope($q, $request);

        if ($request->filled('status')) {
            $q->where('status', $request->input('status'));
        }
        if ($request->filled('client_id')) {
            $q->where('client_id', (int) $request->input('client_id'));
        }
        if ($request->filled('from')) {
            $q->whereDate('issued_on', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $q->whereDate('issued_on', '<=', $request->input('to'));
        }

        return response()->json($q->orderByDesc('issued_on')->paginate(40));
    }

    public function show(Request $request, AccountReceivable $accountReceivable): JsonResponse
    {
        $this->assertAccount($request, $accountReceivable);

        return response()->json($accountReceivable->load([
            'client',
            'document',
            'project',
            'area',
            'payments.income',
            'payments.registeredBy:id,name',
        ]));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'document_id' => ['nullable', 'integer', 'exists:documents,id'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'area_id' => ['required', 'integer', 'exists:areas,id'],
            'total_amount' => ['required', 'numeric', 'min:0.01'],
            'issued_on' => ['required', 'date'],
            'due_on' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);
        $data['area_id'] = $this->resolveAreaId($request);

        $account = AccountReceivable::query()->create(array_merge($data, [
            'paid_amount' => 0,
            'balance_amount' => $data['total_amount'],
            'status' => 'pending',
        ]));

        return response()->json($account->load(['client', 'document', 'project', 'area']), 201);
    }

    public function registerPayment(Request $request, AccountReceivable $accountReceivable, AccountsReceivableService $service): JsonResponse
    {
        $this->assertAccount($request, $accountReceivable);

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'paid_on' => ['required', 'date'],
            'method' => ['nullable', 'string', 'max:64'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $service->registerPayment($accountReceivable, $data, (int) $request->user()->id);

        return response()->json($accountReceivable->fresh()->load(['client', 'document', 'project', 'area', 'payments.income']));
    }

    private function assertAccount(Request $request, AccountReceivable $account): void
    {
        $q = AccountReceivable::query()->whereKey($account->id);
        $this->applyScope($q, $request);

        if (! $q->exists()) {
            abort(404);
        }
    }

    private function applyScope($q, Request $request): void
    {
        if ($request->user()?->isSuperadmin()) {
            return;
        }

        $ids = AreaVisibility::userAreaIds($request->user());
        if ($ids === []) {
            $q->whereRaw('1 = 0');

            return;
        }

        $q->whereIn('area_id', $ids);
    }

    private function resolveAreaId(Request $request): int
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }

        $areaId = $request->integer('area_id');
        if ($areaId <= 0) {
            abort(422, 'Seleccione la empresa de la cuenta por cobrar.');
        }

        if ($user->isSuperadmin()) {
            return $areaId;
        }

        $ids = AreaVisibility::userAreaIds($user);
        if (! in_array($areaId, $ids, true)) {
            abort(403, 'No puedes registrar cuentas por cobrar de otra empresa.');
        }

        return $areaId;
    }
}
