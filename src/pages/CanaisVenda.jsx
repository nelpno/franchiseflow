// Canais de venda (admin/gerente/CS, 10/11/2026): robô × cardápio digital × lançada à mão, na rede e por
// unidade, em 7 dias / este mês / mês anterior (como as outras telas: mês contra o mesmo trecho do anterior). Dados: get_admin_canais_venda (useCanaisVenda);
// regras de atribuição, sinais e ordenação em src/lib/canaisVenda.js. Filtro, ordem e período na URL (F8).
import { useEffect, useMemo } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/shared/PageHeader";
import SectionTitle from "@/components/shared/SectionTitle";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import {
  PAGINA, CARTAO, CHIP, CHIP_ATIVO, CHIP_INATIVO, H3_CARTAO, LINK_ACAO, LISTA, CABECALHO_LISTA, ROTULO,
} from "@/components/shared/adminUi";
import { formatPct } from "@/lib/formatters";
import { nomeCurto } from "@/lib/networkOverview";
import { useQueryClient } from "@tanstack/react-query";
import { useCanaisVenda, prefetchCanaisVenda, dadoVelho } from "@/entities/canaisVenda";
import { useAuth } from "@/lib/AuthContext";
import {
  PERIODOS, periodoValido, filtroValido, ordemValida, FILTROS_LISTA, ORDENS, ESTADOS_CARDAPIO,
  totalRs, totalVendas, conversaoRobo, participacao, resumoAdesao, sinaisUnidade, ordenarUnidades, textoFatia,
  MIN_VISITAS_SEM_PEDIDO, MIN_PEDIDOS, MIN_CONTATOS_ROBO, QUEDA_CONVERSAO_PP, QUEDA_CONVERSAO_REL, DIAS_LIGADO_SEM_VISITA,
} from "@/lib/canaisVenda";
import { brl, n, qtd, detalhePeriodo, Comparacao, ChipSinal } from "@/components/canais/canaisUi";

const GRADE = "md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,2fr)_7rem] md:items-center md:gap-4";

function Indicador({ rotulo, valor, apoio, atual, anterior, dados }) {
  return (
    <div className={`${CARTAO} min-w-0`}>
      <p className={`${ROTULO} whitespace-nowrap`}>{rotulo}</p>
      <p className="mt-2 font-plus-jakarta text-xl font-extrabold tabular-nums text-ink min-[400px]:text-2xl sm:text-3xl">{valor}</p>
      {apoio && <p className="mt-1 text-sm tabular-nums text-ink-2">{apoio}</p>}
      <Comparacao atual={atual} anterior={anterior} dados={dados} />
    </div>
  );
}

function Passo({ rotulo, valor, antes, ultimo }) {
  return (
    <li className={`flex items-baseline justify-between gap-3 py-2 ${ultimo ? "" : "border-b border-surface-line"}`}>
      <span className="min-w-0 text-sm text-ink-2">{rotulo}</span>
      <span className="shrink-0 text-right tabular-nums">
        <span className="font-semibold text-ink">{valor}</span>
        {antes != null && <span className="ml-2 text-sm text-ink-3">antes {antes}</span>}
      </span>
    </li>
  );
}

function celulaCardapio(u) {
  const a = u.atual || {};
  if (u.estado !== "ligado" && !Number(a.visitas) && !Number(a.pedidos_enviados)) {
    return { principal: ESTADOS_CARDAPIO[u.estado] || "Sem cardápio", apoio: "" };
  }
  return {
    principal: `${n(a.vendas_cardapio)} ${Number(a.vendas_cardapio) === 1 ? "venda" : "vendas"} · ${brl(a.rs_cardapio)}`,
    apoio: `${qtd(a.visitas, "visita", "visitas")} → ${qtd(a.pedidos_enviados, "pedido", "pedidos")} → ${n(a.pedidos_chegaram)} ${Number(a.pedidos_chegaram) === 1 ? "chegou" : "chegaram"}`,
  };
}

function LinhaUnidade({ u, voltarPara }) {
  const a = u.atual || {};
  const sinais = sinaisUnidade(u);
  const conv = conversaoRobo(a);
  const card = celulaCardapio(u);
  const ficha = `/Unidade?id=${encodeURIComponent(u.evo)}`;
  return (
    <li className={`border-t border-surface-line px-4 py-3 sm:px-5 md:py-4 ${GRADE}`} data-canais-linha={u.evo}>
      {/* Celular (T9): 3 linhas — nome + 1º sinal; números; link */}
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{nomeCurto(u.nome)}</span>
          <span className="md:hidden"><ChipSinal sinal={sinais[0]} extra={sinais.length - 1} /></span>
        </p>
        <p className="mt-0.5 text-sm text-ink-3 md:hidden tabular-nums">
          {brl(totalRs(a))} · robô {conv === null ? "sem conversa" : formatPct(conv, { casas: 0 })} ·{" "}
          {u.estado === "ligado" || Number(a.visitas)
            ? `cardápio ${qtd(a.visitas, "visita", "visitas")}, ${qtd(a.vendas_cardapio, "venda", "vendas")}`
            : (ESTADOS_CARDAPIO[u.estado] || "sem cardápio").toLowerCase()}
        </p>
      </div>
      <div className="hidden text-right tabular-nums md:block">
        <p className="font-semibold text-ink">{brl(totalRs(a))}</p>
        <p className="text-sm text-ink-3">{qtd(totalVendas(a), "venda", "vendas")}</p>
      </div>
      <div className="hidden text-right tabular-nums md:block">
        <p className="font-semibold text-ink">{conv === null ? "—" : formatPct(conv)}</p>
        <p className="text-sm text-ink-3">{n(a.robo_compraram)} de {n(a.robo_contatos)}</p>
      </div>
      <div className="hidden min-w-0 md:block">
        <p className="font-semibold text-ink tabular-nums">{card.principal}</p>
        {card.apoio && <p className="text-sm text-ink-3 tabular-nums">{card.apoio}</p>}
      </div>
      <div className="hidden min-w-0 md:block">
        {sinais.length ? <ChipSinal sinal={sinais[0]} extra={sinais.length - 1} /> : <span className="text-sm text-ink-3">—</span>}
      </div>
      <div className="flex justify-end md:block md:text-right">
        <Link to={ficha} state={{ from: voltarPara, label: "Canais de venda" }} className={LINK_ACAO}>Abrir ficha →</Link>
      </div>
    </li>
  );
}

const horaGerado = (d) => {
  const t = Date.parse(d?.gerado_em || "");
  return Number.isFinite(t)
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(t))
    : "antes";
};

export default function CanaisVenda() {
  const location = useLocation();
  const { user } = useAuth();
  // A página do cardápio (lista de adesão) abre só para admin/gerente; o CS vê a contagem aqui.
  const veCardapio = user?.role === "admin" || user?.role === "manager";
  const [params, setParams] = useSearchParams();
  // ?periodo=7d|mes|mes_anterior; o ?dias=30 antigo vira "mes"
  const periodo = periodoValido(params.get("periodo") || params.get("dias"));
  const queryClient = useQueryClient();
  const filtro = filtroValido(params.get("filtro"));
  const ordem = ordemValida(params.get("ordem"));
  const q = useCanaisVenda(periodo);
  const d = q.data;
  const a = d?.rede?.atual;
  const p = d?.rede?.anterior;

  const mudar = (chave, valor, padrao) => {
    const np = new URLSearchParams(params);
    if (valor === padrao) np.delete(chave); else np.set(chave, String(valor));
    setParams(np, { replace: true, state: location.state });
  };
  const mudarPeriodo = (id) => {
    const np = new URLSearchParams(params);
    np.delete("dias");
    if (id === "7d") np.delete("periodo"); else np.set("periodo", id);
    setParams(np, { replace: true, state: location.state });
  };
  // Atualizando = mostrando outro período enquanto o novo chega (placeholder) ou a cópia local com mais de 5 min
  // sendo renovada.
  const atualizando = q.isFetching && (q.isPlaceholderData || d?.periodo !== periodo || dadoVelho(q.dataUpdatedAt));
  // Só depois que o período da tela chegou do banco (não sobre a cópia local) busca os outros: trocar fica
  // instantâneo sem disputar com a busca principal.
  const pronto = !!d && !q.isPlaceholderData && !q.isFetching && !dadoVelho(q.dataUpdatedAt);
  useEffect(() => {
    if (!pronto) return;
    PERIODOS.filter((x) => x.id !== periodo).forEach((x) => prefetchCanaisVenda(queryClient, x.id, user?.id));
  }, [pronto, periodo, queryClient, user?.id]);

  const unidades = d?.unidades || [];
  const agora = useMemo(() => new Date(), [d]); // eslint-disable-line react-hooks/exhaustive-deps
  const contagem = useMemo(
    () => Object.fromEntries(FILTROS_LISTA.map((f) => [f.id, unidades.filter((u) => f.match(u, agora)).length])),
    [unidades, agora],
  );
  const visiveis = useMemo(() => {
    const f = FILTROS_LISTA.find((x) => x.id === filtro) || FILTROS_LISTA[0];
    return ordenarUnidades(unidades.filter((u) => f.match(u, agora)), ordem);
  }, [unidades, filtro, ordem, agora]);

  const fatia = participacao(a);
  const ades = resumoAdesao(d?.adesao);
  const convA = conversaoRobo(a);
  const convP = conversaoRobo(p);
  const voltar = location.state?.from === "hoje" ? { to: "/Dashboard", label: "Hoje" } : undefined;

  const seletorPeriodo = (
    <div className="flex gap-2" role="group" aria-label="Período">
      {PERIODOS.map((x) => (
        <button key={x.id} type="button" aria-pressed={periodo === x.id} onClick={() => mudarPeriodo(x.id)}
          onMouseEnter={() => prefetchCanaisVenda(queryClient, x.id, user?.id)}
          className={`${CHIP} ${periodo === x.id ? CHIP_ATIVO : CHIP_INATIVO}`}>
          {x.rotulo}
        </button>
      ))}
    </div>
  );

  return (
    <div className={`${PAGINA} pb-24 md:pb-6`}>
      <PageHeader
        voltar={voltar}
        titulo="Canais de venda"
        subtitulo="Quanto a rede vende pelo robô, pelo cardápio digital e lançado à mão, e onde agir."
        situacao={d ? (atualizando ? "Atualizando…" : q.isError ? `Não deu para atualizar; números de ${horaGerado(d)}` : detalhePeriodo(d)) : undefined}
        acao={seletorPeriodo}
      />

      {q.isLoading && !d ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className={`h-32 rounded-2xl motion-reduce:animate-none ${i === 0 ? "col-span-2 md:col-span-1" : ""}`} />)}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-56 rounded-2xl motion-reduce:animate-none" />
            <Skeleton className="h-56 rounded-2xl motion-reduce:animate-none" />
          </div>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl motion-reduce:animate-none" />)}
        </>
      ) : !a ? (
        <ErrorState cartao texto="Os números dos canais de venda não vieram agora." onTentarNovamente={() => q.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-canais-indicadores>
            <Indicador rotulo="Total" valor={brl(totalRs(a))} apoio={qtd(totalVendas(a), "venda", "vendas")}
              atual={totalRs(a)} anterior={totalRs(p)} dados={d} />
            <Indicador rotulo="Robô" valor={brl(a.rs_robo)} apoio={fatia ? `${textoFatia(fatia.robo)} · ${qtd(a.vendas_robo, "venda", "vendas")}` : qtd(a.vendas_robo, "venda", "vendas")}
              atual={a.rs_robo} anterior={p?.rs_robo} dados={d} />
            <Indicador rotulo="Cardápio" valor={brl(a.rs_cardapio)} apoio={fatia ? `${textoFatia(fatia.cardapio)} · ${qtd(a.vendas_cardapio, "venda", "vendas")}` : qtd(a.vendas_cardapio, "venda", "vendas")}
              atual={a.rs_cardapio} anterior={p?.rs_cardapio} dados={d} />
            <Indicador rotulo="À mão" valor={brl(a.rs_manual)} apoio={fatia ? `${textoFatia(fatia.manual)} · ${qtd(a.vendas_manual, "venda", "vendas")}` : qtd(a.vendas_manual, "venda", "vendas")}
              atual={a.rs_manual} anterior={p?.rs_manual} dados={d} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <section className={CARTAO} aria-labelledby="funil-robo">
              <h2 id="funil-robo" className={H3_CARTAO}>Robô no WhatsApp</h2>
              <p className="mt-1 text-sm text-ink-2">Quem escreveu para a unidade e comprou depois (fechado pelo robô ou pela franqueada).</p>
              <ul className="mt-3">
                <Passo rotulo="Pessoas que escreveram" valor={n(a.robo_contatos)} antes={n(p?.robo_contatos)} />
                <Passo rotulo="Compraram" valor={n(a.robo_compraram)} antes={n(p?.robo_compraram)} />
                <Passo rotulo="Conversão" valor={convA === null ? "—" : formatPct(convA)} antes={convP === null ? "—" : formatPct(convP)} ultimo />
              </ul>
            </section>
            <section className={CARTAO} aria-labelledby="funil-cardapio">
              <h2 id="funil-cardapio" className={H3_CARTAO}>Cardápio digital</h2>
              <p className="mt-1 text-sm text-ink-2">Do link aberto até a venda lançada do mesmo telefone em até 72 horas.</p>
              <ul className="mt-3">
                <Passo rotulo="Visitas" valor={n(a.visitas)} antes={n(p?.visitas)} />
                <Passo rotulo="Pedidos montados" valor={n(a.pedidos_enviados)} antes={n(p?.pedidos_enviados)} />
                <Passo rotulo="Chegaram no WhatsApp" valor={n(a.pedidos_chegaram)} antes={n(p?.pedidos_chegaram)} />
                <Passo rotulo="Viraram venda" valor={n(a.pedidos_viraram_venda)} antes={n(p?.pedidos_viraram_venda)} ultimo />
              </ul>
              <p className="mt-2 text-sm text-ink-3">
                Vendas do cardápio fechadas pelo robô: {n(a.vendas_cardapio_robo)} de {n(a.vendas_cardapio)}; as outras a franqueada lançou.
              </p>
            </section>
          </div>

          <section className={`${CARTAO} space-y-3`} aria-labelledby="adesao-canais">
            <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:gap-3">
              <h2 id="adesao-canais" className={H3_CARTAO}>Adesão ao cardápio</h2>
              <p className="text-sm text-ink-3">Situação de agora, {n(ades.total)} unidades</p>
              {veCardapio && <Link to="/CardapioDigital?visao=rede" className={`${LINK_ACAO} md:ml-auto`}>Ver a lista de adesão →</Link>}
            </div>
            <ul className="flex flex-wrap gap-2">
              {Object.entries(ESTADOS_CARDAPIO).filter(([k]) => ades[k] > 0).map(([k, rot]) => (
                <li key={k} className="rounded-full border border-surface-line bg-surface-2 px-3 py-1.5 text-sm text-ink-2">
                  {rot} · <span className="font-semibold text-ink tabular-nums">{n(ades[k])}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3" aria-labelledby="canais-unidades">
            <SectionTitle id="canais-unidades" titulo="Por unidade" ajuda="Ordene e filtre; o sinal diz o que olhar primeiro." />
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible" role="group" aria-label="Filtrar unidades">
                {FILTROS_LISTA.map((f) => (
                  <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => mudar("filtro", f.id, "todas")}
                    className={`${CHIP} ${filtro === f.id ? CHIP_ATIVO : CHIP_INATIVO}`}>
                    {f.rotulo} · {contagem[f.id] || 0}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <span className="whitespace-nowrap">Ordenar por</span>
                <select value={ordem} onChange={(e) => mudar("ordem", e.target.value, "rs")}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-surface-line bg-white px-3 text-sm font-semibold text-ink md:flex-none">
                  {ORDENS.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
                </select>
              </label>
            </div>
            {visiveis.length === 0 ? (
              <EmptyState cartao icone="filter_alt_off" titulo="Nenhuma unidade neste filtro"
                texto="Nenhuma unidade se encaixa agora." acao={{ rotulo: "Ver todas", onClick: () => mudar("filtro", "todas", "todas") }} />
            ) : (
              <div className={LISTA}>
                <div className={`hidden ${CABECALHO_LISTA} ${GRADE}`}>
                  <span>Unidade</span><span className="text-right">Faturamento</span><span className="text-right">Robô</span>
                  <span>Cardápio</span><span>Sinal</span><span />
                </div>
                <ul data-canais-lista>
                  {visiveis.map((u) => <LinhaUnidade key={u.evo} u={u} voltarPara={`/CanaisVenda${location.search}`} />)}
                </ul>
              </div>
            )}
          </section>

          <details className={`${CARTAO} text-sm text-ink-2`}>
            <summary className="flex min-h-10 cursor-pointer items-center font-semibold text-ink">Como cada número é contado</summary>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li><b>Cada venda conta uma vez, num canal só</b> (pela data da venda). <b>Cardápio</b>: a venda do mesmo telefone lançada até 72 h depois de um pedido do cardápio chegar no WhatsApp, fechada pelo robô ou à mão (o pedido veio pronto do cardápio). <b>Robô</b>: venda que o robô lançou e não veio do cardápio. <b>À mão</b>: o resto.</li>
              <li><b>Pessoas que escreveram</b>: telefones diferentes que mandaram mensagem à unidade no período (disparo da franqueada não entra), sem quem mandou pedido do cardápio. <b>Compraram</b>: venda do mesmo telefone, de qualquer origem, lançada depois da 1ª mensagem e dentro do período.</li>
              <li><b>Visitas</b>: aberturas do link do cardápio (sem os testes). <b>Pedidos montados</b>: pedidos enviados pelo cardápio; <b>chegaram</b>: o código #PED- apareceu numa mensagem recebida pela unidade. Se o cliente apagar o código, o pedido não é contado.</li>
              <li><b>Sinais</b>: cardápio ligado há {DIAS_LIGADO_SEM_VISITA}+ dias sem visita; {MIN_VISITAS_SEM_PEDIDO}+ visitas e nenhum pedido; {MIN_PEDIDOS}+ pedidos montados sem chegar no WhatsApp; {MIN_PEDIDOS}+ pedidos que chegaram sem venda; conversão do robô {QUEDA_CONVERSAO_PP}+ pontos e {Math.round(QUEDA_CONVERSAO_REL * 100)}%+ abaixo do período anterior (com {MIN_CONTATOS_ROBO}+ pessoas nos dois).</li>
              <li>Comparação, como nas outras telas: <b>7 dias</b> contra os 7 antes e <b>este mês</b> contra o mesmo trecho do mês anterior, os dois cortados na mesma hora de agora (hoje ainda está em andamento); <b>mês anterior</b> contra o mês antes dele, inteiros. &quot;Novo&quot; = não havia nada para comparar. As datas exatas ficam na linha de cima, ao lado do período. Venda com data futura (o robô grava a data da entrega) só entra quando a data chega.</li>
              <li>&quot;Compraram&quot; inclui cliente antigo que escreveu e comprou de novo: mede a conversa que vira venda, não só cliente novo.</li>
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
