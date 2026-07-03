<?php

return [

    // Endpoint base para consulta DNI (json.pe).
    'url' => env('APIRENIEC_URL', 'https://api.json.pe/api/dni'),

    // Endpoint base para consulta RUC (json.pe).
    'ruc_url' => env('APIRENIEC_URL_RUC', 'https://api.json.pe/api/ruc'),

    // KEY de json.pe.
    'key' => env('APIRENIEC_KEY', ''),

];
