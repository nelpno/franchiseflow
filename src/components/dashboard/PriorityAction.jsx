import { useNavigate } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";

const SCENARIOS = [
  {
    key: "equipe_digital",
    check: ({ subscription }) =>
      subscription?.current_payment_status === "OVERDUE",
    render: () => ({
      icon: "warning",
      title: "Sua Equipe Digital em atraso",
      subtitle: "Regularize para evitar bloqueio do sistema",
      cta: "Regularizar",
      onPress: true,
      colors: { bg: "#fef2f2", border: "#fecaca", button: "#b91c1c" },
    }),
  },
  {
    key: "estoque",
    check: ({ healthResult }) => healthResult?.dimensions?.estoque?.zeroCount > 0,
    render: ({ healthResult }) => {
      const d = healthResult.dimensions.estoque;
      const names = d.zeroNames || "";
      return {
        icon: "inventory_2",
        title: `Reponha ${d.zeroCount} ${d.zeroCount === 1 ? "item zerado" : "itens zerados"}`,
        subtitle: names || "Clientes não conseguem comprar",
        cta: "Repor",
        navigateTo: "/Gestao?tab=estoque",
        colors: { bg: "#fef2f2", border: "#fecaca", button: "#b91c1c" },
      };
    },
  },
  {
    key: "leads",
    check: ({ smartActions }) => smartActions?.some(a => a.type === "responder"),
    render: ({ smartActions }) => {
      const leads = smartActions.filter(a => a.type === "responder");
      const names = leads.slice(0, 2).map(a => a.contact?.nome || a.contact?.telefone).filter(Boolean).join(", ");
      return {
        icon: "chat",
        title: `${leads.length} ${leads.length === 1 ? "cliente aguardando" : "clientes aguardando"} resposta`,
        subtitle: names || "Leads sem retorno há mais de 1 dia",
        cta: "Responder",
        navigateTo: "/MyContacts",
        colors: { bg: "#fff7ed", border: "#fed7aa", button: "#d97706" },
      };
    },
  },
  {
    key: "frete",
    check: ({ coachActions }) => coachActions?.some(a => a.type === "revisar_frete"),
    render: ({ coachActions }) => {
      const action = coachActions.find(a => a.type === "revisar_frete");
      return {
        icon: "local_shipping",
        title: "Frete está perdendo vendas",
        subtitle: action?.message || "Clientes abandonaram no checkout por causa do frete",
        cta: "Revisar",
        navigateTo: "/FranchiseSettings",
        colors: { bg: "#fef2f2", border: "#fecaca", button: "#b91c1c" },
      };
    },
  },
  {
    key: "reposicao",
    check: ({ healthResult }) => healthResult?.dimensions?.reposicao?.daysSince >= 30,
    render: ({ healthResult }) => ({
      icon: "refresh",
      title: `Sem pedido de reposição há ${healthResult.dimensions.reposicao.daysSince} dias`,
      subtitle: "Estoque pode acabar em breve",
      cta: "Pedir",
      navigateTo: "/Gestao?tab=reposicao",
      colors: { bg: "#fefce8", border: "#fde68a", button: "#d97706" },
    }),
  },
  {
    key: "marketing",
    check: ({ marketingPayment }) => !marketingPayment || marketingPayment.status === "rejected",
    render: ({ marketingPayment }) => ({
      icon: "campaign",
      title: marketingPayment?.status === "rejected"
        ? "Pagamento de marketing recusado"
        : "Investimento de marketing pendente",
      subtitle: marketingPayment?.status === "rejected"
        ? marketingPayment.rejection_reason || "Verifique o comprovante"
        : "Mínimo R$ 200",
      cta: "Registrar",
      navigateTo: "/Marketing",
      colors: { bg: "#f0f4ff", border: "#c7d2fe", button: "#4f46e5" },
    }),
  },
  {
    // Robo CONFIGURADO que parou de responder. Vem antes do "ative seu robo" porque a
    // acao e outra: aqui nao se configura nada, se RECONECTA o WhatsApp.
    // Ate 07/09/2026 este caso era invisivel: `botActive` significava "existe linha em
    // franchise_configurations", entao nunca ficava falso e 8 franquias que vendiam com
    // o robo mudo ha 7+ dias viam a faixa verde "Tudo em dia!".
    key: "bot_parado",
    check: ({ botConfigured, botActive, botSilentDays, hasRecentSales }) =>
      botConfigured && !botActive && botSilentDays !== null && hasRecentSales,
    render: ({ botSilentDays }) => ({
      icon: "smart_toy",
      title: botSilentDays >= 1
        ? `Seu robô não responde há ${botSilentDays} ${botSilentDays === 1 ? "dia" : "dias"}`
        : "Seu robô parou de responder",
      subtitle: "Reconecte o WhatsApp — quem chamar não está sendo atendido",
      cta: "Reconectar",
      navigateTo: "/FranchiseSettings",
      colors: { bg: "#fef2f2", border: "#fecaca", button: "#b91c1c" },
    }),
  },
  {
    key: "bot",
    check: ({ botConfigured }) => !botConfigured,
    render: () => ({
      icon: "smart_toy",
      title: "Ative seu Vendedor Digital",
      // o "40% mais" que estava aqui nao tem medicao por tras — trocado pelo que o
      // robo de fato faz (auditoria 07/09/2026).
      subtitle: "Ele responde seus clientes enquanto você produz",
      cta: "Configurar",
      navigateTo: "/FranchiseSettings",
      colors: { bg: "#f8fafc", border: "#cbd5e1", button: "#475569" },
    }),
  },
];

export default function PriorityAction({ healthResult, smartActions, coachActions, marketingPayment, botActive, botConfigured, botSilentDays, hasRecentSales, subscription, onOpenPaymentSheet }) {
  const navigate = useNavigate();

  const ctx = { healthResult, smartActions, coachActions, marketingPayment, botActive, botConfigured, botSilentDays, hasRecentSales, subscription };
  const activeScenario = SCENARIOS.find(s => s.check(ctx));

  if (!activeScenario) {
    // Tudo em dia!
    return (
      <div className="mb-4 flex items-center gap-3 p-3 rounded-xl border"
        style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", borderColor: "#bbf7d0" }}
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#d1fae5" }}>
          <MaterialIcon icon="check_circle" size={20} style={{ color: "#16a34a" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-ink">Tudo em dia!</p>
          <p className="text-[11px] text-ok">Seu negócio está rodando bem. Continue assim!</p>
        </div>
      </div>
    );
  }

  const data = activeScenario.render(ctx);

  return (
    <div
      className="mb-4 flex items-center gap-3 p-3 rounded-xl border"
      style={{ background: `linear-gradient(135deg, ${data.colors.bg}, ${data.colors.bg}ee)`, borderColor: data.colors.border }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${data.colors.border}40` }}
      >
        <MaterialIcon icon={data.icon} size={20} style={{ color: data.colors.button }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-ink leading-snug">{data.title}</p>
        <p className="text-[11px] text-ink-3 mt-0.5 truncate">{data.subtitle}</p>
      </div>
      <button
        onClick={() => data.onPress ? onOpenPaymentSheet?.() : navigate(data.navigateTo)}
        className="px-3 py-1.5 rounded-lg text-white text-xs font-medium shrink-0 active:scale-95 transition-transform"
        style={{ backgroundColor: data.colors.button }}
      >
        {data.cta} →
      </button>
    </div>
  );
}
