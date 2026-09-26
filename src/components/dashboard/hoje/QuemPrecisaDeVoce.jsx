import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { FILTROS, aplicarFiltro, contarFiltros, nomeCurto, nomesResumo, roboParadoDias, semVenda, semVendaDias } from "@/lib/networkOverview";
import { CARTAO, CARTAO_CLICAVEL, H2 } from "@/components/shared/adminUi";

// Estilo por filtro — só tokens do design system (brand/warn/ok), sem hex fora da paleta.
const ESTILO = {
  sem_venda: { icon: "warning", iconBg: "bg-brand-soft", iconColor: "text-brand" },
  robo_parado: { icon: "smart_toy", iconBg: "bg-brand-soft", iconColor: "text-brand" },
  caiu: { icon: "trending_down", iconBg: "bg-warn-soft", iconColor: "text-warn-ink" },
  novas: { icon: "rocket_launch", iconBg: "bg-brand-soft", iconColor: "text-brand" },
  subiu: { icon: "trending_up", iconBg: "bg-ok-soft", iconColor: "text-ok-ink" },
};

// Título e primeira frase curtos SÓ para as linhas pequenas (novas/subiu) — o `f.titulo`/
// `f.oQueFazer` de FILTROS é o texto completo usado no chip e no cabeçalho de Unidades,
// e aqui cortava com "..." no celular (item 17).
const CURTO = {
  novas: { titulo: (n) => `${n} ${n === 1 ? "nova" : "novas"} na trilha`, subtitulo: "Veja em que passo parou" },
  subiu: { titulo: (n) => `${n} ${n === 1 ? "subiu" : "subiram"} 20%+`, subtitulo: "Dê os parabéns" },
};

// "Vila dos Remédios (25 dias), Itatiba (30), Piratininga (27) e mais 2" (pedido da Fase 1).
// `dias` escolhe QUAL contador mostrar: sem_venda usa dias desde a última venda,
// robo_parado usa dias desde a última conversa com o robô (achado 26/09 — antes as
// duas linhas mostravam semVendaDias, e "robô parado" saía com "(0 dias)").
function nomesComDias(rows, max = 5, dias = semVendaDias) {
  const nomes = rows.map((r) => {
    const d = dias(r);
    const nome = nomeCurto(r.franchise_name);
    return d === null ? nome : `${nome} (${d} dias)`;
  });
  if (nomes.length <= max) return nomes.join(", ");
  return `${nomes.slice(0, max).join(", ")} e mais ${nomes.length - max}`;
}

function LinhaGrande({ chave, rows, titulo, detalhe, cta }) {
  const estilo = ESTILO[chave];
  const n = rows.length;
  if (n === 0) return null;

  return (
    <Link
      to={`/Unidades?filtro=${chave}`}
      state={{ from: "hoje" }}
      className={`flex flex-col gap-3 md:flex-row md:items-center md:gap-5 ${CARTAO_CLICAVEL}`}
    >
      <div className="flex items-start gap-4 min-w-0 md:flex-1">
        <div className={`w-11 h-11 rounded-xl ${estilo.iconBg} ${estilo.iconColor} flex items-center justify-center shrink-0`}>
          <MaterialIcon icon={estilo.icon} size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-ink">{titulo}</p>
          <p className="text-sm text-ink-2 mt-0.5">{detalhe}</p>
        </div>
      </div>
      {/* B6: link sempre à direita no desktop, mesmo quando o texto da esquerda é curto. */}
      <span className="text-sm font-semibold text-brand-dark whitespace-nowrap shrink-0 pl-[60px] md:pl-0 md:ml-auto">
        {cta ? cta(n) : `Ver ${n === 1 ? "a unidade" : `as ${n}`} e o que fazer →`}
      </span>
    </Link>
  );
}

function LinhaPequena({ chave, rows }) {
  const estilo = ESTILO[chave];
  const curto = CURTO[chave];
  const n = rows.length;
  if (n === 0) return null;

  return (
    <Link
      to={`/Unidades?filtro=${chave}`}
      state={{ from: "hoje" }}
      className={`flex items-center gap-3 min-w-0 ${CARTAO_CLICAVEL}`}
    >
      <div className={`w-10 h-10 rounded-xl ${estilo.iconBg} ${estilo.iconColor} flex items-center justify-center shrink-0`}>
        <MaterialIcon icon={estilo.icon} size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink">{curto.titulo(n)}</p>
        <p className="text-xs text-ink-2 line-clamp-2">{curto.subtitulo}</p>
      </div>
      <span className="text-sm font-semibold text-brand-dark whitespace-nowrap shrink-0 md:ml-auto">
        Ver →
      </span>
    </Link>
  );
}

export default function QuemPrecisaDeVoce({ overview }) {
  const contagem = contarFiltros(overview);
  // Robô parado, mas só quem realmente vende sem o robô (item 11): quem já está em
  // "sem venda" não conta de novo aqui — senão a mesma unidade infla as duas linhas.
  const roboParadoVendendo = aplicarFiltro(overview, "robo_parado").filter((r) => !semVenda(r));
  const total = contagem.sem_venda + roboParadoVendendo.length + contagem.caiu + contagem.novas + contagem.subiu;

  if (total === 0) {
    return (
      <section aria-label="Quem precisa de você" className="flex flex-col gap-3">
        <h2 className={H2}>Quem precisa de você</h2>
        <div className={`flex items-center gap-3 ${CARTAO} text-ink-2`}>
          <MaterialIcon icon="check_circle" size={22} className="text-ok-ink shrink-0" />
          Tudo tranquilo por aqui hoje — nenhuma unidade pedindo atenção.
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Quem precisa de você" className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className={H2}>Quem precisa de você</h2>
        <span className="text-sm text-ink-3">Cada linha abre a lista já filtrada e diz o que fazer.</span>
      </div>

      <LinhaGrande
        chave="sem_venda"
        rows={aplicarFiltro(overview, "sem_venda")}
        titulo={FILTROS.sem_venda.titulo(contagem.sem_venda)}
        detalhe={nomesComDias(aplicarFiltro(overview, "sem_venda"))}
      />
      <LinhaGrande
        chave="robo_parado"
        rows={roboParadoVendendo}
        titulo={`${roboParadoVendendo.length} ${roboParadoVendendo.length === 1 ? "unidade" : "unidades"} vendendo, mas com o robô parado`}
        detalhe={nomesComDias(roboParadoVendendo, 5, roboParadoDias)}
        cta={(n) => `Ver ${n === 1 ? "a unidade" : `as ${n}`} e conferir o WhatsApp →`}
      />
      <LinhaGrande
        chave="caiu"
        rows={aplicarFiltro(overview, "caiu")}
        titulo={FILTROS.caiu.titulo(contagem.caiu)}
        detalhe={nomesResumo(aplicarFiltro(overview, "caiu"), 5)}
      />

      {(contagem.novas > 0 || contagem.subiu > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LinhaPequena chave="novas" rows={aplicarFiltro(overview, "novas")} />
          <LinhaPequena chave="subiu" rows={aplicarFiltro(overview, "subiu")} />
        </div>
      )}
    </section>
  );
}
