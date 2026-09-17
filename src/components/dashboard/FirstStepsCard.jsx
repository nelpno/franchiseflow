import React from "react";
import { useNavigate } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";

/**
 * Cartão "Primeiros passos" da Início do franqueado — resumo da trilha (montarJornada,
 * ver src/lib/onboardingJourney.js) com CTA pra tela cheia (/Onboarding).
 *
 * Puramente apresentacional: recebe a jornada já calculada e não busca nada sozinho.
 * Quem decide SE o cartão aparece é o FranchiseeDashboard (checklist existe e
 * status !== 'approved') — aqui só sabemos desenhar.
 */
export default function FirstStepsCard({ jornada }) {
  const navigate = useNavigate();
  if (!jornada) return null;

  const { passos, agora, completo, total } = jornada;

  const handleContinuar = () => {
    try {
      window.clarity?.("event", "primeiros_passos_continuar");
    } catch {
      // Analytics nunca pode travar a navegação
    }
    navigate("/Onboarding");
  };

  return (
    <section className="mb-4 rounded-3xl bg-brand bg-farinha text-white p-5 shadow-[0_12px_28px_rgba(185,28,28,0.25)] flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-extrabold tracking-[0.12em] text-white/90">
          PRIMEIROS PASSOS
        </span>
        <span className="text-sm font-bold bg-white/[0.16] rounded-full px-2.5 py-1 whitespace-nowrap">
          {completo ? "Tudo pronto" : `Passo ${agora?.passoNumero ?? total} de ${total}`}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {passos.map((passo) => {
          const atual = !completo && agora?.passoNumero === passo.numero;
          const bg = passo.pronto ? "bg-white" : atual ? "bg-white/55" : "bg-white/20";
          return <span key={passo.id} className={`h-2 rounded-full ${bg}`} />;
        })}
      </div>

      <p className="font-plus-jakarta font-extrabold text-xl leading-snug">
        {completo ? "Tudo pronto! A equipe Maxi vai conferir." : `Agora: ${agora?.titulo ?? ""}`}
      </p>

      <button
        type="button"
        onClick={handleContinuar}
        className="h-[52px] rounded-2xl bg-white text-brand font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
      >
        Continuar
        <MaterialIcon icon="arrow_forward" size={20} />
      </button>
    </section>
  );
}
