import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./components/ui/toast";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PanelLayout } from "./components/PanelLayout";

// Cada página es su propio chunk: /marcar (empleados marcando desde el
// celular, sin login) no tiene por qué descargar el bundle entero del
// panel admin (mapas, export a Excel, etc.) solo para poder cargar.
const MarcarPage = lazy(() => import("./pages/MarcarPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SetPasswordPage = lazy(() => import("./pages/SetPasswordPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const SucursalesPage = lazy(() => import("./pages/sucursales/SucursalesPage"));
const SucursalDetallePage = lazy(() => import("./pages/sucursales/SucursalDetallePage"));
const EmpleadosPage = lazy(() => import("./pages/empleados/EmpleadosPage"));
const EmpleadoDetallePage = lazy(() => import("./pages/empleados/EmpleadoDetallePage"));
const AsistenciaPage = lazy(() => import("./pages/asistencia/AsistenciaPage"));
const HorasPage = lazy(() => import("./pages/horas/HorasPage"));
const TurnosPage = lazy(() => import("./pages/turnos/TurnosPage"));
const RrhhPage = lazy(() => import("./pages/rrhh/RrhhPage"));
const AdminPage = lazy(() => import("./pages/admin/AdminPage"));
const OrganizacionDetallePage = lazy(() => import("./pages/admin/OrganizacionDetallePage"));
const PlanPage = lazy(() => import("./pages/plan/PlanPage"));
const ConfiguracionPage = lazy(() => import("./pages/configuracion/ConfiguracionPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const LiquidacionPage = lazy(() => import("./pages/liquidacion/LiquidacionPage"));
const LegajosPage = lazy(() => import("./pages/legajos/LegajosPage"));
const LegajoDetallePage = lazy(() => import("./pages/legajos/LegajoDetallePage"));
const ChatEmpleadoPage = lazy(() => import("./pages/ChatEmpleadoPage"));

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-accent" role="status" aria-label="Cargando" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/bienvenida" element={<SetPasswordPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <HomePage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sucursales"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <SucursalesPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sucursales/:id"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <SucursalDetallePage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/empleados"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <EmpleadosPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/empleados/:id"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <EmpleadoDetallePage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/asistencia"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <AsistenciaPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/horas"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <HorasPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/turnos"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <TurnosPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rrhh"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <RrhhPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <AdminPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/organizaciones/:id"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <OrganizacionDetallePage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/plan"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <PlanPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracion"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <ConfiguracionPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/liquidacion"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <LiquidacionPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/legajos"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <LegajosPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/legajos/:id"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <LegajoDetallePage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/marcar/:org/:sucursal" element={<MarcarPage />} />
            <Route path="/chat/:orgSlug" element={<ChatEmpleadoPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
