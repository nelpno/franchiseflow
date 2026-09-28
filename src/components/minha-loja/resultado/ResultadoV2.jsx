// S17.1 (28/09/2026): tela nova do Resultado (Gestão › Resultado), SÓ com a chave ui_v2.
// Com a chave desligada o TabResultado renderiza a tela de sempre e este arquivo nem roda.
// Os números vêm prontos de montarResultadoMes (src/lib/monthlyReport.js) — o MESMO modelo
// do PDF. Contrato do dinheiro: docs/claude/sobrou-no-mes.md (caixa puro, "a receber" entra).
import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import MaterialIcon from "@/components/ui/MaterialIcon";
import ExportButtons from "@/components/shared/ExportButtons";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBRL, formatBRLCompactResultado } from "@/lib/formatters";
import { getCategoryMeta } from "@/lib/expenseCategories";
import { textoComparacaoSobrou, blocosDoResultado } from "@/lib/resultadoTela";
import { buildProductsExportRows, productsExportColumns, produtosComPercentual } from "@/lib/productsExport";
import { CARTAO, H2, TOM_ATENCAO, BTN_SECUNDARIO, BTN_PRIMARIO } from "@/components/shared/adminUi";

const LBL = "text-xs font-bold uppercase tracking-wide text-ink-3";
const CAP = "text-xs text-ink-3";
const VAL = "font-plus-jakarta font-bold tabular-nums text-ink";
const LISTA = "divide-y divide-surface-line rounded-2xl border border-surface-line bg-white";
const LINHA = "flex items-center gap-3 px-4 py-3";

function Barra({ pct, cor }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-line">
      <div className={`h-full rounded-full ${cor}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}


// --------------------------------------------------------------- topo: Sobrou, Entrou × Saiu
function Topo({ modelo, monthLabel, isCurrentMonth, onPrevMonth, onNextMonth, onBaixarRelatorio, gerandoRelatorio }) {
  const { sobrou, entrou, saiu, nomeMes, comparacao, diaCorte } = modelo;
  const maior = Math.max(entrou, saiu, 1);
  const positivo = sobrou >= 0;
  return (
    <section className={`${CARTAO} space-y-4`} aria-label="Sobrou no mês">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onPrevMonth} aria-label="Mês anterior" title="Mês anterior"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 hover:bg-surface">
          <MaterialIcon icon="chevron_left" size={22} aria-hidden="true" />
        </button>
        <h2 className="font-plus-jakarta text-base font-bold capitalize text-ink" aria-live="polite">{monthLabel}</h2>
        <button type="button" onClick={onNextMonth} disabled={isCurrentMonth} aria-label="Próximo mês" title="Próximo mês"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 hover:bg-surface disabled:opacity-40">
          <MaterialIcon icon="chevron_right" size={22} aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:items-center md:gap-10">
        <div className="flex flex-col gap-1">
          <span className={LBL}>Sobrou em {nomeMes}</span>
          <span className={`font-plus-jakarta text-4xl font-extrabold tabular-nums leading-tight md:text-5xl ${positivo ? "text-ok-ink" : "text-err"}`}>
            {formatBRL(sobrou)}
          </span>
          {comparacao && <span className="text-sm text-ink-2">{textoComparacaoSobrou(comparacao, diaCorte)}</span>}
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3">
            <span className="text-sm text-ink-2">Entrou</span>
            <Barra pct={(entrou / maior) * 100} cor="bg-ok" />
            <span className={`${VAL} text-sm`}>{formatBRL(entrou)}</span>
          </div>
          <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3">
            <span className="text-sm text-ink-2">Saiu</span>
            <Barra pct={(saiu / maior) * 100} cor="bg-brand" />
            <span className={`${VAL} text-sm`}>{formatBRL(saiu)}</span>
          </div>
          <span className={CAP}>O que entrou menos o que saiu no mês. Venda ainda a receber já conta; o estoque não entra nessa conta.</span>
        </div>
      </div>

      {onBaixarRelatorio && (
        <button type="button" onClick={onBaixarRelatorio} disabled={gerandoRelatorio} className={`${BTN_SECUNDARIO} min-h-[44px] w-full md:w-auto`}>
          <MaterialIcon icon="picture_as_pdf" size={18} aria-hidden="true" />
          {gerandoRelatorio ? "Gerando relatório..." : "Baixar relatório do mês (PDF)"}
        </button>
      )}
    </section>
  );
}

// --------------------------------------------------------------- aviso do pedido à fábrica
function AvisoFabrica({ aviso, naoConferido }) {
  if (naoConferido) {
    return (
      <p className={`${CAP} flex items-center gap-1.5`} role="status">
        <MaterialIcon icon="info" size={16} aria-hidden="true" />
        Não foi possível conferir os pedidos à fábrica agora: o Sobrou pode ainda não ter a compra que está a caminho.
      </p>
    );
  }
  if (!aviso) return null;
  const { aCaminho, semGasto } = aviso;
  return (
    <div className={`${TOM_ATENCAO} flex items-start gap-3`} role="status">
      <MaterialIcon icon="local_shipping" size={22} className="mt-0.5 shrink-0 text-warn-ink" aria-hidden="true" />
      <div className="space-y-1 text-sm text-ink">
        {aCaminho.n > 0 && (
          <p>
            <strong>{aCaminho.n === 1 ? "1 pedido à fábrica" : `${aCaminho.n} pedidos à fábrica`} ainda não {aCaminho.n === 1 ? "entrou" : "entraram"} como gasto</strong>{" "}
            ({formatBRL(aCaminho.valor)}). {aCaminho.n === 1 ? "Ele entra" : "Eles entram"} sozinho{aCaminho.n === 1 ? "" : "s"} quando chegar{aCaminho.n === 1 ? "" : "em"}, e o Sobrou vai baixar.
          </p>
        )}
        {semGasto.n > 0 && (
          <p>
            <strong>{semGasto.n === 1 ? "1 pedido entregue" : `${semGasto.n} pedidos entregues`} neste mês sem o gasto lançado</strong>{" "}
            ({formatBRL(semGasto.valor)}). Confira em Gastos do mês e, se não estiver lá, fale com a Maxi.
          </p>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- De onde veio
function DeOndeVeio({ modelo }) {
  const { deOndeVeio, mes } = modelo;
  const temRobo = mes.porOrigem.robo.n > 0;
  return (
    <section className="flex flex-col gap-2.5" aria-label="De onde veio">
      <h2 className={H2}>De onde veio</h2>
      <div className={LISTA}>
        {deOndeVeio.map((l) => (
          <div key={l.chave} className={LINHA}>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">{l.rotulo}</div>
              {l.chave === "vendas" && (
                <div className={CAP}>
                  {l.n} venda{l.n === 1 ? "" : "s"}{l.n > 0 ? ` · valor médio ${formatBRL(mes.valorMedio)}` : ""}
                </div>
              )}
              {l.chave === "frete" && <div className={CAP}>{l.n} entrega{l.n === 1 ? "" : "s"}</div>}
            </div>
            <span className={`${VAL} text-sm ${l.valor < 0 ? "text-err" : ""}`}>
              {l.valor < 0 ? `- ${formatBRL(-l.valor)}` : formatBRL(l.valor)}
            </span>
          </div>
        ))}
        {mes.vendas > 0 && (
          <div className="px-4 py-3 space-y-1.5">
            {temRobo && (
              <>
                <div className="flex justify-between gap-2 text-xs text-ink-2">
                  <span>Pelo robô · {mes.porOrigem.robo.n} venda{mes.porOrigem.robo.n === 1 ? "" : "s"}</span>
                  <span className="tabular-nums">{formatBRL(mes.porOrigem.robo.valor)}</span>
                </div>
                <div className="flex justify-between gap-2 text-xs text-ink-2">
                  <span>Lançadas por você · {mes.porOrigem.manual.n}</span>
                  <span className="tabular-nums">{formatBRL(mes.porOrigem.manual.valor)}</span>
                </div>
              </>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
              {mes.porPagamento.slice(0, 4).map((p) => (
                <span key={p.rotulo} className="tabular-nums">{p.rotulo} {formatBRL(p.valor)}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// --------------------------------------------------------------- Para onde foi
function ParaOndeFoi({ modelo }) {
  const linhas = modelo.paraOndeFoi;
  const maior = Math.max(...linhas.map((l) => l.valor), 1);
  return (
    <section className="flex flex-col gap-2.5" aria-label="Para onde foi">
      <h2 className={H2}>Para onde foi</h2>
      <div className={`${CARTAO} flex flex-col gap-3.5`}>
        {linhas.length === 0 && <p className="text-sm text-ink-3">Nenhum gasto neste mês.</p>}
        {linhas.map((l) => (
          <div key={l.chave} className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-2">
              <span className="text-sm font-semibold text-ink">{l.rotulo}</span>
              <span className={`${VAL} text-sm`}>{formatBRL(l.valor)}</span>
            </div>
            <Barra pct={(l.valor / maior) * 100} cor="bg-brand" />
            {l.chave === "__fabrica__" && l.pedidos > 0 && (
              <span className={CAP}>{l.pedidos} pedido{l.pedidos === 1 ? "" : "s"} · com frete</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// --------------------------------------------------------------- Mais vendidos
function MaisVendidos({ modelo, monthLabel }) {
  const top = modelo.maisVendidos;
  const [todos, setTodos] = useState(false);
  return (
    <section className="flex flex-col gap-2.5" aria-label="Mais vendidos">
      <div className="flex items-baseline justify-between">
        <h2 className={H2}>Mais vendidos</h2>
        <span className={CAP}>em unidades</span>
      </div>
      <div className={LISTA}>
        {top.length === 0 && <p className="px-4 py-3 text-sm text-ink-3">Sem vendas neste mês.</p>}
        {top.map((p, i) => (
          <div key={p.name} className={LINHA}>
            <span className="w-5 font-plus-jakarta font-extrabold tabular-nums text-ink-3">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{p.name}</span>
            <span className={`${VAL} text-sm`}>{p.quantity.toLocaleString("pt-BR")}</span>
          </div>
        ))}
        {modelo.produtos.length > 0 && (
          <button type="button" onClick={() => setTodos(true)} className="flex min-h-[44px] w-full items-center justify-between px-4 text-sm font-semibold text-brand-dark hover:bg-surface">
            Ver todos os produtos ({modelo.produtos.length})
            <MaterialIcon icon="arrow_forward" size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <VendasPorProduto open={todos} onOpenChange={setTodos} produtos={modelo.produtos} chave={modelo.chave} monthLabel={monthLabel} />
    </section>
  );
}

// --------------------------------------------------------------- Vendas por produto (todos)
// Pedido de Bragança (28/09/2026): vendas por produto no período = o mês do Resultado.
function VendasPorProduto({ open, onOpenChange, produtos, chave, monthLabel }) {
  const lista = produtosComPercentual(produtos);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1rem)] flex-col p-4 sm:w-full sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-plus-jakarta">Vendas por produto</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={CAP}>
            <span className="capitalize">{monthLabel}</span> · valor = quantidade × preço do item (sem frete e desconto)
          </p>
          <ExportButtons
            data={buildProductsExportRows(produtos, { includeTotalsRow: true })}
            columns={productsExportColumns(produtos)}
            filename={`vendas-por-produto-${chave}`}
            title={`Vendas por produto · ${monthLabel}`}
            evento="planilha_produtos"
          />
        </div>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th className="px-1 py-2 font-semibold">Produto</th>
                <th className="px-1 py-2 text-right font-semibold">Qtd</th>
                <th className="px-1 py-2 text-right font-semibold">Valor</th>
                <th className="px-1 py-2 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-line">
              {lista.map((p) => (
                <tr key={p.name}>
                  <td className="px-1 py-2 text-ink">{p.name}</td>
                  <td className="px-1 py-2 text-right tabular-nums text-ink">{p.quantity.toLocaleString("pt-BR")}</td>
                  <td className="whitespace-nowrap px-1 py-2 text-right tabular-nums text-ink">{formatBRL(p.revenue)}</td>
                  <td className="px-1 py-2 text-right tabular-nums text-ink-3">{p.pct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------- O que mudou
function OQueMudou({ modelo, mostrarDica }) {
  const { oQueMudou, comparacao } = modelo;
  if (!comparacao || oQueMudou.length === 0) return null;
  const caiu = oQueMudou.some((p) => p.agora < p.antes);
  return (
    <section className={`${CARTAO} grid gap-3 md:grid-cols-[240px_repeat(3,minmax(0,1fr))] md:items-center md:gap-6`} aria-label="O que mudou">
      <div>
        <h2 className="font-plus-jakarta text-base font-bold text-ink">O que mudou</h2>
        <p className={CAP}>
          em relação a {comparacao.mesAnterior}{comparacao.mesmoTrecho ? `, até o dia ${modelo.diaCorte}` : ""}, em unidades
        </p>
      </div>
      {oQueMudou.map((p) => {
        const subiu = p.agora > p.antes;
        return (
          <div key={p.nome} className="flex items-center justify-between gap-2 md:flex-col md:items-start md:gap-0.5">
            <span className="min-w-0 truncate text-sm font-semibold text-ink">{p.nome}</span>
            <span className={`${VAL} text-sm ${subiu ? "!text-ok-ink" : "!text-brand-dark"}`}>
              {p.antes.toLocaleString("pt-BR")} → {p.agora.toLocaleString("pt-BR")} {subiu ? "↑" : "↓"}
            </span>
          </div>
        );
      })}
      {caiu && mostrarDica && (
        <p className={`${CAP} md:col-span-4`}>Caiu? Chame quem comprava esse produto em Meus clientes.</p>
      )}
    </section>
  );
}

// --------------------------------------------------------------- Estoque
function Estoque({ estoque, paradosCount, onClickEstoque }) {
  const conteudo = (
    <>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
        <MaterialIcon icon="inventory_2" size={22} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="text-sm font-semibold text-ink">{formatBRL(estoque.vendaPotencial)} em estoque</div>
        <div className={CAP}>
          a preço de venda · custou {formatBRL(estoque.custoTotal)}
          {Number.isFinite(estoque.markupMedioPct) && estoque.custoTotal > 0 ? ` · markup médio ${estoque.markupMedioPct >= 0 ? "+" : ""}${estoque.markupMedioPct}%` : ""}
          {estoque.qtdProdutosAtivos > 0 ? ` · ${estoque.qtdProdutosAtivos} produtos ativos` : ""}
          {paradosCount > 0 ? ` · ${paradosCount} parado${paradosCount > 1 ? "s" : ""} há 28+ dias` : ""}
        </div>
      </div>
      {onClickEstoque && <span className="shrink-0 text-sm font-bold text-brand">Estoque ›</span>}
    </>
  );
  return onClickEstoque ? (
    <button type="button" onClick={onClickEstoque} className={`${CARTAO} flex w-full items-center gap-3.5 hover:bg-surface`}>
      {conteudo}
    </button>
  ) : (
    <div className={`${CARTAO} flex items-center gap-3.5`}>{conteudo}</div>
  );
}

// --------------------------------------------------------------- Quanto sobrou por mês
function SobrouPorMes({ modelo }) {
  const { porMes, ano } = modelo;
  const comDado = porMes.filter((m) => m.temDado);
  if (comDado.length < 2) return null;
  const maior = Math.max(...comDado.map((m) => Math.abs(m.sobrou)), 1);
  return (
    <section className="flex flex-col gap-2.5" aria-label="Quanto sobrou por mês">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={H2}>Quanto sobrou por mês</h2>
        <span className={CAP}>{ano.ano}</span>
      </div>
      <div className={`${CARTAO} grid h-[210px] grid-cols-6 items-end gap-2.5 md:h-[250px] md:gap-4`}>
        {porMes.map((m) => {
          const altura = m.temDado ? Math.max(4, (Math.abs(m.sobrou) / maior) * 130) : 4;
          const cor = !m.temDado ? "bg-surface-line" : m.sobrou < 0 ? "bg-err/70" : m.atual ? "bg-ok" : "bg-brand-soft";
          return (
            <div key={m.chave} className="flex min-w-0 flex-col items-center gap-1.5">
              <span className={`truncate text-[11px] tabular-nums ${m.atual ? "font-extrabold text-ok-ink" : "text-ink-3"} ${m.sobrou < 0 ? "!text-err" : ""}`}>
                {m.temDado ? formatBRLCompactResultado(m.sobrou) : "—"}
              </span>
              <i className={`block w-full rounded-md ${cor}`} style={{ height: `${altura}px` }} aria-hidden="true" />
              <span className={`text-xs ${m.atual ? "font-bold text-ink" : "text-ink-3"}`}>{m.rotulo}</span>
            </div>
          );
        })}
      </div>
      {ano.mesesComDado >= 2 && (
        <span className={CAP}>
          No ano: {formatBRL(ano.total)} {ano.total >= 0 ? "sobraram" : "de diferença"}.
          {ano.melhorMes ? ` ${modelo.nomeMes.charAt(0).toUpperCase() + modelo.nomeMes.slice(1)} é o seu melhor mês até agora.` : ""}
          {!ano.melhorMes && ano.melhor ? ` Melhor mês: ${ano.melhor.rotulo} (${formatBRL(ano.melhor.valor)}).` : ""}
          {` ${ano.mesesAzul} de ${ano.mesesComDado} meses no azul · média de ${formatBRL(ano.media)} por mês.`}
        </span>
      )}
    </section>
  );
}

// --------------------------------------------------------------- Gastos do mês
function GastosDoMes({ despesas, onEditar, onExcluir, onRegistrarGasto, exportDespesas }) {
  return (
    <section className="flex flex-col gap-2.5" aria-label="Gastos do mês">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={H2}>Gastos do mês</h2>
        <div className="flex items-center gap-2">
          {despesas.length > 0 && <ExportButtons {...exportDespesas} />}
          <button type="button" onClick={onRegistrarGasto} className={`${BTN_PRIMARIO} min-h-[44px]`}>
            <MaterialIcon icon="add" size={18} aria-hidden="true" />
            Registrar gasto
          </button>
        </div>
      </div>
      <div className={LISTA}>
        {despesas.length === 0 && <p className="px-4 py-4 text-sm text-ink-3">Nenhum gasto neste mês.</p>}
        {despesas.map((exp) => {
          const meta = getCategoryMeta(exp.category);
          const auto = exp.source && exp.source !== "manual";
          return (
            <div key={exp.id} className="flex items-center gap-2 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{exp.description || meta.label}</div>
                <div className={CAP}>
                  {exp.expense_date ? format(parseISO(exp.expense_date), "dd/MM") : "—"}<span className="hidden md:inline"> · {meta.label}</span> · {auto ? "entra sozinho" : "você lançou"}
                </div>
              </div>
              <span className={`${VAL} shrink-0 text-sm`}>{formatBRL(exp.amount)}</span>
              <button type="button" onClick={() => onEditar(exp)} aria-label="Editar gasto" title="Editar"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-2 hover:bg-surface md:h-9 md:w-9">
                <MaterialIcon icon="edit" size={18} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => onExcluir(exp.id)} aria-label="Excluir gasto" title="Excluir"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-2 hover:bg-surface hover:text-brand md:h-9 md:w-9">
                <MaterialIcon icon="delete" size={18} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// --------------------------------------------------------------- Histórico de ações
function Historico({ auditLogs }) {
  const [aberto, setAberto] = useState(false);
  if (!auditLogs?.length) return null;
  return (
    <section className={CARTAO}>
      <button type="button" onClick={() => setAberto((v) => !v)} className="flex min-h-[44px] w-full items-center justify-between">
        <span className="font-plus-jakarta text-base font-bold text-ink">Histórico de ações</span>
        <MaterialIcon icon={aberto ? "expand_less" : "expand_more"} size={20} className="text-ink-2" aria-hidden="true" />
      </button>
      {aberto && (
        <ul className="mt-2 space-y-2">
          {auditLogs.map((log) => (
            <li key={log.id} className="text-sm text-ink">
              <span className="font-semibold">{log.user_name || "Usuário"}</span>{" "}
              {{ create: "criou", update: "editou", delete: "excluiu" }[log.action] || log.action}{" "}
              {{ sale: "venda", expense: "gasto" }[log.entity_type] || log.entity_type}
              {log.details?.value && <span className="text-ink-2"> ({formatBRL(log.details.value)})</span>}
              {log.details?.amount && <span className="text-ink-2"> ({formatBRL(log.details.amount)})</span>}
              {log.details?.description && <span className="text-ink-2"> · {log.details.description}</span>}
              <span className={`block ${CAP}`}>
                {log.created_at ? format(parseISO(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// --------------------------------------------------------------- "+ Registrar gasto" (um botão só)
function EscolherGasto({ open, onOpenChange, onGasto, onCompra }) {
  const opcao = "flex w-full items-start gap-3 rounded-xl border border-surface-line bg-white p-4 text-left hover:bg-surface min-h-[64px]";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] p-4 sm:w-full sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-plus-jakarta">Registrar gasto</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5">
          <button type="button" className={opcao} onClick={onGasto}>
            <MaterialIcon icon="receipt_long" size={22} className="mt-0.5 text-brand" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-ink">Um gasto do dia a dia</span>
              <span className={CAP}>Embalagem, gás, entrega, aluguel, imposto...</span>
            </span>
          </button>
          <button type="button" className={opcao} onClick={onCompra}>
            <MaterialIcon icon="add_shopping_cart" size={22} className="mt-0.5 text-brand" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-ink">Produto comprado fora da fábrica</span>
              <span className={CAP}>Para revender: entra no estoque e vira gasto junto.</span>
            </span>
          </button>
          <p className={CAP}>Pedido à fábrica não precisa: ele entra sozinho quando chega.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------- tela
export default function ResultadoV2({
  modelo,
  hasData,
  monthLabel,
  isCurrentMonth,
  onPrevMonth,
  onNextMonth,
  onBaixarRelatorio,
  gerandoRelatorio,
  estoque,
  paradosCount,
  onClickEstoque,
  despesas,
  onEditarDespesa,
  onExcluirDespesa,
  onRegistrarGasto,
  onLancarCompra,
  exportDespesas,
  exportVendas,
  auditLogs,
  mostrarDicaClientes,
  pedidosNaoConferidos = false,
}) {
  const [escolhendo, setEscolhendo] = useState(false);
  const abrirEscolha = () => setEscolhendo(true);
  const topo = (
    <Topo
      modelo={modelo}
      monthLabel={monthLabel}
      isCurrentMonth={isCurrentMonth}
      onPrevMonth={onPrevMonth}
      onNextMonth={onNextMonth}
      onBaixarRelatorio={onBaixarRelatorio}
      gerandoRelatorio={gerandoRelatorio}
    />
  );
  const escolha = (
    <EscolherGasto
      open={escolhendo}
      onOpenChange={setEscolhendo}
      onGasto={() => { setEscolhendo(false); onRegistrarGasto(); }}
      onCompra={() => { setEscolhendo(false); onLancarCompra(); }}
    />
  );

  // P3 S17 (item 4): mês vazio troca SÓ os blocos do mês; o resto continua (resultadoTela.js).
  const blocos = blocosDoResultado({ hasData });
  const tem = (b) => blocos.includes(b);
  const estoqueCard = <Estoque estoque={estoque} paradosCount={paradosCount} onClickEstoque={onClickEstoque} />;

  return (
    <div className="space-y-6" data-resultado="v2">
      {topo}
      <AvisoFabrica aviso={modelo.avisoFabrica} naoConferido={pedidosNaoConferidos} />

      {tem("doMes") && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-5 [&>*]:min-w-0">
          <div className="flex flex-col gap-4">
            <DeOndeVeio modelo={modelo} />
            <div className="hidden md:block">{estoqueCard}</div>
          </div>
          <ParaOndeFoi modelo={modelo} />
          <MaisVendidos modelo={modelo} monthLabel={monthLabel} />
        </div>
      )}
      {tem("vazio") && (
        <div className={`${CARTAO} text-center`} data-bloco="vazio">
          <p className="text-base font-semibold text-ink">Nada lançado neste mês</p>
          <p className="mb-4 mt-1 text-sm text-ink-2">Lance a primeira venda do mês ou registre um gasto para ver quanto sobrou.</p>
          <button type="button" onClick={abrirEscolha} className={`${BTN_PRIMARIO} min-h-[44px]`}>
            <MaterialIcon icon="add" size={18} aria-hidden="true" />
            Registrar gasto
          </button>
        </div>
      )}

      {tem("oQueMudou") && <OQueMudou modelo={modelo} mostrarDica={mostrarDicaClientes} />}

      {tem("estoque") && <div className={tem("doMes") ? "md:hidden" : ""}>{estoqueCard}</div>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-5 [&>*]:min-w-0">
        {tem("porMes") && <SobrouPorMes modelo={modelo} />}
        {tem("gastos") && (
          <GastosDoMes
            despesas={despesas}
            onEditar={onEditarDespesa}
            onExcluir={onExcluirDespesa}
            onRegistrarGasto={abrirEscolha}
            exportDespesas={exportDespesas}
          />
        )}
      </div>

      {tem("planilhaVendas") && exportVendas && exportVendas.count > 0 && (
        <section className={`${CARTAO} flex flex-wrap items-center justify-between gap-3`} aria-label="Planilha das vendas">
          <div>
            <h2 className="font-plus-jakarta text-base font-bold text-ink">Planilha das vendas</h2>
            <p className={CAP}>{exportVendas.count} venda{exportVendas.count !== 1 ? "s" : ""} em {monthLabel}</p>
          </div>
          <ExportButtons
            data={exportVendas.data}
            columns={exportVendas.columns}
            filename={exportVendas.filename}
            title={exportVendas.title}
            evento={exportVendas.evento}
          />
        </section>
      )}

      {tem("historico") && <Historico auditLogs={auditLogs} />}
      {escolha}
    </div>
  );
}
