import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { getFinanceiroRede } from "@/entities/all";
import { formatBRLInteger, formatPct } from "@/lib/formatters";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { linkFicha, nomeCurto } from "@/lib/networkOverview";
import {
  ORDEM_LISTAS, aplicarLista, cfgDaLista, contarListas, deltaPct, diasAtraso, infoMesSeguinte,
  pendenciasDaLinha, resumoFechamento, rotuloMesVerba, rotulosPeriodo, textoSemVerba,
} from "@/lib/fechamentoRede";

/**
 * Aba "Fechamento do mês" do Financeiro (admin).
 *
 * Uma consulta só (get_financeiro_rede): antes a tela baixava 13 meses de vendas da rede
 * inteira no navegador para montar esta mesma tabela. Regras em lib/fechamentoRede.js.
 */

// Grade da tabela no desktop; no celular cada linha vira cartão empilhado.
// Última coluna em largura fixa (não auto): cabeçalho e linhas são grades separadas.
const GRID = "md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_11.5rem]";

// Decisão 7: todo link para a Ficha leva state {from, label} — sem isso a Ficha caía no
// padrão "← Unidades" e quem veio do Financeiro perdia o mês/lista em que estava (achado
// MÉDIO, 26/09).
function linkDaLinha(evo, location) {
  const { to, state } = linkFicha(evo, { from: location.pathname + location.search, label: "Fechamento do mês" });
  return { to, state, label: "Abrir ficha →" };
}

// A RPC ainda não aplicada no banco responde PGRST202 / "Could not find the function".
function rpcAusente(e) {
  const code = e?.code || "";
  const msg = String(e?.message || "");
  return code === "PGRST202" || code === "42883" || /could not find the function/i.test(msg);
}

function Cartao({ titulo, children }) {
  return (
    <div className="min-w-0 rounded-2xl border border-surface-line bg-white p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-3">{titulo}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// #34: link "Resultado" da linha (Fechamento → Por unidade), levando o MÊS junto —
// diferente de "Abrir ficha →" (linkDaLinha acima), que vai para a Ficha da unidade.
function linkResultado(evo, mes) {
  const params = new URLSearchParams({ tab: "porunidade", franchise: evo, mes });
  return `/Financeiro?${params.toString()}`;
}

export default function FechamentoRede({ mes, mesAtual, onVerMensalidades }) {
  // #19: "Cobrar em Mensalidades →" e o link do cabeçalho de vencidas levam já filtrados
  // (?situacao=vencido), em vez de cair na lista inteira das 66 unidades.
  const onVerVencidas = () => onVerMensalidades("vencido");
  const location = useLocation();
  const mountedRef = useRef(true);
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [lista, setLista] = useState("caiu");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const carregar = useCallback(
    async (signal) => {
      setCarregando(true);
      setErro(null);
      try {
        const dados = await getFinanceiroRede(mes, { signal });
        if (!mountedRef.current || signal?.aborted) return;
        setLinhas(dados);
      } catch (e) {
        if (!mountedRef.current || signal?.aborted || e?.name === "AbortError") return;
        console.error("Erro ao carregar fechamento da rede:", e);
        setErro(
          rpcAusente(e)
            ? { ausente: true, texto: "Os números desta aba aparecem assim que a atualização do sistema for concluída. As mensalidades já funcionam." }
            : { ausente: false, texto: safeErrorMessage(e, "Não foi possível carregar o fechamento do mês.") }
        );
      } finally {
        if (mountedRef.current && !signal?.aborted) setCarregando(false);
      }
    },
    [mes]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    carregar(ctrl.signal);
    return () => ctrl.abort();
  }, [carregar]);

  const resumo = useMemo(() => resumoFechamento(linhas), [linhas]);
  const periodo = useMemo(() => rotulosPeriodo(linhas[0]), [linhas]);
  const contagens = useMemo(() => contarListas(linhas), [linhas]);
  const visiveis = useMemo(() => aplicarLista(linhas, lista), [linhas, lista]);
  const ehMesAtual = mes === mesAtual;

  if (carregando) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl motion-reduce:animate-none" />
          ))}
        </div>
        <Skeleton className="h-10 w-full max-w-md rounded-full motion-reduce:animate-none" />
        <Skeleton className="h-80 rounded-2xl motion-reduce:animate-none" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-surface-line bg-white px-4 py-12 text-center">
        <MaterialIcon icon="cloud_off" size={40} className="text-ink-3" aria-hidden="true" />
        <p className="font-plus-jakarta text-base font-bold text-ink">
          {erro.ausente ? "O fechamento do mês ainda não está disponível" : "Não deu para carregar o fechamento"}
        </p>
        <p className="max-w-md text-sm text-ink-2">{erro.texto}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => carregar()}
            className="min-h-10 rounded-xl border border-surface-line bg-white px-4 text-sm font-semibold text-ink-2 hover:bg-surface"
          >
            Tentar de novo
          </button>
          <button
            type="button"
            onClick={() => onVerMensalidades()}
            className="min-h-10 px-2 text-sm font-semibold text-brand-dark hover:underline"
          >
            Ver mensalidades →
          </button>
        </div>
      </div>
    );
  }

  if (linhas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-surface-line bg-white px-4 py-12 text-center">
        <MaterialIcon icon="event_busy" size={36} className="text-ink-3" aria-hidden="true" />
        <p className="font-plus-jakarta text-base font-bold text-ink">Nada para fechar neste mês</p>
        <p className="max-w-sm text-sm text-ink-2">Nenhuma unidade com venda neste mês. Escolha outro mês no seletor acima.</p>
      </div>
    );
  }

  const deltaRede = resumo.deltaPct;
  const nomeTop = resumo.topNaoConfirmadas ? nomeCurto(resumo.topNaoConfirmadas.franchise_name) : null;
  // Mês PRINCIPAL = sempre o do calendário (decisão 2) — mesmo texto que Hoje/Unidades/
  // Marketing usam para "não pagou a verba de X" (achado MÉDIO, 26/09: divergia do mês-alvo).
  // rotuloMesVerba/textoSemVerba/infoMesSeguinte leem as linhas CRUAS (marketing_month/
  // marketing_target_month), nunca um objeto já transformado.
  const mesVerbaRotulo = rotuloMesVerba(linhas);
  const infoSeguinte = infoMesSeguinte(linhas);
  const cfgLista = cfgDaLista(linhas, lista);
  // #22: cartão "Pedidos à fábrica" só aparece quando a RPC nova está aplicada
  // (resumo.poAmount !== null) — sem ela, a grade volta a ter 3 cartões.
  const temPedidos = resumo.poAmount !== null;

  return (
    <div className="space-y-5">
      {/* Resumo */}
      <div className={`grid grid-cols-1 gap-3 ${temPedidos ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <Cartao titulo={`Faturamento da rede · ${periodo?.resumo ?? ""}`}>
          <p className="font-plus-jakarta text-2xl font-extrabold text-ink">{formatBRLInteger(resumo.receita)}</p>
          {deltaRede === null ? (
            <p className="mt-1 text-sm text-ink-3">Sem base para comparar com {periodo?.mesAnterior ?? "o mês anterior"}.</p>
          ) : (
            <p className="mt-1 text-sm text-ink-2">
              <span className={`font-semibold ${deltaRede < 0 ? "text-err" : "text-ok-ink"}`}>{formatPct(deltaRede, { sinal: true })}</span>{" "}
              contra {periodo?.comparacao}
            </p>
          )}
        </Cartao>

        <Cartao titulo="A receber das unidades">
          <ul className="space-y-1.5 text-sm text-ink-2">
            <li className="flex flex-wrap items-center gap-x-2">
              {resumo.mensalidadesVencidas > 0 ? (
                <>
                  <span>
                    <strong className="text-ink">{resumo.mensalidadesVencidas}</strong>{" "}
                    {resumo.mensalidadesVencidas === 1 ? "mensalidade vencida" : "mensalidades vencidas"}
                    {ehMesAtual ? "" : " hoje"}
                    {resumo.valorVencidas > 0 && <> · {formatBRLInteger(resumo.valorVencidas)}</>}
                    {/* #19: nomeia a mais antiga, para não tratar quem venceu ontem igual a
                        quem venceu há meses (Uberlândia, 52 dias, medido em 26/09). */}
                    {resumo.maisAntigaVencida && (
                      <>
                        {" "}
                        · a mais antiga há {diasAtraso(resumo.maisAntigaVencida.dueDate)} dias (
                        {nomeCurto(resumo.maisAntigaVencida.franchise_name)})
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={onVerVencidas}
                    className="inline-flex min-h-10 items-center font-semibold text-brand-dark hover:underline"
                  >
                    Cobrar em Mensalidades →
                  </button>
                </>
              ) : (
                <span className="py-2">Nenhuma mensalidade vencida.</span>
              )}
            </li>
            <li className="flex flex-wrap items-center gap-x-2">
              {resumo.semVerba > 0 ? (
                <>
                  <span>{textoSemVerba(resumo.semVerba, linhas)}</span>
                  {ehMesAtual ? (
                    // Marketing.jsx só filtra pelo mês do calendário (o ATUAL) — em mês
                    // passado o link prometeria uma lista de outro mês (achado MÉDIO,
                    // 26/09), então só aparece quando o Fechamento mostra o mês corrente.
                    <Link
                      to="/Marketing?tab=investimento&filtro=sem_verba"
                      className="inline-flex min-h-10 items-center font-semibold text-brand-dark hover:underline"
                    >
                      Ver quem não pagou →
                    </Link>
                  ) : null}
                </>
              ) : (
                <span className="py-2">Todas pagaram a verba{mesVerbaRotulo ? ` de ${mesVerbaRotulo}` : ""}.</span>
              )}
            </li>
            {infoSeguinte && (
              // Informação secundária NEUTRA dos últimos 5 dias do mês (decisão 2): nunca
              // vermelho, nunca some o resumo principal — só um texto a mais.
              <li className="pt-0.5 text-xs text-ink-3">{infoSeguinte.texto}</li>
            )}
          </ul>
        </Cartao>

        <Cartao titulo={resumo.naoConfirmadasAntigas !== null ? "Sem confirmar há 7+ dias" : "Vendas sem confirmar pagamento"}>
          {/* #21: quando a RPC nova está aplicada, o número grande já é só a pendência de
              verdade (7+ dias) — a venda de hoje sem confirmar, que é normal, não conta
              mais como problema. Sem a RPC nova, mantém o número de sempre. */}
          {resumo.naoConfirmadasAntigas !== null ? (
            <>
              <p className="font-plus-jakarta text-2xl font-extrabold text-ink">{resumo.naoConfirmadasAntigas}</p>
              {resumo.naoConfirmadasAntigas > 0 ? (
                <>
                  <p className="mt-1 text-sm text-ink-2">
                    Venda registrada há mais de 7 dias sem o pagamento confirmado pelo franqueado.
                    {resumo.topAntigas
                      ? ` ${nomeCurto(resumo.topAntigas.franchise_name)} tem ${resumo.topAntigas.n} ${resumo.topAntigas.n === 1 ? "venda" : "vendas"} sem confirmar há mais de 7 dias.`
                      : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => setLista("confirmar")}
                    className="mt-1 inline-flex min-h-10 items-center text-sm font-semibold text-brand-dark hover:underline"
                  >
                    Ver vendas a confirmar →
                  </button>
                </>
              ) : (
                <p className="mt-1 text-sm text-ink-2">Nenhuma venda parada há mais de 7 dias.</p>
              )}
            </>
          ) : (
            <>
              <p className="font-plus-jakarta text-2xl font-extrabold text-ink">{resumo.naoConfirmadas}</p>
              {resumo.naoConfirmadas > 0 ? (
                <>
                  <p className="mt-1 text-sm text-ink-2">
                    {formatBRLInteger(resumo.valorNaoConfirmado)} em vendas que a unidade ainda não marcou como pagas.
                    {nomeTop ? ` ${nomeTop} tem ${resumo.topNaoConfirmadas.n} ${resumo.topNaoConfirmadas.n === 1 ? "venda assim" : "vendas assim"}.` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => setLista("confirmar")}
                    className="mt-1 inline-flex min-h-10 items-center text-sm font-semibold text-brand-dark hover:underline"
                  >
                    Ver vendas a confirmar →
                  </button>
                </>
              ) : (
                <p className="mt-1 text-sm text-ink-2">Todas as vendas do mês estão com pagamento confirmado.</p>
              )}
            </>
          )}
        </Cartao>

        {temPedidos && (
          <Cartao titulo={`Pedidos à fábrica · ${periodo?.resumo ?? ""}`}>
            <p className="font-plus-jakarta text-2xl font-extrabold text-ink">{formatBRLInteger(resumo.poAmount)}</p>
            {resumo.poDeltaPct === null ? (
              <p className="mt-1 text-sm text-ink-3">Sem base para comparar com {periodo?.mesAnterior ?? "o mês anterior"}.</p>
            ) : (
              <p className="mt-1 text-sm text-ink-2">
                <span className={`font-semibold ${resumo.poDeltaPct < 0 ? "text-err" : "text-ok-ink"}`}>
                  {formatPct(resumo.poDeltaPct, { sinal: true })}
                </span>{" "}
                contra {periodo?.comparacao}
              </p>
            )}
            <Link to="/PurchaseOrders" className="mt-1 inline-flex min-h-10 items-center text-sm font-semibold text-brand-dark hover:underline">
              Ver pedidos →
            </Link>
          </Cartao>
        )}
      </div>

      {/* Chips */}
      <div className="space-y-2">
        <div role="group" aria-label="Listas" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          {ORDEM_LISTAS.map((k) => {
            const ativo = lista === k;
            // "Mais venderam" (F5): chip sem contador útil (é só a contagem de quem
            // vendeu, não informa nada) — mudança #39.
            const chip = cfgDaLista(linhas, k).chip;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={ativo}
                onClick={() => setLista(k)}
                className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-sm transition-colors ${
                  ativo
                    ? "border-brand-dark bg-brand-dark font-semibold text-white"
                    : "border-surface-line bg-white font-medium text-ink-2 hover:bg-surface"
                }`}
              >
                {k === "vendeu" ? chip : `${chip} · ${contagens[k] ?? 0}`}
              </button>
            );
          })}
        </div>
        <p className="px-1 text-xs text-ink-3">{cfgLista.nota}</p>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-surface-line bg-white">
        {visiveis.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <MaterialIcon icon="check_circle" size={32} className="text-ok" aria-hidden="true" />
            <p className="text-base font-semibold text-ink">{cfgLista.vazio}</p>
          </div>
        ) : (
          <>
            <div
              className={`hidden gap-3 border-b border-surface-line bg-surface-2 px-5 py-3 text-xs font-bold uppercase tracking-wide text-ink-3 md:grid ${GRID}`}
            >
              <span>Unidade</span>
              <span>{periodo?.colunaAtual}</span>
              <span>{periodo?.colunaAnterior}</span>
              <span>Diferença</span>
              <span>A confirmar</span>
              <span className="sr-only">Ação</span>
            </div>
            <div className="divide-y divide-surface-line">
              {visiveis.map((r) => {
                const d = deltaPct(r) === null ? null : formatPct(deltaPct(r), { sinal: true, casas: 0 });
                const pend = pendenciasDaLinha(r);
                const acao = linkDaLinha(r.franchise_id, location);
                const corDelta = deltaPct(r) === null ? "text-ink-3" : deltaPct(r) < 0 ? "text-err" : "text-ok-ink";
                const resultado = linkResultado(r.franchise_id, mes);
                return (
                  <div key={r.franchise_id}>
                    {/* Celular (#39): linha 1 = nome (truncate) + delta; linha 2 = valores
                        em tabular-nums, o valor nunca some (antes nome+valor dividiam um
                        único truncate e nome longo cortava o valor). */}
                    <div className="p-4 md:hidden">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate font-semibold text-ink">
                          {nomeCurto(r.franchise_name)}
                          {!r.is_active && <span className="font-normal text-ink-3"> · encerrada</span>}
                        </p>
                        {d && <span className={`shrink-0 font-semibold ${corDelta}`}>{d}</span>}
                      </div>
                      <p className="mt-0.5 truncate text-sm tabular-nums text-ink-2">
                        {formatBRLInteger(r.rev_month)} · {periodo?.colunaAnterior || "mês anterior"} {formatBRLInteger(r.rev_prev_same)}
                        {pend.length ? ` · ${pend.join(" · ")}` : ""}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <Link to={acao.to} state={acao.state} className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-dark hover:underline">
                          Abrir ficha ›
                        </Link>
                        <Link to={resultado} className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-dark hover:underline">
                          Resultado ›
                        </Link>
                      </div>
                    </div>

                    {/* Desktop: colunas alinhadas com o cabeçalho. */}
                    <div className={`hidden gap-3 px-5 py-3.5 md:grid md:items-center ${GRID}`}>
                      <div className="min-w-0">
                        <p className="font-semibold leading-snug text-ink">{nomeCurto(r.franchise_name)}</p>
                        {(r.owner_name || !r.is_active) && (
                          <p className="truncate text-sm text-ink-3">
                            {r.owner_name || ""}
                            {!r.is_active ? `${r.owner_name ? " · " : ""}encerrada` : ""}
                          </p>
                        )}
                      </div>
                      <span className="font-semibold text-ink">{formatBRLInteger(r.rev_month)}</span>
                      <span className="text-ink-2">{formatBRLInteger(r.rev_prev_same)}</span>
                      {d ? (
                        <span className={`font-semibold ${corDelta}`}>{d}</span>
                      ) : (
                        <span className="text-ink-3" title="Sem base para comparar (vendia menos de R$ 3 mil)">—</span>
                      )}
                      {pend.length ? (
                        <span className="text-sm font-semibold text-warn-ink">{pend.join(" · ")}</span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                      <div className="flex items-center justify-self-end gap-3 whitespace-nowrap">
                        {/* #34: "Resultado" leva o mesmo mês do Fechamento; "Abrir ficha" vai
                            para a Ficha da unidade (telas diferentes, decisão 7). */}
                        <Link to={resultado} className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-dark hover:underline">
                          Resultado
                        </Link>
                        <Link to={acao.to} state={acao.state} className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-dark hover:underline">
                          {acao.label}
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* #22: sale_date futura fica fora do mês sem aviso nenhum (7 casos medidos em
          26/09) — só aparece quando a RPC nova está aplicada e há pelo menos 1 caso. */}
      {resumo.vendasFuturas > 0 && (
        <p className="px-1 text-xs text-ink-3">
          {resumo.vendasFuturas} {resumo.vendasFuturas === 1 ? "venda com data futura não entra" : "vendas com data futura não entram"} no mês (conferir com a unidade).
        </p>
      )}

      {/* #34: o link de rodapé "Ver o resultado de uma unidade →" saiu — cada linha já tem
          o link "Resultado" acima, levando o mês junto. */}
      <p className="px-1 text-xs text-ink-3">
        Faturamento = vendas + frete − desconto. {resumo.unidades} unidades · unidades de teste ficam fora.
      </p>
    </div>
  );
}
