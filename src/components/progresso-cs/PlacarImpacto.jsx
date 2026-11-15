// Bloco 5 — "Placar de impacto" (get_cs_impacto). Método da seção 4.3 do estudo:
// episódio × grupo de controle (unidades não tocadas no mesmo período). NUNCA mostra
// "R$ gerados pelo CS" — só "X de N acima do controle" + ressalvas sempre visíveis.
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import SectionTitle from "@/components/shared/SectionTitle";
import EmptyState from "@/components/shared/EmptyState";
import { CARTAO, LISTA, CABECALHO_LISTA, LINK_ACAO } from "@/components/shared/adminUi";
import {
  textoControle,
  poucosCasos, textoPoucosCasos, textoAcimaControle, textoMedianaVsControle,
  textoAntesDepois, textoJaVinha, corVsControle, rotuloTipoImpacto, dataCurta,
  RESSALVAS_PADRAO,
} from "@/lib/csProgresso";

function GrupoCard({ grupo }) {
  const poucos = poucosCasos(grupo?.n);
  return (
    <div className={CARTAO}>
      <p className="font-plus-jakarta text-base font-bold text-ink">{rotuloTipoImpacto(grupo?.tipo)}</p>
      {poucos ? (
        <p className="mt-2 text-sm text-ink-3">{textoPoucosCasos()}</p>
      ) : (
        <>
          <p className="mt-2 font-plus-jakarta text-2xl font-extrabold tabular-nums text-ink">
            {textoAcimaControle(grupo.acima_do_controle, grupo.n)}
          </p>
          <p className={`mt-1 text-sm font-semibold ${corVsControle(grupo.mediana_vs_controle_pct)}`}>
            {textoMedianaVsControle(grupo.mediana_vs_controle_pct)}
          </p>
        </>
      )}
      <p className="mt-1 text-xs text-ink-3">{grupo?.n ?? 0} episódios no período</p>
    </div>
  );
}

// Desktop: grade T2 de 6 colunas. Celular (T9): nome+tipo, o par antes→depois e o
// resultado vs controle (os 2 números que importam), link à direita — o resto (já
// vinha, controle isolado) fica só na versão de mesa.
function LinhaEpisodio({ ep }) {
  return (
    <div className="border-t border-surface-line px-5 py-4 text-sm">
      <div className="hidden md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_6.5rem] md:items-center md:gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{ep.franchise_name}</p>
          <p className="text-sm text-ink-3">
            {rotuloTipoImpacto(ep.tipo)} · {dataCurta(ep.data)}
          </p>
        </div>
        <p className="whitespace-nowrap text-right text-ink-2 tabular-nums">{textoAntesDepois(ep.rev_dia_antes, ep.rev_dia_depois)}</p>
        <p className="text-right text-ink-2">{textoJaVinha(ep.tendencia_antes_pct) || "sem tendência anterior"}</p>
        <p className="text-right tabular-nums text-ink-2">{textoControle(ep.controle_pct) || "—"}</p>
        <p className={`text-right font-semibold tabular-nums ${corVsControle(ep.vs_controle_pct)}`}>
          {textoMedianaVsControle(ep.vs_controle_pct) || "—"}
        </p>
        <Link to={`/Unidade?id=${ep.franchise_id}`} className={`${LINK_ACAO} justify-self-end`}>
          Abrir ficha →
        </Link>
      </div>

      <div className="flex flex-col gap-1 md:hidden">
        <p className="font-semibold text-ink">
          {ep.franchise_name} <span className="font-normal text-ink-3">· {rotuloTipoImpacto(ep.tipo)}</span>
        </p>
        <p className="tabular-nums text-ink-2">{textoAntesDepois(ep.rev_dia_antes, ep.rev_dia_depois)}</p>
        <div className="flex items-center justify-between gap-2">
          <span className={`font-semibold tabular-nums ${corVsControle(ep.vs_controle_pct)}`}>
            {textoMedianaVsControle(ep.vs_controle_pct) || "—"}
          </span>
          <Link to={`/Unidade?id=${ep.franchise_id}`} className={LINK_ACAO}>
            Abrir ficha →
          </Link>
        </div>
      </div>
    </div>
  );
}

function ListaNomes({ titulo, itens, icone, tom }) {
  if (!itens?.length) return null;
  return (
    <div className={CARTAO}>
      <p className={`flex items-center gap-2 text-sm font-semibold ${tom}`}>
        <MaterialIcon icon={icone} size={18} aria-hidden="true" />
        {titulo}
      </p>
      <p className="mt-1 text-sm text-ink-2">
        {itens.map((i) => i.franchise_name).join(", ")}
      </p>
    </div>
  );
}

export default function PlacarImpacto({ impacto }) {
  const grupos = Array.isArray(impacto?.grupos) ? impacto.grupos : [];
  const episodios = Array.isArray(impacto?.episodios) ? impacto.episodios : [];
  const ressalvas = impacto?.ressalvas?.length ? impacto.ressalvas : RESSALVAS_PADRAO;
  const melhoraram = episodios.filter((e) => Number(e.vs_controle_pct) > 0);
  const pioraram = episodios.filter((e) => Number(e.vs_controle_pct) < 0);

  return (
    <section aria-labelledby="bloco-placar" className="space-y-3">
      <SectionTitle
        id="bloco-placar"
        titulo="Placar de impacto"
        ajuda="Unidades acompanhadas × parecidas não acompanhadas, 28 dias antes × depois"
      />

      <div className="rounded-2xl border border-warn/40 bg-warn-soft p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-warn-ink">
          <MaterialIcon icon="warning" size={18} aria-hidden="true" />
          Antes de ler os números
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
          {ressalvas.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      {grupos.length === 0 ? (
        <EmptyState
          icone="query_stats"
          titulo="Sem episódio medível neste período"
          texto="Precisa de contato após 3+ semanas sem falar com a unidade, com 28 dias completos depois."
          cartao
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {grupos.map((g) => (
            <GrupoCard key={g.tipo} grupo={g} />
          ))}
        </div>
      )}

      {episodios.length > 0 && (
        <>
          <div className={LISTA}>
            <div className={`hidden md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_6.5rem] md:gap-4 ${CABECALHO_LISTA}`}>
              <span>Unidade</span>
              <span className="text-right">R$/dia antes → depois</span>
              <span className="text-right">Já vinha</span>
              <span className="text-right">Controle</span>
              <span className="text-right">Resultado</span>
              <span />
            </div>
            {episodios.map((ep) => (
              <LinhaEpisodio key={`${ep.franchise_id}-${ep.data}`} ep={ep} />
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ListaNomes titulo="Melhoraram depois" itens={melhoraram} icone="trending_up" tom="text-ok-ink" />
            <ListaNomes titulo="Pioraram mesmo assim" itens={pioraram} icone="trending_down" tom="text-err" />
          </div>
        </>
      )}
    </section>
  );
}
