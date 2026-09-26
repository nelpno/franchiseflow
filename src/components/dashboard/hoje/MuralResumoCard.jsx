import { Link } from "react-router-dom";
import { differenceInCalendarDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";

const DIAS_ESPERANDO = 7;
const DIAS_RESOLVIDAS = 30;

// mural = { isLoading, error, tasks } — tasks vem de getCsTasks() (colunas reais:
// column_status, moved_to_column_at, assignee; ver src/components/customer-success/tierConfig.js
// para os valores de column_status: a_fazer, em_andamento, aguardando_retorno, feito).
// `assignee` entrou 26/09 (item 35): sem ele o Nelson via só o total e quem espera, nunca
// se o CS está resolvendo de fato.
export default function MuralResumoCard({ mural }) {
  if (mural.isLoading) return <Skeleton className="h-[76px] rounded-2xl" />;

  // Erro é silencioso aqui: o mural tem tela própria, não vale travar "Hoje" por isso.
  if (mural.error) return null;

  const abertas = mural.tasks.filter((t) => t.column_status !== "feito" && t.franchise_id);
  const unidadesEmAcompanhamento = new Set(abertas.map((t) => t.franchise_id)).size;
  if (unidadesEmAcompanhamento === 0) return null;

  const esperando7d = mural.tasks.filter(
    (t) => t.column_status === "aguardando_retorno" && differenceInCalendarDays(new Date(), new Date(t.moved_to_column_at)) >= DIAS_ESPERANDO
  ).length;
  const feitos30d = mural.tasks.filter(
    (t) => t.column_status === "feito" && differenceInCalendarDays(new Date(), new Date(t.moved_to_column_at)) <= DIAS_RESOLVIDAS
  ).length;
  const semResponsavel = abertas.filter((t) => !t.assignee).length;

  const partes = [
    esperando7d > 0 ? `${esperando7d} ${esperando7d === 1 ? "espera" : "esperam"} resposta há ${DIAS_ESPERANDO}+ dias` : null,
    `${feitos30d} ${feitos30d === 1 ? "resolvida" : "resolvidas"} em ${DIAS_RESOLVIDAS} dias`,
    semResponsavel > 0 ? `${semResponsavel} sem responsável` : null,
  ].filter(Boolean);

  return (
    <Link
      to="/CustomerSuccess"
      className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5 p-4 md:py-[18px] md:px-6 bg-brand-gold-soft border border-brand-gold-line rounded-2xl hover:brightness-[0.99] transition-all"
    >
      <div className="flex items-start gap-4 min-w-0 md:flex-1">
        <div className="w-11 h-11 rounded-xl bg-white text-brand-gold-ink flex items-center justify-center shrink-0">
          <MaterialIcon icon="view_kanban" size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-ink">
            Mural do CS: {unidadesEmAcompanhamento} {unidadesEmAcompanhamento === 1 ? "unidade" : "unidades"} em acompanhamento
          </p>
          {partes.length > 0 && <p className="text-sm text-ink-2 mt-0.5">{partes.join(" · ")}</p>}
        </div>
      </div>
      <span className="text-sm font-semibold text-brand-dark whitespace-nowrap md:shrink-0 pl-[60px] md:pl-0 md:ml-auto">
        Abrir o mural →
      </span>
    </Link>
  );
}
