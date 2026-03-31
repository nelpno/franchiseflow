import { isSameMonth, parseISO } from "date-fns";

/**
 * Checks if a date string falls within a given month.
 */
export function isInMonth(dateStr, monthDate) {
  if (!dateStr) return false;
  const d = parseISO(dateStr.substring(0, 10));
  return isSameMonth(d, monthDate);
}

/**
 * Calculates P&L for a set of sales, sale items, and expenses within a month.
 * Returns: { vendas, freteCobrado, totalDescontos, totalRecebido, custoProdutos, taxasCartao, outrasDespesas, lucro, margem, salesCount }
 */
export function calculatePnL(sales, saleItems, expenses) {
  const vendas = sales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
  const freteCobrado = sales.reduce((sum, s) => sum + (parseFloat(s.delivery_fee) || 0), 0);
  const totalDescontos = sales.reduce((sum, s) => sum + (parseFloat(s.discount_amount) || 0), 0);
  const totalRecebido = vendas + freteCobrado - totalDescontos;

  const custoProdutos = saleItems.reduce(
    (sum, si) => sum + (parseFloat(si.quantity) || 0) * (parseFloat(si.cost_price) || 0),
    0
  );

  const taxasCartao = sales.reduce((sum, s) => sum + (parseFloat(s.card_fee_amount) || 0), 0);
  const outrasDespesas = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const lucro = totalRecebido - custoProdutos - taxasCartao - outrasDespesas;
  const margem = totalRecebido > 0 ? (lucro / totalRecebido) * 100 : 0;

  return {
    vendas,
    freteCobrado,
    totalDescontos,
    totalRecebido,
    custoProdutos,
    taxasCartao,
    outrasDespesas,
    lucro,
    margem,
    salesCount: sales.length,
  };
}

/**
 * Returns top N products by quantity sold from sale items.
 */
export function getTopProducts(saleItems, limit = 5) {
  const map = {};
  for (const si of saleItems) {
    const name = si.product_name || "Produto";
    if (!map[name]) map[name] = { name, quantity: 0, revenue: 0 };
    map[name].quantity += parseFloat(si.quantity) || 0;
    map[name].revenue += (parseFloat(si.quantity) || 0) * (parseFloat(si.unit_price) || 0);
  }
  return Object.values(map)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

/**
 * Filters arrays of sales/expenses by month and groups by franchise_id.
 * Returns Map<franchise_id, { sales, expenses }>
 */
export function groupByFranchiseAndMonth(sales, expenses, monthDate) {
  const map = new Map();

  for (const s of sales) {
    const dateStr = s.sale_date || s.created_at;
    if (!isInMonth(dateStr, monthDate)) continue;
    const fid = s.franchise_id;
    if (!map.has(fid)) map.set(fid, { sales: [], expenses: [] });
    map.get(fid).sales.push(s);
  }

  for (const e of expenses) {
    const dateStr = e.expense_date || e.created_at;
    if (!isInMonth(dateStr, monthDate)) continue;
    const fid = e.franchise_id;
    if (!map.has(fid)) map.set(fid, { sales: [], expenses: [] });
    map.get(fid).expenses.push(e);
  }

  return map;
}
