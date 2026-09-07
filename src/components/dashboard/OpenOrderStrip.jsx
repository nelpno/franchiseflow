import { useNavigate } from "react-router-dom";
import { parseDateOnly } from "@/lib/dateOnly";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRLInteger } from "@/lib/formatters";

/**
 * "Meu pedido saiu?" e uma das perguntas que mais chegam no grupo da rede — e a home
 * ja carregava os pedidos (FranchiseeDashboard, indice [6]) so para JOGAR FORA: o
 * state existia e nao era renderizado em lugar nenhum (auditoria 07/09/2026).
 * Esta faixa nao adiciona nenhuma query.
 *
 * `estimated_delivery` e DATE puro: tem de passar por parseDateOnly, senao
 * new Date("2026-09-10") vira UTC meia-noite e mostra 09/09 em horario de Brasilia.
 */
const ABERTOS = new Set(["pendente", "confirmado"]);

const ESTILO = {
  pendente: {
    bg: "#fffbeb", border: "#fde68a", ink: "#b45309",
    icon: "schedule", rotulo: "Pedido aguardando confirmação da fábrica",
  },
  confirmado: {
    bg: "#eff6ff", border: "#bfdbfe", ink: "#1d4ed8",
    icon: "local_shipping", rotulo: "Pedido confirmado pela fábrica",
  },
};

export default function OpenOrderStrip({ purchaseOrders = [] }) {
  const navigate = useNavigate();

  const aberto = purchaseOrders
    .filter((o) => ABERTOS.has(o.status))
    .sort((a, b) => new Date(b.ordered_at || 0) - new Date(a.ordered_at || 0))[0];

  if (!aberto) return null;

  const e = ESTILO[aberto.status] || ESTILO.pendente;
  const entrega = aberto.estimated_delivery ? parseDateOnly(aberto.estimated_delivery) : null;
  const valor = Number(aberto.total_amount) || 0;

  const detalhe = [
    valor > 0 ? formatBRLInteger(valor) : null,
    entrega ? `chega ${format(entrega, "EEEE, dd/MM", { locale: ptBR })}` : "sem data de entrega ainda",
  ].filter(Boolean).join(" · ");

  return (
    <button
      onClick={() => navigate("/Gestao?tab=reposicao")}
      className="mb-4 w-full flex items-center gap-3 p-3 rounded-xl border text-left active:scale-[0.99] transition-transform"
      style={{ backgroundColor: e.bg, borderColor: e.border }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${e.border}66` }}
      >
        <MaterialIcon icon={e.icon} size={20} style={{ color: e.ink }} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#1b1c1d] leading-snug">{e.rotulo}</p>
        <p className="text-[11px] text-[#7a6d6d] mt-0.5 truncate">{detalhe}</p>
      </div>
      <MaterialIcon icon="chevron_right" size={20} style={{ color: e.ink }} aria-hidden="true" />
    </button>
  );
}
