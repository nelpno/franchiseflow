// S15.1 — Pedidos que a fábrica já entregou e a UNIDADE ainda não conferiu ('em_rota').
// Só existem para unidade com a chave ui_v2: o banco desvia o "entregue" do admin para cá
// (supabase/2026-09-28-s15-conferir-entrega.sql). Estoque e despesa entram quando ela
// confirma "Recebi tudo certo"/"Faltou algo", ou sozinhos em 48 h. Sem nenhum, a seção some.
// Busca própria (mesmo modelo da EntreguesSection): não pesa a carga inicial da página.
import { useEffect, useState } from "react";
import { PurchaseOrder } from "@/entities/all";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatters";
import { H2 } from "@/components/shared/adminUi";
import { STATUS_AGUARDA_CONFERENCIA, aguardaConferencia, prazoConferencia } from "@/lib/conferenciaEntrega";
import { filtrarPorTermo } from "./pedidosHelpers";

const FUSO = "America/Sao_Paulo";
const diaMes = (d) => new Date(d).toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" });
const hora = (d) => new Date(d).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });

export default function AguardandoConferenciaSection({ getFranchiseName, onVerItens, unidadeParam, searchTerm, testFranchiseIds, versao }) {
  const [pedidos, setPedidos] = useState([]);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let alive = true;
    setErro(false);
    const criteria = { status: STATUS_AGUARDA_CONFERENCIA };
    if (unidadeParam) criteria.franchise_id = unidadeParam;
    PurchaseOrder.filter(criteria, "ordered_at")
      .then((data) => {
        if (!alive) return;
        // Só conferência S15 (com awaiting_since); em_rota legado não é "esperando a unidade".
        const semTeste = (data || []).filter((o) => aguardaConferencia(o) && !testFranchiseIds?.has(o.franchise_id));
        setPedidos(filtrarPorTermo(semTeste, searchTerm, getFranchiseName));
      })
      .catch((error) => {
        if (!alive) return;
        console.error("Erro ao carregar pedidos esperando conferência:", error);
        setPedidos([]);
        setErro(true);
      });
    return () => { alive = false; };
  }, [unidadeParam, searchTerm, testFranchiseIds, getFranchiseName, versao, tentativa]);

  if (erro) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-err/30 bg-white p-4 text-sm text-err">
        Não foi possível ver os pedidos que esperam a unidade conferir.
        <button type="button" onClick={() => setTentativa((t) => t + 1)} className="min-h-10 rounded-xl border border-surface-line px-4 font-semibold text-ink hover:bg-surface">
          Tentar de novo
        </button>
      </div>
    );
  }
  if (pedidos.length === 0) return null;

  const agora = Date.now();
  return (
    <section aria-label="Esperando a unidade conferir" className="space-y-3">
      <div>
        <h2 className={H2}>Esperando a unidade conferir</h2>
        <p className="mt-1 text-sm text-ink-2">
          A fábrica já entregou. O estoque e a despesa entram quando a unidade confirmar o que chegou; sem resposta em 2 dias, entram completos e você é avisado.
        </p>
      </div>
      <div className="divide-y divide-surface-line overflow-hidden rounded-2xl border border-surface-line bg-white">
        {pedidos.map((order) => {
          const prazo = prazoConferencia(order);
          const venceu = prazo && prazo.getTime() <= agora;
          return (
            <div key={order.id} className="flex items-center gap-3 p-4 sm:px-5 sm:py-3">
              <MaterialIcon icon="local_shipping" size={20} className="shrink-0 text-warn-ink" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{getFranchiseName(order.franchise_id)}</p>
                <p className="text-sm text-ink-3">
                  {order.shipped_at ? `entregue em ${diaMes(order.shipped_at)}` : "entregue"}
                  {prazo && (venceu
                    ? " · prazo acabou, fecha como completo na próxima rodada"
                    : ` · conferir até ${diaMes(prazo)} às ${hora(prazo)}`)}
                </p>
              </div>
              <span className="hidden text-sm text-ink-2 sm:inline">{formatBRL(order.total_amount)}</span>
              <button type="button" onClick={() => onVerItens(order)} className="min-h-10 shrink-0 text-sm font-semibold text-brand-dark hover:underline">
                Ver itens →
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
