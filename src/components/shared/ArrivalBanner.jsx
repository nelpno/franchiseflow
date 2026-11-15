// Faixa "Você veio de X" (regras V1..V6 do padrão). Uma só para todas as telas que abrem
// filtradas vindo de outra (Hoje → Unidades, Fechamento → Mensalidades, Hoje → Pedidos…).
//
// Genérica:
//   <ArrivalBanner
//     origem="Mensalidades vencidas"      // o que filtrou (linha 1, caixa alta)
//     quantidade={3}                      // opcional: "· 3 unidades"
//     unidade={["mensalidade", "mensalidades"]}  // opcional: singular/plural (padrão unidade/unidades)
//     oQueFazer="Cobre a mais antiga primeiro."  // uma frase com verbo (linha 2)
//     repare="Uberlândia está vencida há 52 dias."  // opcional: nomeia unidades e mês (V5)
//     saida={{ rotulo: "Ver todas as 66", onClick }}  // botão B3 (V6); aceita { to, state } no lugar de onClick
//   />
//
// Da tela Unidades (filtro de networkOverview.FILTROS):
//   <ArrivalBannerFiltro filtroKey="sem_venda" rows={filtradas} total={rows.length} onVerTodas={…} />
import { Link } from "react-router-dom";
import { FILTROS, nomesResumo, rotuloMesVerba, semVerba } from "@/lib/networkOverview";
import { BTN_CONTORNO_MARCA } from "./adminUi";

export default function ArrivalBanner({ origem, quantidade, unidade = ["unidade", "unidades"], oQueFazer, repare, saida, className = "" }) {
  const temQtd = Number.isFinite(quantidade);
  return (
    <section
      aria-label="Por que você está aqui"
      className={`flex flex-col gap-3 rounded-2xl bg-brand-soft p-5 sm:flex-row sm:items-start sm:gap-5 ${className}`}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-dark">
          Você veio de: {origem}
          {temQtd && ` · ${quantidade} ${quantidade === 1 ? unidade[0] : unidade[1]}`}
        </p>
        {oQueFazer && (
          <p className="text-base leading-snug text-ink">
            <strong>O que fazer:</strong> {oQueFazer}
          </p>
        )}
        {repare && <p className="text-sm text-ink-2">Repare: {repare}</p>}
      </div>
      {saida &&
        (saida.to ? (
          <Link to={saida.to} state={saida.state} className={`${BTN_CONTORNO_MARCA} shrink-0 self-start`}>
            {saida.rotulo}
          </Link>
        ) : (
          <button type="button" onClick={saida.onClick} className={`${BTN_CONTORNO_MARCA} shrink-0 self-start`}>
            {saida.rotulo}
          </button>
        ))}
    </section>
  );
}

// Filtros em que vale lembrar da verba: sem verba o anúncio para, e com ele o robô.
const MOSTRA_REPARE = new Set(["sem_venda", "robo_parado", "caiu"]);

// "Itatiba, Piratininga e Uberlândia também não pagaram a verba de setembro. …" (V5)
export function repareSemVerba(rows) {
  const sem = (rows || []).filter(semVerba);
  if (sem.length === 0) return null;
  const mes = rotuloMesVerba(rows);
  const verbo = sem.length === 1 ? "também não pagou" : "também não pagaram";
  return `${nomesResumo(sem, 3)} ${verbo} a verba${mes ? ` de ${mes}` : " do mês"}. Sem verba o anúncio para, e com ele o robô.`;
}

export function ArrivalBannerFiltro({ filtroKey, rows = [], total, onVerTodas }) {
  const f = FILTROS[filtroKey];
  if (!f || filtroKey === "todas") return null;
  return (
    <ArrivalBanner
      origem={f.chip}
      quantidade={rows.length}
      oQueFazer={f.oQueFazer}
      repare={MOSTRA_REPARE.has(filtroKey) ? repareSemVerba(rows) : null}
      saida={{ rotulo: `Ver todas as ${total}`, onClick: onVerTodas }}
    />
  );
}
