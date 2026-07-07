<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountReceivable;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Services\AccountsReceivableService;
use App\Support\AreaVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class DocumentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Document::query()->with(['client:id,legal_name', 'project:id,name', 'area:id,name', 'uploader:id,name']);
        AreaVisibility::applyDocumentScope($q, $request->user());

        if ($request->filled('doc_type')) {
            $q->where('doc_type', $request->input('doc_type'));
        }

        return response()->json($q->orderByDesc('id')->paginate(30));
    }

    public function store(Request $request, AccountsReceivableService $receivableService): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:15360'],
            'title' => ['required', 'string', 'max:255'],
            'doc_type' => ['required', 'string', 'max:64'],
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'contract_total' => ['nullable', 'numeric', 'min:0.01'],
            'contract_due_on' => ['nullable', 'date'],
            'register_payment' => ['sometimes', 'boolean'],
            'payment_amount' => ['nullable', 'numeric', 'min:0.01'],
            'payment_paid_on' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'string', 'max:64'],
            'payment_reference' => ['nullable', 'string', 'max:255'],
        ]);

        if (! empty($data['client_id'])) {
            $this->assertClientVisible($request, (int) $data['client_id']);
        }
        if (! empty($data['project_id'])) {
            $this->assertProjectVisible($request, (int) $data['project_id']);
        }
        $user = $request->user();
        if ($user !== null && ! $user->isSuperadmin()) {
            $data['area_id'] = AreaVisibility::resolveAreaIdOrFail($user, $data['area_id'] ?? null);
        } elseif ($user !== null && isset($data['area_id']) && $data['area_id'] !== null) {
            $data['area_id'] = AreaVisibility::resolveAreaIdOrFail($user, $data['area_id']);
        }

        $path = $data['file']->store('xpande_documents', 'public');
        $doc = DB::transaction(function () use ($data, $path, $request, $receivableService) {
            $doc = Document::query()->create([
                'client_id' => $data['client_id'] ?? null,
                'project_id' => $data['project_id'] ?? null,
                'area_id' => $data['area_id'] ?? null,
                'doc_type' => $data['doc_type'],
                'title' => $data['title'],
                'path' => $path,
                'uploaded_by' => $request->user() !== null ? $request->user()->id : null,
                'version' => 1,
            ]);

            DocumentVersion::query()->create([
                'document_id' => $doc->id,
                'version' => 1,
                'path' => $path,
                'user_id' => $request->user() !== null ? $request->user()->id : null,
                'note' => 'Alta inicial',
            ]);

            if ($data['doc_type'] === 'contract' && isset($data['contract_total'])) {
                if (empty($data['client_id']) || empty($data['area_id'])) {
                    abort(422, 'Cliente, area y monto son obligatorios para generar una cuenta por cobrar.');
                }

                $account = AccountReceivable::query()->create([
                    'client_id' => $data['client_id'],
                    'document_id' => $doc->id,
                    'project_id' => $data['project_id'] ?? null,
                    'area_id' => $data['area_id'],
                    'total_amount' => $data['contract_total'],
                    'paid_amount' => 0,
                    'balance_amount' => $data['contract_total'],
                    'issued_on' => now()->toDateString(),
                    'due_on' => $data['contract_due_on'] ?? null,
                    'status' => 'pending',
                    'notes' => 'Generado automaticamente desde contrato: ' . $doc->title,
                ]);

                if ($request->boolean('register_payment')) {
                    $receivableService->registerPayment($account, [
                        'amount' => $data['payment_amount'] ?? $data['contract_total'],
                        'paid_on' => $data['payment_paid_on'] ?? now()->toDateString(),
                        'method' => $data['payment_method'] ?? null,
                        'reference' => $data['payment_reference'] ?? null,
                        'notes' => 'Pago registrado al generar contrato.',
                    ], (int) $request->user()->id);
                }
            }

            return $doc;
        });

        return response()->json($doc, 201);
    }

    public function addVersion(Request $request, Document $document): JsonResponse
    {
        $this->assertDoc($request, $document);
        $data = $request->validate([
            'file' => ['required', 'file', 'max:15360'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);
        $path = $data['file']->store('xpande_documents', 'public');

        $next = (int) $document->version + 1;
        DocumentVersion::query()->create([
            'document_id' => $document->id,
            'version' => $next,
            'path' => $path,
            'user_id' => $request->user() !== null ? $request->user()->id : null,
            'note' => $data['note'] ?? null,
        ]);
        $document->update(['path' => $path, 'version' => $next]);

        return response()->json($document->fresh()->load('versions'));
    }

    public function destroy(Request $request, Document $document): JsonResponse
    {
        $this->assertDoc($request, $document);
        if (Storage::disk('public')->exists($document->path)) {
            Storage::disk('public')->delete($document->path);
        }
        $document->versions()->delete();
        $document->delete();

        return response()->json(null, 204);
    }

    private function assertDoc(Request $request, Document $document): void
    {
        $q = Document::query()->whereKey($document->id);
        AreaVisibility::applyDocumentScope($q, $request->user());
        if (!$q->exists()) {
            abort(404);
        }
    }

    private function assertClientVisible(Request $request, int $clientId): void
    {
        $q = \App\Models\Client::query()->whereKey($clientId);
        AreaVisibility::applyClientScope($q, $request->user());
        if (! $q->exists()) {
            abort(404);
        }
    }

    private function assertProjectVisible(Request $request, int $projectId): void
    {
        $q = \App\Models\Project::query()->whereKey($projectId);
        AreaVisibility::applyProjectScope($q, $request->user());
        if (! $q->exists()) {
            abort(404);
        }
    }
}
