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
import LancarCompraSheet from "@/components/minha-loja/LancarCompraSheet";
import ExportButtons from "@/components/shared/ExportButtons";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { PAYMENT_METHODS } from "@/lib/franchiseUtils";
import {
  format,
  subMonths,
  addMonths,
  isSameMonth,
  parseISO,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  calculatePnL,
  calcularEstoqueResumo,
  getEstadoFinanceiro,
  isInMonth,
  getTopProducts,
} from "@/lib/financialCalcs";
import { getCategoryMeta } from "@/lib/expenseCategories";

// --------------------------------------------------------------- helpers
const formatBRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const formatBRLCompact = (v) => {
  const n = parseFloat(v) || 0;
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toFixed(n >= 10000 ? 1 : 2).replace(".", ",")}k`;
  return formatBRL(n);
};

// Banner color → Tailwind class lookup
const BANNER_COLORS = {
  green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-900", icon: "text-green-600" },
  blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900", icon: "text-blue-600" },
  amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900", icon: "text-amber-600" },
  red: { bg: "bg-red-50", border: "border-red-200", text: "text-red-900", icon: "text-red-600" },
};

// --------------------------------------------------------------- HeroMetric
function HeroMetric({ pnl, prevPnl, monthLabel, onPrevMonth, onNextMonth, isCurrentMonth }) {
  const lucro = pnl.lucroCaixa;
  const lucroAnterior = prevPnl?.lucroCaixa || 0;
  const deltaPct = lucroAnterior !== 0
    ? Math.round(((lucro - lucroAnterior) / Math.abs(lucroAnterior)) * 100)
    : null;
  const isPositive = lucro >= 0;

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 overflow-hidden">
      <CardContent className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={onPrevMonth} className="rounded-xl">
            <MaterialIcon icon="chevron_left" size={22} className="text-[#4a3d3d]" />
          </Button>
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-[#4a3d3d]/70 font-plus-jakarta">
              Como foi
            </p>
            <h2 className="text-base md:text-lg font-bold text-[#1b1c1d] font-plus-jakarta capitalize mt-0.5">
              {monthLabel}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNextMonth}
            disabled={isCurrentMonth}
            className="rounded-xl"
          >
            <MaterialIcon icon="chevron_right" size={22} className={isCurrentMonth ? "text-[#cac0c0]" : "text-[#4a3d3d]"} />
          </Button>
        </div>

        <div className="text-center py-1">
          <p className="text-xs text-[#4a3d3d] uppercase tracking-widest font-plus-jakarta mb-2">
            Lucro do mês
          </p>
          <div className={`text-4xl md:text-5xl font-bold font-mono-numbers tracking-tight ${
            isPositive ? "text-[#1b1c1d]" : "text-[#dc2626]"
          }`}>
            {formatBRL(lucro)}
          </div>
          {deltaPct !== null && (
            <div className="flex items-center justify-center gap-1.5 mt-2.5">
              <MaterialIcon
                icon={deltaPct >= 0 ? "trending_up" : "trending_down"}
                size={16}
                className={deltaPct >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}
              />
              <span className="text-xs text-[#4a3d3d]">
                <span className={`font-bold ${deltaPct >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                  {deltaPct > 0 ? "+" : ""}{deltaPct}%
                </span>{" "}vs mês anterior ({formatBRL(lucroAnterior)})
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------------- ContextualBanner
function ContextualBanner({ estado }) {
  const colors = BANNER_COLORS[estado.cor] || BANNER_COLORS.green;
  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-4 md:p-5 flex items-start gap-3`}>
      <div className={`shrink-0 mt-0.5 ${colors.icon}`}>
        <MaterialIcon icon={estado.icone} size={26} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`text-base font-bold font-plus-jakarta ${colors.text}`}>{estado.titulo}</h3>
        <p className={`text-sm mt-1 ${colors.text} opacity-90`}>{estado.mensagem}</p>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- CardEmEstoque
function CardEmEstoque({ estoque, paradosCount, onClickEstoque, onLancarCompra }) {
  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 hover:shadow-md transition-shadow">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-[#d4af37]/10 rounded-lg">
            <MaterialIcon icon="inventory_2" size={16} className="text-[#775a19]" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#4a3d3d]/80 font-plus-jakarta">
            Em Estoque
          </span>
        </div>

        <div className="flex-1">
          <div className="text-3xl font-bold text-[#1b1c1d] font-mono-numbers mb-0.5">
            {formatBRL(estoque.vendaPotencial)}
          </div>
          <p className="text-xs text-[#4a3d3d] mb-3">a vender</p>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[#4a3d3d]">
              <span>Custo</span>
              <span className="font-mono-numbers font-medium">{formatBRL(estoque.custoTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-[#4a3d3d]">
              <span>Markup médio</span>
              <span className={`font-mono-numbers font-medium ${estoque.markupMedioPct >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                {estoque.markupMedioPct >= 0 ? "+" : ""}{estoque.markupMedioPct}%
              </span>
            </div>
            <div className="flex items-center justify-between text-[#4a3d3d]">
              <span>Produtos ativos</span>
              <span className="font-mono-numbers font-medium">{estoque.qtdProdutosAtivos}</span>
            </div>
          </div>

          {paradosCount > 0 && (
            <button
              onClick={onClickEstoque}
              className="mt-3 pt-3 border-t border-[#291715]/5 w-full flex items-center justify-between text-xs text-[#775a19] hover:text-[#5a4012] transition-colors group"
            >
              <span className="flex items-center gap-1.5">
                <MaterialIcon icon="ac_unit" size={14} className="text-[#d4af37]" />
                <span className="font-medium">
                  {paradosCount} parado{paradosCount > 1 ? "s" : ""} há 28+ dias
                </span>
              </span>
              <MaterialIcon icon="arrow_forward" size={14} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
          )}
        </div>

        <Button
          size="sm"
          onClick={onLancarCompra}
          className="w-full gap-1.5 bg-[#b91c1c] hover:bg-[#991b1b] text-white rounded-xl text-xs mt-4"
        >
          <MaterialIcon icon="add_shopping_cart" size={16} />
          Lançar compra
        </Button>
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------------- CardCaixa
function CardCaixa({ pnl, onLancarDespesa }) {
  const { vendas, freteCobrado, totalDescontos, totalRecebido, taxasCartao, outrasDespesas, lucroCaixa } = pnl;
  const saiu = taxasCartao + outrasDespesas;
  const isPositive = lucroCaixa >= 0;

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 hover:shadow-md transition-shadow">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-[#16a34a]/10 rounded-lg">
            <MaterialIcon icon="account_balance_wallet" size={16} className="text-[#15803d]" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#4a3d3d]/80 font-plus-jakarta">
            Caixa do mês
          </span>
        </div>

        <div className="flex-1">
          <div className={`text-3xl font-bold font-mono-numbers mb-0.5 ${isPositive ? "text-[#1b1c1d]" : "text-[#dc2626]"}`}>
            {formatBRL(lucroCaixa)}
          </div>
          <p className="text-xs text-[#4a3d3d] mb-3">saldo</p>

          {/* ENTROU detalhado */}
          <div className="space-y-1 text-xs mb-3">
            <div className="flex items-center justify-between text-[#1b1c1d]">
              <span className="flex items-center gap-1 font-semibold">
                <MaterialIcon icon="arrow_upward" size={12} className="text-[#16a34a]" />
                Entrou
              </span>
              <span className="font-mono-numbers font-bold text-[#16a34a]">{formatBRL(totalRecebido)}</span>
            </div>
            <div className="flex items-center justify-between text-[#4a3d3d] pl-4">
              <span className="text-[11px]">└ Vendas</span>
              <span className="font-mono-numbers text-[11px]">{formatBRL(vendas)}</span>
            </div>
            {freteCobrado > 0 && (
              <div className="flex items-center justify-between text-[#4a3d3d] pl-4">
                <span className="text-[11px]">└ Frete cobrado</span>
                <span className="font-mono-numbers text-[11px]">{formatBRL(freteCobrado)}</span>
              </div>
            )}
            {totalDescontos > 0 && (
              <div className="flex items-center justify-between text-[#4a3d3d] pl-4">
                <span className="text-[11px]">└ (-) Descontos</span>
                <span className="font-mono-numbers text-[11px] text-[#dc2626]">-{formatBRL(totalDescontos)}</span>
              </div>
            )}
          </div>

          {/* SAIU sumarizado */}
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between text-[#1b1c1d]">
              <span className="flex items-center gap-1 font-semibold">
                <MaterialIcon icon="arrow_downward" size={12} className="text-[#dc2626]" />
                Saiu
              </span>
              <span className="font-mono-numbers font-bold text-[#dc2626]">-{formatBRL(saiu)}</span>
            </div>
            <p className="text-[10px] text-[#4a3d3d]/60 pl-4 italic">
              detalhe abaixo em "Onde foi o dinheiro"
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onLancarDespesa}
          className="w-full gap-1.5 rounded-xl text-xs mt-4 border-[#291715]/20"
        >
          <MaterialIcon icon="add" size={16} />
          Lançar despesa
        </Button>
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------------- CardMaisVendidos
function CardMaisVendidos({ topProducts, onSeeAll }) {
  if (!topProducts.length) {
    return (
      <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
        <CardContent className="p-5 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-[#d4af37]/15 rounded-lg">
              <MaterialIcon icon="emoji_events" size={16} className="text-[#775a19]" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#4a3d3d]/80 font-plus-jakarta">
              Mais vendidos
            </span>
          </div>
          <p className="text-xs text-[#4a3d3d] flex-1 flex items-center justify-center text-center py-6">
            Sem vendas neste mês.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 hover:shadow-md transition-shadow">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-[#d4af37]/15 rounded-lg">
            <MaterialIcon icon="emoji_events" size={16} className="text-[#775a19]" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#4a3d3d]/80 font-plus-jakarta">
            Mais vendidos
          </span>
        </div>

        <div className="flex-1 space-y-3">
          {topProducts.slice(0, 3).map((p, i) => (
            <div key={p.name} className="flex items-start gap-2.5">
              <span className="text-base font-bold text-[#d4af37] w-5 text-center font-mono-numbers shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1b1c1d] truncate leading-tight">{p.name}</p>
                <div className="flex items-center gap-2 text-xs text-[#4a3d3d] mt-0.5">
                  <span className="font-mono-numbers">{p.quantity} un</span>
                  <span className="opacity-30">·</span>
                  <span className="font-mono-numbers">{formatBRL(p.revenue)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onSeeAll}
          className="text-xs text-[#b91c1c] hover:text-[#991b1b] font-medium mt-4 flex items-center gap-1 self-start"
        >
          Ver todas as vendas
          <MaterialIcon icon="arrow_forward" size={14} />
        </button>
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------------- OndeFoiODinheiro
function OndeFoiODinheiro({ expenses, taxasCartao, onLancarDespesa }) {
  const { byCategory, total } = useMemo(() => {
    const map = new Map();
    for (const e of expenses) {
      const cat = e.category || "outros";
      map.set(cat, (map.get(cat) || 0) + (parseFloat(e.amount) || 0));
    }
    if (taxasCartao > 0) {
      // Mostra taxas de cartão como linha separada (não está em expenses, vem das vendas)
      map.set("__taxas_cartao__", taxasCartao);
    }
    const totalSum = Array.from(map.values()).reduce((s, v) => s + v, 0);
    const sorted = Array.from(map.entries())
      .map(([cat, amount]) => ({ cat, amount }))
      .sort((a, b) => b.amount - a.amount);
    return { byCategory: sorted, total: totalSum };
  }, [expenses, taxasCartao]);

  if (!byCategory.length) {
    return (
      <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-[#b91c1c]/10 rounded-lg">
              <MaterialIcon icon="pie_chart" size={16} className="text-[#b91c1c]" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#4a3d3d]/80 font-plus-jakarta">
              Onde foi o dinheiro
            </h3>
          </div>
          <p className="text-xs text-[#4a3d3d] text-center py-4">
            Nenhuma despesa neste mês ainda.
          </p>
          <div className="flex justify-center">
            <Button onClick={onLancarDespesa} variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs border-[#291715]/20">
              <MaterialIcon icon="add" size={16} />
              Lançar primeira despesa
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
      <CardContent className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#b91c1c]/10 rounded-lg">
              <MaterialIcon icon="pie_chart" size={16} className="text-[#b91c1c]" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#4a3d3d]/80 font-plus-jakarta">
              Onde foi o dinheiro
            </h3>
          </div>
          <span className="text-sm text-[#4a3d3d] font-mono-numbers">
            Total {formatBRL(total)}
          </span>
        </div>

        <div className="space-y-3">
          {byCategory.map(({ cat, amount }) => {
            const meta = cat === "__taxas_cartao__"
              ? { label: "Taxas de cartão", icon: "credit_card", color: "#dc2626" }
              : getCategoryMeta(cat);
            const pct = total > 0 ? (amount / total) * 100 : 0;
            return (
              <div key={cat} className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: `${meta.color}15` }}>
                  <MaterialIcon icon={meta.icon} size={16} style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[#1b1c1d]">{meta.label}</span>
                    <span className="text-sm font-semibold text-[#1b1c1d] font-mono-numbers">{formatBRL(amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#e9e8e9] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: meta.color }}
                      />
                    </div>
                    <span className="text-xs text-[#4a3d3d] font-mono-numbers w-10 text-right">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-[#291715]/5">
          <Button onClick={onLancarDespesa} variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs border-[#291715]/20">
            <MaterialIcon icon="add" size={16} />
            Lançar despesa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------------- EvolucaoCard
function EvolucaoCard({ evolucao }) {
  const [expanded, setExpanded] = useState(true);

  const stats = useMemo(() => {
    if (!evolucao.length) return null;
    const lucros = evolucao.map(e => e.lucro);
    const maxLucro = Math.max(...lucros);
    const maxLucroMes = evolucao.find(e => e.lucro === maxLucro)?.mes;
    const lucroAtual = lucros[lucros.length - 1];
    const lucroPrimeiro = lucros[0];
    const tendencia = lucroAtual > lucroPrimeiro ? "📈" : lucroAtual < lucroPrimeiro ? "📉" : "→";
    const mesesPositivos = lucros.filter(l => l > 0).length;
    return { maxLucro, maxLucroMes, tendencia, mesesPositivos, total: evolucao.length };
  }, [evolucao]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    return (
      <div className="bg-white border border-[#291715]/10 rounded-xl shadow-lg px-3 py-2 text-xs">
        <p className="font-bold text-[#1b1c1d] capitalize mb-1">{label}</p>
        <div className="space-y-0.5">
          <p className="text-[#4a3d3d]">
            Receita: <span className="font-mono-numbers font-medium text-[#1b1c1d]">{formatBRL(item.receita)}</span>
          </p>
          <p className="text-[#4a3d3d]">
            Lucro:{" "}
            <span className={`font-mono-numbers font-medium ${item.lucro >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
              {formatBRL(item.lucro)}
            </span>
          </p>
        </div>
      </div>
    );
  };

  if (!evolucao.length) return null;

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
      <CardContent className="p-5 md:p-6">
        <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#d4af37]/15 rounded-lg">
              <MaterialIcon icon="show_chart" size={16} className="text-[#775a19]" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#4a3d3d]/80 font-plus-jakarta">
              Evolução · últimos 6 meses
            </h3>
          </div>
          <MaterialIcon icon={expanded ? "expand_less" : "expand_more"} size={20} className="text-[#4a3d3d]" />
        </button>

        {expanded && (
          <>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-5">
                <div className="bg-[#fbf9fa] rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#4a3d3d]/70 font-medium mb-0.5">
                    Maior lucro
                  </p>
                  <p className="text-sm font-bold text-[#1b1c1d] font-mono-numbers">
                    {formatBRLCompact(stats.maxLucro)}
                  </p>
                  <p className="text-[10px] text-[#4a3d3d] capitalize">{stats.maxLucroMes}</p>
                </div>
                <div className="bg-[#fbf9fa] rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#4a3d3d]/70 font-medium mb-0.5">
                    Tendência
                  </p>
                  <p className="text-sm font-bold text-[#1b1c1d]">{stats.tendencia}</p>
                  <p className="text-[10px] text-[#4a3d3d]">
                    {stats.mesesPositivos}/{stats.total} meses no azul
                  </p>
                </div>
                <div className="bg-[#fbf9fa] rounded-xl p-3 col-span-2 md:col-span-1">
                  <p className="text-[10px] uppercase tracking-wider text-[#4a3d3d]/70 font-medium mb-0.5">
                    Crescimento
                  </p>
                  <p className="text-sm font-bold text-[#1b1c1d] font-mono-numbers">
                    {evolucao[0].lucro > 0
                      ? `${Math.round(((evolucao[evolucao.length-1].lucro - evolucao[0].lucro) / Math.abs(evolucao[0].lucro)) * 100)}%`
                      : "—"}
                  </p>
                  <p className="text-[10px] text-[#4a3d3d]">{evolucao[0].mes} → {evolucao[evolucao.length-1].mes}</p>
                </div>
              </div>
            )}

            <div className="h-56 md:h-64 -ml-1 md:-ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={evolucao} margin={{ top: 10, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e9e8e9" vertical={false} />
                  <XAxis
                    dataKey="mes"
                    stroke="#4a3d3d"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#1b1c1d"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    width={36}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#b91c1c"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    width={36}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#1b1c1d", fillOpacity: 0.04 }} />
                  <Bar yAxisId="left" dataKey="receita" name="Receita" fill="#1b1c1d" fillOpacity={0.3} radius={[6, 6, 0, 0]} barSize={28} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="lucro"
                    name="Lucro"
                    stroke="#b91c1c"
                    strokeWidth={2.5}
                    dot={{ fill: "#b91c1c", r: 3.5 }}
                    activeDot={{ r: 5, fill: "#991b1b" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-5 mt-2 text-xs text-[#4a3d3d]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#1b1c1d]/30" />
                <span>Receita <span className="text-[#1b1c1d]/60">(esquerda)</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-[#b91c1c]" />
                <span>Lucro <span className="text-[#b91c1c]/70">(direita)</span></span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------------- main TabResultado
export default function TabResultado({ franchiseId, currentUser }) {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [sales, setSales] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [lancarCompraOpen, setLancarCompraOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!franchiseId) return;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        Sale.filter(
          { franchise_id: franchiseId },
          null,
          null,
          { columns: 'id, sale_date, value, delivery_fee, discount_amount, card_fee_amount, contact_id, source, payment_method, net_value, created_at' }
        ),
        Expense.filter({ franchise_id: franchiseId }),
        InventoryItem.filter(
          { franchise_id: franchiseId },
          null,
          null,
          { columns: 'id, product_name, quantity, cost_price, sale_price, min_stock, active' }
        ),
        AuditLog.filter({ franchise_id: franchiseId }, "-created_at", 20,
          { columns: 'id, action, details, created_at, user_name, entity_type' }),
      ]);

      const get = (r) => r.status === "fulfilled" ? r.value : [];
      const salesData = get(results[0]);

      // SaleItem em segundo round (depende dos sale IDs)
      const saleIds = salesData.map(s => s.id);
      const saleItemsData = saleIds.length > 0
        ? await SaleItem.filter({ sale_id: saleIds }, null, null,
            { columns: 'id, sale_id, inventory_item_id, quantity, unit_price, cost_price, product_name' })
        : [];

      setSales(salesData);
      setSaleItems(saleItemsData);
      setExpenses(get(results[1]));
      setInventoryItems(get(results[2]));
      setAuditLogs(get(results[3]));

      const failed = results.map((r, i) => r.status === "rejected" ? ["vendas", "despesas", "estoque", "auditoria"][i] : null).filter(Boolean);
      if (failed.length) toast.error(`Alguns dados não carregaram: ${failed.join(", ")}`);
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
      toast.error("Erro ao carregar dados do resultado.");
    } finally {
      setLoading(false);
    }
  }, [franchiseId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtros do mês selecionado
  const monthSales = useMemo(() => sales.filter(s => isInMonth(s.sale_date || s.created_at, selectedMonth)), [sales, selectedMonth]);
  const monthSaleIds = useMemo(() => new Set(monthSales.map(s => s.id)), [monthSales]);
  const monthSaleItems = useMemo(() => saleItems.filter(si => monthSaleIds.has(si.sale_id)), [saleItems, monthSaleIds]);
  const monthExpenses = useMemo(() => expenses.filter(e => isInMonth(e.expense_date || e.created_at, selectedMonth)), [expenses, selectedMonth]);

  // Mês anterior (para HeroMetric delta)
  const prevMonthDate = useMemo(() => subMonths(selectedMonth, 1), [selectedMonth]);
  const prevMonthSales = useMemo(() => sales.filter(s => isInMonth(s.sale_date || s.created_at, prevMonthDate)), [sales, prevMonthDate]);
  const prevMonthSaleIds = useMemo(() => new Set(prevMonthSales.map(s => s.id)), [prevMonthSales]);
  const prevMonthSaleItems = useMemo(() => saleItems.filter(si => prevMonthSaleIds.has(si.sale_id)), [saleItems, prevMonthSaleIds]);
  const prevMonthExpenses = useMemo(() => expenses.filter(e => isInMonth(e.expense_date || e.created_at, prevMonthDate)), [expenses, prevMonthDate]);

  // PnL atual e anterior
  const pnl = useMemo(() => calculatePnL(monthSales, monthSaleItems, monthExpenses), [monthSales, monthSaleItems, monthExpenses]);
  const prevPnl = useMemo(() => calculatePnL(prevMonthSales, prevMonthSaleItems, prevMonthExpenses), [prevMonthSales, prevMonthSaleItems, prevMonthExpenses]);

  // Resumo de estoque (atual)
  const estoqueResumo = useMemo(() => calcularEstoqueResumo(inventoryItems), [inventoryItems]);

  // Média mensal de receita (últimos 6 meses, exclui o atual se for o mês corrente sem dados)
  const mediaMensalReceita = useMemo(() => {
    const counts = {};
    for (let i = 0; i < 6; i++) {
      const d = subMonths(selectedMonth, i);
      const key = format(d, "yyyy-MM");
      counts[key] = sales
        .filter(s => isInMonth(s.sale_date || s.created_at, d))
        .reduce((sum, s) => sum + (parseFloat(s.value) || 0) + (parseFloat(s.delivery_fee) || 0) - (parseFloat(s.discount_amount) || 0), 0);
    }
    const values = Object.values(counts).filter(v => v > 0);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }, [sales, selectedMonth]);

  // Estado financeiro (banner)
  const estadoFinanceiro = useMemo(
    () => getEstadoFinanceiro({
      lucroCaixa: pnl.lucroCaixa,
      valorEstoqueVenda: estoqueResumo.vendaPotencial,
      mediaMensalReceita,
    }),
    [pnl.lucroCaixa, estoqueResumo.vendaPotencial, mediaMensalReceita]
  );

  // Top produtos
  const topProducts = useMemo(() => getTopProducts(monthSaleItems, 5), [monthSaleItems]);

  // Parados no freezer (28+ dias sem venda, com estoque > 0)
  const paradosCount = useMemo(() => {
    const cutoff = format(subDays(new Date(), 28), "yyyy-MM-dd");
    const recentSaleIds = new Set(
      sales.filter(s => (s.sale_date || s.created_at || "").substring(0, 10) >= cutoff).map(s => s.id)
    );
    const soldItemIds = new Set(
      saleItems.filter(si => recentSaleIds.has(si.sale_id)).map(si => si.inventory_item_id)
    );
    return inventoryItems.filter(i => i.active !== false && (parseFloat(i.quantity) || 0) > 0 && !soldItemIds.has(i.id)).length;
  }, [sales, saleItems, inventoryItems]);

  // Evolução 6 meses
  const evolucaoData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(selectedMonth, i);
      const monthKey = format(d, "MMM", { locale: ptBR }).replace(".", "");
      const mSales = sales.filter(s => isInMonth(s.sale_date || s.created_at, d));
      const mSaleIds = new Set(mSales.map(s => s.id));
      const mSaleItems = saleItems.filter(si => mSaleIds.has(si.sale_id));
      const mExpenses = expenses.filter(e => isInMonth(e.expense_date || e.created_at, d));
      const monthPnL = calculatePnL(mSales, mSaleItems, mExpenses);
      data.push({
        mes: monthKey,
        receita: monthPnL.totalRecebido,
        lucro: monthPnL.lucroCaixa,
        isCurrent: i === 0,
      });
    }
    // Só mostra evolução se tiver pelo menos 2 meses com dados
    const hasData = data.filter(d => d.receita > 0).length;
    return hasData >= 2 ? data : [];
  }, [sales, saleItems, expenses, selectedMonth]);

  // ─── Handlers
  const handlePrevMonth = () => setSelectedMonth(m => subMonths(m, 1));
  const handleNextMonth = () => {
    const next = addMonths(selectedMonth, 1);
    if (next <= new Date()) setSelectedMonth(next);
  };
  const handleLancarDespesa = () => { setEditingExpense(null); setExpenseDialogOpen(true); };
  const handleEditExpense = (exp) => { setEditingExpense(exp); setExpenseDialogOpen(true); };
  const handleExpenseSaved = () => { setExpenseDialogOpen(false); setEditingExpense(null); loadData(); };
  const handleDeleteExpense = async (id) => {
    try {
      await Expense.delete(id);
      toast.success("Despesa excluída!");
      setDeleteConfirmId(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao excluir despesa.");
    }
  };
  const handleClickEstoque = () => navigate("/Gestao?tab=estoque");
  const handleLancarCompra = () => setLancarCompraOpen(true);
  const handleVerVendas = () => navigate("/Vendas");

  // Fornecedores recentes para autocomplete
  const recentSuppliers = useMemo(() => {
    const set = new Set();
    for (const e of expenses.slice(0, 50)) {
      if (e.supplier && e.supplier.trim()) set.add(e.supplier.trim());
    }
    return Array.from(set).slice(0, 10);
  }, [expenses]);

  const monthLabel = format(selectedMonth, "MMMM yyyy", { locale: ptBR });
  const isCurrentMonth = isSameMonth(selectedMonth, new Date());

  // Export columns
  const exportColumns = useMemo(() => [
    { key: "sale_date", header: "Data", format: (v) => v ? format(parseISO(v.substring(0, 10)), "dd/MM/yyyy") : "—" },
    { key: "value", header: "Valor (R$)", format: (v) => (parseFloat(v) || 0).toFixed(2) },
    { key: "payment_method", header: "Pagamento", format: (v) => PAYMENT_METHODS.find(p => p.value === v)?.label || v || "—" },
    { key: "net_value", header: "Valor Líquido (R$)", format: (v) => (parseFloat(v) || 0).toFixed(2) },
  ], []);
  const exportData = useMemo(() => monthSales.map(s => ({
    sale_date: s.sale_date || s.created_at,
    value: s.value,
    payment_method: s.payment_method || "—",
    net_value: s.net_value || s.value,
  })), [monthSales]);

  const hasData = monthSales.length > 0 || monthExpenses.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <MaterialIcon icon="progress_activity" size={32} className="animate-spin text-[#b91c1c]" />
        <span className="ml-3 text-[#4a3d3d]">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <HeroMetric
        pnl={pnl}
        prevPnl={prevPnl}
        monthLabel={monthLabel}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        isCurrentMonth={isCurrentMonth}
      />

      {!hasData ? (
        <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
          <CardContent className="p-8 text-center">
            <MaterialIcon icon="analytics" size={48} className="text-[#cac0c0] mb-3 mx-auto" />
            <h3 className="text-base font-medium text-[#1b1c1d] mb-1 font-plus-jakarta">
              Vazio por enquanto
            </h3>
            <p className="text-sm text-[#4a3d3d] mb-4">
              Lance sua primeira venda do mês ou registre uma despesa pra ver seu resultado.
            </p>
            <Button onClick={handleLancarDespesa} variant="outline" className="gap-1.5 rounded-xl">
              <MaterialIcon icon="add" size={16} />
              Lançar despesa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <ContextualBanner estado={estadoFinanceiro} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CardEmEstoque
              estoque={estoqueResumo}
              paradosCount={paradosCount}
              onClickEstoque={handleClickEstoque}
              onLancarCompra={handleLancarCompra}
            />
            <CardCaixa pnl={pnl} onLancarDespesa={handleLancarDespesa} />
            <CardMaisVendidos topProducts={topProducts} onSeeAll={handleVerVendas} />
          </div>

          <OndeFoiODinheiro
            expenses={monthExpenses}
            taxasCartao={pnl.taxasCartao}
            onLancarDespesa={handleLancarDespesa}
          />

          <EvolucaoCard evolucao={evolucaoData} />

          {/* Despesas list (mantida) */}
          <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
            <CardContent className="p-5 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#4a3d3d]/80 font-plus-jakarta">
                  Despesas do mês
                </h3>
                <Button size="sm" onClick={handleLancarDespesa} className="gap-1.5 bg-[#b91c1c] hover:bg-[#991b1b] text-white rounded-xl text-xs">
                  <MaterialIcon icon="add" size={16} />
                  Adicionar
                </Button>
              </div>

              {monthExpenses.length === 0 ? (
                <p className="text-sm text-[#4a3d3d] text-center py-6">Nenhuma despesa neste mês.</p>
              ) : (
                <div className="space-y-2">
                  {monthExpenses.map((exp) => {
                    const meta = getCategoryMeta(exp.category);
                    const isAuto = exp.source && exp.source !== "manual";
                    return (
                      <div key={exp.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#fbf9fa] border border-[#291715]/5">
                        <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: `${meta.color}15` }}>
                          <MaterialIcon icon={meta.icon} size={16} style={{ color: meta.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-medium text-[#1b1c1d] truncate">{exp.description}</p>
                            {isAuto && (
                              <span className="text-[10px] bg-[#d4af37]/15 text-[#775a19] px-1.5 py-0.5 rounded-full font-medium">
                                auto
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#4a3d3d]">
                            {meta.label}
                            {exp.supplier && ` · ${exp.supplier}`}
                            {exp.expense_date && ` · ${format(parseISO(exp.expense_date), "dd/MM/yyyy")}`}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-[#1b1c1d] font-mono-numbers shrink-0">
                          {formatBRL(exp.amount)}
                        </span>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => handleEditExpense(exp)} className="p-1.5 rounded-lg hover:bg-[#d4af37]/10 text-[#4a3d3d] hover:text-[#775a19]">
                            <MaterialIcon icon="edit" size={16} />
                          </button>
                          <button onClick={() => setDeleteConfirmId(exp.id)} className="p-1.5 rounded-lg hover:bg-[#b91c1c]/10 text-[#4a3d3d] hover:text-[#b91c1c]">
                            <MaterialIcon icon="delete" size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Vendas (mantido) */}
          {monthSales.length > 0 && (
            <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
              <CardContent className="p-5 md:p-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#4a3d3d]/80 font-plus-jakarta">
                      Exportar vendas
                    </h3>
                    <p className="text-xs text-[#4a3d3d]/70 mt-1">
                      {monthSales.length} venda{monthSales.length !== 1 ? "s" : ""} em {monthLabel}
                    </p>
                  </div>
                  <ExportButtons
                    data={exportData}
                    columns={exportColumns}
                    filename={`vendas-${format(selectedMonth, "yyyy-MM")}`}
                    title={`Vendas — ${monthLabel}`}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audit log (mantido, colapsado) */}
          {auditLogs.length > 0 && (
            <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
              <CardContent className="p-5 md:p-6">
                <button onClick={() => setShowAuditLogs(v => !v)} className="flex items-center justify-between w-full">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#4a3d3d]/80 font-plus-jakarta">
                    Histórico de ações
                  </h3>
                  <MaterialIcon icon={showAuditLogs ? "expand_less" : "expand_more"} size={20} className="text-[#4a3d3d]" />
                </button>

                {showAuditLogs && (
                  <div className="mt-4 space-y-2">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-[#fbf9fa] border border-[#291715]/5">
                        <div className="p-1.5 bg-[#b91c1c]/10 rounded-lg shrink-0 mt-0.5">
                          <MaterialIcon
                            icon={log.action === "create" ? "add_circle" : log.action === "update" ? "edit" : "delete"}
                            size={14}
                            className="text-[#b91c1c]"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#1b1c1d]">
                            <span className="font-medium">{log.user_name || "Usuário"}</span>{" "}
                            {{ create: "criou", update: "editou", delete: "excluiu" }[log.action] || log.action}{" "}
                            {{ sale: "venda", expense: "despesa" }[log.entity_type] || log.entity_type}
                            {log.details?.value && <span className="text-[#4a3d3d]"> ({formatBRL(log.details.value)})</span>}
                            {log.details?.amount && <span className="text-[#4a3d3d]"> ({formatBRL(log.details.amount)})</span>}
                            {log.details?.description && <span className="text-[#4a3d3d]"> — {log.details.description}</span>}
                          </p>
                          <p className="text-xs text-[#4a3d3d]/70 mt-0.5">
                            {log.created_at ? format(parseISO(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Expense form dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta">
              {editingExpense ? "Editar despesa" : "Lançar despesa"}
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

      {/* Lançar Compra externa */}
      <LancarCompraSheet
        open={lancarCompraOpen}
        onOpenChange={setLancarCompraOpen}
        franchiseId={franchiseId}
        inventoryItems={inventoryItems}
        recentSuppliers={recentSuppliers}
        onSaved={() => loadData()}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full sm:max-w-sm p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta">Excluir despesa?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#4a3d3d]">Esta ação não pode ser desfeita.</p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button className="flex-1 bg-[#b91c1c] hover:bg-[#991b1b] text-white" onClick={() => handleDeleteExpense(deleteConfirmId)}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
