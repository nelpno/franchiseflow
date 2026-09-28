// S18.1 — 5º bloco da Início nova (chave ui_v2): o que pede ação hoje. Reusa as faixas que já
// existiam (mensalidade, pedido a caminho/conferir entrega, ação prioritária) e acrescenta as
// vendas a receber, com o MESMO recorte da caixa "A receber" da tela Vendas.
import React from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRLInteger } from "@/lib/formatters";
import { faixaMensalidade } from "@/lib/pagamentos";
import MensalidadeFaixa from "../MensalidadeFaixa";
import OpenOrderStrip, { pedidoEmDestaque } from "../OpenOrderStrip";
import PriorityAction from "../PriorityAction";

function AReceberFaixa({ aReceber }) {
  if (!aReceber || aReceber.n <= 0) return null;
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
  subscription, purchaseOrders, aReceber, marketingPayment, botActive, botConfigured, botSilentDays,
  hasRecentSales, onOpenPaymentSheet,
}) {
  // "Tudo em dia!" só quando nada acima pede ação (as regras são as de cada faixa).
  const temOutraPendencia = !!faixaMensalidade(subscription) || !!pedidoEmDestaque(purchaseOrders) || (aReceber?.n || 0) > 0;
  return (
    <section aria-label="Agora" className="flex flex-col gap-3 [&>*]:mb-0">
      <h2 className="font-plus-jakarta text-base font-bold text-ink">Agora</h2>
      <MensalidadeFaixa subscription={subscription} />
      <OpenOrderStrip purchaseOrders={purchaseOrders} />
      <AReceberFaixa aReceber={aReceber} />
      <PriorityAction
        marketingPayment={marketingPayment}
        botActive={botActive}
        botConfigured={botConfigured}
        botSilentDays={botSilentDays}
        hasRecentSales={hasRecentSales}
        subscription={subscription}
        onOpenPaymentSheet={onOpenPaymentSheet}
        semTudoEmDia={temOutraPendencia}
      />
    </section>
  );
}
