<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Tras Nginx/Ingress HTTPS, sin esto Laravel puede ver HTTP y las cookies/session no encajan bien.
        $middleware->trustProxies(at: '*');
        // Logout es seguro sin CSRF: el peor caso de un ataque CSRF-logout es cerrar la sesión del usuario (sin daño).
        $middleware->validateCsrfTokens(except: ['api/auth/logout']);
        $middleware->alias([
            'superadmin' => \App\Http\Middleware\EnsureSuperadmin::class,
            'permission' => \App\Http\Middleware\EnsurePermission::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
