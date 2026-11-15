// S18.1 — 4º bloco da Início nova (chave ui_v2): faturamento dos últimos 6 meses, pelas
// VENDAS (montarEvolucao em src/lib/inicioMes.js), nunca por daily_summaries.
// 29/09: aba "7 dias" (montarUltimosDias) — as barras dia a dia da Início antiga (pedido de Santos).
import React, { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRLCompact, formatBRLInteger } from "@/lib/formatters";
import { CARTAO, H3_CARTAO, CHIP, CHIP_ATIVO, CHIP_INATIVO } from "@/components/shared/adminUi";

const CHAVE_VISTA = "inicio_evolucao_vista";

function lerVista() {
  try {
    return window.localStorage.getItem(CHAVE_VISTA) === "dias" ? "dias" : "meses";
  } catch {
    return "meses";
  }
}

function Barras({ itens }) {
  const maior = Math.max(...itens.map((m) => m.valor), 1);
  return (
    <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${itens.length}, minmax(0, 1fr))` }}>
      {itens.map((m) => {
        const altura = Math.max(4, Math.round((m.valor / maior) * 88));
        return (
          <div key={m.chave} className="flex min-w-0 flex-col items-center gap-1" title={formatBRLInteger(m.valor)}>
            <div className="flex h-[112px] w-full flex-col items-center justify-end gap-1">
              <span className={`text-[11px] tabular-nums ${m.atual ? "font-bold text-brand" : "text-ink-3"}`}>
                {m.valor > 0 ? formatBRLCompact(m.valor).replace("R$ ", "") : "—"}
              </span>
              <div
                className={`w-full max-w-[44px] rounded-t-lg ${m.atual ? "bg-brand" : "bg-brand/15"}`}
                style={{ height: altura }}
              />
            </div>
            <span className={`text-xs capitalize ${m.atual ? "font-bold text-ink" : "text-ink-2"}`}>{m.rotulo}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function InicioEvolucao({ meses, dias, status, mediana, nomeMes, onTentarDeNovo }) {
  const [vista, setVista] = useState(lerVista);
  const escolher = (v) => {
    setVista(v);
    try {
      window.localStorage.setItem(CHAVE_VISTA, v);
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  };

  const temMeses = !!meses?.length && meses.some((m) => m.valor > 0);
  const temDias = !!dias?.length && dias.some((d) => d.valor > 0);
  const emDias = vista === "dias";

  if (!emDias && status === "loading") {
    return (
      <section className={CARTAO} aria-label="Evolução">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-4 h-32 w-full rounded-xl" />
      </section>
    );
  }
  if (!temMeses && !temDias) return null;

  const totalDias = (dias || []).reduce((a, d) => a + d.valor, 0);

  return (
    <section className={CARTAO} aria-label="Evolução">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className={H3_CARTAO}>Evolução</h2>
          <p className="text-xs text-ink-3">{emDias ? "faturamento por dia, em R$" : "faturamento por mês, em R$"}</p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Ver por">
          <button type="button" aria-pressed={!emDias} onClick={() => escolher("meses")} className={`${CHIP} ${!emDias ? CHIP_ATIVO : CHIP_INATIVO}`}>
            Meses
          </button>
          <button type="button" aria-pressed={emDias} onClick={() => escolher("dias")} className={`${CHIP} ${emDias ? CHIP_ATIVO : CHIP_INATIVO}`}>
            7 dias
          </button>
        </div>
      </div>

      {emDias ? (
        <>
          {temDias ? (
            <Barras itens={dias} />
          ) : (
            <p className="mt-4 text-sm text-ink-2">Nenhuma venda nos últimos 7 dias.</p>
          )}
          {temDias && (
            <p className="mt-3 text-xs text-ink-3">
              Últimos 7 dias: {formatBRLInteger(totalDias)}, média de {formatBRLInteger(totalDias / dias.length)} por dia. A barra vermelha é hoje.
            </p>
          )}
        </>
      ) : (
        <>
          {temMeses ? (
            <Barras itens={meses} />
          ) : (
            <p className="mt-4 text-sm text-ink-2">Ainda sem vendas nos últimos meses.</p>
          )}
          <p className="mt-3 text-xs text-ink-3">
            {nomeMes ? `${nomeMes.charAt(0).toUpperCase()}${nomeMes.slice(1)} vai até hoje.` : "O mês atual vai até hoje."}
            {mediana !== null && mediana !== undefined && ` Sua mediana dos 3 meses anteriores: ${formatBRLInteger(mediana)}.`}
            {status === "erro" && " Os meses mais antigos não carregaram agora."}
          </p>
          {status === "erro" && onTentarDeNovo && (
            <button type="button" onClick={onTentarDeNovo} className="mt-1 min-h-11 text-sm font-semibold text-brand">
              Tentar de novo
            </button>
          )}
        </>
      )}
    </section>
  );
}
