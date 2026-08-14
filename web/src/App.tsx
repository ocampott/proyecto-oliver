import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PanelLayout } from "./components/PanelLayout";
import MarcarPage from "./pages/MarcarPage";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
          <Route path="/marcar/:org/:sucursal" element={<MarcarPage />} />
          <Route path="*" element={<div className="p-8">Página no encontrada.</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
