import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Sale, SaleItem, Expense, InventoryItem, AuditLog } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MaterialIcon from "@/components/ui/MaterialIcon";
import ExpenseForm from "@/components/minha-loja/ExpenseForm";
import ResultadoCharts from "@/components/minha-loja/ResultadoCharts";
import ExportButtons from "@/components/shared/ExportButtons";
import { toast } from "sonner";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  subDays,
  isSameMonth,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const formatBRL = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value || 0
  );

function getMonthRange(date) {
  const start = format(startOfMonth(date), "yyyy-MM-dd");
  const end = format(endOfMonth(date), "yyyy-MM-dd");
  return { start, end };
}

function isInMonth(dateStr, monthDate) {
  if (!dateStr) return false;
  const d = parseISO(dateStr.substring(0, 10));
  return isSameMonth(d, monthDate);
}

export default function TabResultado({ franchiseId, currentUser }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [sales, setSales] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Audit logs
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditLogs, setShowAuditLogs] = useState(true);
  const [auditUserFilter, setAuditUserFilter] = useState("todos");

  const loadData = useCallback(async () => {
    if (!franchiseId) return;
    setLoading(true);
    try {
      const [salesData, saleItemsData, expensesData, inventoryData, auditData] = await Promise.all([
        Sale.filter({ franchise_id: franchiseId }),
        SaleItem.list(),
        Expense.filter({ franchise_id: franchiseId }),
        InventoryItem.filter({ franchise_id: franchiseId }),
        AuditLog.filter({ franchise_id: franchiseId }, "-created_at", 20),
      ]);
      setSales(salesData);
      setSaleItems(saleItemsData);
      setExpenses(expensesData);
      setInventoryItems(inventoryData);
      setAuditLogs(auditData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados do resultado.");
    } finally {
      setLoading(false);
    }
  }, [franchiseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Month navigation ---
  const handlePrevMonth = () => setSelectedMonth((m) => subMonths(m, 1));
  const handleNextMonth = () => {
    const next = addMonths(selectedMonth, 1);
    if (next <= new Date()) setSelectedMonth(next);
  };

  const monthLabel = format(selectedMonth, "MMMM yyyy", { locale: ptBR });
  const isCurrentMonth = isSameMonth(selectedMonth, new Date());

  // --- Filtered data for selected month ---
  const monthSales = useMemo(() => {
    return sales.filter((s) => {
      const dateStr = s.sale_date || s.created_at;
      return isInMonth(dateStr, selectedMonth);
    });
  }, [sales, selectedMonth]);

  const monthSaleIds = useMemo(() => new Set(monthSales.map((s) => s.id)), [monthSales]);

  const monthSaleItems = useMemo(() => {
    return saleItems.filter((si) => monthSaleIds.has(si.sale_id));
  }, [saleItems, monthSaleIds]);

  const monthExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const dateStr = e.expense_date || e.created_at;
      return isInMonth(dateStr, selectedMonth);
    });
  }, [expenses, selectedMonth]);

  // --- P&L calculations ---
  const faturamento = useMemo(
    () => monthSales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0),
    [monthSales]
  );

  const custoProdutos = useMemo(
    () =>
      monthSaleItems.reduce(
        (sum, si) => sum + (parseFloat(si.quantity) || 0) * (parseFloat(si.cost_price) || 0),
        0
      ),
    [monthSaleItems]
  );

  const taxasCartao = useMemo(
    () =>
      monthSales.reduce((sum, s) => sum + (parseFloat(s.card_fee_amount) || 0), 0),
    [monthSales]
  );

  const fretePago = useMemo(
    () =>
      monthSales.reduce((sum, s) => sum + (parseFloat(s.delivery_fee) || 0), 0),
    [monthSales]
  );

  const outrasDespesas = useMemo(
    () => monthExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0),
    [monthExpenses]
  );

  const lucro = faturamento - custoProdutos - taxasCartao - fretePago - outrasDespesas;

  // --- Previous month comparison ---
  const prevMonth = subMonths(selectedMonth, 1);
  const prevMonthFaturamento = useMemo(() => {
    return sales
      .filter((s) => {
        const dateStr = s.sale_date || s.created_at;
        return isInMonth(dateStr, prevMonth);
      })
      .reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
  }, [sales, prevMonth]);

  const monthDiffPercent = useMemo(() => {
    if (prevMonthFaturamento === 0) return null;
    return ((faturamento - prevMonthFaturamento) / prevMonthFaturamento) * 100;
  }, [faturamento, prevMonthFaturamento]);

  // --- Top products ---
  const topProducts = useMemo(() => {
    const map = {};
    for (const si of monthSaleItems) {
      const name = si.product_name || "Produto";
      if (!map[name]) map[name] = { name, quantity: 0, revenue: 0 };
      map[name].quantity += parseFloat(si.quantity) || 0;
      map[name].revenue += (parseFloat(si.quantity) || 0) * (parseFloat(si.unit_price) || 0);
    }
    return Object.values(map)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [monthSaleItems]);

  // --- Stale products (0 sales in 28 days, stock > 0) ---
  const staleProducts = useMemo(() => {
    const cutoff = format(subDays(new Date(), 28), "yyyy-MM-dd");
    // Get all sale_item inventory_item_ids in last 28 days
    const recentSaleIds = new Set(
      sales
        .filter((s) => (s.sale_date || s.created_at || "").substring(0, 10) >= cutoff)
        .map((s) => s.id)
    );
    const soldItemIds = new Set(
      saleItems
        .filter((si) => recentSaleIds.has(si.sale_id))
        .map((si) => si.inventory_item_id)
    );
    return inventoryItems.filter(
      (item) => (parseFloat(item.quantity) || 0) > 0 && !soldItemIds.has(item.id)
    );
  }, [sales, saleItems, inventoryItems]);

  // --- Expense handlers ---
  const handleExpenseSaved = () => {
    setExpenseDialogOpen(false);
    setEditingExpense(null);
    loadData();
  };

  const handleEditExpense = (exp) => {
    setEditingExpense(exp);
    setExpenseDialogOpen(true);
  };

  const handleDeleteExpense = async (id) => {
    try {
      await Expense.delete(id);
      toast.success("Despesa excluída!");
      setDeleteConfirmId(null);
      loadData();
    } catch (error) {
      console.error("Erro ao excluir despesa:", error);
      toast.error("Erro ao excluir despesa.");
    }
  };

  // --- Export columns ---
  const exportColumns = useMemo(() => [
    { key: "sale_date", header: "Data", format: (v) => v ? format(parseISO(v.substring(0, 10)), "dd/MM/yyyy") : "—" },
    { key: "value", header: "Valor (R$)", format: (v) => (parseFloat(v) || 0).toFixed(2) },
    { key: "payment_method", header: "Pagamento" },
    { key: "delivery_method", header: "Entrega" },
    { key: "net_value", header: "Valor Líquido (R$)", format: (v) => (parseFloat(v) || 0).toFixed(2) },
  ], []);

  const exportData = useMemo(() =>
    monthSales.map((s) => ({
      sale_date: s.sale_date || s.created_at,
      value: s.value,
      payment_method: s.payment_method || "—",
      delivery_method: s.delivery_method || "—",
      net_value: s.net_value || s.value,
    })),
    [monthSales]
  );

  // --- Audit log filtering ---
  const auditUserNames = useMemo(() => {
    const names = new Set();
    auditLogs.forEach((log) => {
      if (log.user_name) names.add(log.user_name);
    });
    return Array.from(names).sort();
  }, [auditLogs]);

  const filteredAuditLogs = useMemo(() => {
    if (auditUserFilter === "todos") return auditLogs;
    return auditLogs.filter((log) => log.user_name === auditUserFilter);
  }, [auditLogs, auditUserFilter]);

  // --- Audit log helpers ---
  const actionLabels = {
    create: "Criou",
    update: "Editou",
    delete: "Excluiu",
  };
  const entityLabels = {
    sale: "venda",
    expense: "despesa",
  };

  // --- Empty state check ---
  const hasData = monthSales.length > 0 || monthExpenses.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <MaterialIcon icon="progress_activity" size={32} className="animate-spin text-[#b91c1c]" />
        <span className="ml-3 text-[#534343]">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          className="rounded-xl hover:bg-[#b91c1c]/5"
        >
          <MaterialIcon icon="chevron_left" size={24} className="text-[#534343]" />
        </Button>
        <span className="text-lg font-semibold text-[#1b1c1d] font-plus-jakarta capitalize min-w-[180px] text-center">
          {monthLabel}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          disabled={isCurrentMonth}
          className="rounded-xl hover:bg-[#b91c1c]/5"
        >
          <MaterialIcon icon="chevron_right" size={24} className={isCurrentMonth ? "text-[#cac0c0]" : "text-[#534343]"} />
        </Button>
      </div>

      {!hasData ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <MaterialIcon icon="analytics" size={64} className="text-[#cac0c0] mb-4" />
          <h3 className="text-lg font-medium text-[#1b1c1d] mb-1 font-plus-jakarta">
            Sem dados para este mês
          </h3>
          <p className="text-sm text-[#534343] max-w-sm">
            Lance vendas para ver seu resultado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* P&L Card — spans 2 cols on desktop */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
              <CardContent className="p-5 md:p-6 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#534343]/80 font-plus-jakarta mb-4">
                  Resultado do Mês
                </h3>

                {/* Faturamento */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#534343]">Faturamento bruto</span>
                  <span className="text-sm font-semibold text-[#16a34a] font-mono-numbers">
                    {formatBRL(faturamento)}
                  </span>
                </div>

                {/* Custo produtos */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#534343]">(-) Custo dos produtos</span>
                  <span className="text-sm text-[#534343] font-mono-numbers">
                    {formatBRL(custoProdutos)}
                  </span>
                </div>

                {/* Taxas cartao */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#534343]">(-) Taxas cartão</span>
                  <span className="text-sm text-[#534343] font-mono-numbers">
                    {formatBRL(taxasCartao)}
                  </span>
                </div>

                {/* Frete */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#534343]">(-) Frete pago</span>
                  <span className="text-sm text-[#534343] font-mono-numbers">
                    {formatBRL(fretePago)}
                  </span>
                </div>

                {/* Outras despesas */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#534343]">(-) Outras despesas</span>
                  <span className="text-sm text-[#534343] font-mono-numbers">
                    {formatBRL(outrasDespesas)}
                  </span>
                </div>

                {/* Separator */}
                <div className="border-t border-[#291715]/10 my-1" />

                {/* Lucro */}
                <div className="flex justify-between items-center">
                  <span className="text-base font-bold text-[#1b1c1d]">= LUCRO ESTIMADO</span>
                  <span
                    className={`text-lg font-bold font-mono-numbers ${
                      lucro >= 0 ? "text-[#16a34a]" : "text-[#b91c1c]"
                    }`}
                  >
                    {formatBRL(lucro)}
                  </span>
                </div>

                {/* vs previous month */}
                {monthDiffPercent !== null && (
                  <div className="flex items-center gap-2 pt-2 border-t border-[#291715]/5">
                    <MaterialIcon
                      icon={monthDiffPercent >= 0 ? "trending_up" : "trending_down"}
                      size={18}
                      className={monthDiffPercent >= 0 ? "text-[#16a34a]" : "text-[#b91c1c]"}
                    />
                    <span className="text-xs text-[#534343]">
                      vs. mês anterior:{" "}
                      <span
                        className={`font-semibold ${
                          monthDiffPercent >= 0 ? "text-[#16a34a]" : "text-[#b91c1c]"
                        }`}
                      >
                        {monthDiffPercent >= 0 ? "+" : ""}
                        {monthDiffPercent.toFixed(1)}%
                      </span>
                      {" "}({formatBRL(prevMonthFaturamento)})
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expenses section */}
            <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
              <CardContent className="p-5 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#534343]/80 font-plus-jakarta">
                    Despesas do Mês
                  </h3>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingExpense(null);
                      setExpenseDialogOpen(true);
                    }}
                    className="gap-1.5 bg-[#b91c1c] hover:bg-[#991b1b] text-white rounded-xl text-xs"
                  >
                    <MaterialIcon icon="add" size={16} />
                    Adicionar
                  </Button>
                </div>

                {monthExpenses.length === 0 ? (
                  <p className="text-sm text-[#534343] text-center py-6">
                    Nenhuma despesa neste mês.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {monthExpenses.map((exp) => (
                      <div
                        key={exp.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-[#fbf9fa] border border-[#291715]/5"
                      >
                        <div className="p-1.5 bg-[#b91c1c]/10 rounded-lg shrink-0">
                          <MaterialIcon icon="receipt_long" size={16} className="text-[#b91c1c]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#1b1c1d] truncate">
                            {exp.description}
                          </p>
                          <p className="text-xs text-[#534343]">
                            {exp.expense_date
                              ? format(parseISO(exp.expense_date), "dd/MM/yyyy")
                              : "—"}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-[#1b1c1d] font-mono-numbers shrink-0">
                          {formatBRL(exp.amount)}
                        </span>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => handleEditExpense(exp)}
                            className="p-1.5 rounded-lg hover:bg-[#d4af37]/10 text-[#534343] hover:text-[#775a19] transition-colors"
                          >
                            <MaterialIcon icon="edit" size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(exp.id)}
                            className="p-1.5 rounded-lg hover:bg-[#b91c1c]/10 text-[#534343] hover:text-[#b91c1c] transition-colors"
                          >
                            <MaterialIcon icon="delete" size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Insights column */}
          <div className="space-y-6">
            {/* Top products */}
            {topProducts.length > 0 && (
              <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
                <CardContent className="p-5 md:p-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#534343]/80 font-plus-jakarta mb-4">
                    Mais Vendidos
                  </h3>
                  <div className="space-y-3">
                    {topProducts.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-[#d4af37] w-5 text-right">
                          {i + 1}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#1b1c1d] truncate">{p.name}</p>
                          <p className="text-xs text-[#534343]">
                            {p.quantity} un &middot; {formatBRL(p.revenue)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stale products */}
            {staleProducts.length > 0 && (
              <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
                <CardContent className="p-5 md:p-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#534343]/80 font-plus-jakarta mb-4">
                    Parados no freezer
                  </h3>
                  <p className="text-xs text-[#534343] mb-3">
                    Sem vendas nos últimos 28 dias
                  </p>
                  <div className="space-y-2">
                    {staleProducts.slice(0, 8).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-[#fbf9fa]"
                      >
                        <span className="text-sm text-[#1b1c1d] truncate">
                          {item.product_name}
                        </span>
                        <span className="text-xs text-[#534343] font-mono-numbers shrink-0 ml-2">
                          {item.quantity} {item.unit || "un"}
                        </span>
                      </div>
                    ))}
                    {staleProducts.length > 8 && (
                      <p className="text-xs text-[#534343] text-center">
                        +{staleProducts.length - 8} outros
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Charts section */}
      {sales.length > 0 && (
        <ResultadoCharts
          sales={sales}
          expenses={expenses}
          saleItems={saleItems}
        />
      )}

      {/* Export buttons */}
      {monthSales.length > 0 && (
        <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#534343]/80 font-plus-jakarta">
                  Exportar Vendas
                </h3>
                <p className="text-xs text-[#534343]/60 mt-1">
                  {monthSales.length} venda{monthSales.length !== 1 ? "s" : ""} em{" "}
                  {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
                </p>
              </div>
              <ExportButtons
                data={exportData}
                columns={exportColumns}
                filename={`vendas-${format(selectedMonth, "yyyy-MM")}`}
                title={`Vendas — ${format(selectedMonth, "MMMM yyyy", { locale: ptBR })}`}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit log section */}
      {auditLogs.length > 0 && (
        <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
          <CardContent className="p-5 md:p-6">
            <button
              onClick={() => setShowAuditLogs(!showAuditLogs)}
              className="flex items-center justify-between w-full"
            >
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#534343]/80 font-plus-jakarta">
                Histórico de Ações
              </h3>
              <MaterialIcon
                icon={showAuditLogs ? "expand_less" : "expand_more"}
                size={20}
                className="text-[#534343]"
              />
            </button>

            {showAuditLogs && (
              <div className="mt-4 space-y-3">
                {auditUserNames.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#534343] whitespace-nowrap">Filtrar por:</span>
                    <select
                      value={auditUserFilter}
                      onChange={(e) => setAuditUserFilter(e.target.value)}
                      className="text-xs h-8 px-2 py-1 rounded-xl bg-[#e9e8e9] border-none text-[#1b1c1d] focus:ring-2 focus:ring-[#b91c1c]/20 focus:outline-none"
                    >
                      <option value="todos">Todos</option>
                      {auditUserNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                {filteredAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-[#fbf9fa] border border-[#291715]/5"
                  >
                    <div className="p-1.5 bg-[#b91c1c]/10 rounded-lg shrink-0 mt-0.5">
                      <MaterialIcon
                        icon={
                          log.action === "create"
                            ? "add_circle"
                            : log.action === "update"
                            ? "edit"
                            : "delete"
                        }
                        size={14}
                        className="text-[#b91c1c]"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#1b1c1d]">
                        <span className="font-medium">{log.user_name || "Usuário"}</span>{" "}
                        {actionLabels[log.action] || log.action}{" "}
                        {entityLabels[log.entity_type] || log.entity_type}
                        {log.details?.value && (
                          <span className="text-[#534343]">
                            {" "}
                            ({formatBRL(log.details.value)})
                          </span>
                        )}
                        {log.details?.description && (
                          <span className="text-[#534343]">
                            {" "}
                            — {log.details.description}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[#534343]/60 mt-0.5">
                        {log.created_at
                          ? format(parseISO(log.created_at), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })
                          : "—"}
                      </p>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Expense form dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta">
              {editingExpense ? "Editar Despesa" : "Nova Despesa"}
            </DialogTitle>
          </DialogHeader>
          <ExpenseForm
            expense={editingExpense}
            franchiseId={franchiseId}
            currentUser={currentUser}
            onSave={handleExpenseSaved}
            onCancel={() => setExpenseDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta">Excluir despesa?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#534343]">
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-[#b91c1c] hover:bg-[#991b1b] text-white"
              onClick={() => handleDeleteExpense(deleteConfirmId)}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
