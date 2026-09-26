// "Conversas com a unidade": cartões abertos e resolvidos do Mural do CS para essa
// franquia (unit.cs, de get_unit_360). Ficha da unidade (/Unidade?id=<evo>).
import { Link } from "react-router-dom";
import { dataCurta, diasDesde, haDias } from "@/lib/adminFormat";

// Vocabulário do Mural novo (Fase 3): Falar hoje / Esperando resposta / Resolvidos.
const COLUNA_LABEL = {
  a_fazer: "falar hoje",
  em_andamento: "falar hoje",
  aguardando_retorno: "esperando resposta",
  feito: "resolvido",
};

// Eventos automáticos sem nota não contam como "combinado" com a unidade (item 2, 26/09).
const TIPOS_SEM_RELATO = new Set(["auto_open", "auto_resolve", "resolve"]);

// Últimas notas de verdade (com texto) — usadas na faixa "Último combinado" e na lista.
export function notasRelevantes(cs, max = 5) {
  return (cs?.recent_events || [])
    .filter((e) => e?.note && !TIPOS_SEM_RELATO.has(e.event_type))
    .slice(0, max);
}

export default function ConversasCard({ cs, franchiseId }) {
  const abertos = cs?.open_tasks || [];
  const resolvidos = cs?.resolved_count || 0;
  const linkUnidade = franchiseId ? `/CustomerSuccess?unidade=${encodeURIComponent(franchiseId)}` : "/CustomerSuccess";
  const notas = notasRelevantes(cs);

  return (
    <div className="bg-white rounded-2xl p-5 md:p-6 border border-surface-line flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <h2 className="font-plus-jakarta text-base md:text-lg font-bold text-ink">Conversas com a unidade</h2>
        <Link to={linkUnidade} className="text-sm font-medium text-brand-dark hover:underline">
          Ver no Mural do CS →
        </Link>
      </div>

      {notas.length > 0 && (
        <div className="mb-2">
          <div className="text-xs font-bold text-ink-3 uppercase tracking-wide">Últimas notas</div>
          <ul className="divide-y divide-surface-line">
            {notas.map((e) => (
              <li key={e.id} className="py-2 text-sm text-ink-2">
                <span className="text-ink-3">{dataCurta(e.created_at)}{e.created_by_name ? ` · ${e.created_by_name}` : ""}</span>
                {": "}
                <span className="text-ink">{e.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {abertos.length === 0 && resolvidos === 0 ? (
        <p className="text-sm text-ink-3 py-3">Nenhuma conversa registrada ainda.</p>
      ) : (
        <div className="divide-y divide-surface-line">
          {abertos.map((t) => {
            const dias = diasDesde(t.moved_to_column_at);
            return (
              <div key={t.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3 text-sm">
                <span className="text-ink-3 shrink-0">
                  {dataCurta(t.created_at)}
                </span>
                <span className="min-w-0">
                  <strong className="text-ink">{t.title}</strong>
                  {" · "}{COLUNA_LABEL[t.column_status] || t.column_status}
                  {dias != null && dias >= 3 ? ` ${haDias(dias)}` : ""}
                  {t.assignee_name ? ` · cuidando: ${t.assignee_name}` : " · ninguém cuidando"}
                </span>
                <Link
                  to={`/CustomerSuccess?task=${encodeURIComponent(t.id)}`}
                  className="font-semibold text-brand-dark hover:underline text-right shrink-0"
                >
                  Abrir o cartão →
                </Link>
              </div>
            );
          })}
          {resolvidos > 0 && (
            <div className="py-3 text-sm">
              <Link to={linkUnidade} className="font-semibold text-brand-dark hover:underline">
                Histórico: {resolvidos} {resolvidos === 1 ? "cartão resolvido" : "cartões resolvidos"} →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
