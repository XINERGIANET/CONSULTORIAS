<?php

namespace App\Services;

use App\Models\AccountPayable;
use App\Models\AccountPayablePayment;
use App\Models\Expense;
use App\Models\FinancialCategory;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AccountsPayableService
{
    public function registerPayment(AccountPayable $account, array $data, int $userId): AccountPayablePayment
    {
        return DB::transaction(function () use ($account, $data, $userId): AccountPayablePayment {
            if ($account->area_id === null) {
                abort(422, 'La cuenta por pagar debe tener área para registrar el egreso.');
            }

            $amount = (float) $data['amount'];
            if ($amount <= 0 || $amount > (float) $account->balance_amount) {
                abort(422, 'El pago debe ser mayor a cero y no puede exceder el saldo pendiente.');
            }

            $categoryName = match ($account->payable_type) {
                'payroll' => 'Planilla / nómina',
                'supplier' => 'Pago a proveedor',
                default => 'Cuenta por pagar',
            };

            $category = FinancialCategory::query()->firstOrCreate(
                ['name' => $categoryName, 'type' => 'expense', 'area_id' => $account->area_id],
                ['is_active' => true]
            );

            $expense = Expense::query()->create([
                'area_id' => $account->area_id,
                'project_id' => $account->project_id,
                'client_id' => null,
                'financial_category_id' => $category->id,
                'amount' => $amount,
                'recorded_on' => $data['paid_on'],
                'responsible_user_id' => $account->user_id ?? $userId,
                'observation' => $data['notes'] ?? ('Pago CxP #'.$account->id.' — '.$account->description),
            ]);

            $payment = AccountPayablePayment::query()->create([
                'account_payable_id' => $account->id,
                'expense_id' => $expense->id,
                'amount' => $amount,
                'paid_on' => $data['paid_on'],
                'method' => $data['method'] ?? null,
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
                'registered_by' => $userId,
            ]);

            $this->recalculate($account);

            return $payment;
        });
    }

    public function recalculate(AccountPayable $account): AccountPayable
    {
        $paid = (float) $account->payments()->sum('amount');
        $total = (float) $account->total_amount;
        $balance = max(0, $total - $paid);

        if ($balance <= 0) {
            $status = 'paid';
            $lastPaid = $account->payments()->orderByDesc('paid_on')->value('paid_on');
            $paidOn = $lastPaid ?? now()->toDateString();
        } elseif ($paid > 0) {
            $status = 'partial';
            $paidOn = null;
        } elseif ($account->projected_due_on !== null && $account->projected_due_on->isPast()) {
            $status = 'overdue';
            $paidOn = null;
        } else {
            $status = 'pending';
            $paidOn = null;
        }

        $account->update([
            'paid_amount' => $paid,
            'balance_amount' => $balance,
            'status' => $status,
            'paid_on' => $paidOn,
            'expense_id' => $balance <= 0 ? ($account->payments()->latest('id')->value('expense_id')) : $account->expense_id,
        ]);

        return $account->fresh();
    }

    /**
     * Genera obligaciones de planilla mensual para colaboradores con sueldo configurado.
     *
     * @return list<AccountPayable>
     */
    public function generatePayroll(int $areaId, int $year, int $month, int $registeredBy): array
    {
        $due = sprintf('%04d-%02d-05', $year, $month);

        return DB::transaction(function () use ($areaId, $year, $month, $due, $registeredBy): array {
            $users = User::query()
                ->where('is_active', true)
                ->whereNotNull('salary')
                ->where('salary', '>', 0)
                ->whereHas('areas', fn ($q) => $q->where('areas.id', $areaId))
                ->get();

            $created = [];

            foreach ($users as $user) {
                $exists = AccountPayable::query()
                    ->where('payable_type', 'payroll')
                    ->where('user_id', $user->id)
                    ->where('area_id', $areaId)
                    ->where('period_year', $year)
                    ->where('period_month', $month)
                    ->exists();

                if ($exists) {
                    continue;
                }

                $amount = round((float) $user->salary, 2);

                $created[] = AccountPayable::query()->create([
                    'payable_type' => 'payroll',
                    'vendor_name' => null,
                    'user_id' => $user->id,
                    'area_id' => $areaId,
                    'total_amount' => $amount,
                    'paid_amount' => 0,
                    'balance_amount' => $amount,
                    'projected_due_on' => $due,
                    'requires_invoice' => false,
                    'status' => 'pending',
                    'description' => sprintf('Planilla %02d/%04d — %s', $month, $year, $user->name),
                    'notes' => 'Generado automáticamente. Practantes/contrato laboral opcional.',
                    'period_year' => $year,
                    'period_month' => $month,
                ]);
            }

            return $created;
        });
    }
}
