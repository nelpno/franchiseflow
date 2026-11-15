import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import TabResultado from "@/components/minha-loja/TabResultado";
import { useAuth } from "@/lib/AuthContext";
import { listarFranquias } from "@/lib/franchisesCache";
import { nomeCurto } from "@/lib/networkOverview";

// A origem veio da Ficha (state.from) quando o caminho é /Unidade — decisão 7 do redesenho.
const vindoDaFicha = (from) => typeof from === "string" && /^\/Unidade(\?|$)/.test(from);

/**
 * Resultado de UMA unidade, igual à tela do franqueado (TabResultado), mas sem os links que
 * levam o admin para telas do franqueado (Gestao/Vendas) — para ele elas redirecionam ao
 * Dashboard (achado "rotas" Onda 1).
 *
 * Carregado sob demanda (React.lazy no Financeiro): o TabResultado arrasta recharts e as
 * consultas da unidade, e o admin só precisa disso quando pede. Entrada pelo deep-link
 * /Financeiro?tab=porunidade&franchise=<evolution_instance_id> (Ficha da unidade, links antigos).
 */
export default function FinanceiroPorUnidade({ franchiseId, initialMonth = null, onChangeFranchise, onVoltar }) {
  const { user } = useAuth();
  const location = useLocation();
  const mountedRef = useRef(true);
  const [franquias, setFranquias] = useState(null);
  const [busca, setBusca] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    listarFranquias()
      .then((l) => {
        if (mountedRef.current) setFranquias(l.filter((f) => f.evolution_instance_id && !f.is_test));
      })
      .catch(() => {
        if (mountedRef.current) setFranquias([]);
      });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const ordenadas = useMemo(
    () => (franquias || []).slice().sort((a, b) => nomeCurto(a.name).localeCompare(nomeCurto(b.name), "pt-BR")),
    [franquias]
  );

  const daFicha = vindoDaFicha(location.state?.from);
  const unidadeAtual = franquias?.find((f) => f.evolution_instance_id === franchiseId) || null;
  const nomeOrigem = unidadeAtual ? nomeCurto(unidadeAtual.name) : location.state?.label || "";

  // #34: select nativo de 66 opções → busca digitável (a lista completa some assim que a
  // pessoa digita 2+ letras do nome ou da cidade).
  const termo = busca.trim().toLowerCase();
  const filtradas = termo.length < 2 ? ordenadas : ordenadas.filter((f) => `${nomeCurto(f.name)} ${f.city || ""}`.toLowerCase().includes(termo));

  const escolher = (f) => {
    setBusca("");
    setBuscaAberta(false);
    onChangeFranchise(f.evolution_instance_id);
  };

  return (
    <div className="space-y-4">
      {daFicha ? (
        <Link
          to={location.state.from}
          className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-brand-dark hover:underline"
        >
          <MaterialIcon icon="arrow_back" size={16} aria-hidden="true" />
          Voltar para a ficha{nomeOrigem ? ` de ${nomeOrigem}` : ""}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onVoltar}
          className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-brand-dark hover:underline"
        >
          <MaterialIcon icon="arrow_back" size={16} aria-hidden="true" />
          Voltar ao fechamento do mês
        </button>
      )}

      <div className="relative">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-line bg-white p-3">
          <MaterialIcon icon="search" size={20} className="shrink-0 text-ink-3" aria-hidden="true" />
          {franquias === null ? (
            <Skeleton className="h-10 flex-1 rounded-xl" />
          ) : (
            <>
              <label htmlFor="fin-unidade" className="sr-only">Buscar unidade</label>
              <input
                id="fin-unidade"
                type="search"
                value={busca || (!buscaAberta && unidadeAtual ? `${nomeCurto(unidadeAtual.name)}${unidadeAtual.city ? ` — ${unidadeAtual.city}` : ""}` : "")}
                onChange={(e) => { setBusca(e.target.value); setBuscaAberta(true); }}
                onFocus={() => setBuscaAberta(true)}
                onBlur={() => setTimeout(() => setBuscaAberta(false), 150)}
                placeholder="Buscar unidade ou cidade…"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-ink-3 placeholder:font-normal"
              />
            </>
          )}
        </div>
        {buscaAberta && franquias !== null && (
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-surface-line bg-white py-1 shadow-lg">
            {filtradas.length === 0 ? (
              <p className="px-4 py-2.5 text-sm text-ink-3">Nenhuma unidade encontrada.</p>
            ) : (
              filtradas.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  // onMouseDown (não onClick): dispara antes do onBlur do input fechar a lista.
                  onMouseDown={() => escolher(f)}
                  className="flex min-h-10 w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-surface"
                >
                  <span className="font-medium text-ink">{nomeCurto(f.name)}</span>
                  {f.city && <span className="shrink-0 text-xs text-ink-3">{f.city}</span>}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {franchiseId ? (
        <TabResultado key={franchiseId} franchiseId={franchiseId} currentUser={user} hideFranchiseeLinks initialMonth={initialMonth} />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-surface-line bg-white px-4 py-12 text-center">
          <MaterialIcon icon="storefront" size={32} className="text-ink-3" aria-hidden="true" />
          <p className="text-sm text-ink-2">
            Escolha uma unidade acima para ver o resultado dela do jeito que o franqueado vê.
          </p>
        </div>
      )}
    </div>
  );
}
