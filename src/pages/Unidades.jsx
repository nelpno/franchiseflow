// Unidades — lista de toda a rede com filtro/busca na URL. Fase 1B do redesenho do
// admin (~/.claude/plans/admin-redesign-2026-09-26.md). Chegada pelo alerta "sem venda"
// já cai filtrada aqui (princípio 2: chegada filtrada + "o que fazer" + "ver todas").
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminNetworkOverview, getCsFranchiseContacts } from "@/entities/all";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { aplicarFiltro, buscar, contarFiltros, isFiltroValido } from "@/lib/networkOverview";
import ArrivalBanner from "@/components/unidades/ArrivalBanner";
import FiltroChips from "@/components/unidades/FiltroChips";
import UnidadeRow from "@/components/unidades/UnidadeRow";
import { GRID_COLS } from "@/components/unidades/unidadeDisplay";

export default function Unidades() {
  const { user } = useAuth();
  // CS vê a lista, mas o cadastro (Franchises) é só admin/gerente: sem botão que devolve para Hoje
  const podeCriar = user?.role === "admin" || user?.role === "manager";
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [contatosPorFid, setContatosPorFid] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const filtroParam = searchParams.get("filtro");
  const filtro = isFiltroValido(filtroParam) ? filtroParam : "todas";
  const termo = searchParams.get("q") || "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overview, contatos] = await Promise.all([
        getAdminNetworkOverview(),
        getCsFranchiseContacts().catch(() => []),
      ]);
      if (!mountedRef.current) return;
      setRows(overview || []);
      setContatosPorFid(Object.fromEntries((contatos || []).map((c) => [c.franchise_id, c])));
    } catch (e) {
      if (mountedRef.current) setError(safeErrorMessage(e, "Não foi possível carregar as unidades."));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const contagens = useMemo(() => contarFiltros(rows), [rows]);
  const filtradas = useMemo(() => aplicarFiltro(rows, filtro), [rows, filtro]);
  const visiveis = useMemo(() => buscar(filtradas, termo), [filtradas, termo]);

  const irParaFiltro = (k) => {
    const next = new URLSearchParams(searchParams);
    if (k === "todas") next.delete("filtro");
    else next.set("filtro", k);
    setSearchParams(next, { replace: true });
  };

  const irParaBusca = (v) => {
    const next = new URLSearchParams(searchParams);
    if (v) next.set("q", v);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {filtro !== "todas" && (
            <Link to={createPageUrl("Dashboard")} className="text-sm font-medium text-brand-dark hover:underline">
              ← Voltar para Hoje
            </Link>
          )}
          <h1 className="font-plus-jakarta text-2xl font-extrabold text-ink sm:text-3xl">Unidades</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <label htmlFor="busca-unidades" className="sr-only">
              Buscar unidade, franqueado ou cidade
            </label>
            <MaterialIcon
              icon="search"
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              id="busca-unidades"
              type="text"
              value={termo}
              onChange={(e) => irParaBusca(e.target.value)}
              placeholder="Buscar unidade, franqueado ou cidade"
              className="h-11 w-full min-w-0 rounded-xl border border-surface-line bg-white pl-9 pr-3 text-sm text-ink focus:border-brand focus:outline-none sm:w-72"
            />
          </div>
          {podeCriar && (
          <Link
            to={`${createPageUrl("Franchises")}?novo=1`}
            className="inline-flex h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-surface-line bg-white px-4 text-sm font-semibold text-ink-2 hover:bg-surface"
          >
            <MaterialIcon icon="add" size={18} aria-hidden="true" /> Nova unidade
          </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-md rounded-full motion-reduce:animate-none" />
          <Skeleton className="h-96 rounded-2xl motion-reduce:animate-none" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-xl border border-surface-line bg-white p-5">
          <MaterialIcon icon="cloud_off" size={24} className="shrink-0 text-ink-3" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-ink-2">{error}</p>
          <button type="button" onClick={load} className="min-h-10 shrink-0 px-2 text-sm font-semibold text-brand-dark">
            Tentar de novo
          </button>
        </div>
      ) : (
        <>
          <ArrivalBanner filtroKey={filtro} rows={filtradas} total={rows.length} onVerTodas={() => irParaFiltro("todas")} />

          <FiltroChips contagens={contagens} ativo={filtro} onSelect={irParaFiltro} />

          <div className="overflow-hidden rounded-2xl border border-surface-line bg-white">
            {filtradas.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                <MaterialIcon icon="check_circle" size={32} className="text-ok" aria-hidden="true" />
                <p className="text-base font-semibold text-ink">Nenhuma unidade aqui agora. Bom sinal.</p>
              </div>
            ) : visiveis.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                <MaterialIcon icon="search_off" size={32} className="text-ink-3" aria-hidden="true" />
                <p className="text-base font-semibold text-ink">Nenhum resultado para &quot;{termo}&quot;</p>
                <button type="button" onClick={() => irParaBusca("")} className="text-sm font-semibold text-brand-dark">
                  Limpar busca
                </button>
              </div>
            ) : (
              <>
                <div
                  className={`hidden ${GRID_COLS} gap-3 border-b border-surface-line bg-surface-2 px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-ink-3 md:grid`}
                >
                  <span>Unidade</span>
                  <span>Faturamento no mês</span>
                  <span>Sem venda há</span>
                  <span>Robô</span>
                  <span>Último pedido à fábrica</span>
                  <span>Verba do mês</span>
                  <span aria-hidden="true" />
                </div>
                <div className="divide-y divide-surface-line">
                  {visiveis.map((row) => (
                    <UnidadeRow key={row.franchise_id} row={row} contato={contatosPorFid[row.franchise_id]} />
                  ))}
                </div>
              </>
            )}
          </div>

          <p className="px-1 text-xs text-ink-3">
            Unidades com menos de 60 dias ficam em &quot;Novas na trilha&quot;.
          </p>
        </>
      )}
    </div>
  );
}
