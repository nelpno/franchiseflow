// Cabeçalho da Ficha: nome, dono, tempo de rede, tier + navegação para as outras
// telas desta unidade (Cadastro e equipe, Configurar robô, Resultado do mês).
import { Link, useLocation } from "react-router-dom";
import { TIER } from "@/components/customer-success/tierConfig";
import { IDADE_NOVA_DIAS, nomeCurto } from "@/lib/networkOverview";
import { idadeUnidade } from "@/lib/adminFormat";

export default function UnidadeHeader({ unit, diagnostico, podeVerFinanceiro = true, onAssumir, assumindo = false, userId = null }) {
  const location = useLocation();
  // O tier vem do cache de saúde (calculado 1x/dia, às 13:32) — pode estar
  // desatualizado. A régua única (diagnostico.motivo, do MESMO cálculo que Unidades/
  // Hoje usam) é a fonte de verdade: nunca mostrar SAUDÁVEL numa unidade com sem
  // venda, mensalidade vencida ou caindo — mesmo que o cache ainda não tenha rodado
  // de novo (achado ALTO, 26/09: era o caso da Uberlândia).
  const nova = diagnostico?.motivo === "nova";
  const temAlertaReal = diagnostico?.motivo && !nova;
  const tierKey = unit.health?.is_standout ? "standout" : unit.health?.tier;
  const tierCache = tierKey ? TIER[tierKey] : null;
  // Divergência nos DOIS sentidos contra a régua única: cache diz SAUDÁVEL/DESTAQUE
  // com alerta real, ou cache diz ATENÇÃO/CRÍTICO sem nenhum motivo (nem "nova") na
  // régua — os dois casos escondem o selo em vez de contradizer a frase do
  // diagnóstico (achado MÉDIO, 26/09: cache com revenue_drop/stopped_selling/
  // subscription_overdue enquanto a régua não acusava nada).
  const tierDivergente = tierCache && (
    (temAlertaReal && (tierKey === "healthy" || tierKey === "standout")) ||
    (!temAlertaReal && !nova && (tierKey === "attention" || tierKey === "critical"))
  );
  const tier = tierDivergente ? null : tierCache;
  const primeiroAberto = unit.cs?.open_tasks?.[0];
  // Todo cartão nasce com o Celso como responsável (cs_default_assignee): "Assumir" aparece
  // sempre que quem cuida NÃO é quem está olhando (antes só aparecia sem responsável, ou seja,
  // quase nunca). Quem já cuida não vê o botão.
  const souEuQueCuido = !!userId && primeiroAberto?.assignee === userId;
  const stateFicha = { from: location.pathname + location.search, label: `a ficha de ${nomeCurto(unit.franchise_name)}` };
  // Item 4, 26/09: age_days vem de franchises.created_at, que é a data de MIGRAÇÃO pro
  // painel (não de abertura da unidade) — ~39 das 66 caem em março/2026 e mostravam "6
  // meses" mesmo em unidades de anos. Só mostra quando é claramente recente (< 60 dias);
  // acima disso, "na rede há X" nunca aparece (decisão do orquestrador, 26/09).
  const mostrarIdade = unit.age_days != null && unit.age_days < IDADE_NOVA_DIAS;

  return (
    <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-plus-jakarta text-2xl md:text-3xl font-extrabold text-ink">
            {nomeCurto(unit.franchise_name)}
          </h1>
          {nova ? (
            <span className="text-xs font-bold text-brand-dark bg-brand/10 rounded-full px-3 py-1">NOVA NA TRILHA</span>
          ) : tier ? (
            <span className={`text-xs font-bold rounded-full px-3 py-1 border ${tier.chip}`}>
              {tier.dot} {tier.label.toUpperCase()}
            </span>
          ) : temAlertaReal ? (
            <span className="text-xs font-bold rounded-full px-3 py-1 border bg-warn/10 text-warn-ink border-warn/30">
              PRECISA DE ATENÇÃO
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink-2 mt-1.5">
          <span>{unit.owner_name || "—"}</span>
          {mostrarIdade && <span>· na rede há {idadeUnidade(unit.age_days)}</span>}
          <span>· cuidando: {primeiroAberto?.assignee_name || "ninguém"}</span>
          {!souEuQueCuido && (
            <button
              type="button"
              onClick={onAssumir}
              disabled={assumindo}
              className="min-h-10 rounded-lg border border-surface-line px-3 text-sm font-semibold text-brand-dark hover:bg-surface disabled:opacity-60"
            >
              {assumindo ? "Assumindo…" : "Assumir"}
            </button>
          )}
        </div>
      </div>
      {/* Item 30, 26/09: no celular esses 3 links empurravam a ação (diagnóstico/mensagem)
          para baixo — ficam só no desktop aqui; UnidadeNav() reaparece no fim da página
          (só no celular), depois do ConversasCard. */}
      {podeVerFinanceiro && <div className="hidden md:block"><UnidadeNav unit={unit} stateFicha={stateFicha} /></div>}
    </header>
  );
}

// Reusado no fim da página, só no celular (item 30) — mesmos 3 links de UnidadeHeader.
export function UnidadeNav({ unit, stateFicha, className = "flex flex-wrap gap-2" }) {
  const evo = unit.franchise_id;
  return (
    <nav aria-label="Outras telas desta unidade" className={className}>
      <Link
        to={`/Franchises?id=${evo}&openSheet=1`}
        state={stateFicha}
        className="min-h-10 px-3.5 flex items-center rounded-xl border border-surface-line text-sm text-ink-2 hover:bg-surface"
      >
        Cadastro e equipe →
      </Link>
      <Link
        to={`/FranchiseSettings?franchise=${evo}`}
        state={stateFicha}
        className="min-h-10 px-3.5 flex items-center rounded-xl border border-surface-line text-sm text-ink-2 hover:bg-surface"
      >
        Configurar robô →
      </Link>
      <Link
        to={`/Financeiro?tab=porunidade&franchise=${evo}`}
        state={stateFicha}
        className="min-h-10 px-3.5 flex items-center rounded-xl border border-surface-line text-sm text-ink-2 hover:bg-surface"
      >
        Resultado do mês →
      </Link>
    </nav>
  );
}
