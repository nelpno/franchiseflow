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
 * Valor efetivamente recebido em uma venda (faturamento por venda).
 * Fórmula canônica do projeto: value - discount_amount + delivery_fee.
 * Coerção numérica obrigatória (campos podem vir como string do Supabase).
 */
export function getSaleNetValue(sale) {
  const value = parseFloat(sale?.value) || 0;
  const discount = parseFloat(sale?.discount_amount) || 0;
  const fee = parseFloat(sale?.delivery_fee) || 0;
  return value - discount + fee;
}

/**
 * Calculates P&L for a set of sales and expenses (visão de caixa puro).
 *
 * Receita - Taxas de cartão - Todas as despesas. Compra de produto entra no mês
 * em que foi paga (NÃO usa CMV — admin e franqueado veem o mesmo número).
 *
 * Param `_saleItems` mantido por compat de chamadas existentes; ignorado.
 */
export function calculatePnL(sales, _saleItems, expenses) {
  const vendas = sales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
  const freteCobrado = sales.reduce((sum, s) => sum + (parseFloat(s.delivery_fee) || 0), 0);
  const totalDescontos = sales.reduce((sum, s) => sum + (parseFloat(s.discount_amount) || 0), 0);
  const totalRecebido = vendas + freteCobrado - totalDescontos;

  const taxasCartao = sales.reduce((sum, s) => sum + (parseFloat(s.card_fee_amount) || 0), 0);
  const outrasDespesas = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const lucroCaixa = totalRecebido - taxasCartao - outrasDespesas;
  const margemCaixa = totalRecebido > 0 ? (lucroCaixa / totalRecebido) * 100 : 0;

  return {
    vendas,
    freteCobrado,
    totalDescontos,
    totalRecebido,
    taxasCartao,
    outrasDespesas,
    lucroCaixa,
    margemCaixa,
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
 * Resumo financeiro do estoque ativo de uma franquia.
 * Fallback client-side se RPC `get_inventory_value_summary` não estiver disponível.
 * Idêntico ao retorno do RPC para consistência.
 *
 * @param {Array} inventoryItems - itens com {quantity, cost_price, sale_price, active}
 * @returns {{ custoTotal, vendaPotencial, qtdProdutosAtivos, markupMedioPct }}
 */
export function calcularEstoqueResumo(inventoryItems) {
  const ativos = (inventoryItems || []).filter(
    (i) => i.active !== false && (parseFloat(i.quantity) || 0) > 0
  );

  let custoTotal = 0;
  let vendaPotencial = 0;
  for (const item of ativos) {
    const qty = parseFloat(item.quantity) || 0;
    custoTotal += qty * (parseFloat(item.cost_price) || 0);
    vendaPotencial += qty * (parseFloat(item.sale_price) || 0);
  }

  const markupMedioPct =
    custoTotal > 0
      ? Math.round(((vendaPotencial - custoTotal) / custoTotal) * 1000) / 10
      : 0;

  return {
    custoTotal,
    vendaPotencial,
    qtdProdutosAtivos: ativos.length,
    markupMedioPct,
  };
}

/**
 * Determina o "estado financeiro" do mês baseado em lucro × estoque.
 * Retorna {cor, titulo, mensagem, icone} para o banner contextual do TabResultado.
 *
 * 4 estados (quadrantes lucro × estoque):
 *   🟢 verde   — Lucro positivo + estoque saudável
 *   🔵 azul    — Lucro baixo + estoque alto (mês de reposição)
 *   🟡 amarelo — Lucro alto + estoque baixo (vendeu bem, considere repor)
 *   🔴 vermelho — Lucro baixo + estoque baixo (atenção)
 *
 * @param {object} params
 * @param {number} params.lucroCaixa     - lucro do período (caixa puro)
 * @param {number} params.valorEstoqueVenda - venda potencial do estoque atual
 * @param {number} params.mediaMensalReceita - receita média mensal (3-6 meses)
 * @returns {{ estado, cor, titulo, mensagem, icone }}
 */
export function getEstadoFinanceiro({
  lucroCaixa = 0,
  valorEstoqueVenda = 0,
  mediaMensalReceita = 0,
}) {
  // Estoque "saudável" = potencial de venda >= 50% da média mensal
  const estoqueAlto =
    mediaMensalReceita > 0
      ? valorEstoqueVenda >= mediaMensalReceita * 0.5
      : valorEstoqueVenda > 1000; // fallback sem histórico
  const lucroPositivo = lucroCaixa > 0;

  if (lucroPositivo && estoqueAlto) {
    return {
      estado: "verde",
      cor: "green",
      titulo: "Mês excelente",
      mensagem:
        "Vendas firmes e estoque saudável. Continue assim — você está no azul.",
      icone: "trending_up",
    };
  }

  if (!lucroPositivo && estoqueAlto) {
    return {
      estado: "azul",
      cor: "blue",
      titulo: "Mês de reposição — colheita vem",
      mensagem:
        "Lucro caiu temporariamente porque você comprou estoque. Não é prejuízo — é investimento. Veja seu estoque a vender ao lado.",
      icone: "savings",
    };
  }

  if (lucroPositivo && !estoqueAlto) {
    return {
      estado: "amarelo",
      cor: "amber",
      titulo: "Vendeu bem, considere repor",
      mensagem:
        "Estoque potencial está baixo. Vai precisar comprar logo pra não perder vendas.",
      icone: "warning_amber",
    };
  }

  return {
    estado: "vermelho",
    cor: "red",
    titulo: "Atenção — vendas fracas",
    mensagem:
      "Vendas fracas e estoque acabando. Que tal acionar o bot para ativar clientes inativos? E considerar uma reposição menor para retomar.",
    icone: "warning",
  };
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
