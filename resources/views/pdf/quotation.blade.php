<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Propuesta Comercial - {{ $quotation->client->legal_name ?? $quotation->client->trade_name ?? 'Cliente' }}</title>
    <style>
        @page { margin: 40px 50px; }
        body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11px; color: #333; line-height: 1.3; }
        .navy { color: #002060; }
        .bg-navy { background-color: #002060; color: white; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { padding: 4px 6px; }
        
        .header-table { border-bottom: 2px solid #002060; margin-bottom: 10px; padding-bottom: 10px; }
        .header-title { font-size: 28px; font-weight: bold; color: #002060; }
        .logo-placeholder { text-align: right; color: #002060; font-size: 20px; font-weight: bold; }
        
        .info-table { font-weight: bold; color: #002060; margin-bottom: 15px; }
        
        .banner { background-color: #002060; color: white; text-align: center; font-weight: bold; font-size: 11px; border: 1px solid white; }
        .banner-cell { background-color: #002060; color: white; text-align: center; font-weight: bold; border: 1px solid white; padding: 4px; }
        
        .bordered td { border: 1px solid #ddd; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        
        .about-text { padding: 5px 0 10px 0; text-align: justify; }
        
        .content-row td { padding: 8px; text-align: center; background-color: #f9f9f9; border-bottom: 2px solid white; border-right: 2px solid white; }
        
        .list-table td { vertical-align: top; border: none; padding: 2px 5px; }
        .list-table .num { width: 20px; text-align: center; }
        
        .totals-table { width: 100%; margin-top: 10px; }
        .totals-table td { padding: 3px 5px; }
        .totals-label { font-weight: bold; color: #002060; text-align: right; width: 80%; }
        .totals-value { text-align: right; width: 20%; }
        
        .footer-bottom { margin-top: 40px; border-top: 1px solid #002060; padding-top: 10px; font-size: 9px; color: #555; }
        .footer-table td { padding: 0; }
        
        .qr-placeholder { width: 80px; height: 80px; border: 1px solid #ccc; text-align: center; line-height: 80px; font-size: 10px; color: #999; margin: 0 auto; }
    </style>
</head>
<body>

    <table class="header-table">
        <tr>
            <td class="header-title">PROPUESTA COMERCIAL</td>
            <td class="logo-placeholder">
                <!-- Reemplazar con la etiqueta img cuando tengas el logo -->
                <span style="font-size: 24px;">&#10004; XINERGIA</span>
            </td>
        </tr>
    </table>

    <table class="info-table">
        <tr>
            <td style="width: 70%;">EMPRESA: &nbsp; <span style="font-weight: normal; color:#333;">{{ $quotation->client->legal_name ?? $quotation->client->trade_name ?? '-' }}</span></td>
            <td style="width: 30%; text-align: right;">Fecha: &nbsp; <span style="font-weight: normal; color:#333;">{{ $quotation->created_at->format('d/m/Y') }}</span></td>
        </tr>
    </table>

    <div class="banner">SOBRE NOSOTROS</div>
    <div class="about-text">
        Somos una consultora especializada en <strong>desarrollo empresarial</strong> y <strong>sistemas integrados de gestión</strong>, el principal compromiso con nuestros clientes es optimizar su desempeño mediante un enfoque aplicado a la <strong>mejora de procesos</strong>.
    </div>

    <table>
        <tr>
            <td class="banner-cell" style="width: 33%;">SERVICIO</td>
            <td class="banner-cell" style="width: 33%;">PLAN</td>
            <td class="banner-cell" style="width: 33%;">LÍNEA DEL SERVICIO</td>
        </tr>
        <tr>
            <td class="content-row text-center">(Consultoría)</td>
            <td class="content-row text-center">(Estándar)</td>
            <td class="content-row text-center">(Integral)</td>
        </tr>
    </table>

    <div class="banner">DETALLE DEL SERVICIO</div>
    <table class="list-table" style="margin-top: 5px;">
        <tr>
            <td class="num navy" style="font-weight: bold;">N°</td>
            <td class="navy" style="font-weight: bold;">DESCRIPCIÓN</td>
            <td class="navy text-center" style="font-weight: bold; width: 60px;">CANT.</td>
            <td class="navy text-right" style="font-weight: bold; width: 80px;">SUBTOTAL</td>
        </tr>
        @foreach($quotation->lines as $index => $line)
        <tr>
            <td class="num">{{ $index + 1 }}</td>
            <td>{{ $line->description }}</td>
            <td class="text-center">{{ number_format($line->quantity, 2) }}</td>
            <td class="text-right">{{ $quotation->currency->symbol ?? 'S/' }} {{ number_format((float) $line->line_total, 2) }}</td>
        </tr>
        @endforeach
    </table>

    <div class="banner" style="margin-top: 15px;">BENEFICIOS</div>
    <table class="list-table" style="margin-top: 5px;">
        <tr>
            <td class="num navy" style="font-weight: bold;">N°</td>
            <td class="navy" style="font-weight: bold;">DESCRIPCIÓN</td>
        </tr>
        <tr>
            <td class="num">1</td>
            <td>Soporte técnico y asesoría constante.</td>
        </tr>
        <tr>
            <td class="num">2</td>
            <td>Optimización de procesos operativos.</td>
        </tr>
    </table>

    <table style="margin-top: 15px;">
        <tr>
            <td class="banner-cell" style="width: 50%;">MODALIDAD</td>
            <td class="banner-cell" style="width: 50%;">TIEMPO DE DURACIÓN</td>
        </tr>
        <tr>
            <td class="content-row text-center">Presencial / Remoto</td>
            <td class="content-row text-center">Según cronograma establecido</td>
        </tr>
    </table>

    <div class="banner">TÉRMINOS Y CONDICIONES</div>
    <div class="content-row" style="text-align: left; padding: 10px;">
        @if($quotation->notes)
            {!! nl2br(e($quotation->notes)) !!}
        @else
            Condiciones de pago, entregables y responsabilidades según contrato.
        @endif
    </div>

    <div class="banner" style="margin-top: 15px;">VALOR DEL SERVICIO</div>
    <table class="totals-table">
        <tr>
            <td class="totals-label">Subtotal</td>
            <td class="totals-value">{{ $quotation->currency->symbol ?? 'S/' }} {{ number_format($quotation->subtotal, 2) }}</td>
        </tr>
        @if($quotation->discount > 0)
        <tr>
            <td class="totals-label">Descuento</td>
            <td class="totals-value">- {{ $quotation->currency->symbol ?? 'S/' }} {{ number_format($quotation->discount, 2) }}</td>
        </tr>
        @endif
        <tr>
            <td class="totals-label">IGV 18%</td>
            <td class="totals-value">{{ $quotation->currency->symbol ?? 'S/' }} {{ number_format($quotation->tax_amount, 2) }}</td>
        </tr>
        <tr>
            <td class="totals-label" style="font-size: 13px;">Total</td>
            <td class="totals-value" style="font-size: 13px; font-weight: bold; background-color: #f0f0f0;">
                {{ $quotation->currency->symbol ?? 'S/' }} {{ number_format($quotation->total, 2) }}
            </td>
        </tr>
    </table>

    <div class="banner" style="margin-top: 20px;">NUESTROS DATOS</div>
    <table style="text-align: center; margin-top: 5px;">
        <tr>
            <td class="banner-cell" style="width: 33%;">RAZÓN SOCIAL</td>
            <td class="banner-cell" style="width: 33%;">CUENTA INTERBANK</td>
            <td class="banner-cell" style="width: 33%;">INTERBANK CCI</td>
        </tr>
        <tr>
            <td class="content-row">CORPORACIÓN XPANDE S.A.C.</td>
            <td class="content-row">700-3004474-109</td>
            <td class="content-row">003-700-00300447-410-925</td>
        </tr>
    </table>
    
    <table style="text-align: center;">
        <tr>
            <td class="banner-cell" style="width: 33%;">CUENTA DE DETRACCIONES</td>
            <td class="banner-cell" style="width: 33%;">CUENTA SCOTIABANK</td>
            <td class="banner-cell" style="width: 33%;">SCOTIABANK CCI</td>
        </tr>
        <tr>
            <td class="content-row">00-250-046413</td>
            <td class="content-row">000-3657026</td>
            <td class="content-row">009-409-000003657026-45</td>
        </tr>
    </table>

    <table style="margin-top: 30px;">
        <tr>
            <td style="width: 30%; text-align: center;">
                <div style="font-size: 10px; color: #002060; margin-bottom: 5px;">¡Conócenos!</div>
                <div class="qr-placeholder">[Código QR]</div>
            </td>
            <td style="width: 40%; text-align: center; color: #002060; font-weight: bold; font-size: 13px; vertical-align: middle;">
                Gracias por su confianza.
            </td>
            <td style="width: 30%; text-align: right; color: #002060; font-weight: bold; font-size: 13px; vertical-align: bottom;">
                &raquo; Somos parte de <span style="font-size: 16px;">Xpandecorp</span>
            </td>
        </tr>
    </table>

    <div class="footer-bottom">
        <table class="footer-table">
            <tr>
                <td style="width: 33%; text-align: left;">Av. Garcilaso # 323. Chiclayo.</td>
                <td style="width: 33%; text-align: center;">Correo: contacto@xpandecorp.com</td>
                <td style="width: 34%; text-align: right;">Contacto: 994195832 - 940174022</td>
            </tr>
        </table>
    </div>

</body>
</html>
