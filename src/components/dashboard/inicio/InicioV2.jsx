// S18.1 (28/09/2026): Início nova da franqueada, SÓ com a chave ui_v2 (FranchiseeDashboard
// decide). Com a chave desligada este arquivo nem renderiza e a Início de sempre fica igual.
// Ordem (decisão do Nelson na Mesa: topo = "você contra você"):
//   1 o mês · (espaço da meta do bimestre, S22) · 2 ranking · 3 meta do dia + dias seguidos ·
//   4 evolução 6 meses · 5 Agora · 6 Quem chamar hoje (+ convite) · 7 atalhos.
// Os dados chegam do FranchiseeDashboard (mesma carga da Início de sempre + o histórico de
// vendas antigas, só com a chave); as contas estão em src/lib/inicioMes.js.
// P3 S18: só desenha dado DESTA unidade (`cargaOk`), com os cortes do dia de Brasília (`janelas`),
// e consulta que falhou (`falhas`) aparece como "não carregou", nunca como zero.
import React, { useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import SubscriptionPaymentSheet from "@/components/shared/SubscriptionPaymentSheet";
import ConversionDetailSheet from "../ConversionDetailSheet";
import FinancialObligationsCard from "../FinancialObligationsCard";
import { pedidoEmDestaque } from "../OpenOrderStrip";
import { cenarioPrioritario } from "../PriorityAction";
import { faixaMensalidade } from "@/lib/pagamentos";
import {
  MESES_EVOLUCAO, aReceberDesde, avaliarAgora, diasSeguidosBatendoMeta, faturamentoDoDia,
  metaDoDia, montarEvolucao, montarInicioMes, vendasDaInicio,
} from "@/lib/inicioMes";
import InicioMesCard from "./InicioMesCard";
import EspacoMetaBimestre from "./EspacoMetaBimestre";
import { InicioRanking, InicioMetaDia } from "./InicioRankingMeta";
import InicioEvolucao from "./InicioEvolucao";
import InicioAgora from "./InicioAgora";
import InicioQuemChamar from "./InicioQuemChamar";
import InicioAtalhos from "./InicioAtalhos";
import InicioErro from "./InicioErro";

// Sem o histórico (carregando ou falhou) a evolução mostra só o que a janela principal cobre:
// o mês atual e os 3 anteriores inteiros.
const MESES_SEM_HISTORICO = 4;

// Mesma ordem dos blocos da tela, sem ícone (a fonte pode não ter carregado ainda).
function EsqueletoBlocos() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-48 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
      </div>
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-44 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-14 rounded-2xl" />
      </div>
    </div>
  );
}

export function InicioV2Esqueleto() {
  return (
    <div className="pt-4 pb-4 px-4 md:px-12 max-w-lg mx-auto md:max-w-none space-y-4 bg-surface">
      <div className="mb-2 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <EsqueletoBlocos />
    </div>
  );
}

export default function InicioV2({
  modoReduzido, evoId, franchise, allSales, historico, estadoCarga, falhas = [], janelas, summaries,
  ranking, rankingDiaOk, rankingDiaFalhou = false, rankingMes, onTentarDeNovo,
  purchaseOrders, subscription, checkPaymentNow, isChecking, marketingPayment,
  botActive, botConfigured, botSilentDays, hasRecentSales, funnel, funnelRange,
}) {
  const [pagamentoAberto, setPagamentoAberto] = useState(false);
  const [conversaoAberta, setConversaoAberta] = useState(false);

  const hojeStr = janelas?.hoje;
  const corteAReceber = janelas?.corteAReceber;
  const vendasOk = !falhas.includes("vendas");
  const dados = useMemo(() => {
    if (!hojeStr) return null;
    // o MESMO dia civil de Brasília dos cortes da consulta (janelasInicio)
    const hoje = parseISO(hojeStr);
    const comHistorico = historico?.status === "ok";
    // a janela principal (recarregada a cada 5 min) ganha da cópia do histórico
    const todas = comHistorico ? vendasDaInicio({ principal: allSales, historico: historico.sales }) : allSales;
    const doDia = faturamentoDoDia(allSales, hojeStr);
    return {
      mes: montarInicioMes({ sales: allSales, hoje }),
      evolucao: montarEvolucao({ sales: todas, hoje, meses: comHistorico ? MESES_EVOLUCAO : MESES_SEM_HISTORICO }),
      // sem o histórico não dá para bater com a caixa da tela Vendas: a receber DESCONHECIDO
      // e sem as vendas da janela principal também não (contaria só as antigas)
      aReceber: !vendasOk
        ? { status: "erro" }
        : comHistorico
          ? { status: "ok", ...aReceberDesde(todas, corteAReceber) }
          : { status: historico?.status === "erro" ? "erro" : "loading" },
      doDia,
      metaHoje: metaDoDia(summaries, hojeStr, { franchiseId: evoId }),
      sequencia: diasSeguidosBatendoMeta(summaries, { hoje: hojeStr, franchiseId: evoId, faturamentoHoje: doDia.total }),
    };
  }, [allSales, historico, summaries, evoId, hojeStr, corteAReceber, vendasOk]);

  // P3-2 #1: a carga desta unidade estourou o tempo — diz isso e deixa tentar de novo.
  if (estadoCarga === "erro") {
    return (
      <div className="flex flex-col gap-4">
        <InicioErro rotulo="Início" texto="Não consegui carregar a Início agora." onTentarDeNovo={onTentarDeNovo} />
        <InicioAtalhos />
      </div>
    );
  }
  // Dado de outra unidade (troca no meio da carga), trilha de outra unidade ou carga com cortes
  // errados: esqueleto (estadoDaCargaV2 em src/lib/inicioMes.js).
  if (estadoCarga !== "ok" || !dados) return <EsqueletoBlocos />;

  const falhouMarketing = falhas.includes("marketing");
  if (modoReduzido) {
    // Unidade que ainda não vendeu: igual à Início de sempre, só as obrigações.
    return <FinancialObligationsCard marketingPayment={marketingPayment} ocultarMarketing={falhouMarketing} />;
  }

  const resumosOk = !falhas.includes("resumos");
  const statusHistorico = historico?.status === "ok" || historico?.status === "erro" ? historico.status : "loading";

  // "Agora": o que pede ação e o que dá para afirmar (regras em avaliarAgora)
  const temFaixa = !!faixaMensalidade(subscription);
  const temPedido = !falhas.includes("pedidos") && !!pedidoEmDestaque(purchaseOrders);
  const agora = avaliarAgora({ temFaixa, temPedido, aReceber: dados.aReceber, falhas });
  const cenario = agora.mostrarPrioridade
    ? cenarioPrioritario({ marketingPayment, botActive, botConfigured, botSilentDays, hasRecentSales, subscription })
    : null;
  // P3 S18 #7: a mensalidade que já está no "Agora" (faixa perto do vencimento ou ação de
  // vencida) não se repete no cartão do fim; a linha do marketing continua.
  const mensalidadeNoAgora = temFaixa || cenario?.key === "equipe_digital";

  return (
    <>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        {vendasOk ? (
          <InicioMesCard mes={dados.mes} funnel={funnel} onAbrirConversao={() => setConversaoAberta(true)} />
        ) : (
          <InicioErro className="lg:col-span-2" rotulo="O mês até hoje" texto="Não consegui carregar as vendas do mês." onTentarDeNovo={onTentarDeNovo} />
        )}
        <EspacoMetaBimestre />
        <InicioRanking
          ranking={ranking}
          rankingDiaOk={rankingDiaOk && !rankingDiaFalhou}
          rankingDiaFalhou={rankingDiaFalhou}
          rankingMes={rankingMes}
          nomeMes={dados.mes.nomeMes}
          onTentarDeNovo={onTentarDeNovo}
        />
        {vendasOk ? (
          <InicioMetaDia
            hoje={dados.doDia}
            metaHoje={dados.metaHoje}
            sequencia={dados.sequencia}
            resumosOk={resumosOk}
            onTentarDeNovo={onTentarDeNovo}
          />
        ) : (
          <InicioErro rotulo="Meta do dia" texto="Não consegui carregar as vendas de hoje." onTentarDeNovo={onTentarDeNovo} />
        )}
        {vendasOk && (
          <InicioEvolucao
            meses={dados.evolucao}
            status={statusHistorico}
            mediana={dados.mes.mediana}
            nomeMes={dados.mes.nomeMes}
            onTentarDeNovo={onTentarDeNovo}
          />
        )}
        <InicioAgora
          subscription={subscription}
          purchaseOrders={purchaseOrders}
          aReceber={dados.aReceber}
          agora={agora}
          marketingPayment={marketingPayment}
          botActive={botActive}
          botConfigured={botConfigured}
          botSilentDays={botSilentDays}
          hasRecentSales={hasRecentSales}
          onOpenPaymentSheet={() => setPagamentoAberto(true)}
          onTentarDeNovo={onTentarDeNovo}
        />
        <InicioQuemChamar evoId={evoId} franchise={franchise} />
        <InicioAtalhos />
      </div>

      <div className="mt-4">
        <FinancialObligationsCard
          marketingPayment={marketingPayment}
          ocultarMensalidade={mensalidadeNoAgora}
          ocultarMarketing={falhouMarketing}
        />
      </div>

      <SubscriptionPaymentSheet
        open={pagamentoAberto}
        onOpenChange={setPagamentoAberto}
        subscription={subscription}
        checkPaymentNow={checkPaymentNow}
        isChecking={isChecking}
      />
      <ConversionDetailSheet
        open={conversaoAberta}
        onOpenChange={setConversaoAberta}
        funnel={funnel}
        range={funnelRange}
        label={funnelRange?.label}
      />
    </>
  );
}
