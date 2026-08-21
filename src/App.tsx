import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./components/ui/toast";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PanelLayout } from "./components/PanelLayout";
import MarcarPage from "./pages/MarcarPage";
import LoginPage from "./pages/LoginPage";
import SetPasswordPage from "./pages/SetPasswordPage";
import HomePage from "./pages/HomePage";
import SucursalesPage from "./pages/sucursales/SucursalesPage";
import EmpleadosPage from "./pages/empleados/EmpleadosPage";
import AsistenciaPage from "./pages/asistencia/AsistenciaPage";
import HorasPage from "./pages/horas/HorasPage";
import TurnosPage from "./pages/turnos/TurnosPage";
import RrhhPage from "./pages/rrhh/RrhhPage";
import AdminPage from "./pages/admin/AdminPage";
import PlanPage from "./pages/plan/PlanPage";
import ConfiguracionPage from "./pages/configuracion/ConfiguracionPage";

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
                  <AdminPage />
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
            <Route path="/marcar/:org/:sucursal" element={<MarcarPage />} />
            <Route path="*" element={<div className="p-8">Página no encontrada.</div>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
