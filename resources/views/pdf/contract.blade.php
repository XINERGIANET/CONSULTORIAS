<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Contrato Comercial — {{ $contract->title ?? 'Contrato' }}</title>
    <style>
        @page { margin: 35px 45px; }
        body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 10px; color: #222; line-height: 1.35; }
        .primary { color: #002060; }
        .bg-primary { background-color: #002060; color: white; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th, td { padding: 5px 6px; }
        
        .header-table { border-bottom: 2px solid #002060; margin-bottom: 15px; padding-bottom: 10px; }
        .header-title { font-size: 22px; font-weight: bold; color: #002060; }
        .header-subtitle { font-size: 11px; color: #555; margin-top: 3px; }
        .logo-box { text-align: right; color: #002060; font-size: 18px; font-weight: bold; }
        
        .box-panel { background-color: #f4f6fa; border: 1px solid #d0d7de; border-radius: 4px; padding: 10px; margin-bottom: 12px; }
        
        .section-banner { background-color: #002060; color: white; font-weight: bold; font-size: 11px; padding: 5px 8px; margin-top: 15px; margin-bottom: 8px; border-radius: 2px; }
        
        .grid-table td { padding: 4px 6px; }
        .grid-label { font-weight: bold; color: #002060; width: 22%; }
        .grid-value { color: #333; }
        
        .data-table { border: 1px solid #d0d7de; margin-top: 6px; }
        .data-table th { background-color: #002060; color: white; text-align: left; font-size: 9.5px; padding: 6px; }
        .data-table td { border-bottom: 1px solid #e1e4e8; padding: 5px 6px; }
        .data-table tr:nth-child(even) { background-color: #f8fafc; }
        
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        
        .status-badge { display: inline-block; padding: 2px 6px; font-size: 9px; font-weight: bold; border-radius: 3px; }
        .status-active { background-color: #e6ffed; color: #22863a; border: 1px solid #bef5ca; }
        .status-expired { background-color: #ffeef0; color: #cb2431; border: 1px solid #fdaeb7; }
        .status-renewed { background-color: #dbedff; color: #0366d6; border: 1px solid #c8e1ff; }
        
        .signature-table { margin-top: 45px; }
        .signature-box { text-align: center; border-top: 1px solid #666; padding-top: 8px; width: 42%; margin: 0 4%; float: left; }
        
        .footer { margin-top: 30px; border-top: 1px solid #002060; padding-top: 8px; font-size: 8.5px; color: #666; text-align: center; }
    </style>
</head>
<body>

    <table class="header-table">
        <tr>
            <td>
                <div class="header-title">CONTRATO COMERCIAL</div>
                <div class="header-subtitle">Documento de Convenio de Servicios — N° #{{ $contract->id }}</div>
            </td>
            <td class="logo-box">
                @if(file_exists(public_path('img/logo-xinergia.png')))
                    <img src="{{ public_path('img/logo-xinergia.png') }}" width="140" alt="XINERGIA">
                @else
                    <span style="font-size: 20px; color:#002060;">XINERGIA</span>
                @endif
            </td>
        </tr>
    </table>

    <div class="box-panel">
        <table class="grid-table" style="margin-bottom: 0;">
            <tr>
                <td class="grid-label">Cliente / Razón Social:</td>
                <td class="grid-value" style="font-size: 11px; font-weight: bold;">{{ $contract->client->legal_name ?? 'Cliente N/A' }}</td>
                <td class="grid-label">RUC / DNI:</td>
                <td class="grid-value">{{ $contract->client->ruc ?? $contract->client->dni ?? 'N/A' }}</td>
            </tr>
            <tr>
                <td class="grid-label">Proyecto Asignado:</td>
                <td class="grid-value" style="font-weight: bold;">{{ $contract->project->name ?? 'Proyecto General' }}</td>
                <td class="grid-label">Área / Empresa:</td>
                <td class="grid-value">{{ $contract->area->name ?? 'General' }}</td>
            </tr>
            <tr>
                <td class="grid-label">Vigencia del Contrato:</td>
                <td class="grid-value">
                    <strong>{{ $contract->start_date ? $contract->start_date->format('d/m/Y') : '-' }}</strong> al 
                    <strong>{{ $contract->end_date ? $contract->end_date->format('d/m/Y') : '-' }}</strong>
                </td>
                <td class="grid-label">Estado:</td>
                <td class="grid-value">
                    @if($contract->status === 'active')
                        <span class="status-badge status-active">ACTIVO</span>
                    @elseif($contract->status === 'expired')
                        <span class="status-badge status-expired">VENCIDO</span>
                    @elseif($contract->status === 'renewed')
                        <span class="status-badge status-renewed">RENOVADO</span>
                    @else
                        <span class="status-badge" style="background:#eee;">{{ strtoupper($contract->status) }}</span>
                    @endif
                </td>
            </tr>
        </table>
    </div>

    <div class="section-banner">1. OBJETO Y RESUMEN DEL CONTRATO</div>
    <p style="text-align: justify; margin: 4px 0 10px 0;">
        El presente contrato establece las condiciones comerciales, modalidades de cobranza y compromisos acordados para la ejecución de los servicios del proyecto <strong>«{{ $contract->project->name ?? $contract->title }}»</strong>, brindados a favor del cliente <strong>{{ $contract->client->legal_name ?? '-' }}</strong>.
    </p>

    <table class="grid-table">
        <tr>
            <td class="grid-label">Título del Contrato:</td>
            <td class="grid-value">{{ $contract->title }}</td>
        </tr>
        <tr>
            <td class="grid-label">Monto Total Contratado:</td>
            <td class="grid-value" style="font-size: 12px; font-weight: bold; color: #002060;">
                S/ {{ number_format((float) $contract->total_amount, 2) }}
            </td>
        </tr>
        <tr>
            <td class="grid-label">Frecuencia de Cobro:</td>
            <td class="grid-value">{{ ucfirst($contract->billing_frequency ?? 'mensual') }} ({{ $contract->installments_count }} cuota(s))</td>
        </tr>
        @if($contract->notes)
        <tr>
            <td class="grid-label">Observaciones / Notas:</td>
            <td class="grid-value">{{ $contract->notes }}</td>
        </tr>
        @endif
    </table>

    <div class="section-banner">2. CRONOGRAMA DE CUENTAS POR COBRAR</div>
    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 10%; text-align: center;">N° Cuota</th>
                <th style="width: 25%;">Vencimiento Proyectado</th>
                <th style="width: 25%; text-align: right;">Monto Cuota</th>
                <th style="width: 40%;">Concepto / Detalle</th>
            </tr>
        </thead>
        <tbody>
            @forelse($contract->receivables as $item)
                <tr>
                    <td class="text-center" style="font-weight: bold;">{{ $item->installment_number }}</td>
                    <td>{{ $item->due_on ? $item->due_on->format('d/m/Y') : ($item->projected_due_on ? $item->projected_due_on->format('d/m/Y') : '-') }}</td>
                    <td class="text-right" style="font-weight: bold;">S/ {{ number_format((float) $item->total_amount, 2) }}</td>
                    <td>{{ $item->notes ?? 'Cuota '.$item->installment_number }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="4" class="text-center" style="color: #888;">Sin cuotas detalladas.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="signature-table" style="margin-top: 60px;">
        <table style="width: 100%; border: none;">
            <tr>
                <td style="width: 45%; text-align: center; border: none;">
                    <div style="border-top: 1px solid #333; margin: 0 20px; padding-top: 5px; font-weight: bold; color: #002060;">
                        POR LA CONSULTORA
                    </div>
                    <div style="font-size: 9px; color: #555;">Representante Legal / Gerencia</div>
                </td>
                <td style="width: 10%; border: none;"></td>
                <td style="width: 45%; text-align: center; border: none;">
                    <div style="border-top: 1px solid #333; margin: 0 20px; padding-top: 5px; font-weight: bold; color: #002060;">
                        POR EL CLIENTE
                    </div>
                    <div style="font-size: 9px; color: #555;">{{ $contract->client->legal_name ?? 'Representante Autorizado' }}</div>
                </td>
            </tr>
        </table>
    </div>

    <div class="footer">
        Documento generado el {{ date('d/m/Y H:i') }} — Xinergia Consultoría &amp; Gestión Empresarial
    </div>

</body>
</html>
