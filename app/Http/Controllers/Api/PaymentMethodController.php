<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesPrivileged;
use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentMethodController extends Controller
{
    use AuthorizesPrivileged;

    public function index(Request $request): JsonResponse
    {
        $q = PaymentMethod::query()->orderBy('name');

        if ($request->boolean('active_only', true)) {
            $q->where('is_active', true);
        }

        return response()->json($q->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePrivileged($request);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:64', 'unique:payment_methods,code'],
            'name' => ['required', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        return response()->json(PaymentMethod::query()->create($data), 201);
    }

    public function update(Request $request, PaymentMethod $paymentMethod): JsonResponse
    {
        $this->authorizePrivileged($request);

        $paymentMethod->update($request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:64', 'unique:payment_methods,code,'.$paymentMethod->id],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]));

        return response()->json($paymentMethod->fresh());
    }

    public function destroy(Request $request, PaymentMethod $paymentMethod): JsonResponse
    {
        $this->authorizePrivileged($request);
        $paymentMethod->update(['is_active' => false]);

        return response()->json(null, 204);
    }
}
