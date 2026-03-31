import React, { useMemo } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { getTopProducts } from "@/lib/financialCalcs";
import { getMarginTierCounts } from "@/lib/marginHelpers";
import { formatBRL } from "@/lib/formatBRL";

function PnlRow({ label, value, color, bold }) {
  if (!value && value !== 0) return null;
  const isZero = Math.abs(value) < 0.01;
  if (isZero && !bold) return null;
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-[#4a3d3d]">{label}</span>
      <span
        className={`text-sm ${bold ? "font-bold" : "font-medium"}`}
        style={{ color: color || "#1b1c1d" }}
      >
        {formatBRL(value)}
      </span>
    </div>
  );
}

export default function FranchiseFinanceDrilldown({ franchiseData, inventoryItems, saleItems }) {
  const { pnl, prevPnl } = franchiseData;
  const topProducts = useMemo(() => getTopProducts(saleItems, 5), [saleItems]);
  const marginTiers = useMemo(() => getMarginTierCounts(inventoryItems), [inventoryItems]);

  const variation =
    prevPnl && prevPnl.totalRecebido > 0
      ? ((pnl.totalRecebido - prevPnl.totalRecebido) / prevPnl.totalRecebido) * 100
      : null;

  return (
    <div className="border-t border-[#e9e8e9] bg-[#fbf9fa] px-4 py-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* P&L Breakdown */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-[#1b1c1d] flex items-center gap-1.5 mb-2">
            <MaterialIcon icon="receipt_long" size={16} className="text-[#b91c1c]" />
            Resultado do Mes
            {variation !== null && (
              <span
                className={`text-xs font-bold ml-auto ${
                  variation >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"
                }`}
              >
                {variation >= 0 ? "+" : ""}
                {variation.toFixed(1)}% vs anterior
              </span>
            )}
          </h4>

          <PnlRow label="Vendas" value={pnl.vendas} />
          <PnlRow label="Frete cobrado" value={pnl.freteCobrado} />
          <PnlRow label="Descontos" value={-pnl.totalDescontos} color="#dc2626" />
          <div className="border-t border-[#e9e8e9] my-1" />
          <PnlRow label="Total Recebido" value={pnl.totalRecebido} bold />
          <PnlRow label="(-) Custo produtos" value={-pnl.custoProdutos} color="#dc2626" />
          <PnlRow label="(-) Taxas cartao" value={-pnl.taxasCartao} color="#dc2626" />
          <PnlRow label="(-) Outras despesas" value={-pnl.outrasDespesas} color="#dc2626" />
          <div className="border-t border-[#e9e8e9] my-1" />
          <PnlRow
            label="Lucro Estimado"
            value={pnl.lucro}
            color={pnl.lucro >= 0 ? "#16a34a" : "#dc2626"}
            bold
          />
        </div>

        {/* Top Products */}
        <div>
          <h4 className="text-sm font-semibold text-[#1b1c1d] flex items-center gap-1.5 mb-2">
            <MaterialIcon icon="star" size={16} className="text-[#d4af37]" />
            Top Produtos
          </h4>
          {topProducts.length === 0 ? (
            <p className="text-xs text-[#7a6d6d]">Sem vendas no periodo</p>
          ) : (
            <div className="space-y-1.5">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#7a6d6d] w-4">{i + 1}</span>
                  <span className="text-sm text-[#1b1c1d] flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-[#7a6d6d]">{p.quantity}un</span>
                  <span className="text-xs font-medium text-[#4a3d3d]">{formatBRL(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Margin Summary */}
        <div>
          <h4 className="text-sm font-semibold text-[#1b1c1d] flex items-center gap-1.5 mb-2">
            <MaterialIcon icon="inventory_2" size={16} className="text-[#775a19]" />
            Markup do Estoque
          </h4>
          {marginTiers.total === 0 ? (
            <p className="text-xs text-[#7a6d6d]">Sem itens de estoque</p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-3 rounded-full overflow-hidden bg-[#e9e8e9] flex">
                  {marginTiers.high > 0 && (
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${(marginTiers.high / marginTiers.total) * 100}%` }}
                    />
                  )}
                  {marginTiers.medium > 0 && (
                    <div
                      className="h-full bg-[#d4af37]"
                      style={{ width: `${(marginTiers.medium / marginTiers.total) * 100}%` }}
                    />
                  )}
                  {marginTiers.low > 0 && (
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${(marginTiers.low / marginTiers.total) * 100}%` }}
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
                  <span className="text-xs text-[#4a3d3d]">{marginTiers.high} boa</span>
                </div>
                <div>
                  <span className="inline-block w-2 h-2 rounded-full bg-[#d4af37] mr-1" />
                  <span className="text-xs text-[#4a3d3d]">{marginTiers.medium} media</span>
                </div>
                <div>
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />
                  <span className="text-xs text-[#4a3d3d]">{marginTiers.low} baixa</span>
                </div>
              </div>
              {marginTiers.noPrice > 0 && (
                <p className="text-xs text-[#7a6d6d]">
                  {marginTiers.noPrice} sem preco definido
                </p>
              )}
              <p className="text-xs font-medium text-[#1b1c1d]">
                Markup medio: {marginTiers.avgMargin.toFixed(0)}%
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
