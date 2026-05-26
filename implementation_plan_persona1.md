# Plan de Implementación Integral (Módulos CRM, Finanzas y Cotizaciones)

Este documento detalla el plan técnico completo para implementar todos los pendientes solicitados.

## 1. Módulo Clientes (Datos, Representante y Sedes)

### Database & Migrations
- **[NEW] Migración `clients`**: Agregar columna `rubro` (string).
- **[NEW] Migración `client_contacts`**: Agregar columna `observations` (text).
- **[NEW] Migración `client_locations`**: Crear tabla con `client_id`, `name`, `address`, `phone`, `responsible_person`, `is_active`.

### Backend Models & Controllers
- **[MODIFY] `App\Models\Client`**: Agregar `rubro` al fillable y crear relación `locations()`.
- **[MODIFY] `App\Models\ClientContact`**: Agregar `observations`.
- **[NEW] `App\Models\ClientLocation` & `ClientLocationController`**: Modelo y controlador API para CRUD de sedes. Registrar rutas en `routes/web.php`.
- **[MODIFY] `ClientController`**: Permitir guardar `rubro` y cargar la relación de sedes.

### Frontend (`OperationalPages.tsx`)
- **[MODIFY] `ClientsPage`**: Añadir input para "Rubro".
- **[MODIFY] `ClientDetailPage`**:
  - Actualizar modal de Contactos añadiendo `textarea` para Observaciones.
  - Crear un nuevo panel (sección) para gestionar múltiples **Sedes**.
  - Crear modal y funciones para agregar/editar/eliminar sedes conectadas a la API.

---

## 2. Área Automática (Aplicación en Todo el Sistema)

> [!IMPORTANT]  
> Esto requiere modificar el comportamiento en múltiples vistas y controladores donde actualmente se selecciona el área manualmente.

### Frontend
- **[MODIFY] Quitar selectores de área en formularios**:
  - `ClientsPage` (Clientes)
  - `QuotationsPage` (Cotizaciones)
  - `OpportunitiesPage` (Oportunidades)
  - `FinanzasHubPage` (Ingresos y Gastos)
  - `TimeEntriesPage` (Tiempos)

### Backend Controllers
En cada controlador (`ClientController`, `QuotationController`, `OpportunityController`, `IncomeController`, `ExpenseController`, `TimeEntryController`), modificar los métodos `store`:
- Ignorar el parámetro `area_id` o `area_ids` recibido del frontend.
- **Entidades con relación M:M (ej. Clientes, Cotizaciones, Proyectos)**: Asignar automáticamente todas las áreas a las que pertenece el usuario logueado (`$request->user()->areas()->pluck('areas.id')->toArray()`).
- **Entidades con relación 1:M (ej. Ingresos, Gastos, Tiempos)**: Asignar la primera área (principal) del usuario (`$request->user()->areas()->first()?->id`).

---

## 3. Etapas CRM

### Backend & Frontend
- **[MODIFY] `ClientsPage` (Frontend)**: Actualizar el selector de Etapa CRM en el modal. Las opciones disponibles serán estrictamente:
  1. `lead` (Lead)
  2. `prospect` (Prospecto)
  3. `active_client` (Cliente Activo)
- Se removerá la opción redundante "Cliente" o "Cliente inactivo" del listado CRM habitual, simplificando el embudo.
- **[MODIFY] Validación Backend**: Asegurar que las validaciones en `ClientController` soporten los nuevos strings si hay reglas restrictivas.

---

## 4. Envío de Cotizaciones y Cambio de Etapa

### Backend (`QuotationController`)
- **[NEW] Endpoints de Envío**: Crear `/api/quotations/{id}/send-email` y `/api/quotations/{id}/send-whatsapp`.
- **Lógica de Cambio de Etapa**: En ambos endpoints, si el cliente asociado tiene etapa `lead`, actualizarlo automáticamente a `prospect`.
- **Envío Email**: Utilizar `Mail` de Laravel para enviar la cotización adjunta en PDF.
- **Envío WhatsApp**: Retornar un enlace de `api.whatsapp.com` preconfigurado con un texto estándar y enlace al PDF para que el usuario proceda con el envío.

### Frontend (`CommerceQuotationsOpportunities.tsx`)
- **[MODIFY] `QuotationsPage`**: En la tabla de cotizaciones, agregar botones de acción "📧 Correo" y "💬 WhatsApp" que consuman los endpoints correspondientes.

---

## 5. Formato de Cotización (Generación de PDF)

> [!NOTE]  
> Usaremos `barryvdh/laravel-dompdf` (ya instalado en tu proyecto) para construir y exportar el PDF.

### Backend (Vistas y Controladores)
- **[NEW] `resources/views/pdf/quotation.blade.php`**: Plantilla base HTML/CSS que contendrá la estructura profesional solicitada:
  - Estructura base / membrete de la empresa.
  - Datos del Cliente y Representante (extrayendo el contacto principal de las relaciones).
  - Listado de Servicios (Líneas de la cotización).
  - Montos (Subtotal, Impuestos, Total).
  - Condiciones comerciales y notas.
- **[NEW] Export Endpoint**: Crear `/api/quotations/{id}/pdf` que genere y descargue el PDF o permita previsualizarlo en el navegador.

## Revisión requerida
¿Estás de acuerdo con aplicar el "Área Automática" a todos los módulos especificados (Clientes, Cotizaciones, Oportunidades, Finanzas, Tiempos)? Si apruebas el plan, iniciaré creando las migraciones y la lógica principal.
