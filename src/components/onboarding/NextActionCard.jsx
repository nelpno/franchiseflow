import MaterialIcon from "@/components/ui/MaterialIcon";
import { PASSO_ICONES } from "@/components/onboarding/journeySteps.js";

// Cartão "Agora" da trilha: a ÚNICA tarefa que importa neste momento, com o botão
// que leva direto pra ela. `agora` vem de montarJornada() (onboardingJourney.js) —
// null quando os 5 passos estão prontos (Onboarding.jsx troca por outro cartão).
export default function NextActionCard({ agora, passoTitulo, onAction, onVerPasso }) {
  if (!agora) return null;

  const icon = PASSO_ICONES[agora.passoId] || "task_alt";
  // Resumo curto pro cartão — o texto completo fica no "Como fazer" do passo.
  const resumo = agora.resumo || (agora.texto || "").split("\n")[0];
  const destinoPrincipal = agora.destinos?.[0];

  return (
    <div className="bg-white border-2 border-brand rounded-[22px] p-5 flex flex-col gap-3.5 shadow-[0_10px_28px_rgba(185,28,28,0.10)]">
      <div className="flex items-center gap-3">
        <span className="w-[52px] h-[52px] rounded-2xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
          <MaterialIcon icon={icon} size={28} />
        </span>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[13px] font-extrabold tracking-[0.12em] text-brand">AGORA</span>
          <span className="text-sm text-ink-3 truncate">
            Passo {agora.passoNumero} · {passoTitulo}
          </span>
        </div>
      </div>

      <h2 className="font-plus-jakarta font-extrabold text-[22px] leading-tight text-ink">
        {agora.titulo}
      </h2>
      {resumo && <p className="text-base leading-relaxed text-ink-2">{resumo}</p>}

      {destinoPrincipal && (
        <button
          type="button"
          onClick={() => onAction?.(destinoPrincipal, agora.passoId)}
          className="min-h-[56px] rounded-2xl bg-brand hover:bg-brand-dark text-white text-[17px] font-bold flex items-center justify-center gap-2.5 transition-colors"
        >
          {destinoPrincipal.rotulo}
          <MaterialIcon icon="arrow_forward" size={22} />
        </button>
      )}

      {onVerPasso && (
        <button
          type="button"
          onClick={() => onVerPasso(agora.passoId)}
          className="min-h-[44px] text-[15px] font-semibold text-brand hover:text-brand-dark text-center"
        >
          Ver as dicas deste passo
        </button>
      )}
    </div>
  );
}
