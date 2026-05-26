<?php

namespace App\Services;

use App\Models\AccountReceivable;
use App\Models\AccountReceivablePayment;
use App\Models\FinancialCategory;
use App\Models\Income;
use Illuminate\Support\Facades\DB;

class AccountsReceivableService
{
    public function registerPayment(AccountReceivable $account, array $data, int $userId): AccountReceivablePayment
    {
        return DB::transaction(function () use ($account, $data, $userId): AccountReceivablePayment {
            if ($account->area_id === null) {
                abort(422, 'La cuenta por cobrar debe tener area para registrar pagos en finanzas.');
            }

            $amount = (float) $data['amount'];
            if ($amount <= 0 || $amount > (float) $account->balance_amount) {
                abort(422, 'El pago debe ser mayor a cero y no puede exceder el saldo pendiente.');
            }

            $category = FinancialCategory::query()->firstOrCreate(
                ['name' => 'Pago de contrato', 'type' => 'income'],
                ['is_active' => true]
            );

            $income = Income::query()->create([
                'client_id' => $account->client_id,
                'project_id' => $account->project_id,
                'area_id' => $account->area_id,
                'financial_category_id' => $category->id,
                'amount' => $amount,
                'recorded_on' => $data['paid_on'],
                'payment_status' => 'paid',
                'description' => $data['notes'] ?? 'Pago de cuenta por cobrar #'.$account->id,
            ]);

            $payment = AccountReceivablePayment::query()->create([
                'account_receivable_id' => $account->id,
                'income_id' => $income->id,
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

    public function recalculate(AccountReceivable $account): AccountReceivable
    {
        $paid = (float) $account->payments()->sum('amount');
        $total = (float) $account->total_amount;
        $balance = max(0, $total - $paid);
        if ($balance <= 0) {
            $status = 'paid';
        } elseif ($paid > 0) {
            $status = 'partial';
        } elseif ($account->due_on !== null && $account->due_on->isPast()) {
            $status = 'overdue';
        } else {
            $status = 'pending';
        }

        $account->update([
            'paid_amount' => $paid,
            'balance_amount' => $balance,
            'status' => $status,
        ]);

        return $account->fresh();
    }
}
