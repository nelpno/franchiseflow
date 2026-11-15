import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { useAuth } from "@/lib/AuthContext";
import { OnboardingChecklist, FranchiseConfiguration, getOnboardingFacts } from "@/entities/all";
import { listarFranquias } from "@/lib/franchisesCache";
import { resolveActiveFranchise } from "@/lib/franchiseUtils";
import { montarJornada } from "@/lib/onboardingJourney";
import { tarefasFeitas, mensagemPronto, lerFeitas, gravarFeitas, uniao } from "@/lib/primeirosPassosAviso";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";

// Faixa "Voltar aos Primeiros passos" — aparece em QUALQUER tela do app quando a
// franqueada chegou ali pela trilha (destino tipo "app" de journeySteps.js, que
// sempre leva `?de=primeiros-passos` na URL). A flag fica em sessionStorage porque
// a navegação seguinte (ex: abrir um Sheet, trocar de aba dentro da tela) perde o
// query param original — sem a flag, a faixa sumiria no primeiro clique dentro da
// tela de destino. Some sozinha ao entrar em /Onboarding (voltou pra trilha) ou ao
// ser tocada.
//
// Enquanto aparece, confere a trilha (ao chegar, a cada 20 s e ao voltar para a aba) e
// avisa "Pronto: X. Próximo: Y" quando uma tarefa fica pronta aqui mesmo (17/09/2026).
const FLAG_KEY = "voltar_trilha_primeiros_passos";
const INTERVALO_CONFERENCIA_MS = 20000;

export default function VoltarTrilhaBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, selectedFranchise } = useAuth();
  const [visible, setVisible] = useState(false);
  const conferindoRef = useRef(false);

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

  // Muda a cada troca de usuário/unidade/visibilidade e ao sair: resposta de antes é descartada.
  const geracaoRef = useRef(0);
  useEffect(() => {
    return () => { geracaoRef.current += 1; };
  }, [user?.id, selectedFranchise?.evolution_instance_id, visible]);

  const conferir = useCallback(async () => {
    if (conferindoRef.current || user?.role !== "franchisee") return;
    conferindoRef.current = true;
    const geracao = geracaoRef.current;
    try {
      const franquia = resolveActiveFranchise(await listarFranquias(), user, selectedFranchise);
      const evoId = franquia?.evolution_instance_id;
      if (!evoId) return;
      const [checklists, configs, facts] = await Promise.all([
        OnboardingChecklist.filter({ franchise_id: evoId }),
        FranchiseConfiguration.filter({ franchise_evolution_instance_id: evoId }),
        getOnboardingFacts(evoId),
      ]);
      const checklist = checklists?.[0];
      if (geracao !== geracaoRef.current) return;
      if (!checklist || checklist.status === "approved" || !facts) return;
      const jornada = montarJornada({ franchise: franquia, config: configs?.[0], facts, items: checklist.items });
      const anteriores = lerFeitas(evoId);
      const mensagem = mensagemPronto(jornada, anteriores);
      // Só acrescenta: um dado atrasado aqui não pode "desfazer" tarefa e gerar aviso repetido depois.
      gravarFeitas(evoId, uniao(anteriores, tarefasFeitas(jornada)));
      if (mensagem) toast.success(mensagem);
    } catch {
      // O aviso é um extra: falha aqui não faz nada.
    } finally {
      conferindoRef.current = false;
    }
  }, [user, selectedFranchise]);

  useEffect(() => {
    if (visible) conferir();
  }, [visible, location.pathname, conferir]);

  useVisibilityPolling(conferir, INTERVALO_CONFERENCIA_MS, visible && user?.role === "franchisee");

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
