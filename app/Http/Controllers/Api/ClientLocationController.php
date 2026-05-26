<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientLocation;
use App\Support\AreaVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientLocationController extends Controller
{
    public function store(Request $request, Client $client): JsonResponse
    {
        $this->assertClient($request, $client);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'phone' => ['nullable', 'string', 'max:64'],
            'responsible_person' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $data['client_id'] = $client->id;

        return response()->json(ClientLocation::query()->create($data), 201);
    }

    public function update(Request $request, Client $client, ClientLocation $location): JsonResponse
    {
        $this->assertClient($request, $client);
        if ($location->client_id !== $client->id) {
            abort(404);
        }
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'phone' => ['nullable', 'string', 'max:64'],
            'responsible_person' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $location->update($data);

        return response()->json($location->fresh());
    }

    public function destroy(Request $request, Client $client, ClientLocation $location): JsonResponse
    {
        $this->assertClient($request, $client);
        if ($location->client_id !== $client->id) {
            abort(404);
        }
        $location->delete();

        return response()->json(null, 204);
    }

    private function assertClient(Request $request, Client $client): void
    {
        $q = Client::query()->whereKey($client->id);
        AreaVisibility::applyClientScope($q, $request->user());
        if (! $q->exists()) {
            abort(404);
        }
    }
}
