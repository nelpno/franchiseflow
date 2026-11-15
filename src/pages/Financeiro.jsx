import React, { Suspense, lazy, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import FechamentoRede from "@/components/financeiro/FechamentoRede";
import PageHeader from "@/components/shared/PageHeader";
import MonthStepper from "@/components/shared/MonthStepper";
import { PAGINA } from "@/components/shared/adminUi";
import { useAdminPendingCounts } from "@/hooks/useAdminPendingCounts";
import { mesValido, somarMeses } from "@/lib/fechamentoRede";
import { dataCurta } from "@/lib/adminFormat";

// Só carregam no clique: o painel do ASAAS é grande e o resultado por unidade arrasta o
// TabResultado + recharts. A aba padrão (Fechamento do mês) é 1 consulta agregada.
const AsaasSetupPanel = lazy(() => import("@/components/financeiro/AsaasSetupPanel"));
const FinanceiroPorUnidade = lazy(() => import("@/components/financeiro/FinanceiroPorUnidade"));

const MESES_PARA_TRAS = 12;

// ?tab=: fechamento (padrão) | mensalidades | porunidade (drilldown, sem aba própria).
// "financeiro" era a aba padrão antiga: cai no fechamento.
function tabDaUrl(t) {
  return t === "mensalidades" || t === "porunidade" ? t : "fechamento";
}

function Carregando() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-16 rounded-2xl motion-reduce:animate-none" />
      <Skeleton className="h-80 rounded-2xl motion-reduce:animate-none" />
    </div>
  );
}

export default function Financeiro() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pending } = useAdminPendingCounts();

  const mesAtual = useMemo(() => format(new Date(), "yyyy-MM"), []);
  const tab = tabDaUrl(searchParams.get("tab"));
  const mesUrl = searchParams.get("mes");
  const mes = mesValido(mesUrl, mesAtual, MESES_PARA_TRAS) ? mesUrl : mesAtual;
  const franchiseId = searchParams.get("franchise") || "";
  const mesMinimo = somarMeses(mesAtual, -MESES_PARA_TRAS);

  const atualizar = useCallback(
    (mudancas) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(mudancas)) {
            if (v === null || v === undefined || v === "") p.delete(k);
            else p.set(k, v);
          }
          return p;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // #19: "Cobrar em Mensalidades →" do Fechamento passa a situação já filtrada
  // (?situacao=vencido), lida pelo AsaasSetupPanel — sem isso o admin caía na lista
  // inteira das 66 unidades e tinha que achar o chip "Vencido" na mão. #34: o link
  // "Resultado" de cada linha leva junto o mês que o admin estava vendo.
  const irPara = (novaTab, { situacao, mes: mesDestino, franchise } = {}) => {
    const mudancas = {
      tab: novaTab === "fechamento" ? null : novaTab,
      franchise: novaTab === "porunidade" ? (franchise ?? franchiseId) : null,
      situacao: novaTab === "mensalidades" ? situacao || null : null,
    };
    if (novaTab === "porunidade" && mesDestino) mudancas.mes = mesDestino;
    atualizar(mudancas);
  };
  const trocarMes = (novo) => atualizar({ mes: novo === mesAtual ? null : novo });

  const vencidas = pending?.mensalidades_vencidas ?? null;
  const ABAS = [
    { key: "fechamento", label: "Fechamento do mês", icon: "fact_check" },
    {
      key: "mensalidades",
      label: vencidas > 0 ? `Mensalidades · ${vencidas} ${vencidas === 1 ? "vencida" : "vencidas"}` : "Mensalidades",
      icon: "autorenew",
    },
  ];

  // C9: Mensalidades é status ATUAL (system_subscriptions), não histórico do mês — o
  // seletor de mês some e dá lugar a "Situação de hoje, dd/mm" (mudança #34 / regra do
  // padrão-visual, seção 12). O Fechamento (e o drilldown por unidade) continuam com o
  // MonthStepper.
  const situacaoHoje = `Situação de hoje, ${dataCurta(format(new Date(), "yyyy-MM-dd"))}`;

  return (
    <div className={PAGINA}>
      <PageHeader
        titulo="Financeiro"
        subtitulo="Quanto a rede vendeu, quem deve e quem precisa de atenção no mês."
        mes={
          tab === "fechamento" ? (
            <MonthStepper mes={mes} min={mesMinimo} max={mesAtual} onChange={trocarMes} />
          ) : null
        }
        situacao={tab === "mensalidades" ? situacaoHoje : null}
      />

      {tab !== "porunidade" && (
        <div role="tablist" aria-label="Seções do financeiro" className="-mx-1 flex gap-1 overflow-x-auto border-b border-surface-line px-1">
          {ABAS.map((a) => {
            const ativa = tab === a.key;
            return (
              <button
                key={a.key}
                type="button"
                role="tab"
                aria-selected={ativa}
                // #19: a aba anuncia "N vencidas" — tocar nela já abre filtrado por
                // ?situacao=vencido (achado MÉDIO 26/09: antes abria a lista inteira).
                onClick={() => irPara(a.key, a.key === "mensalidades" && vencidas > 0 ? { situacao: "vencido" } : {})}
                className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2 text-sm sm:px-3 transition-colors ${
                  ativa ? "border-brand-dark font-semibold text-ink" : "border-transparent font-medium text-ink-3 hover:text-ink-2"
                }`}
              >
                <MaterialIcon icon={a.icon} size={16} className="hidden sm:inline-block" aria-hidden="true" />
                {a.label}
              </button>
            );
          })}
        </div>
      )}

      {tab === "fechamento" && (
        <FechamentoRede
          mes={mes}
          mesAtual={mesAtual}
          onVerMensalidades={(situacao) => irPara("mensalidades", { situacao })}
        />
      )}

      {tab === "mensalidades" && (
        <Suspense fallback={<Carregando />}>
          <AsaasSetupPanel />
        </Suspense>
      )}

      {tab === "porunidade" && (
        <Suspense fallback={<Carregando />}>
          <FinanceiroPorUnidade
            franchiseId={franchiseId}
            initialMonth={mesValido(mesUrl, mesAtual, MESES_PARA_TRAS) ? mesUrl : null}
            onChangeFranchise={(evo) => atualizar({ franchise: evo })}
            onVoltar={() => irPara("fechamento")}
          />
        </Suspense>
      )}
    </div>
  );
}
