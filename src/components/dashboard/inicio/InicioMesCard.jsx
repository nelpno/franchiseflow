// S18.1 — 1º bloco da Início nova: "o mês, você contra você" (chave ui_v2).
// Números prontos de montarInicioMes/textosInicioMes (src/lib/inicioMes.js).
import React from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRLInteger } from "@/lib/formatters";
import { textosInicioMes } from "@/lib/inicioMes";
import { CARTAO, ROTULO, LINK_ACAO } from "@/components/shared/adminUi";

const SELO = {
  ok: "bg-ok-soft text-ok-ink",
  atencao: "bg-warn-soft text-warn-ink",
  neutro: "bg-surface-2 text-ink-2",
};

// Mesma conta do cartão Conversão (ConversionCard): só com base no robô (20+ pessoas).
function linhaConversao(funnel) {
  if (!funnel?.has_bot_data) return null;
  const reached = Number(funnel.reached) || 0;
  const converted = Number(funnel.converted) || 0;
  if (reached <= 0) return null;
  return `${Math.round((converted / reached) * 100)}% de quem falou com o robô comprou (${converted} de ${reached})`;
}

export default function InicioMesCard({ mes, funnel, onAbrirConversao }) {
  const t = textosInicioMes(mes, formatBRLInteger);
  if (!t) return null;
  const conversao = linhaConversao(funnel);
  const semVenda = mes.vendas === 0;

  return (
    <section className={`${CARTAO} lg:col-span-2`} aria-label="O mês até hoje">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={ROTULO}>{t.titulo}</span>
        {t.selo && (
          <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-bold ${SELO[t.selo.tom]}`}>
            {t.selo.texto}
          </span>
        )}
      </div>

      <p className="mt-1 font-plus-jakarta text-4xl font-extrabold tabular-nums leading-tight text-ink md:text-5xl">
        {formatBRLInteger(mes.faturamento)}
      </p>
      {semVenda ? (
        <p className="mt-1 text-sm text-ink-2">
          Ainda sem venda neste mês. Assim que a primeira entrar, ela aparece aqui.
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink-2">
          <strong className="font-semibold text-ink tabular-nums">{mes.vendas}</strong>{" "}
          {mes.vendas === 1 ? "venda" : "vendas"} · valor médio{" "}
          <strong className="font-semibold text-ink tabular-nums">{formatBRLInteger(mes.valorMedio)}</strong>
        </p>
      )}

      {(t.comparacao || t.ritmo) && (
        <div className="mt-3 space-y-1 border-t border-surface-line pt-3 text-sm leading-relaxed text-ink-2">
          {t.comparacao && <p>{t.comparacao}</p>}
          {t.ritmo && <p>{t.ritmo}</p>}
        </div>
      )}

      {t.proximoPasso && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-sm font-medium text-ink">
          <MaterialIcon icon="trending_up" size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
          <span className="min-w-0">{t.proximoPasso}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link to="/Gestao?tab=resultado" className={LINK_ACAO}>
          Ver o resultado do mês
          <MaterialIcon icon="chevron_right" size={18} aria-hidden="true" />
        </Link>
        {conversao && (
          <button type="button" onClick={onAbrirConversao} className="inline-flex min-h-10 items-center gap-1 text-left text-sm text-ink-2 hover:underline">
            <MaterialIcon icon="smart_toy" size={18} className="shrink-0 text-ink-3" aria-hidden="true" />
            {conversao}
          </button>
        )}
      </div>
    </section>
  );
}
