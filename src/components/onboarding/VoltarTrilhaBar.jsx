import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";

// Faixa "Voltar aos Primeiros passos" — aparece em QUALQUER tela do app quando a
// franqueada chegou ali pela trilha (destino tipo "app" de journeySteps.js, que
// sempre leva `?de=primeiros-passos` na URL). A flag fica em sessionStorage porque
// a navegação seguinte (ex: abrir um Sheet, trocar de aba dentro da tela) perde o
// query param original — sem a flag, a faixa sumiria no primeiro clique dentro da
// tela de destino. Some sozinha ao entrar em /Onboarding (voltou pra trilha) ou ao
// ser tocada.
const FLAG_KEY = "voltar_trilha_primeiros_passos";

export default function VoltarTrilhaBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("de") === "primeiros-passos") {
      try {
        sessionStorage.setItem(FLAG_KEY, "true");
      } catch {
        // sessionStorage pode falhar (modo privado) — a faixa só não aparece
      }
    }

    if (location.pathname === "/Onboarding") {
      try {
        sessionStorage.removeItem(FLAG_KEY);
      } catch {
        // idem acima
      }
      setVisible(false);
      return;
    }

    let flag = false;
    try {
      flag = sessionStorage.getItem(FLAG_KEY) === "true";
    } catch {
      flag = false;
    }
    setVisible(flag);
  }, [location.pathname, location.search]);

  if (!visible) return null;

  const handleClick = () => {
    try {
      sessionStorage.removeItem(FLAG_KEY);
    } catch {
      // idem acima
    }
    navigate("/Onboarding");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-ink text-white text-sm font-semibold px-4 py-2.5 hover:bg-ink/90 transition-colors"
    >
      <MaterialIcon icon="arrow_back" size={18} />
      Voltar aos Primeiros passos
    </button>
  );
}
