<?php

use App\Http\Controllers\Api\AreaController;
use App\Http\Controllers\Api\AccountPayableController;
use App\Http\Controllers\Api\AccountReceivableController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CollaboratorsController;
use App\Http\Controllers\Api\CargoController;
use App\Http\Controllers\Api\ClientContactController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\CrmActivityController;
use App\Http\Controllers\Api\CurrencyController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\FinancialCategoryController;
use App\Http\Controllers\Api\IncomeController;
use App\Http\Controllers\Api\IntegrationStubController;
use App\Http\Controllers\Api\OpportunityController;
use App\Http\Controllers\Api\PaymentMethodController;
use App\Http\Controllers\Api\PerformanceReviewController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\QuotationController;
use App\Http\Controllers\Api\ReportsController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\ServiceCatalogController;
use App\Http\Controllers\Api\StatusCatalogController;
use App\Http\Controllers\Api\TariffConfigController;
use App\Http\Controllers\Api\TaxRateController;
use App\Http\Controllers\Api\TimeEntryController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\UserManagementController;
use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function (): void {
    Route::get('/login', DashboardController::class)->name('login');
    Route::get('/api/auth/login', fn () => redirect('/login'));
    Route::post('/api/auth/login', [AuthController::class, 'login']);
});

Route::middleware('auth')->group(function (): void {
    Route::post('/api/auth/logout', [AuthController::class, 'logout']);
    Route::get('/api/auth/me', [AuthController::class, 'me']);
    Route::post('/api/auth/change-password', [AuthController::class, 'changePassword']);
    Route::get('/api/notifications', [NotificationController::class, 'index']);

    $spaUi = DashboardController::class;

    Route::get('/', $spaUi);
    Route::get('/areas/{any}', $spaUi)->where('any', '.*');
    Route::get('/areas', $spaUi);

    Route::get('/clientes/{any}', $spaUi)->where('any', '.*');
    Route::get('/clientes', $spaUi);

    Route::get('/proyectos/{any}', $spaUi)->where('any', '.*');
    Route::get('/proyectos', $spaUi);

    Route::get('/saas/{any}', $spaUi)->where('any', '.*');
    Route::get('/saas', $spaUi);

    Route::get('/cotizaciones/{any}', $spaUi)->where('any', '.*');
    Route::get('/cotizaciones', $spaUi);

    Route::get('/oportunidades/{any}', $spaUi)->where('any', '.*');
    Route::get('/oportunidades', $spaUi);

    Route::get('/finanzas/{any}', $spaUi)->where('any', '.*');
    Route::get('/finanzas', $spaUi);

    Route::get('/rentabilidad/{any}', $spaUi)->where('any', '.*');
    Route::get('/rentabilidad', $spaUi);

    Route::get('/tiempos/{any}', $spaUi)->where('any', '.*');
    Route::get('/tiempos', $spaUi);

    Route::get('/documentos/{any}', $spaUi)->where('any', '.*');
    Route::get('/documentos', $spaUi);

    Route::get('/reportes/{any}', $spaUi)->where('any', '.*');
    Route::get('/reportes', $spaUi);

    Route::get('/admin/catalogos/{any}', $spaUi)->where('any', '.*');
    Route::get('/admin/catalogos', $spaUi);

    Route::get('/integraciones/{any}', $spaUi)->where('any', '.*');
    Route::get('/integraciones', $spaUi);

    Route::get('/tareas', $spaUi);
    Route::get('/tareas/{any}', $spaUi)->where('any', '.*');

    Route::get('/calendario', $spaUi);
    Route::get('/calendario/{any}', $spaUi)->where('any', '.*');

    Route::get('/cuentas-por-cobrar', $spaUi);
    Route::get('/cuentas-por-cobrar/{any}', $spaUi)->where('any', '.*');

    Route::get('/cuentas-por-pagar', $spaUi);
    Route::get('/cuentas-por-pagar/{any}', $spaUi)->where('any', '.*');

    Route::get('/usuarios', $spaUi);
    Route::get('/usuarios/{any}', $spaUi)->where('any', '.*');

    Route::prefix('api')->group(function (): void {
        Route::get('collaborators', [CollaboratorsController::class, 'index']);
        Route::get('roles', [RoleController::class, 'index']);
        Route::get('roles/permissions', [RoleController::class, 'permissions']);
        Route::get('areas', [AreaController::class, 'index']);
        Route::post('areas', [AreaController::class, 'store']);
        Route::put('areas/{area}', [AreaController::class, 'update']);
        Route::delete('areas/{area}', [AreaController::class, 'destroy']);

        Route::get('clients', [ClientController::class, 'index']);
        Route::get('clients/search-ruc/{ruc}', [ClientController::class, 'searchRuc']);
        Route::get('clients/search-dni/{dni}', [ClientController::class, 'searchDni']);
        Route::post('clients', [ClientController::class, 'store']);
        Route::get('clients/{client}', [ClientController::class, 'show']);
        Route::put('clients/{client}', [ClientController::class, 'update']);
        Route::delete('clients/{client}', [ClientController::class, 'destroy']);

        Route::post('clients/{client}/contacts', [ClientContactController::class, 'store']);
        Route::put('clients/{client}/contacts/{contact}', [ClientContactController::class, 'update']);
        Route::delete('clients/{client}/contacts/{contact}', [ClientContactController::class, 'destroy']);

        Route::post('clients/{client}/locations', [\App\Http\Controllers\Api\ClientLocationController::class, 'store']);
        Route::put('clients/{client}/locations/{location}', [\App\Http\Controllers\Api\ClientLocationController::class, 'update']);
        Route::delete('clients/{client}/locations/{location}', [\App\Http\Controllers\Api\ClientLocationController::class, 'destroy']);

        Route::get('clients/{client}/crm-activities', [CrmActivityController::class, 'index']);
        Route::post('clients/{client}/crm-activities', [CrmActivityController::class, 'store']);
        Route::delete('clients/{client}/crm-activities/{activity}', [CrmActivityController::class, 'destroy']);

        Route::get('opportunities', [OpportunityController::class, 'index']);
        Route::post('opportunities', [OpportunityController::class, 'store']);
        Route::put('opportunities/{opportunity}', [OpportunityController::class, 'update']);
        Route::delete('opportunities/{opportunity}', [OpportunityController::class, 'destroy']);

        Route::get('projects', [ProjectController::class, 'index']);
        Route::post('projects', [ProjectController::class, 'store']);
        Route::get('projects/{project}', [ProjectController::class, 'show']);
        Route::put('projects/{project}', [ProjectController::class, 'update']);
        Route::delete('projects/{project}', [ProjectController::class, 'destroy']);

        Route::get('tasks', [TaskController::class, 'index']);
        Route::post('tasks', [TaskController::class, 'store']);
        Route::get('tasks/{task}', [TaskController::class, 'show']);
        Route::put('tasks/{task}', [TaskController::class, 'update']);
        Route::post('tasks/{task}/start', [TaskController::class, 'start']);
        Route::post('tasks/{task}/finish', [TaskController::class, 'finish']);
        Route::delete('tasks/{task}', [TaskController::class, 'destroy']);

        Route::get('quotations', [QuotationController::class, 'index']);
        Route::get('quotations/{quotation}', [QuotationController::class, 'show']);
        Route::post('quotations', [QuotationController::class, 'store']);
        Route::put('quotations/{quotation}', [QuotationController::class, 'update']);
        Route::post('quotations/{quotation}/accept', [QuotationController::class, 'accept']);
        Route::get('quotations/{quotation}/pdf', [QuotationController::class, 'generatePdf']);
        Route::get('quotations/{quotation}/excel', [QuotationController::class, 'generateExcel']);
        Route::post('quotations/{quotation}/send-whatsapp', [QuotationController::class, 'sendWhatsapp']);
        Route::post('quotations/{quotation}/send-email', [QuotationController::class, 'sendEmail']);
        Route::delete('quotations/{quotation}', [QuotationController::class, 'destroy']);

        Route::get('incomes', [IncomeController::class, 'index']);
        Route::post('incomes', [IncomeController::class, 'store']);
        Route::get('incomes/{income}', [IncomeController::class, 'show']);
        Route::put('incomes/{income}', [IncomeController::class, 'update']);
        Route::delete('incomes/{income}', [IncomeController::class, 'destroy']);

        Route::get('accounts-receivable', [AccountReceivableController::class, 'index'])->middleware('permission:view_finances');
        Route::post('accounts-receivable', [AccountReceivableController::class, 'store'])->middleware('permission:register_payments');
        Route::get('accounts-receivable/{accountReceivable}', [AccountReceivableController::class, 'show'])->middleware('permission:view_finances');
        Route::post('accounts-receivable/{accountReceivable}/payments', [AccountReceivableController::class, 'registerPayment'])->middleware('permission:register_payments');

        Route::get('accounts-payable', [AccountPayableController::class, 'index'])->middleware('permission:view_finances');
        Route::post('accounts-payable', [AccountPayableController::class, 'store'])->middleware('permission:register_payments');
        Route::post('accounts-payable/generate-payroll', [AccountPayableController::class, 'generatePayroll'])->middleware('permission:register_payments');
        Route::get('accounts-payable/{accountPayable}', [AccountPayableController::class, 'show'])->middleware('permission:view_finances');
        Route::post('accounts-payable/{accountPayable}/payments', [AccountPayableController::class, 'registerPayment'])->middleware('permission:register_payments');
        Route::post('accounts-payable/{accountPayable}/invoice', [AccountPayableController::class, 'markInvoiced'])->middleware('permission:register_payments');
        Route::delete('accounts-payable/{accountPayable}', [AccountPayableController::class, 'destroy'])->middleware('permission:register_payments');

        Route::get('expenses', [ExpenseController::class, 'index']);
        Route::post('expenses', [ExpenseController::class, 'store']);
        Route::get('expenses/{expense}', [ExpenseController::class, 'show']);
        Route::put('expenses/{expense}', [ExpenseController::class, 'update']);
        Route::delete('expenses/{expense}', [ExpenseController::class, 'destroy']);

        Route::get('time-entries', [TimeEntryController::class, 'index']);
        Route::post('time-entries', [TimeEntryController::class, 'store']);
        Route::put('time-entries/{timeEntry}', [TimeEntryController::class, 'update']);
        Route::delete('time-entries/{timeEntry}', [TimeEntryController::class, 'destroy']);
        Route::post('time-entries/{timeEntry}/review', [TimeEntryController::class, 'review']);

        Route::get('documents', [DocumentController::class, 'index']);
        Route::post('documents', [DocumentController::class, 'store']);
        Route::post('documents/{document}/versions', [DocumentController::class, 'addVersion']);
        Route::delete('documents/{document}', [DocumentController::class, 'destroy']);

        Route::get('reports/cash-flow', [ReportsController::class, 'cashFlow']);
        Route::get('reports/profitability-projects', [ReportsController::class, 'profitabilityProjects']);
        Route::get('reports/profitability-clients', [ReportsController::class, 'profitabilityClients']);
        Route::get('reports/profitability-areas', [ReportsController::class, 'profitabilityAreas']);
        Route::get('reports/consultant-workload', [ReportsController::class, 'consultantWorkload']);
        Route::get('reports/insights', [ReportsController::class, 'insights']);
        Route::get('reports/cost-comparison', [ReportsController::class, 'costComparison']);
        Route::get('reports/recent-activity', [ReportsController::class, 'recentActivity']);

        Route::get('catalog/financial-categories', [FinancialCategoryController::class, 'index']);
        Route::post('catalog/financial-categories', [FinancialCategoryController::class, 'store']);
        Route::put('catalog/financial-categories/{financialCategory}', [FinancialCategoryController::class, 'update']);
        Route::delete('catalog/financial-categories/{financialCategory}', [FinancialCategoryController::class, 'destroy']);

        Route::get('catalog/currencies', [CurrencyController::class, 'index']);
        Route::post('catalog/currencies', [CurrencyController::class, 'store']);
        Route::put('catalog/currencies/{currency}', [CurrencyController::class, 'update']);
        Route::delete('catalog/currencies/{currency}', [CurrencyController::class, 'destroy']);

        Route::get('catalog/tax-rates', [TaxRateController::class, 'index']);
        Route::post('catalog/tax-rates', [TaxRateController::class, 'store']);
        Route::put('catalog/tax-rates/{taxRate}', [TaxRateController::class, 'update']);
        Route::delete('catalog/tax-rates/{taxRate}', [TaxRateController::class, 'destroy']);

        Route::get('catalog/services', [ServiceCatalogController::class, 'index']);
        Route::post('catalog/services', [ServiceCatalogController::class, 'store']);
        Route::put('catalog/services/{service}', [ServiceCatalogController::class, 'update']);
        Route::delete('catalog/services/{service}', [ServiceCatalogController::class, 'destroy']);

        Route::get('catalog/cargos', [CargoController::class, 'index']);
        Route::post('catalog/cargos', [CargoController::class, 'store']);
        Route::put('catalog/cargos/{cargo}', [CargoController::class, 'update']);
        Route::delete('catalog/cargos/{cargo}', [CargoController::class, 'destroy']);

        Route::get('catalog/tariffs', [TariffConfigController::class, 'index']);
        Route::post('catalog/tariffs', [TariffConfigController::class, 'store']);
        Route::put('catalog/tariffs/{tariffConfig}', [TariffConfigController::class, 'update']);
        Route::delete('catalog/tariffs/{tariffConfig}', [TariffConfigController::class, 'destroy']);

        Route::get('catalog/statuses', [StatusCatalogController::class, 'index']);
        Route::post('catalog/statuses', [StatusCatalogController::class, 'store']);
        Route::put('catalog/statuses/{statusCatalog}', [StatusCatalogController::class, 'update']);
        Route::delete('catalog/statuses/{statusCatalog}', [StatusCatalogController::class, 'destroy']);

        Route::get('catalog/payment-accounts', [\App\Http\Controllers\Api\PaymentAccountController::class, 'index']);
        Route::post('catalog/payment-accounts', [\App\Http\Controllers\Api\PaymentAccountController::class, 'store']);
        Route::put('catalog/payment-accounts/{paymentAccount}', [\App\Http\Controllers\Api\PaymentAccountController::class, 'update']);
        Route::delete('catalog/payment-accounts/{paymentAccount}', [\App\Http\Controllers\Api\PaymentAccountController::class, 'destroy']);

        Route::get('catalog/payment-methods', [PaymentMethodController::class, 'index']);
        Route::post('catalog/payment-methods', [PaymentMethodController::class, 'store']);
        Route::put('catalog/payment-methods/{paymentMethod}', [PaymentMethodController::class, 'update']);
        Route::delete('catalog/payment-methods/{paymentMethod}', [PaymentMethodController::class, 'destroy']);

        Route::get('performance-reviews', [PerformanceReviewController::class, 'index']);
        Route::post('performance-reviews', [PerformanceReviewController::class, 'store']);
        Route::put('performance-reviews/{performanceReview}', [PerformanceReviewController::class, 'update']);
        Route::delete('performance-reviews/{performanceReview}', [PerformanceReviewController::class, 'destroy']);

        Route::get('integrations', [IntegrationStubController::class, 'index']);
    });

    Route::prefix('api/users')->middleware('superadmin')->group(function (): void {
        Route::get('/', [UserManagementController::class, 'index']);
        Route::post('/', [UserManagementController::class, 'store']);
        Route::get('/{user}', [UserManagementController::class, 'show']);
        Route::put('/{user}', [UserManagementController::class, 'update']);
        Route::delete('/{user}', [UserManagementController::class, 'destroy']);
    });

    Route::prefix('api/roles')->middleware('superadmin')->group(function (): void {
        Route::post('/', [RoleController::class, 'store']);
        Route::put('/{role}', [RoleController::class, 'update']);
        Route::delete('/{role}', [RoleController::class, 'destroy']);
    });
});
