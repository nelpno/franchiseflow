import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { FILTROS, aplicarFiltro, contarFiltros, nomeCurto, nomesResumo, semVendaDias } from "@/lib/networkOverview";

// Estilo por filtro — só tokens do design system (brand/warn/ok), sem hex fora da paleta.
const ESTILO = {
  sem_venda: { icon: "warning", iconBg: "bg-brand-soft", iconColor: "text-brand" },
  robo_parado: { icon: "smart_toy", iconBg: "bg-brand-soft", iconColor: "text-brand" },
  caiu: { icon: "trending_down", iconBg: "bg-warn-soft", iconColor: "text-warn-ink" },
  novas: { icon: "rocket_launch", iconBg: "bg-brand-soft", iconColor: "text-brand" },
  subiu: { icon: "trending_up", iconBg: "bg-ok-soft", iconColor: "text-ok-ink" },
};

// "Vila dos Remédios (25 dias), Itatiba (30), Piratininga (27) e mais 2" — só sem_venda
// leva o contador de dias por unidade (pedido explícito da Fase 1).
function nomesComDias(rows, max = 5) {
  const nomes = rows.map((r) => {
    const d = semVendaDias(r);
    const nome = nomeCurto(r.franchise_name);
    return d === null ? nome : `${nome} (${d} dias)`;
  });
  if (nomes.length <= max) return nomes.join(", ");
  return `${nomes.slice(0, max).join(", ")} e mais ${nomes.length - max}`;
}

function LinhaGrande({ chave, rows }) {
  const f = FILTROS[chave];
  const estilo = ESTILO[chave];
  const n = rows.length;
  if (n === 0) return null;
  const detalhe = chave === "sem_venda" ? nomesComDias(rows) : nomesResumo(rows, 5);

  return (
    <Link
      to={`/Unidades?filtro=${chave}`}
      className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5 p-4 md:py-[18px] md:px-6 bg-white border border-ink-shadow/10 rounded-2xl hover:bg-surface transition-colors"
    >
      <div className="flex items-start gap-4 min-w-0">
        <div className={`w-11 h-11 rounded-xl ${estilo.iconBg} ${estilo.iconColor} flex items-center justify-center shrink-0`}>
          <MaterialIcon icon={estilo.icon} size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-ink">{f.titulo(n)}</p>
          <p className="text-sm text-ink-2 mt-0.5 md:truncate">{detalhe}</p>
        </div>
      </div>
      <span className="text-sm font-semibold text-brand-dark whitespace-nowrap md:shrink-0 pl-[60px] md:pl-0">
        Ver {n === 1 ? "a unidade" : `as ${n}`} e o que fazer →
      </span>
    </Link>
  );
}

function LinhaPequena({ chave, rows }) {
  const f = FILTROS[chave];
  const estilo = ESTILO[chave];
  const n = rows.length;
  if (n === 0) return null;

  return (
    <Link
      to={`/Unidades?filtro=${chave}`}
      className="flex items-center gap-3 p-4 bg-white border border-ink-shadow/10 rounded-2xl hover:bg-surface transition-colors min-w-0"
    >
      <div className={`w-10 h-10 rounded-xl ${estilo.iconBg} ${estilo.iconColor} flex items-center justify-center shrink-0`}>
        <MaterialIcon icon={estilo.icon} size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink truncate">{f.titulo(n)}</p>
        <p className="text-xs text-ink-2 truncate">{f.oQueFazer.split(".")[0]}</p>
      </div>
      <span className="text-sm font-semibold text-brand-dark whitespace-nowrap shrink-0">
        Ver {n === 1 ? "" : `as ${n}`} →
      </span>
    </Link>
  );
}

export default function QuemPrecisaDeVoce({ overview }) {
  const contagem = contarFiltros(overview);
  const total = contagem.sem_venda + contagem.robo_parado + contagem.caiu + contagem.novas + contagem.subiu;

  if (total === 0) {
    return (
      <section aria-label="Quem precisa de você" className="flex flex-col gap-3">
        <h2 className="font-plus-jakarta text-xl font-bold text-ink">Quem precisa de você</h2>
        <div className="flex items-center gap-3 p-5 bg-white border border-ink-shadow/10 rounded-2xl text-ink-2">
          <MaterialIcon icon="check_circle" size={22} className="text-ok-ink shrink-0" />
          Tudo tranquilo por aqui hoje — nenhuma unidade pedindo atenção.
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Quem precisa de você" className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="font-plus-jakarta text-xl font-bold text-ink">Quem precisa de você</h2>
        <span className="text-sm text-ink-3">Cada linha abre a lista já filtrada e diz o que fazer.</span>
      </div>

      <LinhaGrande chave="sem_venda" rows={aplicarFiltro(overview, "sem_venda")} />
      <LinhaGrande chave="robo_parado" rows={aplicarFiltro(overview, "robo_parado")} />
      <LinhaGrande chave="caiu" rows={aplicarFiltro(overview, "caiu")} />

      {(contagem.novas > 0 || contagem.subiu > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LinhaPequena chave="novas" rows={aplicarFiltro(overview, "novas")} />
          <LinhaPequena chave="subiu" rows={aplicarFiltro(overview, "subiu")} />
        </div>
      )}
    </section>
  );
}
