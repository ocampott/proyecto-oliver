import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import MarcarPage from "./pages/MarcarPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/marcar/:org/:sucursal" element={<MarcarPage />} />
          <Route path="*" element={<div className="p-8">Página no encontrada.</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
