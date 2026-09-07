import React, { useMemo, useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";

/**
 * Ranking de funil da rede (admin): quem converte mal e quem retém bem.
 *
 * As duas métricas são INDEPENDENTES e pedem ações opostas — Itaquera converte 7% e
 * retém 2,16 compras/cliente; Rio Preto é o inverso. Por isso a ordenação é alternável
 * em vez de um "score" único que misturaria as duas coisas.
 */
const ORDERS = [
  { key: "conv", label: "Pior conversão", icon: "trending_down" },
  { key: "repeat", label: "Pior recompra", icon: "replay" },
  { key: "volume", label: "Maior volume perdido", icon: "person_off" },
];

function pctColor(v) {
  if (v == null) return "text-ink-3";
  if (v < 5) return "text-err font-bold";
  if (v < 10) return "text-[#b45309]";
  if (v >= 15) return "text-ok font-bold";
  return "text-ink";
}

function repeatColor(v) {
  if (v == null) return "text-ink-3";
  if (v >= 1.5) return "text-ok font-bold";
  if (v <= 1.02) return "text-err";
  return "text-ink";
}

export default function NetworkFunnelPanel({ rows = [] }) {
  const [order, setOrder] = useState("conv");

  const { withBot, totals } = useMemo(() => {
    const wb = rows.filter((r) => r.has_bot_data);
    const sumReached = wb.reduce((a, r) => a + (r.reached || 0), 0);
    const sumConverted = wb.reduce((a, r) => a + (r.converted || 0), 0);
    const sumCustomers = wb.reduce((a, r) => a + (r.customers || 0), 0);
    const sorted = [...wb].sort((a, b) => {
      if (order === "repeat") {
        return (Number(a.purchases_per_customer) || 0) - (Number(b.purchases_per_customer) || 0);
      }
      if (order === "volume") {
        return ((b.reached || 0) - (b.converted || 0)) - ((a.reached || 0) - (a.converted || 0));
      }
      return (Number(a.conversion_pct) || 0) - (Number(b.conversion_pct) || 0);
    });
    return {
      withBot: sorted,
      totals: {
        reached: sumReached,
        converted: sumConverted,
        lost: sumReached - sumConverted,
        pct: sumReached > 0 ? (sumConverted / sumReached) * 100 : 0,
        customers: sumCustomers,
        franchises: wb.length,
      },
    };
  }, [rows, order]);

  const noBot = rows.filter((r) => !r.has_bot_data);

  if (!rows.length) {
    return <p className="text-sm text-ink-3">Sem dados de funil no período.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-xl border border-ink-4/20 p-3 sm:p-4">
        <p className="text-sm text-ink-2">
          <strong className="text-ink tabular-nums">{totals.reached.toLocaleString("pt-BR")}</strong> pessoas falaram com a rede
          e <strong className="text-ink tabular-nums">{totals.converted.toLocaleString("pt-BR")}</strong> compraram
          (<strong className="text-ink">{totals.pct.toFixed(1).replace(".", ",")}%</strong>) em {totals.franchises} unidades com robô ativo.
        </p>
        <p className="text-xs text-ink-3 mt-1">
          {totals.lost.toLocaleString("pt-BR")} pessoas chegaram e não compraram no período.
        </p>
      </div>

      <div className="flex gap-1 bg-ink-shadow/5 p-1 rounded-xl overflow-x-auto sm:w-fit">
        {ORDERS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setOrder(o.key)}
            className={`px-3 py-1.5 text-xs font-plus-jakarta rounded-lg whitespace-nowrap min-h-[36px] flex items-center gap-1 transition-all active:scale-95 ${
              order === o.key ? "font-bold text-white bg-brand shadow-sm" : "font-medium text-ink/70"
            }`}
          >
            <MaterialIcon icon={o.icon} size={15} />
            {o.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border border-ink-4/20">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-xs text-ink-2 border-b border-ink-shadow/10">
              <th className="py-2 px-3 font-medium">Franquia</th>
              <th className="py-2 px-2 font-medium text-right">Falaram</th>
              <th className="py-2 px-2 font-medium text-right">Compraram</th>
              <th className="py-2 px-2 font-medium text-right">Conversão</th>
              <th className="py-2 px-2 font-medium text-right">Clientes</th>
              <th className="py-2 px-2 font-medium text-right" title="Compras por cliente no período">Recompra</th>
              <th className="py-2 px-3 font-medium text-right" title="Quanto das vendas veio de quem passou pelo robô">Via robô</th>
            </tr>
          </thead>
          <tbody>
            {withBot.map((r) => (
              <tr key={r.franchise_id} className="border-b border-ink-shadow/5 last:border-0 hover:bg-surface">
                <td className="py-2 px-3 text-ink">{r.franchise_name}</td>
                <td className="py-2 px-2 text-right tabular-nums text-ink-2">{r.reached}</td>
                <td className="py-2 px-2 text-right tabular-nums text-ink-2">{r.converted}</td>
                <td className={`py-2 px-2 text-right tabular-nums ${pctColor(Number(r.conversion_pct))}`}>
                  {r.conversion_pct != null ? `${String(r.conversion_pct).replace(".", ",")}%` : "—"}
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-ink-2">{r.customers}</td>
                <td className={`py-2 px-2 text-right tabular-nums ${repeatColor(Number(r.purchases_per_customer))}`}>
                  {r.purchases_per_customer != null ? String(r.purchases_per_customer).replace(".", ",") : "—"}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-ink-3">
                  {r.bot_share_pct != null ? `${String(r.bot_share_pct).replace(".", ",")}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {noBot.length > 0 && (
        <div className="bg-surface-2 border border-ink-shadow/10 rounded-xl px-3 py-2.5">
          <p className="text-xs text-ink-2">
            <MaterialIcon icon="smart_toy" size={14} className="align-middle mr-1 text-ink-3" />
            <strong>{noBot.length}</strong> sem robô ativo no período (menos de 20 pessoas alcançadas) — sem denominador, não entram no ranking:{" "}
            {noBot.map((r) => r.franchise_name).join(", ")}.
          </p>
        </div>
      )}
    </div>
  );
}
