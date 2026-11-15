// S18.1 — 2º e 3º blocos da Início nova (chave ui_v2): ranking do mês (↑↓) e do dia; meta do
// dia + dias seguidos. Regras em src/lib/inicioMes.js (deltaRanking, metaDoDia,
// diasSeguidosBatendoMeta) — as mesmas do RankingStreak da Início de sempre.
import React from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRLInteger } from "@/lib/formatters";
import { deltaRanking } from "@/lib/inicioMes";
import { Skeleton } from "@/components/ui/skeleton";
import { CARTAO, ROTULO, LINK_ACAO } from "@/components/shared/adminUi";
import InicioErro, { InicioErroLinha } from "./InicioErro";

// P3 S18: `rankingMes` = { status, dado } já conferido (esta unidade, este mês de Brasília);
// `rankingDiaOk` = a posição do dia veio desta carga, do dia de hoje e sem erro. O que não se
// sabe não aparece — nunca "sem venda hoje" por causa de uma falha.
export function InicioRanking({ ranking, rankingDiaOk, rankingDiaFalhou = false, rankingMes, nomeMes, onTentarDeNovo }) {
  if (rankingMes?.status === "erro") {
    return <InicioErro rotulo="Ranking" texto="Não consegui carregar o ranking do mês." onTentarDeNovo={onTentarDeNovo} />;
  }
  if (rankingMes?.status !== "ok") {
    return (
      <section className={`${CARTAO} flex items-center gap-3`} aria-label="Ranking">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
      </section>
    );
  }
  const monthlyRanking = rankingMes.dado;
  const temMes = monthlyRanking?.rank_position && monthlyRanking?.total_franchises;
  const temDia = ranking?.position && ranking?.total_franchises;
  const delta = deltaRanking(monthlyRanking);
  const textoDia = rankingDiaOk ? (temDia ? `${ranking.position}º hoje` : "sem venda hoje ainda") : null;
  // Posição fechada do mês passado (01/10/2026): no dia 1º o mês novo ainda não tem posição.
  const anterior = rankingMes.anterior;
  const textoAnterior = anterior?.rank_position && anterior?.total_franchises
    ? `Em ${format(new Date(`${anterior.mes}-01T12:00:00`), "MMMM", { locale: ptBR })} você fechou em ${anterior.rank_position}º de ${anterior.total_franchises}.`
    : null;

  return (
    <section className={`${CARTAO} flex flex-wrap items-center gap-3`} aria-label="Ranking">
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
            {delta && textoDia && <span className="text-ink-3"> · </span>}
            {textoDia && <span className="text-ink-2">{textoDia}</span>}
          </p>
        </div>
      ) : (
        <p className="min-w-0 text-sm text-ink-2">Sua posição no ranking aparece com a primeira venda do mês.</p>
      )}
      {textoAnterior && <p className="basis-full text-sm text-ink-2">{textoAnterior}</p>}
      {/* P3-2 #5: só a posição do dia falhou — diz isso e deixa tentar de novo */}
      {rankingDiaFalhou && (
        <div className="basis-full">
          <InicioErroLinha texto="Não consegui carregar a posição de hoje." onTentarDeNovo={onTentarDeNovo} />
        </div>
      )}
    </section>
  );
}

export function InicioMetaDia({ hoje, metaHoje, sequencia, resumosOk = true, onTentarDeNovo }) {
  const total = hoje.total;
  const temMeta = resumosOk && metaHoje !== null && metaHoje > 0;
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

      {!resumosOk && (
        <div className="mt-3">
          <InicioErroLinha texto="A meta do dia e a sequência não carregaram agora." onTentarDeNovo={onTentarDeNovo} />
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 border-t border-surface-line pt-3">
        {resumosOk && (
          <MaterialIcon
            icon="local_fire_department"
            filled
            size={22}
            className={`shrink-0 ${dias > 0 ? "text-brand" : "text-ink-3"}`}
            aria-hidden="true"
          />
        )}
        <p className="min-w-0 flex-1 text-sm text-ink-2">
          {!resumosOk ? null : dias > 1 ? (
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
