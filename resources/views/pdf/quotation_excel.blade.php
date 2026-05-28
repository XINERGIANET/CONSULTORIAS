<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Propuesta Comercial</title>
    <style>
        table { border-collapse: collapse; width: 900px; font-family: 'Arial', sans-serif; font-size: 11px; }
        td, th { padding: 4px; }
        .bg-navy { background-color: #002060; color: #ffffff; text-align: center; font-weight: bold; border: 1px solid #ffffff; }
        .navy-text { color: #002060; font-weight: bold; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .border-bottom { border-bottom: 2px solid #002060; }
        .border-bottom-thin { border-bottom: 1px solid #002060; }
        .light-bg { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <table>
        <!-- 7 Columns: A, B, C, D, E, F, G -->
        <colgroup>
            <col width="5%">  <!-- A: N° -->
            <col width="20%"> <!-- B: Desc -->
            <col width="15%"> <!-- C: Desc -->
            <col width="15%"> <!-- D: Desc -->
            <col width="15%"> <!-- E: Cant -->
            <col width="15%"> <!-- F: Subtotal -->
            <col width="15%"> <!-- G: Subtotal -->
        </colgroup>
        
        <!-- HEADER -->
        <tr>
            <td colspan="4" class="navy-text" style="font-size: 24px; border-bottom: 2px solid #002060;">PROPUESTA COMERCIAL</td>
            <td colspan="3" class="navy-text text-right" style="font-size: 20px; border-bottom: 2px solid #002060;">
                @if(file_exists(public_path('img/logo-xinergia.png')))
                    <img src="{{ asset('img/logo-xinergia.png') }}" width="150" alt="XINERGIA">
                @else
                    &#10004; XINERGIA
                @endif
            </td>
        </tr>
        <tr>
            <td colspan="7" style="height: 5px;"></td>
        </tr>

        <!-- INFO -->
        <tr>
            <td colspan="1" class="navy-text">EMPRESA:</td>
            <td colspan="4" style="color:#000;">{{ $quotation->client->legal_name ?? $quotation->client->trade_name ?? '-' }}</td>
            <td colspan="1" class="navy-text text-right">Fecha:</td>
            <td colspan="1" style="color:#000; text-align: right;">{{ $quotation->created_at->format('d/m/Y') }}</td>
        </tr>
        <tr>
            <td colspan="7" style="height: 10px;"></td>
        </tr>

        <!-- SOBRE NOSOTROS -->
        <tr>
            <td colspan="7" class="bg-navy">SOBRE NOSOTROS</td>
        </tr>
        <tr>
            <td colspan="7" style="text-align: justify; padding: 10px 5px;">
                Somos una consultora especializada en <b>desarrollo empresarial</b> y <b>sistemas integrados de gestión</b>, el principal compromiso con nuestros clientes es optimizar su desempeño mediante un enfoque aplicado a la <b>mejora de procesos</b>.
            </td>
        </tr>

        <!-- SERVICIO / PLAN / LÍNEA -->
        <tr>
            <td colspan="2" class="bg-navy">SERVICIO</td>
            <td colspan="2" class="bg-navy">PLAN</td>
            <td colspan="3" class="bg-navy">LÍNEA DEL SERVICIO</td>
        </tr>
        <tr>
            <td colspan="2" class="text-center light-bg">(Consultoría)</td>
            <td colspan="2" class="text-center light-bg">(Estándar)</td>
            <td colspan="3" class="text-center light-bg">(Integral)</td>
        </tr>
        <tr>
            <td colspan="7" style="height: 10px;"></td>
        </tr>

        <!-- DETALLE DEL SERVICIO -->
        <tr>
            <td colspan="7" class="bg-navy">DETALLE DEL SERVICIO</td>
        </tr>
        <tr>
            <td colspan="1" class="navy-text text-center border-bottom-thin light-bg">N°</td>
            <td colspan="3" class="navy-text text-center border-bottom-thin light-bg">DESCRIPCIÓN</td>
            <td colspan="1" class="navy-text text-center border-bottom-thin light-bg">CANT.</td>
            <td colspan="2" class="navy-text text-center border-bottom-thin light-bg">SUBTOTAL</td>
        </tr>
        @foreach($quotation->lines as $index => $line)
        <tr>
            <td colspan="1" class="text-center">{{ $index + 1 }}</td>
            <td colspan="3">{{ $line->description }}</td>
            <td colspan="1" class="text-center">{{ number_format($line->quantity, 2) }}</td>
            <td colspan="2" class="text-center">{{ $quotation->currency->symbol ?? 'S/' }} {{ number_format((float) $line->line_total, 2) }}</td>
        </tr>
        @endforeach
        <tr>
            <td colspan="7" style="height: 10px;"></td>
        </tr>

        <!-- BENEFICIOS -->
        <tr>
            <td colspan="7" class="bg-navy">BENEFICIOS</td>
        </tr>
        <tr>
            <td colspan="1" class="navy-text text-center border-bottom-thin light-bg">N°</td>
            <td colspan="6" class="navy-text text-center border-bottom-thin light-bg">DESCRIPCIÓN</td>
        </tr>
        <tr>
            <td colspan="1" class="text-center">1</td>
            <td colspan="6">Soporte técnico y asesoría constante.</td>
        </tr>
        <tr>
            <td colspan="1" class="text-center">2</td>
            <td colspan="6">Optimización de procesos operativos.</td>
        </tr>
        <tr>
            <td colspan="7" style="height: 10px;"></td>
        </tr>

        <!-- MODALIDAD / TIEMPO -->
        <tr>
            <td colspan="3" class="bg-navy">MODALIDAD</td>
            <td colspan="4" class="bg-navy">TIEMPO DE DURACIÓN</td>
        </tr>
        <tr>
            <td colspan="3" class="text-center light-bg">Presencial / Remoto</td>
            <td colspan="4" class="text-center light-bg">Según cronograma establecido</td>
        </tr>
        <tr>
            <td colspan="7" style="height: 10px;"></td>
        </tr>

        <!-- TÉRMINOS Y CONDICIONES -->
        <tr>
            <td colspan="7" class="bg-navy">TÉRMINOS Y CONDICIONES</td>
        </tr>
        <tr>
            <td colspan="7" class="light-bg" style="padding: 10px;">
                @if($quotation->notes)
                    {!! nl2br(e($quotation->notes)) !!}
                @else
                    Condiciones de pago, entregables y responsabilidades según contrato.
                @endif
            </td>
        </tr>
        <tr>
            <td colspan="7" style="height: 10px;"></td>
        </tr>

        <!-- VALOR DEL SERVICIO -->
        <tr>
            <td colspan="7" class="bg-navy">VALOR DEL SERVICIO</td>
        </tr>
        <tr>
            <td colspan="7" class="text-center light-bg">(Se escribe = )</td>
        </tr>
        <tr>
            <td colspan="4"></td>
            <td colspan="1" class="navy-text text-center">Subtotal</td>
            <td colspan="2" class="text-center">{{ $quotation->currency->symbol ?? 'S/' }} {{ number_format($quotation->subtotal, 2) }}</td>
        </tr>
        @if($quotation->discount > 0)
        <tr>
            <td colspan="4"></td>
            <td colspan="1" class="navy-text text-center">Descuento</td>
            <td colspan="2" class="text-center">- {{ $quotation->currency->symbol ?? 'S/' }} {{ number_format($quotation->discount, 2) }}</td>
        </tr>
        @endif
        <tr>
            <td colspan="4"></td>
            <td colspan="1" class="navy-text text-center">IGV 18%</td>
            <td colspan="2" class="text-center">{{ $quotation->currency->symbol ?? 'S/' }} {{ number_format($quotation->tax_amount, 2) }}</td>
        </tr>
        <tr>
            <td colspan="4"></td>
            <td colspan="1" class="navy-text text-center" style="font-weight: bold;">Total</td>
            <td colspan="2" class="text-center light-bg" style="font-weight: bold;">{{ $quotation->currency->symbol ?? 'S/' }} {{ number_format($quotation->total, 2) }}</td>
        </tr>
        <tr>
            <td colspan="7" style="height: 15px;"></td>
        </tr>

        <!-- NUESTROS DATOS -->
        <tr>
            <td colspan="7" class="bg-navy">NUESTROS DATOS</td>
        </tr>
        <tr>
            <td colspan="2" class="bg-navy">RAZÓN SOCIAL</td>
            <td colspan="2" class="bg-navy">CUENTA INTERBANK</td>
            <td colspan="3" class="bg-navy">INTERBANK CCI</td>
        </tr>
        <tr>
            <td colspan="2" class="text-center light-bg">CORPORACIÓN XPANDE S.A.C.</td>
            <td colspan="2" class="text-center light-bg">700-3004474-109</td>
            <td colspan="3" class="text-center light-bg">003-700-00300447-410-925</td>
        </tr>
        <tr>
            <td colspan="2" class="bg-navy">CUENTA DE DETRACCIONES</td>
            <td colspan="2" class="bg-navy">CUENTA SCOTIABANK</td>
            <td colspan="3" class="bg-navy">SCOTIABANK CCI</td>
        </tr>
        <tr>
            <td colspan="2" class="text-center light-bg">00-250-046413</td>
            <td colspan="2" class="text-center light-bg">000-3657026</td>
            <td colspan="3" class="text-center light-bg">009-409-000003657026-45</td>
        </tr>
        <tr>
            <td colspan="7" style="height: 20px;"></td>
        </tr>

        <!-- FOOTER -->
        <tr>
            <td colspan="2" class="text-center navy-text" style="font-size: 10px;">
                ¡Conócenos!<br><br>
                @if(file_exists(public_path('img/qr.png')))
                    <img src="{{ asset('img/qr.png') }}" width="70" height="70">
                @else
                    [Código QR]
                @endif
            </td>
            <td colspan="3" class="text-center navy-text" style="font-size: 12px; vertical-align: middle;">Gracias por su confianza.</td>
            <td colspan="2" class="text-right navy-text" style="font-size: 12px; vertical-align: bottom;">&raquo; Somos parte de <b>Xpandecorp</b></td>
        </tr>
        <tr>
            <td colspan="7" style="border-bottom: 2px solid #002060;"></td>
        </tr>
        <tr>
            <td colspan="2" style="font-size: 10px; color: #002060;">Av. Garcilaso # 323. Chiclayo.</td>
            <td colspan="3" style="font-size: 10px; color: #002060; text-align: center;">Correo: contacto@xpandecorp.com</td>
            <td colspan="2" style="font-size: 10px; color: #002060; text-align: right;">Contacto: 994195832 - 940174022</td>
        </tr>

    </table>
</body>
</html>
