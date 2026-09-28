// S18.1 — 2º e 3º blocos da Início nova (chave ui_v2): ranking do mês (↑↓) e do dia; meta do
// dia + dias seguidos. Regras em src/lib/inicioMes.js (deltaRanking, metaDoDia,
// diasSeguidosBatendoMeta) — as mesmas do RankingStreak da Início de sempre.
import React from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRLInteger } from "@/lib/formatters";
import { deltaRanking } from "@/lib/inicioMes";
import { CARTAO, ROTULO, LINK_ACAO } from "@/components/shared/adminUi";

export function InicioRanking({ ranking, monthlyRanking, nomeMes }) {
  const temMes = monthlyRanking?.rank_position && monthlyRanking?.total_franchises;
  const temDia = ranking?.position && ranking?.total_franchises;
  const delta = deltaRanking(monthlyRanking);

  return (
    <section className={`${CARTAO} flex items-center gap-3`} aria-label="Ranking">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gold-soft text-brand-gold-ink">
        <MaterialIcon icon="military_tech" size={24} filled aria-hidden="true" />
      </span>
      {temMes ? (
        <div className="min-w-0">
          <p className="font-plus-jakarta text-xl font-extrabold tabular-nums text-ink">
            {monthlyRanking.rank_position}º{" "}
            <span className="text-sm font-medium text-ink-3">de {monthlyRanking.total_franchises} em {nomeMes}</span>
          </p>
          <p className="text-sm">
            {delta?.type === "up" && (
              <span className="font-semibold text-ok-ink">↑ subiu {delta.value} {delta.value === 1 ? "posição" : "posições"}</span>
            )}
            {delta?.type === "down" && (
              <span className="font-semibold text-warn-ink">↓ caiu {delta.value} {delta.value === 1 ? "posição" : "posições"}</span>
            )}
            {delta?.type === "same" && <span className="text-ink-2">→ mesma posição do mês passado</span>}
            {delta && <span className="text-ink-3"> · </span>}
            <span className="text-ink-2">{temDia ? `${ranking.position}º hoje` : "sem venda hoje ainda"}</span>
          </p>
        </div>
      ) : (
        <p className="min-w-0 text-sm text-ink-2">Sua posição no ranking aparece com a primeira venda do mês.</p>
      )}
    </section>
  );
}

export function InicioMetaDia({ hoje, metaHoje, sequencia }) {
  const total = hoje.total;
  const temMeta = metaHoje !== null && metaHoje > 0;
  const pct = temMeta ? Math.min(100, Math.round((total / metaHoje) * 100)) : 0;
  const batida = temMeta && total >= metaHoje;
  const dias = sequencia?.dias || 0;

  return (
    <section className={CARTAO} aria-label="Meta do dia">
      <div className="flex items-center justify-between gap-2">
        <span className={ROTULO}>Hoje</span>
        {batida && (
          <span className="inline-flex min-h-6 items-center rounded-full bg-ok-soft px-2.5 text-xs font-bold text-ok-ink">
            meta do dia batida
          </span>
        )}
      </div>
      <p className="mt-1 font-plus-jakarta text-2xl font-extrabold tabular-nums text-ink">
        {formatBRLInteger(total)}{" "}
        <span className="text-sm font-medium text-ink-3">
          em {hoje.vendas} {hoje.vendas === 1 ? "venda" : "vendas"}
        </span>
      </p>

      {temMeta && (
        <>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-line" aria-hidden="true">
            <div className={`h-full rounded-full ${batida ? "bg-ok" : "bg-brand"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink-2">
            Meta do dia {formatBRLInteger(metaHoje)} (sua média dos últimos 30 dias + 10%) ·{" "}
            {batida ? (
              <span className="font-semibold text-ok-ink">passou {formatBRLInteger(total - metaHoje)}</span>
            ) : (
              <span className="font-semibold text-ink">faltam {formatBRLInteger(metaHoje - total)}</span>
            )}
          </p>
        </>
      )}

      <div className="mt-3 flex items-center gap-3 border-t border-surface-line pt-3">
        <MaterialIcon
          icon="local_fire_department"
          filled
          size={22}
          className={`shrink-0 ${dias > 0 ? "text-brand" : "text-ink-3"}`}
          aria-hidden="true"
        />
        <p className="min-w-0 flex-1 text-sm text-ink-2">
          {dias > 1 ? (
            <>
              <strong className="font-semibold text-ink tabular-nums">{dias} dias seguidos</strong> batendo a meta do dia
            </>
          ) : dias === 1 ? (
            <>
              <strong className="font-semibold text-ink">1 dia</strong> batendo a meta do dia
            </>
          ) : temMeta ? (
            "Bata a meta de hoje e comece uma sequência."
          ) : (
            "A meta do dia aparece depois de uma semana de vendas."
          )}
        </p>
        <Link to="/Vendas?periodo=hoje" className={`${LINK_ACAO} shrink-0`}>
          Vendas de hoje
          <MaterialIcon icon="chevron_right" size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
