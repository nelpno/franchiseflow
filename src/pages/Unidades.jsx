// Unidades — lista de toda a rede com filtro/busca na URL. Fase 1B do redesenho do
// admin (~/.claude/plans/admin-redesign-2026-09-26.md). Chegada pelo alerta "sem venda"
// já cai filtrada aqui (princípio 2: chegada filtrada + "o que fazer" + "ver todas").
import { useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { useAdminNetworkOverview } from "@/hooks/useAdminNetworkOverview";
import {
  aplicarFiltro,
  buscar,
  contarFiltros,
  direcaoPadraoOrdem,
  isFiltroValido,
  isOrdemValida,
  ordenarPor,
  rotuloMesVerba,
} from "@/lib/networkOverview";
import ArrivalBanner from "@/components/unidades/ArrivalBanner";
import FiltroChips from "@/components/unidades/FiltroChips";
import OrdenarBotao from "@/components/unidades/OrdenarBotao";
import OrdenarSeletor from "@/components/unidades/OrdenarSeletor";
import UnidadeRow from "@/components/unidades/UnidadeRow";
import { GRID_COLS, rotuloColunaFaturamentoCurto } from "@/components/unidades/unidadeDisplay";
import PageHeader, { AcaoPrincipal, BuscaCabecalho } from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import { CABECALHO_LISTA, LISTA, PAGINA } from "@/components/shared/adminUi";

export default function Unidades() {
  const { user } = useAuth();
  // CS vê a lista, mas o cadastro (Franchises) é só admin/gerente: sem botão que devolve para Hoje
  const podeCriar = user?.role === "admin" || user?.role === "manager";
  const location = useLocation();
  const veioDeHoje = location.state?.from === "hoje";
  const [searchParams, setSearchParams] = useSearchParams();
  // Mesma consulta e cache da Hoje (react-query, queryKey ['admin-overview']) — trocar
  // de tela não rebaixa os ~50 KB de novo.
  const { overview: rows, isLoading: loading, error: loadError, refetch } = useAdminNetworkOverview();
  const error = loadError ? safeErrorMessage(loadError, "Não foi possível carregar as unidades.") : null;

  const filtroParam = searchParams.get("filtro");
  const filtro = isFiltroValido(filtroParam) ? filtroParam : "todas";
  const termo = searchParams.get("q") || "";

  // Ordem explícita do usuário (clique no cabeçalho / seletor do celular). Sem escolha,
  // `ordem` fica null e a lista mantém a ordem PADRÃO do filtro atual (aplicarFiltro já
  // ordena: quem mais vendia primeiro em sem_venda/robo_parado etc.) — pedido do Nelson.
  const ordemParam = searchParams.get("ordem");
  const ordem = isOrdemValida(ordemParam) ? ordemParam : null;
  const dirParam = searchParams.get("dir");
  const direcao = ordem ? (dirParam === "asc" || dirParam === "desc" ? dirParam : direcaoPadraoOrdem(ordem)) : null;

  const contagens = useMemo(() => contarFiltros(rows), [rows]);
  const filtradas = useMemo(() => aplicarFiltro(rows, filtro), [rows, filtro]);
  const buscadas = useMemo(() => buscar(filtradas, termo), [filtradas, termo]);
  const visiveis = useMemo(
    () => (ordem ? ordenarPor(buscadas, ordem, direcao, filtro) : buscadas),
    [buscadas, ordem, direcao, filtro]
  );

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

  // Cabeçalho clicável (desktop) e seletor "Ordenar por" (celular) chamam isto. Mesma
  // coluna de novo → inverte; coluna diferente → entra com a direção padrão dela;
  // null (opção "Padrão" do seletor) → limpa e volta pra ordem própria do filtro.
  const irParaOrdem = (chave) => {
    const next = new URLSearchParams(searchParams);
    if (!chave) {
      next.delete("ordem");
      next.delete("dir");
    } else if (ordem === chave) {
      next.set("ordem", chave);
      next.set("dir", direcao === "asc" ? "desc" : "asc");
    } else {
      next.set("ordem", chave);
      next.set("dir", direcaoPadraoOrdem(chave));
    }
    setSearchParams(next, { replace: true });
  };

  const inverterOrdem = () => {
    if (!ordem) return;
    const next = new URLSearchParams(searchParams);
    next.set("dir", direcao === "asc" ? "desc" : "asc");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className={PAGINA}>
      <PageHeader
        voltar={veioDeHoje ? { to: createPageUrl("Dashboard"), label: "Hoje" } : undefined}
        titulo="Unidades"
        acao={
          <>
            <BuscaCabecalho
              id="busca-unidades"
              value={termo}
              onChange={irParaBusca}
              placeholder="Buscar unidade ou pessoa"
              rotulo="Buscar unidade, franqueado ou cidade"
            />
            {podeCriar && <AcaoPrincipal icone="add" rotulo="Nova unidade" to={`${createPageUrl("Franchises")}?novo=1`} />}
          </>
        }
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-md rounded-full motion-reduce:animate-none" />
          <Skeleton className="h-96 rounded-2xl motion-reduce:animate-none" />
        </div>
      ) : error ? (
        <ErrorState texto={error} onTentarNovamente={() => refetch()} cartao />
      ) : (
        <>
          <ArrivalBanner filtroKey={filtro} rows={filtradas} total={rows.length} onVerTodas={() => irParaFiltro("todas")} />

          <FiltroChips contagens={contagens} ativo={filtro} onSelect={irParaFiltro} rows={rows} />

          {filtradas.length > 0 && (
            <OrdenarSeletor ordem={ordem} direcao={direcao || "desc"} onEscolher={irParaOrdem} onInverter={inverterOrdem} />
          )}

          <div className={LISTA}>
            {filtradas.length === 0 ? (
              <EmptyState icone="check_circle" titulo="Nenhuma unidade aqui agora. Bom sinal." />
            ) : visiveis.length === 0 ? (
              <EmptyState
                icone="search_off"
                titulo={`Nenhum resultado para "${termo}"`}
                acao={{ rotulo: "Limpar busca", onClick: () => irParaBusca("") }}
              />
            ) : (
              <>
                <div className={`hidden ${GRID_COLS} gap-3 border-b border-surface-line md:grid ${CABECALHO_LISTA}`}>
                  <OrdenarBotao chave="unidade" rotulo="Unidade" ativo={ordem === "unidade"} direcao={direcao} onClick={irParaOrdem} />
                  <div className="flex flex-col items-start gap-0.5">
                    <OrdenarBotao
                      chave="faturamento"
                      rotulo={rotuloColunaFaturamentoCurto(filtro)}
                      ativo={ordem === "faturamento"}
                      direcao={direcao}
                      onClick={irParaOrdem}
                    />
                    <OrdenarBotao
                      chave="variacao"
                      rotulo="Variação"
                      ativo={ordem === "variacao"}
                      direcao={direcao}
                      onClick={irParaOrdem}
                      pequeno
                      className="text-ink-3"
                    />
                  </div>
                  <OrdenarBotao chave="sem_venda" rotulo="Sem venda há" ativo={ordem === "sem_venda"} direcao={direcao} onClick={irParaOrdem} />
                  <OrdenarBotao chave="robo" rotulo="Robô" ativo={ordem === "robo"} direcao={direcao} onClick={irParaOrdem} />
                  <OrdenarBotao chave="ultimo_pedido" rotulo="Últ. pedido" ativo={ordem === "ultimo_pedido"} direcao={direcao} onClick={irParaOrdem} />
                  <OrdenarBotao
                    chave="verba"
                    rotulo={`Verba${rotuloMesVerba(rows) ? ` de ${rotuloMesVerba(rows)}` : ""}`}
                    ativo={ordem === "verba"}
                    direcao={direcao}
                    onClick={irParaOrdem}
                  />
                  <span aria-hidden="true" />
                </div>
                <div className="divide-y divide-surface-line">
                  {visiveis.map((row) => (
                    <UnidadeRow key={row.franchise_id} row={row} filtro={filtro} />
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
