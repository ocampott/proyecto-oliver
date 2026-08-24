import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <Card className="max-w-sm text-center">
        <p className="text-[56px] font-extrabold leading-none text-accent">404</p>
        <p className="mt-3 text-[15px] text-text-secondary">Esta página no existe.</p>
        <Button className="mt-6" onClick={() => navigate("/")}>
          Inicio
        </Button>
      </Card>
    </div>
  );
}
