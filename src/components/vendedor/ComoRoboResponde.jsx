import { useMemo, useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import ReviewSummary from "@/components/vendedor/ReviewSummary";
import { montarSimulacoes, montarConferencias, modeloDaSimulacao, agoraSaoPaulo } from "@/lib/simulacoesRobo";
import { modoDoFrete } from "@/lib/freteModelo";

// Etapa 5 do Meu Vendedor (plano de frete 12/09/2026, Fase 5c): respostas montadas com o cadastro da tela,
// o que conferir antes de ligar e, recolhidos, todos os dados (a antiga Revisão).

const ESTILO = {
  erro: { icon: "error", cls: "bg-err-soft text-err" },
  aviso: { icon: "warning", cls: "bg-warn-soft text-warn-ink" },
  ok: { icon: "check_circle", cls: "bg-ok-soft text-ok-ink" },
  info: { icon: "info", cls: "bg-surface text-ink-2" },
};

export default function ComoRoboResponde({ formData, erros = [], avisos = [], onGoToStep }) {
  const hoje = useMemo(() => agoraSaoPaulo().data, []);
  const itens = useMemo(() => montarSimulacoes(formData, hoje), [formData, hoje]);
  const conferencias = useMemo(() => montarConferencias(formData, { erros, avisos }), [formData, erros, avisos]);
  const variosGrupos = (modeloDaSimulacao(formData)?.grupos?.length || 0) > 1;
  const [verDados, setVerDados] = useState(false);
  const modo = modoDoFrete(formData);
  const temEntrega = formData.has_delivery !== false;

  const intro = !temEntrega || modo === "simples"
    ? "Respostas montadas com os seus dados. O robô lê o seu cadastro e deve responder assim. Se alguma estiver errada, o ajuste é nas etapas anteriores."
    : modo === "estruturado"
      ? "Respostas montadas com os seus dados, pelo mesmo cálculo que o robô usa. Se alguma estiver errada, o ajuste é nas etapas anteriores."
      : "Seu frete está em texto livre, então aqui aparecem só as respostas de pagamento e retirada: o frete, o robô interpreta linha a linha.";

  return (
    <div className="space-y-6">
      <p className="text-xs text-ink-2/70">{intro}</p>

      <div className="space-y-5">
        {itens.map((it, i) => (
          <div key={`${it.rotulo}-${i}`} className={`space-y-2 ${i ? "border-t border-surface-line/20 pt-4" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest font-bold text-ink-2/50">{it.rotulo}</span>
              {it.tag && <span className="px-2 py-0.5 rounded-md bg-warn-soft text-warn-ink text-[11px] font-semibold">{it.tag}</span>}
            </div>
            <div className="max-w-[85%] w-fit px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white border border-surface-line text-sm text-ink">{it.pergunta}</div>
            <div className="ml-auto max-w-[85%] w-fit px-3.5 py-2.5 rounded-2xl rounded-br-md bg-brand/[0.07] text-sm text-ink">{it.resposta}</div>
          </div>
        ))}
      </div>

      {conferencias.length > 0 && (
        <div className="rounded-xl border border-surface-line/30 p-4 space-y-2">
          <p className="text-sm font-bold text-ink">Antes de ligar, confira</p>
          {conferencias.map((c, i) => (
            <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs ${ESTILO[c.tipo].cls}`}>
              <MaterialIcon icon={ESTILO[c.tipo].icon} size={16} className="shrink-0 mt-px" />
              <span>{c.texto}</span>
            </div>
          ))}
        </div>
      )}

      {temEntrega && variosGrupos && (
        <div className="rounded-xl border border-surface-line/30 p-4 space-y-1">
          <p className="text-sm font-bold text-ink">A regra do dia</p>
          <p className="text-xs text-ink-2">
            O frete segue sempre o dia da <b>entrega</b>. Quem pede na sexta para sábado paga a tabela de sábado; quem pede na sexta para segunda paga a de segunda.
          </p>
        </div>
      )}

      <div>
        <button type="button" onClick={() => setVerDados((v) => !v)} className="text-xs font-semibold text-brand flex items-center gap-1 hover:underline">
          <MaterialIcon icon="expand_more" size={16} className={`transition-transform ${verDados ? "rotate-180" : ""}`} />
          {verDados ? "Esconder os dados cadastrados" : "Ver todos os dados cadastrados"}
        </button>
        {verDados && <div className="mt-3"><ReviewSummary formData={formData} onGoToStep={onGoToStep} /></div>}
      </div>
    </div>
  );
}
