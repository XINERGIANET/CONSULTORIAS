<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Cotización #{{ $quotation->number }}</title>
    <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 14px; color: #333; margin: 0; padding: 20px; }
        .header { width: 100%; border-bottom: 2px solid #465fff; padding-bottom: 15px; margin-bottom: 20px; text-align: center; }
        .header img { max-width: 150px; }
        .header-title { font-size: 24px; color: #465fff; font-weight: bold; margin-top: 10px; }
        .info-table { width: 100%; margin-bottom: 20px; border-collapse: collapse; }
        .info-table td { padding: 5px; vertical-align: top; }
        .info-table .title { font-weight: bold; color: #555; width: 120px; }
        .details-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .details-table th, .details-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        .details-table th { background-color: #f8f9fa; color: #465fff; font-weight: bold; }
        .text-right { text-align: right !important; }
        .totals-table { width: 50%; float: right; border-collapse: collapse; margin-bottom: 30px; }
        .totals-table td { padding: 8px; border: 1px solid #ddd; }
        .totals-table .totals-title { font-weight: bold; background-color: #f8f9fa; }
        .footer { clear: both; margin-top: 40px; font-size: 12px; color: #777; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
        .notes { margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #465fff; }
    </style>
</head>
<body>

    <div class="header">
        <!-- Logo placeholder -->
        <div class="header-title">COTIZACIÓN DE SERVICIOS</div>
        <div>Cotizacion N: {{ $quotation->number }}</div>
        <div>Fecha: {{ $quotation->created_at->format('d/m/Y') }}</div>
        @if($quotation->valid_until)
        <div>Válido hasta: {{ $quotation->valid_until->format('d/m/Y') }}</div>
        @endif
    </div>

    <table class="info-table">
        <tr>
            <td class="title">Cliente:</td>
            <td>{{ $quotation->client->legal_name ?? $quotation->client->trade_name }}</td>
            <td class="title">RUC:</td>
            <td>{{ $quotation->client->ruc ?? '-' }}</td>
        </tr>
        <tr>
            <td class="title">Dirección:</td>
            <td>{{ $quotation->client->address ?? '-' }}</td>
            <td class="title">Representante:</td>
            <td>
                @if($quotation->client->contacts->isNotEmpty())
                    {{ $quotation->client->contacts->first()->name }} 
                    ({{ $quotation->client->contacts->first()->phone ?? 'Sin teléfono' }})
                @else
                    -
                @endif
            </td>
        </tr>
    </table>

    <table class="details-table">
        <thead>
            <tr>
                <th>Descripción</th>
                <th class="text-right" style="width: 80px;">Cant.</th>
                <th class="text-right" style="width: 120px;">Precio Unit.</th>
                <th class="text-right" style="width: 120px;">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            @foreach($quotation->lines as $line)
            <tr>
                <td>{{ $line->description }}</td>
                <td class="text-right">{{ number_format($line->quantity, 2) }}</td>
                <td class="text-right">{{ $quotation->currency->symbol ?? '$' }} {{ number_format($line->unit_price, 2) }}</td>
                <td class="text-right">{{ $quotation->currency->symbol ?? '$' }} {{ number_format((float) $line->line_total, 2) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <table class="totals-table">
        <tr>
            <td class="totals-title text-right">Subtotal:</td>
            <td class="text-right">{{ $quotation->currency->symbol ?? '$' }} {{ number_format($quotation->subtotal, 2) }}</td>
        </tr>
        @if($quotation->discount > 0)
        <tr>
            <td class="totals-title text-right">Descuento:</td>
            <td class="text-right">- {{ $quotation->currency->symbol ?? '$' }} {{ number_format($quotation->discount, 2) }}</td>
        </tr>
        @endif
        @if($quotation->tax_amount > 0)
        <tr>
            <td class="totals-title text-right">Impuestos:</td>
            <td class="text-right">{{ $quotation->currency->symbol ?? '$' }} {{ number_format($quotation->tax_amount, 2) }}</td>
        </tr>
        @endif
        <tr>
            <td class="totals-title text-right" style="font-size: 16px;"><strong>TOTAL:</strong></td>
            <td class="text-right" style="font-size: 16px; font-weight: bold; color: #465fff;">
                {{ $quotation->currency->symbol ?? '$' }} {{ number_format($quotation->total, 2) }}
            </td>
        </tr>
    </table>

    <div style="clear: both;"></div>

    @if($quotation->notes)
    <div class="notes">
        <strong>Condiciones y Notas:</strong><br>
        {!! nl2br(e($quotation->notes)) !!}
    </div>
    @endif

    <div class="footer">
        Documento generado por el sistema CRM - Consultoría.<br>
        Si tiene alguna consulta sobre esta cotización, por favor contáctenos.
    </div>

</body>
</html>
