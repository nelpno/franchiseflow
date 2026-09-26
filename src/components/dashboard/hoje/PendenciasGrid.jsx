import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { nomeDoMes, plural } from "./hojeFormat";

// Substituem as ~130 notificações/mês de pedido/pagamento (removidas do front em 26/09,
// o banco já ignora essas chamadas). Só admin/gerente: get_admin_pending_counts dá 42501
// para customer_success — o pai nem chama a RPC para esse papel.
function CartaoPendencia({ n, label, cta, href, icon }) {
  if (!n) return null;
  return (
    <Link
      to={href}
      className="p-4 bg-white border border-ink-shadow/10 rounded-xl flex flex-col gap-1.5 hover:bg-surface transition-colors min-w-0"
    >
      <div className="flex items-center justify-between">
        <span className="font-plus-jakarta text-2xl font-extrabold text-ink tabular-nums">{n}</span>
        <MaterialIcon icon={icon} size={18} className="text-ink-3" />
      </div>
      <span className="text-sm text-ink-2">{label}</span>
      <span className="text-sm font-semibold text-brand-dark">{cta}</span>
    </Link>
  );
}

export default function PendenciasGrid({ pending, semVerbaCount }) {
  if (!pending) return null;

  // sem_verba = não pagou o mês corrente nem o alvo → o mês que falta é o do calendário (BRT)
  const mesCorrente = nomeDoMes(new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7));
  const cartoes = [
    {
      n: pending.pedidos_para_confirmar,
      label: plural(pending.pedidos_para_confirmar, "pedido à fábrica esperando confirmação", "pedidos à fábrica esperando confirmação"),
      cta: "Confirmar →",
      href: "/PurchaseOrders",
      icon: "local_shipping",
    },
    {
      n: pending.marketing_a_confirmar,
      label: plural(pending.marketing_a_confirmar, "verba de anúncio esperando confirmação", "verbas de anúncio esperando confirmação"),
      cta: "Confirmar →",
      href: "/Marketing?tab=investimento",
      icon: "payments",
    },
    {
      n: pending.marketing_sem_campanha,
      label: plural(pending.marketing_sem_campanha, "campanha paga que ainda não subiu", "campanhas pagas que ainda não subiram"),
      cta: "Subir campanha →",
      href: "/Marketing?tab=investimento",
      icon: "campaign",
    },
    {
      n: pending.mensalidades_vencidas,
      label: plural(pending.mensalidades_vencidas, "mensalidade vencida", "mensalidades vencidas"),
      cta: "Ver e cobrar →",
      href: "/Financeiro?tab=mensalidades",
      icon: "account_balance",
    },
    {
      n: semVerbaCount,
      label: `${semVerbaCount === 1 ? "não pagou" : "não pagaram"} a verba de ${mesCorrente}`,
      cta: "Ver quem falta →",
      href: "/Unidades?filtro=sem_verba",
      icon: "campaign",
    },
  ];

  const temAlgo = cartoes.some((c) => c.n > 0);

  return (
    <section aria-label="Pendências" className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="font-plus-jakarta text-xl font-bold text-ink">Pendências</h2>
        <span className="text-sm text-ink-3">Somem quando você resolve.</span>
      </div>
      {temAlgo ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {cartoes.map((c, i) => <CartaoPendencia key={i} {...c} />)}
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-white border border-ink-shadow/10 rounded-xl text-ink-2">
          <MaterialIcon icon="check_circle" size={20} className="text-ok-ink shrink-0" />
          Tudo em dia.
        </div>
      )}
    </section>
  );
}
