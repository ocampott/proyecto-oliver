import { BrowserRouter, Routes, Route } from "react-router-dom";
import MarcarPage from "./pages/MarcarPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/marcar/:org/:sucursal" element={<MarcarPage />} />
        <Route path="*" element={<div className="p-8">Página no encontrada.</div>} />
      </Routes>
    </BrowserRouter>
  );
}
