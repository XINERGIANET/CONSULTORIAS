import type React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { ApexLayout } from "./layouts/ApexLayout";
import { DashboardHome } from "./pages/DashboardHome";
import { LoginPage } from "./pages/LoginPage";
import { QuotationsPage, OpportunitiesPage } from "./pages/CommerceQuotationsOpportunities";
import { CatalogosAdminPage, DocumentsPage, FinanzasHubPage, TimeEntriesPage } from "./pages/CommerceFinanceDocsTimeCatalog";
import { ProjectsPage } from "./pages/ProjectsPage";
import { AreasPage, ClientDetailPage, ClientsPage, IntegracionesPage, RentabilidadPage, ReportesGerenciaPage } from "./pages/OperationalPages";
import { UsersPage } from "./pages/UsersPage";

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RequireSuperadmin({ children }: { children: React.ReactElement }) {
  const { isAuthenticated, isSuperadmin } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!isSuperadmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <ApexLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardHome />} />

          <Route
            path="/areas"
            element={
              <RequireSuperadmin>
                <AreasPage />
              </RequireSuperadmin>
            }
          />
          <Route
            path="/areas/*"
            element={
              <RequireSuperadmin>
                <AreasPage />
              </RequireSuperadmin>
            }
          />

          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/clientes/:id" element={<ClientDetailPage />} />

          <Route path="/proyectos" element={<ProjectsPage />} />
          <Route path="/proyectos/*" element={<ProjectsPage />} />

          <Route path="/cotizaciones" element={<QuotationsPage />} />
          <Route path="/cotizaciones/*" element={<QuotationsPage />} />

          <Route path="/oportunidades" element={<OpportunitiesPage />} />
          <Route path="/oportunidades/*" element={<OpportunitiesPage />} />

          <Route path="/finanzas" element={<FinanzasHubPage />} />
          <Route path="/finanzas/*" element={<FinanzasHubPage />} />

          <Route path="/rentabilidad" element={<RentabilidadPage />} />
          <Route path="/rentabilidad/*" element={<RentabilidadPage />} />

          <Route path="/tiempos" element={<TimeEntriesPage />} />
          <Route path="/tiempos/*" element={<TimeEntriesPage />} />

          <Route path="/documentos" element={<DocumentsPage />} />
          <Route path="/documentos/*" element={<DocumentsPage />} />

          <Route path="/reportes" element={<ReportesGerenciaPage />} />
          <Route path="/reportes/*" element={<ReportesGerenciaPage />} />

          <Route
            path="/admin/catalogos"
            element={
              <RequireSuperadmin>
                <CatalogosAdminPage />
              </RequireSuperadmin>
            }
          />
          <Route
            path="/admin/catalogos/*"
            element={
              <RequireSuperadmin>
                <CatalogosAdminPage />
              </RequireSuperadmin>
            }
          />

          <Route
            path="/integraciones"
            element={
              <RequireSuperadmin>
                <IntegracionesPage />
              </RequireSuperadmin>
            }
          />
          <Route
            path="/integraciones/*"
            element={
              <RequireSuperadmin>
                <IntegracionesPage />
              </RequireSuperadmin>
            }
          />

          <Route
            path="/usuarios"
            element={
              <RequireSuperadmin>
                <UsersPage />
              </RequireSuperadmin>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
