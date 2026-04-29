import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const formatBRL = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value || 0
  );

const formatBRLCompact = (value) => {
  const n = parseFloat(value) || 0;
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(n >= 10000 ? 1 : 2).replace(".", ",")}k`;
  return formatBRL(n);
};

const CATEGORIAS = {
  compra_produto: { label: "Compra de produto", icon: "shopping_basket", color: "#b91c1c" },
  compra_embalagem: { label: "Embalagem", icon: "inventory_2", color: "#7c2d12" },
  compra_insumo: { label: "Insumos", icon: "kitchen", color: "#a16207" },
  aluguel: { label: "Aluguel", icon: "home_work", color: "#1e40af" },
  pessoal: { label: "Pessoal", icon: "groups", color: "#0e7490" },
  energia: { label: "Energia", icon: "bolt", color: "#ca8a04" },
  transporte: { label: "Transporte", icon: "local_shipping", color: "#15803d" },
  marketing: { label: "Marketing", icon: "campaign", color: "#9333ea" },
  impostos: { label: "Impostos", icon: "receipt_long", color: "#475569" },
  outros: { label: "Outros gastos", icon: "more_horiz", color: "#525252" },
};

const SCENARIOS = {
  verde: {
    nome: "🟢 Mês Excelente",
    estado: "verde",
    mes: "Abril",
    mesAnterior: "março",
    lucro: 3450,
    lucroAnterior: 2920,
    receita: 9200,
    vendas: 8920,
    freteCobrado: 280,
    descontos: 0,
    despesasTotal: 5750,
    estoqueCusto: 2700,
    estoqueVenda: 6200,
    estoqueQtd: 28,
    despesas: [
      { cat: "compra_produto", amount: 2800 },
      { cat: "aluguel", amount: 1200 },
      { cat: "pessoal", amount: 800 },
      { cat: "energia", amount: 450 },
      { cat: "transporte", amount: 250 },
      { cat: "outros", amount: 250 },
    ],
    topVendidos: [
      { name: "Lasanha Bolonhesa", qty: 62, revenue: 1860, markup: 135 },
      { name: "Nhoque Tradicional", qty: 41, revenue: 1230, markup: 120 },
      { name: "Rondelli Espinafre", qty: 28, revenue: 840, markup: 110 },
    ],
    parados: 1,
    evolucao: [
      { mes: "nov", lucro: 2100, estoque: 5500, receita: 7200 },
      { mes: "dez", lucro: 2500, estoque: 5800, receita: 7800 },
      { mes: "jan", lucro: 2800, estoque: 6000, receita: 8400 },
      { mes: "fev", lucro: 3000, estoque: 6000, receita: 8700 },
      { mes: "mar", lucro: 2920, estoque: 5900, receita: 8800 },
      { mes: "abr", lucro: 3450, estoque: 6200, receita: 9200, isCurrent: true },
    ],
    resumoEvolucao: "Crescimento consistente: lucro subiu R$ 1.350 nos últimos 6 meses, estoque mantido saudável.",
    banner: {
      icone: "✅",
      titulo: "Mês excelente",
      mensagem: "Vendas firmes (R$ 9.200) e estoque saudável (R$ 6.200 a vender). Continue assim — você está no azul.",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      textColor: "text-green-900",
      iconColor: "text-green-600",
      icon: "trending_up",
    },
  },

  azul: {
    nome: "🔵 Mês de Reposição",
    estado: "azul",
    mes: "Abril",
    mesAnterior: "março",
    lucro: 620,
    lucroAnterior: 1770,
    receita: 4200,
    vendas: 4080,
    freteCobrado: 120,
    descontos: 0,
    despesasTotal: 3580,
    estoqueCusto: 3700,
    estoqueVenda: 8400,
    estoqueQtd: 42,
    despesas: [
      { cat: "compra_produto", amount: 2500 },
      { cat: "aluguel", amount: 800 },
      { cat: "energia", amount: 280 },
    ],
    topVendidos: [
      { name: "Lasanha Bolonhesa", qty: 28, revenue: 840, markup: 135 },
      { name: "Nhoque Tradicional", qty: 22, revenue: 660, markup: 120 },
      { name: "Capeletti Carne", qty: 14, revenue: 420, markup: 115 },
    ],
    parados: 2,
    evolucao: [
      { mes: "nov", lucro: 1500, estoque: 3000, receita: 5800 },
      { mes: "dez", lucro: 1800, estoque: 2800, receita: 6200 },
      { mes: "jan", lucro: 2100, estoque: 2500, receita: 6500 },
      { mes: "fev", lucro: 1800, estoque: 2000, receita: 5900 },
      { mes: "mar", lucro: 1770, estoque: 1800, receita: 5600 },
      { mes: "abr", lucro: 620, estoque: 8400, receita: 4200, isCurrent: true },
    ],
    resumoEvolucao: "Seu estoque dobrou em abril por causa da reposição (R$ 2.500 em compra). Lucro caiu temporariamente, mas você tem R$ 8.400 a vender — vai colher nos próximos meses.",
    banner: {
      icone: "🔵",
      titulo: "Mês de reposição — colheita vem",
      mensagem: "Você comprou R$ 2.500 em produto esse mês. Não é prejuízo — é investimento. Tem R$ 8.400 a vender no estoque para os próximos meses.",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      textColor: "text-blue-900",
      iconColor: "text-blue-600",
      icon: "savings",
    },
  },

  amarelo: {
    nome: "🟡 Vendeu Bem, Repor",
    estado: "amarelo",
    mes: "Abril",
    mesAnterior: "março",
    lucro: 2180,
    lucroAnterior: 2010,
    receita: 6800,
    vendas: 6580,
    freteCobrado: 220,
    descontos: 0,
    despesasTotal: 4620,
    estoqueCusto: 700,
    estoqueVenda: 1450,
    estoqueQtd: 8,
    despesas: [
      { cat: "aluguel", amount: 1200 },
      { cat: "pessoal", amount: 1500 },
      { cat: "energia", amount: 380 },
      { cat: "transporte", amount: 540 },
      { cat: "marketing", amount: 500 },
      { cat: "outros", amount: 500 },
    ],
    topVendidos: [
      { name: "Lasanha Bolonhesa", qty: 71, revenue: 2130, markup: 135 },
      { name: "Nhoque Tradicional", qty: 53, revenue: 1590, markup: 120 },
      { name: "Rondelli Espinafre", qty: 38, revenue: 1140, markup: 110 },
    ],
    parados: 0,
    evolucao: [
      { mes: "nov", lucro: 1500, estoque: 4000, receita: 5800 },
      { mes: "dez", lucro: 1800, estoque: 3200, receita: 6200 },
      { mes: "jan", lucro: 2000, estoque: 2500, receita: 6500 },
      { mes: "fev", lucro: 2100, estoque: 2000, receita: 6700 },
      { mes: "mar", lucro: 2010, estoque: 1700, receita: 6700 },
      { mes: "abr", lucro: 2180, estoque: 1450, receita: 6800, isCurrent: true },
    ],
    resumoEvolucao: "Vendendo R$ 6.800/mês em média, mas estoque caiu pela metade desde janeiro. Hora de fazer um pedido de reposição.",
    banner: {
      icone: "🟡",
      titulo: "Vendeu bem, considere repor",
      mensagem: "Estoque potencial só R$ 1.450 — vai precisar comprar logo pra não perder vendas. Vende uma média de R$ 6.800/mês.",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      textColor: "text-amber-900",
      iconColor: "text-amber-600",
      icon: "warning_amber",
    },
  },

  vermelho: {
    nome: "🔴 Atenção",
    estado: "vermelho",
    mes: "Abril",
    mesAnterior: "março",
    lucro: -180,
    lucroAnterior: 1200,
    receita: 1840,
    vendas: 1780,
    freteCobrado: 60,
    descontos: 0,
    despesasTotal: 2020,
    estoqueCusto: 540,
    estoqueVenda: 1200,
    estoqueQtd: 6,
    despesas: [
      { cat: "aluguel", amount: 1200 },
      { cat: "energia", amount: 320 },
      { cat: "pessoal", amount: 350 },
      { cat: "outros", amount: 150 },
    ],
    topVendidos: [
      { name: "Lasanha Bolonhesa", qty: 14, revenue: 420, markup: 135 },
      { name: "Nhoque Tradicional", qty: 8, revenue: 240, markup: 120 },
    ],
    parados: 4,
    evolucao: [
      { mes: "nov", lucro: 1800, estoque: 4000, receita: 5400 },
      { mes: "dez", lucro: 1500, estoque: 3200, receita: 4800 },
      { mes: "jan", lucro: 1300, estoque: 2500, receita: 4200 },
      { mes: "fev", lucro: 1000, estoque: 2000, receita: 3500 },
      { mes: "mar", lucro: 1200, estoque: 1500, receita: 3100 },
      { mes: "abr", lucro: -180, estoque: 1200, receita: 1840, isCurrent: true },
    ],
    resumoEvolucao: "Receita caindo 5 meses seguidos e estoque também. Recomendado: ativar clientes antigos via bot e fazer pedido de reposição focado.",
    banner: {
      icone: "🔴",
      titulo: "Atenção — vendas fracas",
      mensagem: "Vendas fracas e estoque acabando. Que tal acionar o bot para ativar clientes inativos? E considerar uma reposição menor para retomar.",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      textColor: "text-red-900",
      iconColor: "text-red-600",
      icon: "warning",
    },
  },
};

function HeroMetric({ data }) {
  const lucro = data.lucro;
  const lucroAnterior = data.lucroAnterior;
  const deltaPct = lucroAnterior !== 0
    ? Math.round(((lucro - lucroAnterior) / Math.abs(lucroAnterior)) * 100)
    : null;
  const isPositive = lucro >= 0;

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 overflow-hidden">
      <CardContent className="p-6 md:p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#4a3d3d]/70 font-plus-jakarta">
              Como foi
            </p>
            <h2 className="text-xl font-bold text-[#1b1c1d] font-plus-jakarta capitalize mt-0.5">
              {data.mes}
            </h2>
          </div>
          <Select defaultValue="abril">
            <SelectTrigger className="h-9 w-auto min-w-[140px] rounded-xl text-sm font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="abril">Abril 2026</SelectItem>
              <SelectItem value="marco">Março 2026</SelectItem>
              <SelectItem value="custom" disabled>Período personalizado…</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-center py-2">
          <p className="text-xs text-[#4a3d3d] uppercase tracking-widest font-plus-jakarta mb-2">
            Lucro do mês
          </p>
          <div
            className={`text-5xl md:text-6xl font-bold font-mono-numbers tracking-tight ${
              isPositive ? "text-[#1b1c1d]" : "text-[#dc2626]"
            }`}
          >
            {formatBRL(lucro)}
          </div>
          {deltaPct !== null && (
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <MaterialIcon
                icon={deltaPct >= 0 ? "trending_up" : "trending_down"}
                size={18}
                className={deltaPct >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}
              />
              <span className="text-sm text-[#4a3d3d]">
                <span
                  className={`font-bold ${
                    deltaPct >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"
                  }`}
                >
                  {deltaPct > 0 ? "+" : ""}
                  {deltaPct}%
                </span>{" "}
                vs {data.mesAnterior} ({formatBRL(lucroAnterior)})
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ContextualBanner({ banner }) {
  return (
    <div
      className={`rounded-2xl border ${banner.borderColor} ${banner.bgColor} p-4 md:p-5 flex items-start gap-3`}
    >
      <div className={`shrink-0 mt-0.5 ${banner.iconColor}`}>
        <MaterialIcon icon={banner.icon} size={28} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`text-base font-bold font-plus-jakarta ${banner.textColor}`}>
          {banner.titulo}
        </h3>
        <p className={`text-sm mt-1 ${banner.textColor} opacity-90`}>
          {banner.mensagem}
        </p>
      </div>
    </div>
  );
}

function CardEmEstoque({ data }) {
  const markup = data.estoqueCusto > 0
    ? Math.round(((data.estoqueVenda - data.estoqueCusto) / data.estoqueCusto) * 100)
    : 0;

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
            {formatBRL(data.estoqueVenda)}
          </div>
          <p className="text-xs text-[#4a3d3d] mb-3">a vender</p>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[#4a3d3d]">
              <span>Custo</span>
              <span className="font-mono-numbers font-medium">{formatBRL(data.estoqueCusto)}</span>
            </div>
            <div className="flex items-center justify-between text-[#4a3d3d]">
              <span>Markup médio</span>
              <span className="font-mono-numbers font-medium text-[#16a34a]">+{markup}%</span>
            </div>
            <div className="flex items-center justify-between text-[#4a3d3d]">
              <span>Produtos ativos</span>
              <span className="font-mono-numbers font-medium">{data.estoqueQtd}</span>
            </div>
          </div>

          {data.parados > 0 && (
            <button className="mt-3 pt-3 border-t border-[#291715]/5 w-full flex items-center justify-between text-xs text-[#775a19] hover:text-[#5a4012] transition-colors group">
              <span className="flex items-center gap-1.5">
                <MaterialIcon icon="ac_unit" size={14} className="text-[#d4af37]" />
                <span className="font-medium">
                  {data.parados} parado{data.parados > 1 ? "s" : ""} há 28+ dias
                </span>
              </span>
              <MaterialIcon icon="arrow_forward" size={14} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
          )}
        </div>

        <Button
          size="sm"
          className="w-full gap-1.5 bg-[#b91c1c] hover:bg-[#991b1b] text-white rounded-xl text-xs mt-4"
        >
          <MaterialIcon icon="add_shopping_cart" size={16} />
          Lançar compra
        </Button>
      </CardContent>
    </Card>
  );
}

function CardCaixa({ data }) {
  const vendas = data.vendas ?? data.receita;
  const frete = data.freteCobrado ?? 0;
  const descontos = data.descontos ?? 0;
  const entrou = data.receita;
  const saiu = data.despesasTotal;
  const saldo = entrou - saiu;
  const isPositive = saldo >= 0;

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
          <div className={`text-3xl font-bold font-mono-numbers mb-0.5 ${
            isPositive ? "text-[#1b1c1d]" : "text-[#dc2626]"
          }`}>
            {formatBRL(saldo)}
          </div>
          <p className="text-xs text-[#4a3d3d] mb-3">saldo</p>

          {/* ENTROU — detalhado */}
          <div className="space-y-1 text-xs mb-3">
            <div className="flex items-center justify-between text-[#1b1c1d]">
              <span className="flex items-center gap-1 font-semibold">
                <MaterialIcon icon="arrow_upward" size={12} className="text-[#16a34a]" />
                Entrou
              </span>
              <span className="font-mono-numbers font-bold text-[#16a34a]">
                {formatBRL(entrou)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[#4a3d3d] pl-4">
              <span className="text-[11px]">└ Vendas</span>
              <span className="font-mono-numbers text-[11px]">{formatBRL(vendas)}</span>
            </div>
            {frete > 0 && (
              <div className="flex items-center justify-between text-[#4a3d3d] pl-4">
                <span className="text-[11px]">└ Frete cobrado</span>
                <span className="font-mono-numbers text-[11px]">{formatBRL(frete)}</span>
              </div>
            )}
            {descontos > 0 && (
              <div className="flex items-center justify-between text-[#4a3d3d] pl-4">
                <span className="text-[11px]">└ (-) Descontos</span>
                <span className="font-mono-numbers text-[11px] text-[#dc2626]">-{formatBRL(descontos)}</span>
              </div>
            )}
          </div>

          {/* SAIU — sumarizado (detalhe em "Onde foi o dinheiro") */}
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between text-[#1b1c1d]">
              <span className="flex items-center gap-1 font-semibold">
                <MaterialIcon icon="arrow_downward" size={12} className="text-[#dc2626]" />
                Saiu
              </span>
              <span className="font-mono-numbers font-bold text-[#dc2626]">
                -{formatBRL(saiu)}
              </span>
            </div>
            <p className="text-[10px] text-[#4a3d3d]/60 pl-4 italic">
              detalhe abaixo em "Onde foi o dinheiro"
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 rounded-xl text-xs mt-4 border-[#291715]/20"
        >
          <MaterialIcon icon="add" size={16} />
          Lançar despesa
        </Button>
      </CardContent>
    </Card>
  );
}

function CardMaisVendidos({ data, onSeeAll }) {
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
          {data.topVendidos.slice(0, 3).map((p, i) => (
            <div key={p.name} className="flex items-start gap-2.5">
              <span className="text-base font-bold text-[#d4af37] w-5 text-center font-mono-numbers shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1b1c1d] truncate leading-tight">
                  {p.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-[#4a3d3d] mt-0.5">
                  <span className="font-mono-numbers">{p.qty} un</span>
                  <span className="opacity-30">·</span>
                  <span className="font-mono-numbers">{formatBRL(p.revenue)}</span>
                  <span className="opacity-30">·</span>
                  <span className="text-[#16a34a] font-medium">+{p.markup}%</span>
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

function OndeFoiODinheiro({ data }) {
  const total = data.despesasTotal;
  const sortedDespesas = [...data.despesas].sort((a, b) => b.amount - a.amount);

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
      <CardContent className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-5">
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
          {sortedDespesas.map((d) => {
            const cat = CATEGORIAS[d.cat];
            const pct = total > 0 ? (d.amount / total) * 100 : 0;
            return (
              <div key={d.cat} className="flex items-center gap-3">
                <div
                  className="p-1.5 rounded-lg shrink-0"
                  style={{ backgroundColor: `${cat.color}15` }}
                >
                  <MaterialIcon icon={cat.icon} size={16} style={{ color: cat.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[#1b1c1d]">
                      {cat.label}
                    </span>
                    <span className="text-sm font-semibold text-[#1b1c1d] font-mono-numbers">
                      {formatBRL(d.amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#e9e8e9] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: cat.color,
                        }}
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
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl text-xs border-[#291715]/20"
          >
            <MaterialIcon icon="add" size={16} />
            Lançar despesa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function _ParadosNoFreezer({ data }) {
  if (data.parados === 0) return null;

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#d4af37]/30">
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#d4af37]/15 rounded-xl shrink-0">
            <MaterialIcon icon="ac_unit" size={20} className="text-[#775a19]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#1b1c1d] font-plus-jakarta mb-0.5">
              Parados no freezer
            </h3>
            <p className="text-xs text-[#4a3d3d] mb-3">
              {data.parados} produto{data.parados > 1 ? "s" : ""} sem venda em 28+ dias
            </p>

            <div className="text-sm text-[#4a3d3d] space-y-0.5">
              <p>• Canelone 4 queijos · 6 un</p>
              {data.parados >= 2 && <p>• Capeletti tradicional · 4 un</p>}
              {data.parados >= 3 && <p>• Lasanha Vegetariana · 3 un</p>}
              {data.parados >= 4 && <p>• Talharim ao alho · 5 un</p>}
            </div>

            <p className="text-xs text-[#4a3d3d]/70 mt-3 italic">
              Considere oferecer com desconto pros próximos clientes ou destacar no seu WhatsApp.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EvolucaoCard({ data }) {
  const [expanded, setExpanded] = useState(true);
  const evolucao = data.evolucao || [];

  const stats = useMemo(() => {
    if (!evolucao.length) return null;
    const lucros = evolucao.map(e => e.lucro);
    const estoques = evolucao.map(e => e.estoque);
    const maxLucro = Math.max(...lucros);
    const maxLucroMes = evolucao.find(e => e.lucro === maxLucro)?.mes;
    const lucroAtual = lucros[lucros.length - 1];
    const lucroPrimeiro = lucros[0];
    const tendenciaLucro = lucroAtual > lucroPrimeiro ? "📈" : lucroAtual < lucroPrimeiro ? "📉" : "→";
    const estoqueAtual = estoques[estoques.length - 1];
    const estoqueMedio = estoques.reduce((a, b) => a + b, 0) / estoques.length;
    return {
      maxLucro,
      maxLucroMes,
      tendenciaLucro,
      estoqueAtual,
      estoqueMedio,
      mesesAcima: lucros.filter(l => l > 0).length,
    };
  }, [evolucao]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    return (
      <div className="bg-white border border-[#291715]/10 rounded-xl shadow-lg px-3 py-2 text-xs">
        <p className="font-bold text-[#1b1c1d] capitalize mb-1">{label}/26</p>
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
          <p className="text-[#4a3d3d]">
            Estoque: <span className="font-mono-numbers font-medium text-[#775a19]">{formatBRL(item.estoque)}</span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
      <CardContent className="p-5 md:p-6">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between mb-4"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#d4af37]/15 rounded-lg">
              <MaterialIcon icon="show_chart" size={16} className="text-[#775a19]" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#4a3d3d]/80 font-plus-jakarta">
              Evolução · últimos 6 meses
            </h3>
          </div>
          <MaterialIcon
            icon={expanded ? "expand_less" : "expand_more"}
            size={20}
            className="text-[#4a3d3d]"
          />
        </button>

        {expanded && (
          <>
            {/* Mini-stats */}
            {stats && (
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-[#fbf9fa] rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#4a3d3d]/70 font-medium mb-0.5">
                    Maior lucro
                  </p>
                  <p className="text-sm font-bold text-[#1b1c1d] font-mono-numbers">
                    {formatBRLCompact(stats.maxLucro)}
                  </p>
                  <p className="text-[10px] text-[#4a3d3d] capitalize">{stats.maxLucroMes}/26</p>
                </div>
                <div className="bg-[#fbf9fa] rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#4a3d3d]/70 font-medium mb-0.5">
                    Tendência
                  </p>
                  <p className="text-sm font-bold text-[#1b1c1d]">{stats.tendenciaLucro}</p>
                  <p className="text-[10px] text-[#4a3d3d]">
                    {stats.mesesAcima}/{evolucao.length} meses no azul
                  </p>
                </div>
                <div className="bg-[#fbf9fa] rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#4a3d3d]/70 font-medium mb-0.5">
                    Estoque hoje
                  </p>
                  <p className="text-sm font-bold text-[#775a19] font-mono-numbers">
                    {formatBRLCompact(stats.estoqueAtual)}
                  </p>
                  <p className="text-[10px] text-[#4a3d3d]">
                    média {formatBRLCompact(stats.estoqueMedio)}
                  </p>
                </div>
              </div>
            )}

            {/* Chart com eixos Y duplos: esquerda = Lucro, direita = Estoque */}
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
                  {/* Eixo esquerdo — LUCRO (vermelho, mesma cor das barras) */}
                  <YAxis
                    yAxisId="left"
                    stroke="#b91c1c"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    width={36}
                  />
                  {/* Eixo direito — ESTOQUE (gold, mesma cor da linha) */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#d4af37"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    width={36}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#1b1c1d", fillOpacity: 0.04 }} />
                  <Bar yAxisId="left" dataKey="lucro" name="Lucro" radius={[6, 6, 0, 0]} barSize={28}>
                    {evolucao.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.lucro < 0 ? "#dc2626" : "#b91c1c"}
                        fillOpacity={entry.isCurrent ? 1 : entry.lucro < 0 ? 0.85 : 0.55}
                      />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="estoque"
                    name="Estoque"
                    stroke="#d4af37"
                    strokeWidth={2.5}
                    dot={{ fill: "#d4af37", r: 3.5 }}
                    activeDot={{ r: 5, fill: "#775a19" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Legenda customizada com cores dos eixos */}
            <div className="flex items-center justify-center gap-5 mt-2 text-xs text-[#4a3d3d]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#b91c1c]" />
                <span>Lucro <span className="text-[#b91c1c]/70">(esquerda)</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-[#d4af37]" />
                <span>Estoque a vender <span className="text-[#d4af37] font-medium">(direita)</span></span>
              </div>
            </div>

            {/* Frase resumo */}
            {data.resumoEvolucao && (
              <div className="mt-4 pt-4 border-t border-[#291715]/5">
                <p className="text-sm text-[#4a3d3d] leading-relaxed">
                  <MaterialIcon icon="lightbulb" size={14} className="inline-block text-[#d4af37] mr-1 align-text-top" />
                  {data.resumoEvolucao}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DevToolbar({ scenario, setScenario }) {
  return (
    <div className="sticky top-0 z-50 bg-[#1b1c1d] text-white px-4 py-3 mb-4 rounded-b-xl shadow-lg">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <MaterialIcon icon="science" size={16} className="text-[#d4af37]" />
          <span className="text-xs font-bold uppercase tracking-widest font-plus-jakarta">
            Preview · Resultado
          </span>
        </div>
        <div className="flex flex-wrap gap-2 flex-1">
          {Object.entries(SCENARIOS).map(([key, s]) => (
            <button
              key={key}
              onClick={() => setScenario(key)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                scenario === key
                  ? "bg-white text-[#1b1c1d]"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {s.nome}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-white/60 shrink-0">
          mock data — não é real
        </span>
      </div>
    </div>
  );
}

export default function PreviewResultado() {
  const [scenario, setScenario] = useState("azul");
  const data = SCENARIOS[scenario];
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#fbf9fa]">
      <DevToolbar scenario={scenario} setScenario={setScenario} />

      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-12 space-y-6">
        <HeroMetric data={data} />
        <ContextualBanner banner={data.banner} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CardEmEstoque data={data} />
          <CardCaixa data={data} />
          <CardMaisVendidos data={data} onSeeAll={() => navigate("/Vendas")} />
        </div>

        <OndeFoiODinheiro data={data} />
        <EvolucaoCard data={data} />
        {/* "Parados no freezer" foi para TabEstoque — agora aparece como link no card Em Estoque */}

        {/* Footer note */}
        <div className="pt-6 text-center">
          <p className="text-xs text-[#4a3d3d]/60">
            Protótipo visual — dados mockados. Aguardando aprovação do Nelson antes do redesign real.
          </p>
        </div>
      </div>
    </div>
  );
}
