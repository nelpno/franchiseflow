// Mural do CS — Onda 2 (redesenho, 26/09/2026). Lista de trabalho do dia do Celso: a
// régua única decide o motivo e a ordem (get_cs_mural), a folha "Registrar" grava
// resultado + combinado + volta num toque só. Sem arrastar (o board antigo tinha 2
// movimentos de arrasto em 3 meses — ver estudo cs-celso/analises/2026-09-26).
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/AuthContext";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import PageHeader, { AcaoPrincipal } from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import { PAGINA_LARGA, CHIP, CHIP_ATIVO, CHIP_INATIVO, H3_CARTAO } from "@/components/shared/adminUi";
import { getCsMural } from "@/entities/csMural";
import { getFranchiseHealthCache } from "@/entities/all";
import { agruparPorRaia, agruparPorMotivo, RAIAS } from "@/lib/csMural";
import { contarFiltros } from "@/lib/networkOverview";
import { useAdminNetworkOverview } from "@/hooks/useAdminNetworkOverview";
import MaterialIcon from "@/components/ui/MaterialIcon";
import MuralCard from "@/components/customer-success/MuralCard";
import QuickAddCard from "@/components/customer-success/QuickAddCard";

// Preferências de tela do Celso (29/09): cartão fechado e coluna Resolvidos recolhida ficam
// lembradas neste aparelho. localStorage pode falhar (aba anônima): aí vale o padrão.
function lerPref(chave, padrao) {
  try { const v = localStorage.getItem(chave); return v === null ? padrao : v === "1"; } catch { return padrao; }
}
function gravarPref(chave, valor) {
  try { localStorage.setItem(chave, valor ? "1" : "0"); } catch { /* sem armazenamento: só nesta visita */ }
}

function Coluna({ titulo, cards, vazioTexto, onMudou, lane, compacto, porMotivo = false, recolhida = false, onRecolher }) {
  if (recolhida) {
    return (
      <button
        type="button"
        onClick={() => onRecolher(false)}
        aria-label={`Mostrar ${titulo}`}
        className="flex w-14 shrink-0 flex-col items-center gap-2 self-start rounded-2xl border border-surface-line bg-white py-4 text-ink-3 hover:bg-surface"
      >
        <MaterialIcon icon="chevron_left" size={20} aria-hidden="true" />
        <span className="text-sm font-semibold [writing-mode:vertical-rl]">{titulo} · {cards.length}</span>
      </button>
    );
  }
  const blocos = porMotivo ? agruparPorMotivo(cards) : [{ motivo: null, label: null, cards }];
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className={H3_CARTAO}>{titulo} <span className="font-semibold text-ink-3">· {cards.length}</span></h2>
        {onRecolher && (
          <button
            type="button"
            onClick={() => onRecolher(true)}
            className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-ink-3 hover:bg-surface"
          >
            Recolher <MaterialIcon icon="chevron_right" size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      {cards.length === 0 ? (
        <div className="rounded-2xl border border-surface-line bg-white px-4 py-6 text-center text-sm text-ink-3">
          {vazioTexto}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {blocos.map((b) => (
            <div key={b.motivo || "todos"} className="flex flex-col gap-2">
              {b.label && (
                <div className="px-1 text-xs font-bold uppercase tracking-wide text-ink-3">{b.label} · {b.cards.length}</div>
              )}
              {b.cards.map((c) => (
                <MuralCard key={c.id} card={c} lane={lane} onMudou={onMudou} compacto={compacto} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// "Por onde começar" (reunião de 29/09): 1) sem venda, 2) sem verba, 3) caiu 20% ou mais.
// Sem verba não é motivo de cartão no Mural: o atalho leva à lista de Unidades já filtrada.
function OrdemDoDia({ contagens }) {
  if (!contagens) return null;
  const passos = [
    { n: 1, rotulo: "Sem venda", filtro: "sem_venda" },
    { n: 2, rotulo: "Sem verba", filtro: "sem_verba" },
    { n: 3, rotulo: "Caiu 20% ou mais", filtro: "caiu" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-surface-line bg-white px-4 py-3">
      <span className="text-sm font-semibold text-ink-2">Por onde começar:</span>
      {passos.map((p) => (
        <Link
          key={p.filtro}
          to={`/Unidades?filtro=${p.filtro}`}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-surface-line bg-surface px-3 text-sm font-semibold text-ink hover:bg-white"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{p.n}</span>
          {p.rotulo} · {contagens[p.filtro] ?? 0}
        </Link>
      ))}
    </div>
  );
}

function BlocoPequeno({ titulo, cards, lane, onMudou, compacto }) {
  if (!cards || cards.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className={H3_CARTAO}>{titulo} <span className="font-normal text-ink-3">· {cards.length}</span></h2>
      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <MuralCard key={c.id} card={c} lane={lane} onMudou={onMudou} compacto={compacto} />
        ))}
      </div>
    </section>
  );
}

const VAZIO_TEXTO = {
  falar_hoje: "Ninguém para falar hoje.",
  esperando: "Ninguém esperando resposta.",
  resolvidos: "Nada resolvido nos últimos 30 dias.",
};

export default function CustomerSuccess() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mural, setMural] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const [franchisesForAdd, setFranchisesForAdd] = useState([]);
  const [compacto, setCompacto] = useState(() => lerPref("cs_mural_compacto", true));
  const [resolvidosRecolhidos, setResolvidosRecolhidos] = useState(() => lerPref("cs_mural_resolvidos_recolhidos", true));
  const mudarCompacto = (v) => { setCompacto(v); gravarPref("cs_mural_compacto", v); };
  const recolherResolvidos = (v) => { setResolvidosRecolhidos(v); gravarPref("cs_mural_resolvidos_recolhidos", v); };
  const { overview } = useAdminNetworkOverview();
  const contagens = overview.length ? contarFiltros(overview) : null;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [m, cache] = await Promise.all([
        getCsMural(),
        getFranchiseHealthCache().catch(() => []),
      ]);
      if (!mountedRef.current) return;
      setMural(m);
      setFranchisesForAdd(
        (cache || [])
          .map((s) => ({ franchise_id: s.franchise_id, franchise_name: s.franchise_name, city: s.city }))
          .sort((a, b) => (a.franchise_name || "").localeCompare(b.franchise_name || ""))
      );
    } catch (e) {
      console.error("[CustomerSuccess] load", e);
      if (mountedRef.current) setError(safeErrorMessage(e, "Não foi possível carregar o mural."));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useVisibilityPolling(load, 300000);

  const reload = useCallback(() => { load(); }, [load]);

  const raia = searchParams.get("raia") || "falar_hoje";
  const setRaia = (k) => {
    const next = new URLSearchParams(searchParams);
    next.set("raia", k);
    setSearchParams(next, { replace: true });
  };

  const grupos = agruparPorRaia(mural?.cards);
  const contagemHoje = mural?.counts?.falar_hoje ?? grupos.falar_hoje.length;

  return (
    <div className={PAGINA_LARGA}>
      <PageHeader
        titulo="Mural do CS"
        subtitulo="A lista de trabalho do dia: fale, registre e o cartão se organiza sozinho."
        situacao={!loading && !error ? `Hoje: ${contagemHoje} para falar` : undefined}
        acao={
          <div className="flex items-center gap-2">
            {user?.role === "admin" && (
              <Link to="/ProgressoCS" className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-dark hover:underline">
                Progresso do CS →
              </Link>
            )}
            <AcaoPrincipal icone="add" rotulo="Novo cartão" onClick={() => setQuickAddOpen(true)} sempreComTexto />
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState texto={error} onTentarNovamente={load} cartao />
      ) : !mural || (mural.cards || []).length === 0 ? (
        <EmptyState icone="task_alt" titulo="Ninguém para falar hoje" texto="Sem cartão aberto no momento." cartao />
      ) : (
        <>
          <OrdemDoDia contagens={contagens} />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => mudarCompacto(!compacto)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-ink-3 hover:bg-surface"
            >
              <MaterialIcon icon={compacto ? "expand_more" : "expand_less"} size={18} aria-hidden="true" />
              {compacto ? "Abrir todos os cartões" : "Fechar todos os cartões"}
            </button>
          </div>
          {/* Celular: uma raia por vez, por chip (?raia=) */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
            {RAIAS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRaia(r.key)}
                className={`${CHIP} ${raia === r.key ? CHIP_ATIVO : CHIP_INATIVO}`}
              >
                {r.label} · {grupos[r.key]?.length ?? 0}
              </button>
            ))}
          </div>
          <div className="lg:hidden">
            <Coluna
              titulo={RAIAS.find((r) => r.key === raia)?.label || ""}
              cards={grupos[raia] || []}
              vazioTexto={VAZIO_TEXTO[raia]}
              onMudou={reload}
              lane={raia}
              compacto={compacto}
              porMotivo={raia === "falar_hoje"}
            />
          </div>

          {/* Desktop: 3 colunas lado a lado */}
          <div className="hidden gap-4 lg:flex">
            <Coluna titulo="Falar hoje" cards={grupos.falar_hoje} vazioTexto={VAZIO_TEXTO.falar_hoje} onMudou={reload} lane="falar_hoje" compacto={compacto} porMotivo />
            <Coluna titulo="Esperando resposta" cards={grupos.esperando} vazioTexto={VAZIO_TEXTO.esperando} onMudou={reload} lane="esperando" compacto={compacto} />
            <Coluna titulo="Resolvidos" cards={grupos.resolvidos} vazioTexto={VAZIO_TEXTO.resolvidos} onMudou={reload} lane="resolvidos" compacto={compacto} recolhida={resolvidosRecolhidos} onRecolher={recolherResolvidos} />
          </div>

          {grupos.resolveu_sozinho.length > 0 && (
            <details className="rounded-2xl border border-surface-line bg-white px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink-3">
                Resolveu sozinho · {grupos.resolveu_sozinho.length}
              </summary>
              <p className="mt-1 text-sm text-ink-3">O motivo sumiu sem ninguém tocar — não conta como trabalho do CS.</p>
              <div className="mt-3 flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                {grupos.resolveu_sozinho.map((c) => (
                  <MuralCard key={c.id} card={c} lane="resolvidos" onMudou={reload} compacto={compacto} />
                ))}
              </div>
            </details>
          )}

          <BlocoPequeno titulo="Com o Nelson" cards={grupos.com_nelson} lane="com_nelson" onMudou={reload} compacto={compacto} />
          <BlocoPequeno titulo="Estacionados" cards={grupos.estacionado} lane="estacionado" onMudou={reload} compacto={compacto} />
        </>
      )}

      <QuickAddCard
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        userId={user?.id}
        franchises={franchisesForAdd}
        onCreated={() => { toast.success("Cartão criado."); reload(); }}
      />
    </div>
  );
}
