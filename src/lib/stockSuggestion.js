import { subDays } from "date-fns";

export const LOOKBACK_DAYS = 28;
export const WEEKS_OF_COVERAGE = 2;

const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;

export function weeklyTurnoverMap(saleItems) {
  const list = saleItems || [];
  if (list.length === 0) return {};

  const cutoff = subDays(new Date(), LOOKBACK_DAYS).toISOString();
  const agg = {};
  let sawAnyKey = false;

  for (const si of list) {
    if (!si.created_at || si.created_at < cutoff) continue;
    const key = si.inventory_item_id;
    if (!key) continue;
    sawAnyKey = true;
    agg[key] = (agg[key] || 0) + (parseFloat(si.quantity) || 0);
  }

  if (isDev && list.length > 0 && !sawAnyKey) {
    console.warn(
      "[stockSuggestion] saleItems chegou sem inventory_item_id — verifique o `columns` da query SaleItem.list. Giro/sugestão vão zerar."
    );
  }

  const out = {};
  for (const [id, total] of Object.entries(agg)) {
    out[id] = total / (LOOKBACK_DAYS / 7);
  }
  return out;
}

export function suggestionFor(item, weeklyTurnover) {
  const wt = weeklyTurnover[item.id] || 0;
  const qty = parseFloat(item.quantity) || 0;
  const minStock = parseFloat(item.min_stock) || 0;

  if (wt <= 0 && minStock <= 0) return null;

  const base = wt > 0 ? Math.ceil(wt * WEEKS_OF_COVERAGE) - qty : 0;
  const floor = minStock > 0 ? minStock - qty : 0;
  return Math.max(base, floor, 0);
}
