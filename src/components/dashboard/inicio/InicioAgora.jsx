// S18.1 — 5º bloco da Início nova (chave ui_v2): o que pede ação hoje. Reusa as faixas que já
// existiam (mensalidade, pedido a caminho/conferir entrega, ação prioritária) e acrescenta as
// vendas a receber, com o MESMO recorte da caixa "A receber" da tela Vendas.
// P3 S18 #6: `agora` vem de avaliarAgora (src/lib/inicioMes.js) — "Tudo em dia!" só quando todas
// as fontes responderam; o que não se sabe vira "não consegui conferir", nunca "tudo certo".
import React from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRLInteger } from "@/lib/formatters";
import MensalidadeFaixa from "../MensalidadeFaixa";
import OpenOrderStrip from "../OpenOrderStrip";
import PriorityAction from "../PriorityAction";
import { InicioErroLinha } from "./InicioErro";

function AReceberFaixa({ aReceber }) {
  if (aReceber?.status !== "ok" || !(aReceber.n > 0)) return null;
  const { n, total } = aReceber;
  return (
    <Link
      to="/Vendas"
      className="flex min-h-[44px] items-center gap-3 rounded-xl border border-brand-gold-line bg-brand-gold-soft p-3 touch-manipulation active:scale-[0.99]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70 text-brand-gold-ink">
        <MaterialIcon icon="payments" size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-snug text-ink">
          {n === 1 ? "1 venda esperando você marcar como recebida" : `${n} vendas esperando você marcar como recebidas`}
        </span>
        <span className="block text-[11px] text-ink-3">{formatBRLInteger(total)} no total · toque em Recebi quando o dinheiro entrar</span>
      </span>
      <MaterialIcon icon="chevron_right" size={20} className="shrink-0 text-brand-gold-ink" aria-hidden="true" />
    </Link>
  );
}

export default function InicioAgora({
  subscription, purchaseOrders, aReceber, agora, marketingPayment, botActive, botConfigured, botSilentDays,
  hasRecentSales, onOpenPaymentSheet, onTentarDeNovo,
}) {
  return (
    <section aria-label="Agora" className="flex flex-col gap-3 [&>*]:mb-0">
      <h2 className="font-plus-jakarta text-base font-bold text-ink">Agora</h2>
      <MensalidadeFaixa subscription={subscription} />
      <OpenOrderStrip purchaseOrders={purchaseOrders} />
      <AReceberFaixa aReceber={aReceber} />
      {agora?.carregando && <Skeleton className="h-14 rounded-xl" />}
      {agora?.erro && (
        <InicioErroLinha texto="Não consegui conferir todos os avisos agora." onTentarDeNovo={onTentarDeNovo} />
      )}
      {agora?.mostrarPrioridade && (
        <PriorityAction
          marketingPayment={marketingPayment}
          botActive={botActive}
          botConfigured={botConfigured}
          botSilentDays={botSilentDays}
          hasRecentSales={hasRecentSales}
          subscription={subscription}
          onOpenPaymentSheet={onOpenPaymentSheet}
          semTudoEmDia={!agora.permitirTudoEmDia}
        />
      )}
    </section>
  );
}
