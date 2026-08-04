<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>419 — Sesión Expirada | Xinergia Intranet</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: #090D16;
      color: #FFFFFF;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      max-width: 32rem;
      width: 100%;
      background: rgba(18, 23, 38, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 1.5rem;
      padding: 2.5rem 2rem;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(12px);
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.875rem;
      border-radius: 9999px;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #FBBF24;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }
    h1 { font-size: 1.75rem; font-weight: 800; tracking: -0.02em; margin-bottom: 0.75rem; }
    p { font-size: 0.875rem; color: #9CA3AF; line-height: 1.6; margin-bottom: 2rem; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: #4F46E5;
      color: #FFFFFF;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.875rem;
      padding: 0.75rem 1.5rem;
      border-radius: 0.75rem;
      transition: background 0.2s, transform 0.1s;
      box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);
    }
    .btn:hover { background: #4338CA; transform: translateY(-1px); }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">419 — SESIÓN EXPIRADA</div>
    <h1>La sesión ha expirado</h1>
    <p>Por motivos de seguridad y tras un periodo de inactividad, la sesión requiere autenticación nuevamente.</p>
    <a href="/login" class="btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      Iniciar Sesión
    </a>
  </div>
</body>
</html>
