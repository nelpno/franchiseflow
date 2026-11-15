// Bloco 2 — "Estado da fila" (get_cs_progresso().fila). Deve chegar a zero em
// "quedas sem cartão" — se não chegar, lista com link para a Ficha (regra do prompt).
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import SectionTitle from "@/components/shared/SectionTitle";
import NadaPendente from "@/components/shared/NadaPendente";
import { CARTAO, LINK_ACAO } from "@/components/shared/adminUi";

// Tokens completos (Tailwind precisa da classe literal, nunca montada por template string).
const TOM_TILE = {
  warn: "bg-warn-soft text-warn-ink",
  err: "bg-err-soft text-err",
  ok: "bg-ok-soft text-ok-ink",
};

function LinhaContagem({ icone, tom, valor, texto }) {
  return (
    <div className={CARTAO}>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TOM_TILE[tom] || TOM_TILE.warn}`}>
          <MaterialIcon icon={icone} size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-plus-jakarta text-2xl font-extrabold tabular-nums text-ink">{valor}</p>
          <p className="text-sm text-ink-2">{texto}</p>
        </div>
      </div>
    </div>
  );
}

export default function EstadoFila({ fila }) {
  const f = fila || {};
  const quedas = Array.isArray(f.quedas_sem_cartao) ? f.quedas_sem_cartao : [];

  return (
    <section aria-labelledby="bloco-fila" className="space-y-3">
      <SectionTitle id="bloco-fila" titulo="Estado da fila" ajuda="Quem está esperando agora" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <LinhaContagem
          icone="schedule"
          tom="warn"
          valor={f.falar_hoje_mais_2_dias ?? 0}
          texto="em Falar hoje há mais de 2 dias"
        />
        <LinhaContagem
          icone="hourglass_empty"
          tom="warn"
          valor={f.esquecidos_7d ?? 0}
          texto="parados há 7+ dias"
        />
        <LinhaContagem
          icone={quedas.length > 0 ? "error" : "check_circle"}
          tom={quedas.length > 0 ? "err" : "ok"}
          valor={quedas.length}
          texto="quedas sem cartão"
        />
      </div>

      {quedas.length === 0 ? (
        <NadaPendente texto="Nenhuma queda grande sem cartão aberto." />
      ) : (
        <div className={CARTAO}>
          <p className="mb-2 text-sm font-semibold text-err">
            {quedas.length === 1 ? "1 queda sem cartão:" : `${quedas.length} quedas sem cartão:`}
          </p>
          <ul className="space-y-2">
            {quedas.map((q) => (
              <li key={q.franchise_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 text-ink">
                  <span className="font-semibold">{q.franchise_name}</span>
                  {q.motivo ? <span className="text-ink-2"> — {q.motivo}</span> : null}
                </span>
                <Link to={`/Unidade?id=${q.franchise_id}`} className={LINK_ACAO}>
                  Abrir ficha →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
