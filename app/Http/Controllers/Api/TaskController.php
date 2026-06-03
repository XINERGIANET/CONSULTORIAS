<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Task::query()->with(['project:id,name', 'assignedUser:id,name']);

        if ($request->filled('q')) {
            $s = '%'.$request->string('q').'%';
            $q->where(function ($w) use ($s) {
                $w->where('title', 'like', $s)
                    ->orWhere('description', 'like', $s)
                    ->orWhereHas('project', fn ($p) => $p->where('name', 'like', $s))
                    ->orWhereHas('assignedUser', fn ($u) => $u->where('name', 'like', $s));
            });
        }

        if ($request->filled('status')) {
            $status = $request->input('status');
            if ($status === 'overdue') {
                $q->where('status', '!=', 'finished')
                    ->whereNotNull('due_date')
                    ->where('due_date', '<', now()->startOfDay());
            } else {
                $q->where('status', $status);
            }
        }

        if ($request->filled('project_id')) {
            $q->where('project_id', (int) $request->input('project_id'));
        }

        if ($request->filled('assigned_user_id')) {
            $q->where('assigned_user_id', (int) $request->input('assigned_user_id'));
        }

        if ($request->filled('priority')) {
            $q->where('priority', $request->input('priority'));
        }

        $sort = $request->string('sort', 'created_at')->toString();
        $allowed = ['id', 'title', 'due_date', 'start_date', 'status', 'priority', 'created_at'];
        if (! in_array($sort, $allowed, true)) {
            $sort = 'created_at';
        }
        $dir = strtolower($request->string('dir', 'desc')->toString()) === 'asc' ? 'asc' : 'desc';
        $q->orderBy($sort, $dir);

        $perPage = max(5, min(100, (int) $request->input('per_page', 30)));

        return response()->json($q->paginate($perPage));
    }

    public function show(Task $task): JsonResponse
    {
        return response()->json($task->load(['project:id,name', 'assignedUser:id,name']));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'             => ['required', 'string', 'max:255'],
            'description'       => ['nullable', 'string'],
            'project_id'        => ['nullable', 'integer', 'exists:projects,id'],
            'assigned_user_id'  => ['nullable', 'integer', 'exists:users,id'],
            'start_date'        => ['nullable', 'date'],
            'due_date'          => ['nullable', 'date'],
            'estimated_hours'   => ['nullable', 'numeric', 'min:0', 'max:9999'],
            'status'            => ['nullable', 'string', 'in:pending,in_progress,finished'],
            'priority'          => ['nullable', 'string', 'in:low,medium,high,critical'],
        ]);

        $data['created_by'] = $request->user()?->id;

        $task = Task::query()->create($data);

        return response()->json($task->load(['project:id,name', 'assignedUser:id,name']), 201);
    }

    public function update(Request $request, Task $task): JsonResponse
    {
        $data = $request->validate([
            'title'             => ['sometimes', 'required', 'string', 'max:255'],
            'description'       => ['nullable', 'string'],
            'project_id'        => ['nullable', 'integer', 'exists:projects,id'],
            'assigned_user_id'  => ['nullable', 'integer', 'exists:users,id'],
            'start_date'        => ['nullable', 'date'],
            'due_date'          => ['nullable', 'date'],
            'estimated_hours'   => ['nullable', 'numeric', 'min:0', 'max:9999'],
            'status'            => ['nullable', 'string', 'in:pending,in_progress,finished'],
            'priority'          => ['nullable', 'string', 'in:low,medium,high,critical'],
        ]);

        $task->update($data);

        return response()->json($task->fresh()->load(['project:id,name', 'assignedUser:id,name']));
    }

    public function destroy(Task $task): JsonResponse
    {
        $task->delete();

        return response()->json(null, 204);
    }
}
