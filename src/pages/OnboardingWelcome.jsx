import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { FranchiseConfiguration } from "@/entities/all";
import { getAvailableFranchises } from "@/lib/franchiseUtils";
import { listarFranquias } from "@/lib/franchisesCache";
import { JOURNEY_STEPS } from "@/components/onboarding/journeySteps.js";
import { VIDEO_BOAS_VINDAS } from "@/components/onboarding/materiais.js";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/logo-maxi-massas-optimized.png";
import { toast } from "sonner";

// Tour de 1 tela (substituiu os 7 slides, 16/09/2026) — quem quer ver como o app
// funciona de verdade assiste ao vídeo; aqui só o roteiro dos 5 passos e o "Começar".
// Descrição curta de cada passo, só pra esta tela (o texto completo vive em
// journeySteps.js, lido pela trilha /Onboarding).
const DESCRICOES_PASSO = {
  dados: "uns 3 minutos",
  robo: "uns 15 minutos",
  espaco: "freezer, embalagens e preço de venda",
  pedido: "com o pedido modelo da Maxi",
  lancamento: "divulgue e lance pelo botão Vender",
};

export default function OnboardingWelcome() {
  const { user, markWelcomeSeen } = useAuth();
  const navigate = useNavigate();
  const [unidadeNome, setUnidadeNome] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function carregarUnidade() {
      try {
        const todas = await listarFranquias();
        const franquia = getAvailableFranchises(todas, user)[0];
        if (!franquia) return;
        const configs = await FranchiseConfiguration.filter({
          franchise_evolution_instance_id: franquia.evolution_instance_id,
        });
        if (!cancelled) {
          setUnidadeNome(configs[0]?.franchise_name || franquia.owner_name || null);
        }
      } catch {
        // Nome da unidade é só um detalhe desta tela — sem ele, a tela segue igual
      }
    }
    if (user) carregarUnidade();
    return () => { cancelled = true; };
  }, [user]);

  const primeiroNome = (user?.full_name || "").split(" ")[0] || "";
  const passos = JOURNEY_STEPS.map((s) => ({ numero: s.numero, titulo: s.titulo, tempo: DESCRICOES_PASSO[s.id] }));

  const handleComecar = async () => {
    setIsCompleting(true);
    try {
      await markWelcomeSeen();
      navigate("/Onboarding", { replace: true });
    } catch (error) {
      console.error("Erro ao concluir boas-vindas:", error);
      toast.error("Erro ao salvar. Tente novamente.");
      setIsCompleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="flex-1 flex flex-col px-6 py-7 max-w-lg w-full mx-auto">
        <img src={logoImg} alt="Maxi Massas" className="h-9 w-auto object-contain self-start mb-6" />

        <span className="text-[13px] font-extrabold tracking-[0.12em] text-brand-gold-ink mb-2">BEM-VINDA</span>
        <h1 className="font-plus-jakarta font-extrabold text-3xl sm:text-4xl leading-tight tracking-tight text-ink mb-2">
          Olá, {primeiroNome}!
        </h1>
        {unidadeNome && <span className="text-base font-semibold text-ink-2 mb-3">{unidadeNome}</span>}
        <p className="text-[17px] leading-relaxed text-ink mt-1 mb-6">
          Em 5 passos sua unidade fica pronta para a primeira venda. A equipe Maxi vai junto em cada um.
        </p>

        <ol className="flex flex-col mb-2">
          {passos.map((p, idx) => (
            <li key={p.numero} className="flex items-stretch gap-3.5">
              <div className="w-10 flex flex-col items-center shrink-0">
                <span className="w-10 h-10 rounded-full bg-brand-soft text-brand font-plus-jakarta font-extrabold text-[17px] flex items-center justify-center shrink-0">
                  {p.numero}
                </span>
                {idx < passos.length - 1 && <span className="w-0.5 flex-1 min-h-[12px] bg-surface-line" />}
              </div>
              <div className="flex flex-col gap-0.5 pb-3.5 pt-2">
                <span className="text-[17px] font-bold text-ink leading-tight">{p.titulo}</span>
                <span className="text-sm text-ink-3">{p.tempo}</span>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-auto flex flex-col gap-1.5 pt-6">
          <Button
            onClick={handleComecar}
            disabled={isCompleting}
            className="min-h-[58px] rounded-2xl bg-brand hover:bg-brand-dark text-white text-[18px] font-bold shadow-lg shadow-brand/20 flex items-center justify-center gap-2.5"
          >
            {isCompleting ? (
              <MaterialIcon icon="progress_activity" size={20} className="animate-spin" />
            ) : (
              <>
                Começar
                <MaterialIcon icon="arrow_forward" size={20} />
              </>
            )}
          </Button>
          <a
            href={VIDEO_BOAS_VINDAS.url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[48px] flex items-center justify-center gap-2 text-[16px] font-semibold text-brand hover:text-brand-dark"
          >
            <MaterialIcon icon="play_circle" size={20} />
            Ver vídeo de boas-vindas · 2 min
          </a>
        </div>
      </div>
    </div>
  );
}
