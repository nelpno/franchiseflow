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
import { agruparPorRaia, RAIAS } from "@/lib/csMural";
import MuralCard from "@/components/customer-success/MuralCard";
import QuickAddCard from "@/components/customer-success/QuickAddCard";

function Coluna({ titulo, cards, vazioTexto, onMudou, lane }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <h2 className={H3_CARTAO}>{titulo}</h2>
        <span className="text-sm font-semibold text-ink-3">{cards.length}</span>
      </div>
      {cards.length === 0 ? (
        <div className="rounded-2xl border border-surface-line bg-white px-4 py-6 text-center text-sm text-ink-3">
          {vazioTexto}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((c) => (
            <MuralCard key={c.id} card={c} lane={lane} onMudou={onMudou} />
          ))}
        </div>
      )}
    </div>
  );
}

function BlocoPequeno({ titulo, cards, lane, onMudou }) {
  if (!cards || cards.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className={H3_CARTAO}>{titulo} <span className="font-normal text-ink-3">· {cards.length}</span></h2>
      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <MuralCard key={c.id} card={c} lane={lane} onMudou={onMudou} />
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
            />
          </div>

          {/* Desktop: 3 colunas lado a lado */}
          <div className="hidden gap-4 lg:flex">
            <Coluna titulo="Falar hoje" cards={grupos.falar_hoje} vazioTexto={VAZIO_TEXTO.falar_hoje} onMudou={reload} lane="falar_hoje" />
            <Coluna titulo="Esperando resposta" cards={grupos.esperando} vazioTexto={VAZIO_TEXTO.esperando} onMudou={reload} lane="esperando" />
            <Coluna titulo="Resolvidos" cards={grupos.resolvidos} vazioTexto={VAZIO_TEXTO.resolvidos} onMudou={reload} lane="resolvidos" />
          </div>

          {grupos.resolveu_sozinho.length > 0 && (
            <details className="rounded-2xl border border-surface-line bg-white px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink-3">
                Resolveu sozinho · {grupos.resolveu_sozinho.length}
              </summary>
              <p className="mt-1 text-sm text-ink-3">O motivo sumiu sem ninguém tocar — não conta como trabalho do CS.</p>
              <div className="mt-3 flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                {grupos.resolveu_sozinho.map((c) => (
                  <MuralCard key={c.id} card={c} lane="resolvidos" onMudou={reload} />
                ))}
              </div>
            </details>
          )}

          <BlocoPequeno titulo="Com o Nelson" cards={grupos.com_nelson} lane="com_nelson" onMudou={reload} />
          <BlocoPequeno titulo="Estacionados" cards={grupos.estacionado} lane="estacionado" onMudou={reload} />
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
