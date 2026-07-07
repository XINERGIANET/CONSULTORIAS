<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Support\AreaVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimeEntryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = TimeEntry::query()->with(['user:id,name', 'project:id,name', 'client:id,legal_name', 'area:id,name']);
        AreaVisibility::applyTimeEntryScope($q, $request->user());

        if ($request->filled('status')) {
            $q->where('status', $request->input('status'));
        }
        if ($request->filled('from')) {
            $q->whereDate('work_date', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $q->whereDate('work_date', '<=', $request->input('to'));
        }

        return response()->json($q->orderByDesc('work_date')->paginate(40));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'work_date' => ['required', 'date'],
            'started_at' => ['nullable', 'date_format:H:i'],
            'ended_at' => ['nullable', 'date_format:H:i'],
            'hours' => ['required', 'numeric', 'min:0.01', 'max:24'],
            'description' => ['nullable', 'string'],
            'user_id' => ['sometimes', 'integer', 'exists:users,id'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
        ]);

        $project = Project::query()->with('client')->findOrFail($data['project_id']);
        $this->assertProject($request, $project);

        $currentUserId = $request->user() !== null ? $request->user()->id : null;
        $uid = $data['user_id'] ?? $currentUserId;
        if ($uid === null) {
            abort(422, 'Usuario requerido.');
        }
        if ($uid !== $currentUserId && ! AreaVisibility::canManageOwnAreas($request->user())) {
            abort(403);
        }

        $requestedAreaId = $data['area_id'] ?? null;
        unset($data['user_id'], $data['area_id']);

        $data['user_id'] = $uid;
        $data['client_id'] = $project->client_id;
        $data['status'] = 'pending';

        $candidateAreaIds = $request->user()->isSuperadmin()
            ? $project->areas()->pluck('areas.id')->all()
            : $project->areas()->whereIn('areas.id', AreaVisibility::userAreaIds($request->user()))->pluck('areas.id')->all();

        if ($requestedAreaId !== null) {
            if (! in_array($requestedAreaId, $candidateAreaIds, true)) {
                abort(422, 'La empresa seleccionada no pertenece a este proyecto.');
            }
            $data['area_id'] = $requestedAreaId;
        } elseif (count($candidateAreaIds) === 1) {
            $data['area_id'] = $candidateAreaIds[0];
        } elseif (count($candidateAreaIds) > 1) {
            abort(422, 'Este proyecto pertenece a varias empresas; seleccione a cual asignar el registro.');
        } else {
            $data['area_id'] = $request->user()->isSuperadmin() ? AreaVisibility::firstUserAreaId($request->user()) : null;
        }

        if ($data['area_id'] === null) {
            abort(422, 'Empresa requerida.');
        }

        return response()->json(TimeEntry::query()->create($data), 201);
    }

    public function update(Request $request, TimeEntry $timeEntry): JsonResponse
    {
        $this->assertEntry($request, $timeEntry);
        $data = $request->validate([
            'work_date' => ['sometimes', 'date'],
            'started_at' => ['nullable', 'date_format:H:i'],
            'ended_at' => ['nullable', 'date_format:H:i'],
            'hours' => ['sometimes', 'numeric', 'min:0.01', 'max:24'],
            'description' => ['nullable', 'string'],
        ]);
        $currentUserId = $request->user() !== null ? $request->user()->id : null;
        if ($timeEntry->user_id !== $currentUserId && ! AreaVisibility::canManageOwnAreas($request->user())) {
            abort(403);
        }
        $timeEntry->update($data);

        return response()->json($timeEntry->fresh()->load(['project', 'client', 'area']));
    }

    public function review(Request $request, TimeEntry $timeEntry): JsonResponse
    {
        if (! AreaVisibility::canManageOwnAreas($request->user())) {
            abort(403);
        }
        $this->assertEntry($request, $timeEntry);
        $data = $request->validate([
            'status' => ['required', 'string', 'in:approved,rejected'],
        ]);
        $timeEntry->update(['status' => $data['status']]);

        return response()->json($timeEntry->fresh());
    }

    public function destroy(Request $request, TimeEntry $timeEntry): JsonResponse
    {
        $this->assertEntry($request, $timeEntry);
        $currentUserId = $request->user() !== null ? $request->user()->id : null;
        if ($timeEntry->user_id !== $currentUserId && ! AreaVisibility::canManageOwnAreas($request->user())) {
            abort(403);
        }
        $timeEntry->delete();

        return response()->json(null, 204);
    }

    private function assertEntry(Request $request, TimeEntry $timeEntry): void
    {
        $q = TimeEntry::query()->whereKey($timeEntry->id);
        AreaVisibility::applyTimeEntryScope($q, $request->user());
        if (! $q->exists()) {
            abort(404);
        }
    }

    private function assertProject(Request $request, Project $project): void
    {
        $q = Project::query()->whereKey($project->id);
        AreaVisibility::applyProjectScope($q, $request->user());
        if (! $q->exists()) {
            abort(404);
        }
    }
}
