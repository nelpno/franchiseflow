// S18.1 (28/09/2026): Início nova da franqueada, SÓ com a chave ui_v2 (FranchiseeDashboard
// decide). Com a chave desligada este arquivo nem renderiza e a Início de sempre fica igual.
// Ordem (decisão do Nelson na Mesa: topo = "você contra você"):
//   1 o mês · (espaço da meta do bimestre, S22) · 2 ranking · 3 meta do dia + dias seguidos ·
//   4 evolução 6 meses · 5 Agora · 6 Quem chamar hoje (+ convite) · 7 atalhos.
// Os dados chegam do FranchiseeDashboard (mesma carga da Início de sempre + o histórico de
// vendas antigas, só com a chave); as contas estão em src/lib/inicioMes.js.
import React, { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import SubscriptionPaymentSheet from "@/components/shared/SubscriptionPaymentSheet";
import ConversionDetailSheet from "../ConversionDetailSheet";
import FinancialObligationsCard from "../FinancialObligationsCard";
import {
  MESES_EVOLUCAO, aReceberDesde, corteAReceber, diasSeguidosBatendoMeta, faturamentoDoDia,
  hojeBrasilia, metaDoDia, montarEvolucao, montarInicioMes,
} from "@/lib/inicioMes";
import InicioMesCard from "./InicioMesCard";
import EspacoMetaBimestre from "./EspacoMetaBimestre";
import { InicioRanking, InicioMetaDia } from "./InicioRankingMeta";
import InicioEvolucao from "./InicioEvolucao";
import InicioAgora from "./InicioAgora";
import InicioQuemChamar from "./InicioQuemChamar";
import InicioAtalhos from "./InicioAtalhos";

// Sem o histórico (carregando ou falhou) a evolução mostra só o que a janela principal cobre:
// o mês atual e os 3 anteriores inteiros.
const MESES_SEM_HISTORICO = 4;

export function InicioV2Esqueleto() {
  // Mesma ordem dos blocos da tela, sem ícone (a fonte pode não ter carregado ainda).
  return (
    <div className="pt-4 pb-4 px-4 md:px-12 max-w-lg mx-auto md:max-w-none space-y-4 bg-surface">
      <div className="mb-2 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
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

export default function InicioV2({
  modoReduzido, evoId, franchise, allSales, historico, summaries, ranking, monthlyRanking,
  purchaseOrders, subscription, checkPaymentNow, isChecking, marketingPayment,
  botActive, botConfigured, botSilentDays, hasRecentSales, funnel, funnelRange,
}) {
  const [pagamentoAberto, setPagamentoAberto] = useState(false);
  const [conversaoAberta, setConversaoAberta] = useState(false);

  const dados = useMemo(() => {
    // "hoje" em Brasília, recalculado a cada recarga dos dados (polling de 5 min da Início)
    const hoje = hojeBrasilia();
    const comHistorico = historico?.status === "ok";
    const todas = comHistorico ? [...historico.sales, ...allSales] : allSales;
    const doDia = faturamentoDoDia(allSales, hoje.str);
    return {
      mes: montarInicioMes({ sales: allSales, hoje: hoje.data }),
      evolucao: montarEvolucao({ sales: todas, hoje: hoje.data, meses: comHistorico ? MESES_EVOLUCAO : MESES_SEM_HISTORICO }),
      // sem o histórico não dá para bater com a caixa da tela Vendas: não mostra número
      aReceber: comHistorico ? aReceberDesde(todas, corteAReceber()) : null,
      doDia,
      metaHoje: metaDoDia(summaries, hoje.str, { franchiseId: evoId }),
      sequencia: diasSeguidosBatendoMeta(summaries, { hoje: hoje.str, franchiseId: evoId, faturamentoHoje: doDia.total }),
    };
  }, [allSales, historico, summaries, evoId]);

  if (modoReduzido) {
    // Unidade que ainda não vendeu: igual à Início de sempre, só as obrigações.
    return <FinancialObligationsCard marketingPayment={marketingPayment} />;
  }

  const statusHistorico = historico?.status === "ok" || historico?.status === "erro" ? historico.status : "loading";

  return (
    <>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        <InicioMesCard mes={dados.mes} funnel={funnel} onAbrirConversao={() => setConversaoAberta(true)} />
        <EspacoMetaBimestre />
        <InicioRanking ranking={ranking} monthlyRanking={monthlyRanking} nomeMes={dados.mes.nomeMes} />
        <InicioMetaDia hoje={dados.doDia} metaHoje={dados.metaHoje} sequencia={dados.sequencia} />
        <InicioEvolucao meses={dados.evolucao} status={statusHistorico} mediana={dados.mes.mediana} nomeMes={dados.mes.nomeMes} />
        <InicioAgora
          subscription={subscription}
          purchaseOrders={purchaseOrders}
          aReceber={dados.aReceber}
          marketingPayment={marketingPayment}
          botActive={botActive}
          botConfigured={botConfigured}
          botSilentDays={botSilentDays}
          hasRecentSales={hasRecentSales}
          onOpenPaymentSheet={() => setPagamentoAberto(true)}
        />
        <InicioQuemChamar evoId={evoId} franchise={franchise} />
        <InicioAtalhos />
      </div>

      <div className="mt-4">
        <FinancialObligationsCard marketingPayment={marketingPayment} />
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
