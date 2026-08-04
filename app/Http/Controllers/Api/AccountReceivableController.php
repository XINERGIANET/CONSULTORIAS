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
            ->whereIn('status', ['pending', 'partial'])
            ->where(function ($q) {
                $q->where(function ($sub) {
                    $sub->whereNotNull('due_on')->whereDate('due_on', '<', now()->toDateString());
                })->orWhere(function ($sub) {
                    $sub->whereNotNull('projected_due_on')->whereDate('projected_due_on', '<', now()->toDateString());
                });
            })
            ->update(['status' => 'overdue']);

        $q = AccountReceivable::query()
            ->with(['client:id,legal_name', 'document:id,title,doc_type', 'project:id,name', 'area:id,name', 'clientContract:id,title,installments_count', 'payments.income', 'payments.registeredBy:id,name'])
            ->withSum('payments as payments_total', 'amount');

        $this->applyScope($q, $request);

        if ($request->filled('status')) {
            if ($request->input('status') !== 'all') {
                $q->where('status', $request->input('status'));
            }
        } else {
            $q->where('status', '!=', 'cancelled');
        }
        if ($request->filled('client_id')) {
            $q->where('client_id', (int) $request->input('client_id'));
        }
        if ($request->filled('project_id')) {
            $q->where('project_id', (int) $request->input('project_id'));
        }
        if ($request->filled('from')) {
            $q->whereDate('issued_on', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $q->whereDate('issued_on', '<=', $request->input('to'));
        }

        $sort = $request->string('sort')->toString();
        $dir = strtolower($request->string('dir', 'asc')->toString()) === 'desc' ? 'desc' : 'asc';

        if ($sort === 'issued_on') {
            $q->orderBy('issued_on', $dir)->orderBy('id', $dir);
        } else {
            $q->orderByRaw("COALESCE(due_on, projected_due_on, issued_on) {$dir}")
                ->orderBy('id', $dir);
        }

        $paginated = $q->paginate(40);


        $today = now()->startOfDay();
        $paginated->getCollection()->transform(function (AccountReceivable $ar) use ($today) {
            $dueDate = $ar->projected_due_on ?? $ar->due_on;
            if ($dueDate !== null && $ar->status !== 'paid' && $ar->status !== 'cancelled' && $dueDate->isPast()) {
                $ar->mora_dias = (int) $dueDate->diffInDays($today);
            } else {
                $ar->mora_dias = 0;
            }

            return $ar;
        });

        return response()->json($paginated);
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
            'client_contract_id' => ['nullable', 'integer', 'exists:client_contracts,id'],
            'area_id' => ['required', 'integer', 'exists:areas,id'],
            'installment_number' => ['nullable', 'integer', 'min:1'],
            'total_amount' => ['required', 'numeric', 'min:0.01'],
            'issued_on' => ['required', 'date'],
            'due_on' => ['nullable', 'date'],
            'projected_due_on' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);
        $data['area_id'] = $this->resolveAreaId($request);

        $account = AccountReceivable::query()->create(array_merge($data, [
            'paid_amount' => 0,
            'balance_amount' => $data['total_amount'],
            'status' => 'pending',
            'due_on' => $data['due_on'] ?? $data['projected_due_on'] ?? $data['issued_on'],
            'projected_due_on' => $data['projected_due_on'] ?? $data['due_on'] ?? $data['issued_on'],
        ]));

        return response()->json($account->load(['client', 'document', 'project', 'area']), 201);
    }

    public function update(Request $request, AccountReceivable $accountReceivable): JsonResponse
    {
        $this->assertAccount($request, $accountReceivable);

        $data = $request->validate([
            'collected_on' => ['nullable', 'date'],
            'due_on' => ['nullable', 'date'],
            'projected_due_on' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'total_amount' => ['nullable', 'numeric', 'min:0.01'],
        ]);

        if (isset($data['total_amount']) && (float) $accountReceivable->paid_amount > 0) {
            abort(422, 'No se puede modificar el monto total de una cuenta por cobrar que ya tiene abonos.');
        }

        if (isset($data['total_amount'])) {
            $data['balance_amount'] = (float) $data['total_amount'] - (float) $accountReceivable->paid_amount;
        }

        $accountReceivable->update($data);

        $service = new AccountsReceivableService();
        $service->recalculate($accountReceivable);

        return response()->json($accountReceivable->fresh()->load(['client', 'document', 'project', 'area', 'payments.income']));
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

        return response()->json($accountReceivable->fresh()->load(['client', 'document', 'project', 'area', 'payments.income', 'payments.registeredBy:id,name']));
    }

    public function revertPayment(Request $request, AccountReceivable $accountReceivable, \App\Models\AccountReceivablePayment $payment, AccountsReceivableService $service): JsonResponse
    {
        $this->assertAccount($request, $accountReceivable);

        if ((int) $payment->account_receivable_id !== (int) $accountReceivable->id) {
            abort(404);
        }

        $service->revertPayment($accountReceivable, $payment);

        return response()->json($accountReceivable->fresh()->load(['client', 'document', 'project', 'area', 'payments.income', 'payments.registeredBy:id,name']));
    }

    public function destroy(Request $request, AccountReceivable $accountReceivable): JsonResponse
    {
        $this->assertAccount($request, $accountReceivable);

        if ($accountReceivable->payments()->exists()) {
            abort(422, 'No se puede eliminar una cuenta por cobrar con pagos registrados. Revierta los pagos primero.');
        }

        $accountReceivable->delete();

        return response()->json(null, 204);
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
