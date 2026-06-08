<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentAccount;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class PaymentAccountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = PaymentAccount::query();
        if ($request->filled('active_only') && $request->boolean('active_only')) {
            $q->where('is_active', true);
        }
        return response()->json($q->orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'in:bank,digital_wallet,cash,other'],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'account_number' => ['nullable', 'string', 'max:255'],
            'cci' => ['nullable', 'string', 'max:255'],
            'currency' => ['nullable', 'string', 'max:10'],
            'holder_name' => ['nullable', 'string', 'max:255'],
            'icon' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ]);

        $account = PaymentAccount::create($data);
        return response()->json($account, 201);
    }

    public function show(PaymentAccount $paymentAccount): JsonResponse
    {
        return response()->json($paymentAccount);
    }

    public function update(Request $request, PaymentAccount $paymentAccount): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'in:bank,digital_wallet,cash,other'],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'account_number' => ['nullable', 'string', 'max:255'],
            'cci' => ['nullable', 'string', 'max:255'],
            'currency' => ['nullable', 'string', 'max:10'],
            'holder_name' => ['nullable', 'string', 'max:255'],
            'icon' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ]);

        $paymentAccount->update($data);
        return response()->json($paymentAccount);
    }

    public function destroy(PaymentAccount $paymentAccount): JsonResponse
    {
        $paymentAccount->delete();
        return response()->json(null, 204);
    }
}
