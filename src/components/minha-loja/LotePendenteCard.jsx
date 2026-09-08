import React, { useMemo } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatters";

/**
 * O lote que ainda vai sair da fabrica, em peso.
 *
 * `purchase_orders.total_weight_kg` e gravado desde 01/07/2026 e nenhuma tela lia — o peso
 * so servia a ficha de separacao. Mas peso e o que decide QUANTAS VANS o lote precisa: a
 * skill maxi-logistica-rotas roteiriza sob teto de 1.500 kg por rota, e ate agora esse
 * numero so aparecia depois de puxar os pedidos por script.
 *
 * Medido em 08/09/2026: 23 pedidos em aberto, R$ 64.483, 2.386 kg — 2 rotas. E os 22
 * pendentes tem peso gravado em 22 (o CLAUDE.md da logistica ainda diz "hoje 0/215",
 * que ficou velho).
 */

export const CAPACIDADE_ROTA_KG = 1500;

export default function LotePendenteCard({ orders = [] }) {
  const lote = useMemo(() => {
    const abertos = orders.filter((o) => o.status === "pendente" || o.status === "confirmado");
    const valor = abertos.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
    const kg = abertos.reduce((s, o) => s + (parseFloat(o.total_weight_kg) || 0), 0);
    const semPeso = abertos.filter((o) => !(parseFloat(o.total_weight_kg) > 0)).length;
    return { pedidos: abertos.length, valor, kg, semPeso, rotas: Math.ceil(kg / CAPACIDADE_ROTA_KG) };
  }, [orders]);

  if (lote.pedidos === 0) return null;

  const kgTexto = lote.kg.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-ink-shadow/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <MaterialIcon icon="local_shipping" size={18} className="text-brand" />
        <h2 className="text-sm font-bold text-ink font-plus-jakarta">Lote em aberto</h2>
        <span className="text-xs text-ink-3">pendentes e confirmados, de toda a rede</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <div>
          <p className="text-2xl font-bold text-ink font-mono-numbers">{lote.pedidos}</p>
          <p className="text-xs text-ink-2">{lote.pedidos === 1 ? "pedido" : "pedidos"}</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-ink font-mono-numbers">{formatBRL(lote.valor)}</p>
          <p className="text-xs text-ink-2">a faturar</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-ink font-mono-numbers">{kgTexto} kg</p>
          <p className="text-xs text-ink-2">
            {lote.kg > 0
              ? `${lote.rotas} ${lote.rotas === 1 ? "rota" : "rotas"} de ${CAPACIDADE_ROTA_KG.toLocaleString("pt-BR")} kg`
              : "sem peso calculado"}
          </p>
        </div>
      </div>

      {lote.semPeso > 0 && (
        <p className="mt-3 text-xs text-ink-2 flex items-center gap-1.5">
          <MaterialIcon icon="info" size={14} className="text-brand-gold-ink shrink-0" />
          {lote.semPeso} {lote.semPeso === 1 ? "pedido está" : "pedidos estão"} sem peso — o total acima
          está abaixo do real.
        </p>
      )}
    </div>
  );
}
