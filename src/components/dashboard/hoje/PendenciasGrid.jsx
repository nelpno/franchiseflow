import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { plural } from "./hojeFormat";
import { rotuloMesVerba } from "@/lib/networkOverview";
import { CARTAO, CARTAO_CLICAVEL, H2 } from "@/components/shared/adminUi";

// Substituem as ~130 notificações/mês de pedido/pagamento (removidas do front em 26/09,
// o banco já ignora essas chamadas). Só admin/gerente: get_admin_pending_counts dá 42501
// para customer_success — o pai nem chama a RPC para esse papel.
function CartaoPendencia({ n, label, cta, href, icon, state }) {
  if (!n) return null;
  return (
    <Link to={href} state={state} className={`flex flex-col gap-1.5 min-w-0 ${CARTAO_CLICAVEL}`}>
      <div className="flex items-center justify-between">
        <span className="font-plus-jakarta text-2xl font-extrabold text-ink tabular-nums">{n}</span>
        <MaterialIcon icon={icon} size={18} className="text-ink-3" />
      </div>
      <span className="text-sm text-ink-2">{label}</span>
      <span className="text-sm font-semibold text-brand-dark">{cta}</span>
    </Link>
  );
}

export default function PendenciasGrid({ pending, semVerbaCount, overview }) {
  if (!pending) return null;

  // sem_verba = não pagou o mês corrente nem o alvo. O cartão já mostra o número grande em
  // cima (CartaoPendencia), então o rótulo aqui NÃO repete o número — monta a frase direto
  // com rotuloMesVerba (mesma fonte de mês, vinda do banco, que Unidades e Marketing usam).
  // Achado alto 26/09: a versão anterior tentava tirar o número com
  // `.replace(/^d+ (unidades? )?/i, "")` — regex sem a barra invertida (procurava a letra
  // "d", não dígitos), então nunca batia e o número saía duplicado: "7" grande + "7 unidades
  // não pagaram..." embaixo.
  const mesSemVerba = rotuloMesVerba(overview);
  const semVerbaLabel = mesSemVerba
    ? `${semVerbaCount === 1 ? "não pagou" : "não pagaram"} a verba de ${mesSemVerba}`
    : `${semVerbaCount === 1 ? "não pagou" : "não pagaram"} a verba do mês`;
  const cartoes = [
    {
      n: pending.pedidos_para_confirmar,
      label: plural(pending.pedidos_para_confirmar, "pedido à fábrica esperando confirmação", "pedidos à fábrica esperando confirmação"),
      cta: "Confirmar →",
      href: "/PurchaseOrders?secao=confirmar",
      icon: "local_shipping",
    },
    {
      n: pending.pedidos_para_entregar,
      label: plural(pending.pedidos_para_entregar, "pedido pronto para separar e entregar", "pedidos prontos para separar e entregar"),
      cta: "Separar e entregar →",
      href: "/PurchaseOrders?secao=entregar",
      icon: "inventory_2",
    },
    {
      n: pending.marketing_a_confirmar,
      label: plural(pending.marketing_a_confirmar, "verba de anúncio esperando confirmação", "verbas de anúncio esperando confirmação"),
      cta: "Confirmar →",
      href: "/Marketing?tab=investimento&filtro=a_confirmar",
      icon: "payments",
    },
    {
      n: pending.marketing_sem_campanha,
      label: plural(pending.marketing_sem_campanha, "campanha paga que ainda não subiu", "campanhas pagas que ainda não subiram"),
      cta: "Subir campanha →",
      href: "/Marketing?tab=investimento&filtro=sem_campanha",
      icon: "campaign",
    },
    {
      n: pending.marketing_sem_comprovante,
      label: plural(pending.marketing_sem_comprovante, "verba paga sem comprovante anexado", "verbas pagas sem comprovante anexado"),
      cta: "Ver quem falta →",
      href: "/Marketing?tab=investimento&filtro=sem_comprovante",
      icon: "receipt_long",
    },
    {
      n: pending.onboarding_aguardando_aprovacao,
      label: plural(pending.onboarding_aguardando_aprovacao, "unidade nova pronta para conferir", "unidades novas prontas para conferir"),
      cta: "Aprovar →",
      href: "/Onboarding",
      icon: "task_alt",
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
      label: semVerbaLabel,
      cta: "Chamar quem falta →",
      // Mesmo destino que o resto de Marketing usa para "sem_verba" (achado médio 26/09:
      // Hoje mandava para Unidades, Marketing/FechamentoRede mandava para cá — duas telas
      // diferentes pro mesmo alerta). O painel de Verba já tem "Chamar" por WhatsApp pronto.
      href: "/Marketing?tab=investimento&filtro=sem_verba",
      icon: "campaign",
    },
  ];

  const temAlgo = cartoes.some((c) => c.n > 0);

  return (
    <section aria-label="Pendências" className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className={H2}>Pendências</h2>
        <span className="text-sm text-ink-3">Somem quando você resolve.</span>
      </div>
      {temAlgo ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cartoes.map((c, i) => <CartaoPendencia key={i} {...c} />)}
        </div>
      ) : (
        <div className={`flex items-center gap-3 ${CARTAO} text-ink-2`}>
          <MaterialIcon icon="check_circle" size={20} className="text-ok-ink shrink-0" />
          Tudo em dia.
        </div>
      )}
    </section>
  );
}
