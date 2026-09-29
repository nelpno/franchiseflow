// S25 (29/09/2026, chave ui_v2): peças do Estoque refeito pelo padrão novo (docs/claude/padrao-visual-admin.md).
// Lista enxuta (produto, quanto tem, situação só quando importa, quanto vende, quanto pedir) e o
// resto (custo, venda, markup, mínimo, categoria) ao abrir o produto. A conta da sugestão é a
// mesma da Reposição e do Novo Pedido (src/lib/stockSuggestion.js › sugestaoDeCompra).
import React from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { formatBRL } from "@/lib/formatters";
import { explicarSugestao, textoVenda } from "@/lib/stockSuggestion";
import {
  BTN_PRIMARIO,
  BTN_SECUNDARIO,
  CARTAO,
  LINK_ACAO,
  LISTA,
  CABECALHO_LISTA,
  ROTULO,
} from "@/components/shared/adminUi";

const CHIP_BASE = "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold";

/** Chip de situação: só aparece quando importa (acabou, acabando, negativo). */
export function ChipSituacao({ s }) {
  if (!s) return null;
  if (s.estoqueNegativo) {
    return <span className={`${CHIP_BASE} bg-err-soft text-err`}>Conte o estoque</span>;
  }
  if (s.situacao === "acabou") return <span className={`${CHIP_BASE} bg-err-soft text-err`}>Acabou</span>;
  if (s.situacao === "acabando") return <span className={`${CHIP_BASE} bg-warn-soft text-warn-ink`}>Acabando</span>;
  return null;
}

const fmtQtd = (v) => {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }).replace("-", "−");
};

/** Markup = quanto o preço de venda está acima do custo. null sem custo ou sem preço. */
export function markupDe(item) {
  const custo = parseFloat(item?.cost_price) || 0;
  const venda = parseFloat(item?.sale_price) || 0;
  if (custo <= 0 || venda <= 0) return null;
  return ((venda - custo) / custo) * 100;
}

// ---------------------------------------------------------------------------- resumo do topo

export function ResumoEstoque({ resumo, sugestaoStatus, onTentarDeNovo, onContar }) {
  const { acabando, negativos, valorCusto, valorVenda, paraPedir } = resumo;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <div className={`${CARTAO} col-span-2 md:col-span-1`}>
        <p className={ROTULO}>Acabando</p>
        {sugestaoStatus === "erro" ? (
          <>
            <p className="mt-2 text-sm text-ink-2">Não deu para ver seus pedidos abertos.</p>
            <button type="button" onClick={onTentarDeNovo} className={LINK_ACAO}>Tentar de novo</button>
          </>
        ) : (
          <>
            <p className="mt-2 font-plus-jakarta text-2xl font-extrabold tabular-nums text-ink sm:text-3xl">
              {sugestaoStatus === "ok" ? acabando : "…"}
              <span className="ml-1.5 text-base font-semibold text-ink-2">{acabando === 1 ? "produto" : "produtos"}</span>
            </p>
            <Link to="/Gestao?tab=reposicao" className={LINK_ACAO}>
              {paraPedir > 0 ? `Ver o que pedir (${paraPedir}) →` : "Ver a reposição →"}
            </Link>
          </>
        )}
      </div>
      <div className={CARTAO}>
        <p className={ROTULO}>Valor em estoque</p>
        <p className="mt-2 font-plus-jakarta text-xl font-extrabold tabular-nums text-ink sm:text-2xl">{formatBRL(valorCusto)}</p>
        <p className="mt-1 text-sm text-ink-2">pelo preço de custo</p>
      </div>
      <div className={CARTAO}>
        <p className={ROTULO}>Se vender tudo</p>
        <p className="mt-2 font-plus-jakarta text-xl font-extrabold tabular-nums text-ink sm:text-2xl">{formatBRL(valorVenda)}</p>
        <p className="mt-1 text-sm text-ink-2">pelo seu preço de venda</p>
      </div>
      {negativos > 0 && (
        <div className="col-span-2 flex flex-col gap-2 rounded-2xl border border-warn/40 bg-warn-soft p-4 sm:flex-row sm:items-center md:col-span-3">
          <MaterialIcon icon="warning" size={20} className="shrink-0 text-warn-ink" aria-hidden="true" />
          <p className="flex-1 text-sm text-ink">
            {negativos === 1 ? "1 produto está" : `${negativos} produtos estão`} com estoque abaixo de zero. Isso acontece
            quando sai venda de produto que não estava lançado. Conte o estoque para acertar.
          </p>
          <button type="button" onClick={onContar} className={`${BTN_SECUNDARIO} shrink-0`}>
            <MaterialIcon icon="checklist" size={18} aria-hidden="true" />
            Contar estoque
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------- lista

function TextoPedir({ info }) {
  if (!info?.daFabrica) return <span className="text-ink-3">—</span>;
  if (!info.pronta) return <span className="text-ink-3">…</span>;
  const s = info.s;
  if (s.repor > 0) return <span className="font-semibold text-brand-dark">Pedir {s.repor}</span>;
  if (s.aCaminho > 0) return <span className="text-ok-ink">{fmtQtd(s.aCaminho)} a caminho</span>;
  return <span className="text-ink-3">—</span>;
}

export function ListaEstoqueV2({ grupos, infoDe, onAbrir }) {
  return (
    <div className="space-y-4">
      <div className={LISTA}>
        <div className={`hidden md:grid md:grid-cols-[minmax(0,1fr)_110px_170px_130px_20px] md:items-center md:gap-4 ${CABECALHO_LISTA}`}>
          <span>Produto</span>
          <span className="text-right">Tem</span>
          <span>Vende</span>
          <span className="text-right">Sugestão</span>
          <span />
        </div>
        {grupos.map((grupo) => (
          <div key={grupo.label}>
            <p className="border-t border-surface-line bg-surface-2 px-4 py-2 text-sm font-bold text-ink-2 md:px-5">{grupo.label}</p>
            {grupo.items.map((item) => {
              const info = infoDe(item);
              const s = info?.s;
              const qtd = parseFloat(item.quantity) || 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onAbrir(item)}
                  className="block w-full border-t border-surface-line px-4 py-3 text-left transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none md:grid md:grid-cols-[minmax(0,1fr)_110px_170px_130px_20px] md:items-center md:gap-4 md:px-5"
                  aria-label={`${item.product_name}: abrir detalhes`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="line-clamp-2 min-w-0 font-semibold text-ink">{item.product_name}</span>
                    <ChipSituacao s={s} />
                  </span>
                  {/* celular: uma linha de apoio com tudo */}
                  <span className="mt-1 flex items-baseline justify-between gap-3 text-sm md:hidden">
                    <span className="min-w-0 text-ink-2 tabular-nums">
                      Tem <b className={qtd < 0 ? "text-err" : "text-ink"}>{fmtQtd(qtd)}</b> · {textoVenda(s)}
                    </span>
                    <span className="shrink-0 tabular-nums"><TextoPedir info={info} /></span>
                  </span>
                  {/* computador: colunas */}
                  <span className={`hidden text-right tabular-nums md:block ${qtd < 0 ? "font-semibold text-err" : "text-ink"}`}>
                    {fmtQtd(qtd)} {item.unit || "un"}
                  </span>
                  <span className="hidden text-sm text-ink-2 md:block">{s && s.porSemana > 0 ? textoVenda(s).replace("vende ", "") : "sem venda"}</span>
                  <span className="hidden text-right text-sm tabular-nums md:block"><TextoPedir info={info} /></span>
                  <MaterialIcon icon="chevron_right" size={18} className="hidden text-ink-3 md:block" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------- detalhe do produto

function Dado({ rotulo, valor, apoio }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <p className="text-xs font-semibold text-ink-3">{rotulo}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-ink">{valor}</p>
      {apoio && <p className="mt-0.5 text-xs text-ink-3">{apoio}</p>}
    </div>
  );
}

export function ItemEstoqueSheet({
  item,
  info,
  intervaloDias,
  categoria,
  onFechar,
  onEditar,
  onOcultar,
  onExcluir,
  onContar,
}) {
  const aberto = !!item;
  const s = info?.s;
  const qtd = parseFloat(item?.quantity) || 0;
  const markup = item ? markupDe(item) : null;
  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent
        side="bottom"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="rounded-t-2xl p-5 sm:bottom-8 sm:left-1/2 sm:right-auto sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:rounded-2xl"
      >
        {item && (
          <div className="space-y-4">
            <SheetHeader className="pr-10 text-left">
              <SheetTitle className="font-plus-jakarta text-lg font-bold leading-snug text-ink">{item.product_name}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                <span>{info?.daFabrica ? "Produto da fábrica" : "Produto seu"}</span>
                <ChipSituacao s={s} />
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={ROTULO}>Tem agora</p>
                <p className={`mt-1 font-plus-jakarta text-3xl font-extrabold tabular-nums ${qtd < 0 ? "text-err" : "text-ink"}`}>
                  {fmtQtd(qtd)} <span className="text-base font-semibold text-ink-2">{item.unit || "un"}</span>
                </p>
              </div>
              <div>
                <p className={ROTULO}>Vende</p>
                <p className="mt-1 text-sm text-ink">{s && s.porSemana > 0 ? `${textoVenda(s).replace("vende ", "")}` : "Sem venda nos últimos 3 meses"}</p>
                {s && s.porSemana > 0 && <p className="text-xs text-ink-3">média das últimas semanas</p>}
              </div>
            </div>

            {qtd < 0 && (
              <div className="rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm text-ink">
                O estoque ficou abaixo de zero: saiu venda deste produto sem ele estar lançado. Conte o que tem no freezer
                para acertar. Para a sugestão, contamos como zero.
                <button type="button" onClick={onContar} className={`${LINK_ACAO} block`}>Contar estoque →</button>
              </div>
            )}

            {info?.daFabrica && (
              <div className="rounded-xl border border-surface-line p-3">
                <p className="text-sm font-semibold text-ink">
                  {!info.pronta
                    ? "Calculando a sugestão…"
                    : s.repor > 0
                      ? `Sugestão: pedir ${s.repor}`
                      : "Sugestão: nada a pedir agora"}
                </p>
                {info.pronta && <p className="mt-1 text-sm text-ink-2">{explicarSugestao(s, intervaloDias)}</p>}
                <Link to="/Gestao?tab=reposicao" onClick={onFechar} className={LINK_ACAO}>Ir para a Reposição →</Link>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Dado rotulo="Preço de venda" valor={parseFloat(item.sale_price) > 0 ? formatBRL(item.sale_price) : "Sem preço"} />
              <Dado rotulo="Custo" valor={parseFloat(item.cost_price) > 0 ? formatBRL(item.cost_price) : "—"} />
              <Dado
                rotulo="Markup"
                valor={markup === null ? "—" : `${Math.round(markup)}%`}
                apoio="quanto a venda está acima do custo (recomendado: 100%)"
              />
              <Dado
                rotulo="Mínimo"
                valor={fmtQtd(item.min_stock)}
                apoio={info?.daFabrica ? "a sugestão nunca fica abaixo disso" : "abaixo disso, aparece como acabando"}
              />
              <Dado rotulo="Categoria" valor={categoria || "—"} />
              <Dado rotulo="Unidade" valor={item.unit || "un"} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={onEditar} className={`${BTN_PRIMARIO} min-h-11 flex-1`}>
                <MaterialIcon icon="edit" size={18} aria-hidden="true" />
                Editar produto
              </button>
              <button type="button" onClick={onOcultar} className={`${BTN_SECUNDARIO} min-h-11`}>
                <MaterialIcon icon="visibility_off" size={18} aria-hidden="true" />
                Ocultar
              </button>
            </div>
            <p className="text-xs text-ink-3">Ocultar: o robô deixa de oferecer e o produto sai da reposição. Dá para reativar depois.</p>
            <button type="button" onClick={onExcluir} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-err hover:underline">
              <MaterialIcon icon="delete" size={18} aria-hidden="true" />
              Excluir produto
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
