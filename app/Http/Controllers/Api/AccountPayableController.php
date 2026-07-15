<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountPayable;
use App\Services\AccountsPayableService;
use App\Support\AreaVisibility;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountPayableController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        AccountPayable::query()
            ->whereIn('status', ['pending', 'partial'])
            ->whereDate('projected_due_on', '<', now()->toDateString())
            ->update(['status' => 'overdue']);

        $q = AccountPayable::query()
            ->with(['user:id,name', 'area:id,name', 'project:id,name']);

        $this->applyScope($q, $request);

        if ($request->filled('status')) {
            $q->where('status', $request->input('status'));
        }
        if ($request->filled('payable_type')) {
            $q->where('payable_type', $request->input('payable_type'));
        }
        if ($request->filled('from')) {
            $q->whereDate('projected_due_on', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $q->whereDate('projected_due_on', '<=', $request->input('to'));
        }

        return response()->json($q->orderBy('projected_due_on')->paginate(40));
    }

    public function show(Request $request, AccountPayable $accountPayable): JsonResponse
    {
        $this->assertAccount($request, $accountPayable);

        return response()->json($accountPayable->load([
            'user',
            'area',
            'project',
            'payments.expense',
            'payments.registeredBy:id,name',
        ]));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'payable_type' => ['required', 'string', 'in:supplier,payroll,other'],
            'vendor_name' => ['nullable', 'string', 'max:255'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'area_id' => ['required', 'integer', 'exists:areas,id'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'total_amount' => ['required', 'numeric', 'min:0.01'],
            'projected_due_on' => ['required', 'date'],
            'requires_invoice' => ['sometimes', 'boolean'],
            'description' => ['required', 'string', 'max:500'],
            'notes' => ['nullable', 'string'],
            'period_year' => ['nullable', 'integer'],
            'period_month' => ['nullable', 'integer', 'min:1', 'max:12'],
        ]);
        $data['area_id'] = $this->resolveAreaId($request);

        $account = AccountPayable::query()->create(array_merge($data, [
            'paid_amount' => 0,
            'balance_amount' => $data['total_amount'],
            'status' => 'pending',
            'requires_invoice' => $request->boolean('requires_invoice'),
        ]));

        return response()->json($account->load(['user', 'area']), 201);
    }

    public function registerPayment(Request $request, AccountPayable $accountPayable, AccountsPayableService $service): JsonResponse
    {
        $this->assertAccount($request, $accountPayable);

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'paid_on' => ['required', 'date'],
            'method' => ['nullable', 'string', 'max:64'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $service->registerPayment($accountPayable, $data, (int) $request->user()->id);

        return response()->json($accountPayable->fresh()->load(['user', 'area', 'payments.expense']));
    }

    public function markInvoiced(Request $request, AccountPayable $accountPayable): JsonResponse
    {
        $this->assertAccount($request, $accountPayable);
        $data = $request->validate([
            'invoiced_on' => ['required', 'date'],
            'document_id' => ['nullable', 'integer', 'exists:documents,id'],
        ]);

        $accountPayable->update([
            'invoiced_on' => $data['invoiced_on'],
            'document_id' => $data['document_id'] ?? $accountPayable->document_id,
        ]);

        return response()->json($accountPayable->fresh());
    }

    public function destroy(Request $request, AccountPayable $accountPayable): JsonResponse
    {
        $this->assertAccount($request, $accountPayable);

        if ($accountPayable->payments()->exists()) {
            abort(422, 'No se puede eliminar una cuenta por pagar con pagos registrados.');
        }

        $accountPayable->delete();

        return response()->json(null, 204);
    }

    public function generatePayroll(Request $request, AccountsPayableService $service): JsonResponse
    {
        $data = $request->validate([
            'area_id' => ['required', 'integer', 'exists:areas,id'],
            'period_year' => ['required', 'integer', 'min:2020', 'max:2100'],
            'period_month' => ['required', 'integer', 'min:1', 'max:12'],
        ]);
        $areaId = $this->resolveAreaId($request);

        $rows = $service->generatePayroll(
            $areaId,
            (int) $data['period_year'],
            (int) $data['period_month'],
            (int) $request->user()->id
        );

        return response()->json([
            'created' => count($rows),
            'items' => $rows,
        ], 201);
    }

    private function assertAccount(Request $request, AccountPayable $account): void
    {
        $q = AccountPayable::query()->whereKey($account->id);
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
            abort(422, 'Seleccione la empresa de la cuenta por pagar.');
        }

        if ($user->isSuperadmin()) {
            return $areaId;
        }

        $ids = AreaVisibility::userAreaIds($user);
        if (! in_array($areaId, $ids, true)) {
            abort(403, 'No puedes registrar cuentas por pagar de otra empresa.');
        }

        return $areaId;
    }
}
