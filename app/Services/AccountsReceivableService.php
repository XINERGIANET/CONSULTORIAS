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
                ['name' => 'Pago de contrato', 'type' => 'income', 'area_id' => $account->area_id],
                ['is_active' => true]
            );

            $methodInfo = !empty($data['method']) ? ' [Método: '.$data['method'].(!empty($data['reference']) ? ' - Ref: '.$data['reference'] : '').']' : '';
            $desc = ($data['notes'] ?? 'Pago de cuenta por cobrar #'.$account->id).$methodInfo;

            $income = Income::query()->create([
                'client_id' => $account->client_id,
                'project_id' => $account->project_id,
                'area_id' => $account->area_id,
                'financial_category_id' => $category->id,
                'amount' => $amount,
                'recorded_on' => $data['paid_on'],
                'payment_status' => 'paid',
                'description' => $desc,
                'receipt_path' => $data['receipt_path'] ?? null,
            ]);

            $payment = AccountReceivablePayment::query()->create([
                'account_receivable_id' => $account->id,
                'income_id' => $income->id,
                'amount' => $amount,
                'paid_on' => $data['paid_on'],
                'method' => $data['method'] ?? null,
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
                'receipt_path' => $data['receipt_path'] ?? null,
                'registered_by' => $userId,
            ]);

            $this->recalculate($account);

            return $payment;
        });
    }

    public function updatePayment(AccountReceivable $account, AccountReceivablePayment $payment, array $data): AccountReceivablePayment
    {
        return DB::transaction(function () use ($account, $payment, $data): AccountReceivablePayment {
            $updateData = [];

            if (isset($data['paid_on'])) {
                $updateData['paid_on'] = $data['paid_on'];
            }
            if (isset($data['receipt_path'])) {
                $updateData['receipt_path'] = $data['receipt_path'];
            }

            if ($updateData !== []) {
                $payment->update($updateData);
            }

            if ($payment->income_id !== null) {
                $incomeUpdates = [];
                if (isset($data['paid_on'])) {
                    $incomeUpdates['recorded_on'] = $data['paid_on'];
                }
                if (isset($data['receipt_path'])) {
                    $incomeUpdates['receipt_path'] = $data['receipt_path'];
                }
                if ($incomeUpdates !== []) {
                    Income::query()->where('id', $payment->income_id)->update($incomeUpdates);
                }
            }

            $this->recalculate($account);

            return $payment->fresh();
        });
    }


    public function revertPayment(AccountReceivable $account, AccountReceivablePayment $payment): AccountReceivable
    {
        return DB::transaction(function () use ($account, $payment): AccountReceivable {
            if ($payment->income_id !== null) {
                Income::query()->where('id', $payment->income_id)->delete();
            }

            $payment->delete();

            return $this->recalculate($account);
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
        } elseif (($account->due_on !== null && $account->due_on->isPast()) || ($account->projected_due_on !== null && $account->projected_due_on->isPast())) {
            $status = 'overdue';
        } else {
            $status = 'pending';
        }

        $account->update([
            'paid_amount' => $paid,
            'balance_amount' => $balance,
            'status' => $status,
            'collected_on' => $status === 'paid'
                ? ($account->payments()->orderByDesc('paid_on')->value('paid_on') ?? now()->toDateString())
                : ($account->payments()->exists() ? ($account->payments()->orderByDesc('paid_on')->value('paid_on')) : null),
        ]);

        return $account->fresh();
    }
}

