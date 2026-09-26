// Raio-x da unidade: grade de métricas. Extraído do FranchiseDrawer (Mural do CS,
// 26/09/2026 Fase 2) para ser reusado pela Ficha da unidade (/Unidade?id=<evo>).
// Aceita o MESMO formato "achatado" de sinais nos dois lugares que o consomem:
//   - Mural: uma linha de get_franchise_health_signals()
//   - Ficha: unit.health.signals de get_unit_360(evo)
// `compacto` (só a Ficha): tira assinatura, marketing e última compra fábrica —
// já aparecem em cima (Rotina/Métricas) com a régua única; repeti-los aqui com o
// número do cache de saúde é o que fazia a Ficha se contradizer (achado ALTO, 26/09).
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL, formatPct } from "@/lib/formatters";
import { marketingLiquid } from "@/lib/franchiseUtils";

function daysAgo(n) {
  if (n == null) return "—";
  if (n <= 0) return "hoje";
  return `${n}d atrás`;
}

export function Metric({ icon, label, value, hint, tone }) {
  return (
    <div className="bg-surface rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-3 font-medium uppercase tracking-wide">
        <MaterialIcon icon={icon} size={14} /> {label}
      </div>
      <div className={`text-base font-bold mt-0.5 ${tone || "text-ink"}`}>{value}</div>
      {hint && <div className="text-[11px] text-ink-3 mt-0.5">{hint}</div>}
    </div>
  );
}

// `signals` é o objeto achatado (row do Mural, ou unit.health.signals da Ficha).
export default function RaioXPanel({ signals, compacto = false }) {
  if (!signals) return null;
  const deltaStr = signals.revenue_delta_pct != null
    ? formatPct(signals.revenue_delta_pct, { sinal: true })
    : null;
  const mktCur = marketingLiquid(signals.marketing_amount_current || 0);
  const mktPrev = marketingLiquid(signals.marketing_amount_prev || 0);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Metric icon="payments" label="Faturamento dos últimos 30 dias" value={formatBRL(signals.revenue_30d || 0)}
        hint={deltaStr ? `${deltaStr} vs 30 dias anteriores` : "base curta pra comparar"}
        tone={signals.revenue_delta_pct != null && signals.revenue_delta_pct <= -15 ? "text-err" : undefined} />
      <Metric icon="trending_up" label="Margem bruta" value={signals.gross_margin_pct_30d != null ? formatPct(signals.gross_margin_pct_30d) : "—"}
        tone={signals.gross_margin_pct_30d != null && signals.gross_margin_pct_30d < 0 ? "text-err" : undefined} />
      <Metric icon="repeat" label="Compras no mês" value={`${signals.purchase_count_30d ?? 0}`} hint={`antes: ${signals.purchase_count_prev ?? 0}`} />
      <Metric icon="category" label="Variedade comprada" value={`${signals.mix_distinct_30d ?? 0}`} hint={`antes: ${signals.mix_distinct_prev ?? 0}`} />
      <Metric icon="inventory_2" label="Itens-chave zerados" value={`${signals.zeroed_key_items_count ?? 0}`}
        hint={`de ${signals.key_items_total ?? 0} que vende`} tone={signals.zeroed_key_items_count >= 3 ? "text-warn-ink" : undefined} />
      <Metric icon="smart_toy" label="Conversão do robô" value={signals.bot_conversion_30d != null ? formatPct(signals.bot_conversion_30d) : "—"} />
      {!compacto && (
        <>
          <Metric icon="shopping_cart" label="Última venda" value={daysAgo(signals.days_since_last_sale)} />
          <Metric icon="local_shipping" label="Última compra fábrica" value={daysAgo(signals.days_since_last_purchase)}
            tone={signals.days_since_last_purchase >= 30 ? "text-err" : undefined} />
          <Metric icon="credit_card" label="Mensalidade do sistema" value={signals.subscription_overdue ? "Atrasada" : "Em dia"}
            tone={signals.subscription_overdue ? "text-err" : "text-ok-ink"} />
          <Metric icon="campaign" label="Verba de marketing (30 dias, líquido)" value={formatBRL(mktCur)} hint={`antes: ${formatBRL(mktPrev)}`}
            tone={mktCur < mktPrev ? "text-err" : mktCur > 0 ? "text-ok-ink" : undefined} />
        </>
      )}
    </div>
  );
}
