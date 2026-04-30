<?php

namespace App\Http\Controllers;

use App\Services\DashboardService;
use Illuminate\Http\Request;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function __invoke(Request $request, DashboardService $dashboard): View
    {
        $user = $request->user();

        return view('apex', [
            'metrics' => $dashboard->payload($user),
            'authUser' => $user ? $user->authPayload() : null,
        ]);
    }
}
