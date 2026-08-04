<?php

namespace App\Services;

use App\Models\AccountReceivable;
use App\Models\Client;
use App\Models\ClientContract;
use App\Models\Document;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ContractBillingService
{
    /**
     * Crea contrato (documento virtual), cronograma y cuentas por cobrar mensuales.
     *
     * @param  array{
     *   client_id:int,
     *   area_id:int,
     *   project_id?:int|null,
     *   title?:string,
     *   total_amount:float|int|string,
     *   installments_count:int,
     *   start_date:string,
     *   first_due_on:string,
     *   billing_frequency?:string,
     *   notes?:string|null
     * }  $data
     */
    public function createContractAndSchedule(Client $client, array $data, ?int $userId): ClientContract
    {
        return DB::transaction(function () use ($client, $data, $userId): ClientContract {
            $total = round((float) $data['total_amount'], 2);
            $count = max(1, (int) $data['installments_count']);
            $baseInstallment = round($total / $count, 2);
            $remainder = round($total - ($baseInstallment * $count), 2);

            $title = $data['title'] ?? ('Contrato comercial — '.$client->legal_name);
            $start = Carbon::parse($data['start_date']);
            $firstDue = Carbon::parse($data['first_due_on']);
            $frequency = $data['billing_frequency'] ?? 'monthly';

            $endDate = match ($frequency) {
                'monthly' => $firstDue->copy()->addMonths($count - 1),
                'quarterly' => $firstDue->copy()->addMonths(($count - 1) * 3),
                'yearly' => $firstDue->copy()->addYears($count - 1),
                default => $firstDue->copy()->addMonths($count - 1),
            };

            $doc = Document::query()->create([
                'client_id' => $client->id,
                'project_id' => $data['project_id'] ?? null,
                'area_id' => $data['area_id'],
                'doc_type' => 'contract',
                'title' => $title,
                'path' => 'contracts/generated/pending-upload',
                'uploaded_by' => $userId,
                'version' => 1,
            ]);

            $contract = ClientContract::query()->create([
                'client_id' => $client->id,
                'document_id' => $doc->id,
                'area_id' => $data['area_id'],
                'project_id' => $data['project_id'] ?? null,
                'title' => $title,
                'total_amount' => $total,
                'installment_amount' => $baseInstallment,
                'installments_count' => $count,
                'billing_frequency' => $frequency,
                'start_date' => $start->toDateString(),
                'end_date' => $endDate->toDateString(),
                'first_due_on' => $firstDue->toDateString(),
                'status' => 'active',
                'notes' => $data['notes'] ?? null,
            ]);

            $issuedOn = now()->toDateString();

            for ($i = 0; $i < $count; $i++) {
                $due = match ($frequency) {
                    'monthly' => $firstDue->copy()->addMonths($i),
                    'quarterly' => $firstDue->copy()->addMonths($i * 3),
                    'yearly' => $firstDue->copy()->addYears($i),
                    default => $firstDue->copy()->addMonths($i),
                };

                $amount = $baseInstallment;
                if ($i === $count - 1) {
                    $amount = round($baseInstallment + $remainder, 2);
                }

                AccountReceivable::query()->create([
                    'client_id' => $client->id,
                    'document_id' => $doc->id,
                    'client_contract_id' => $contract->id,
                    'project_id' => $data['project_id'] ?? null,
                    'area_id' => $data['area_id'],
                    'installment_number' => $i + 1,
                    'total_amount' => $amount,
                    'paid_amount' => 0,
                    'balance_amount' => $amount,
                    'issued_on' => $issuedOn,
                    'due_on' => $due->toDateString(),
                    'projected_due_on' => $due->toDateString(),
                    'collected_on' => null,
                    'status' => 'pending',
                    'notes' => sprintf(
                        'Cuota %d/%d del contrato #%d — vencimiento proyectado %s',
                        $i + 1,
                        $count,
                        $contract->id,
                        $due->format('d/m/Y')
                    ),
                ]);
            }

            $client->update([
                'pipeline_stage' => 'active_client',
                'is_active' => true,
            ]);

            return $contract->load(['document', 'receivables']);
        });
    }

    /**
     * Crea contrato y cuentas por cobrar con un cronograma de fechas y montos personalizados.
     *
     * @param  array{
     *   client_id:int,
     *   area_id:int,
     *   project_id?:int|null,
     *   title?:string,
     *   notes?:string|null
     * }  $data
     * @param  array<int, array{due_on:string, amount:float|int|string, notes?:string|null}>  $customSchedule
     */
    public function createContractAndCustomSchedule(Client $client, array $data, array $customSchedule, ?int $userId): ClientContract
    {
        return DB::transaction(function () use ($client, $data, $customSchedule, $userId): ClientContract {
            $count = max(1, count($customSchedule));
            $total = 0.0;
            foreach ($customSchedule as $item) {
                $total += round((float) ($item['amount'] ?? 0), 2);
            }
            $total = round($total, 2);
            $firstDue = Carbon::parse($customSchedule[0]['due_on'] ?? now()->toDateString());
            $lastDue = Carbon::parse($customSchedule[$count - 1]['due_on'] ?? $firstDue->toDateString());
            $title = $data['title'] ?? ('Contrato comercial — '.$client->legal_name);

            $doc = Document::query()->create([
                'client_id' => $client->id,
                'project_id' => $data['project_id'] ?? null,
                'area_id' => $data['area_id'],
                'doc_type' => 'contract',
                'title' => $title,
                'path' => 'contracts/generated/pending-upload',
                'uploaded_by' => $userId,
                'version' => 1,
            ]);

            $contract = ClientContract::query()->create([
                'client_id' => $client->id,
                'document_id' => $doc->id,
                'area_id' => $data['area_id'],
                'project_id' => $data['project_id'] ?? null,
                'title' => $title,
                'total_amount' => $total,
                'installment_amount' => round($total / $count, 2),
                'installments_count' => $count,
                'billing_frequency' => 'custom',
                'start_date' => $firstDue->toDateString(),
                'end_date' => $lastDue->toDateString(),
                'first_due_on' => $firstDue->toDateString(),
                'status' => 'active',
                'notes' => $data['notes'] ?? 'Cronograma personalizado',
            ]);

            $issuedOn = now()->toDateString();

            foreach ($customSchedule as $index => $item) {
                $due = Carbon::parse($item['due_on']);
                $amount = round((float) $item['amount'], 2);
                $noteText = ! empty($item['notes'])
                    ? trim($item['notes'])
                    : sprintf('Cuota %d/%d del contrato #%d — vencimiento proyectado %s', $index + 1, $count, $contract->id, $due->format('d/m/Y'));

                AccountReceivable::query()->create([
                    'client_id' => $client->id,
                    'document_id' => $doc->id,
                    'client_contract_id' => $contract->id,
                    'project_id' => $data['project_id'] ?? null,
                    'area_id' => $data['area_id'],
                    'installment_number' => $index + 1,
                    'total_amount' => $amount,
                    'paid_amount' => 0,
                    'balance_amount' => $amount,
                    'issued_on' => $issuedOn,
                    'due_on' => $due->toDateString(),
                    'projected_due_on' => $due->toDateString(),
                    'collected_on' => null,
                    'status' => 'pending',
                    'notes' => $noteText,
                ]);
            }

            $client->update([
                'pipeline_stage' => 'active_client',
                'is_active' => true,
            ]);

            return $contract->load(['document', 'receivables']);
        });
    }
}

