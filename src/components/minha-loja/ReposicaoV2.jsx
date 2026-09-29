// S25 (29/09/2026, chave ui_v2): Reposição num bloco só. Antes eram dois cartões repetindo a
// mesma lista ("Acabando (24)" com 24 botões "Repor N" + "Sugestão de reposição"). Agora: um
// cartão com a sugestão do próximo pedido, o porquê de cada linha e UMA ação principal, que abre
// o Novo Pedido já preenchido. A conta é a mesma do Estoque e do formulário
// (src/lib/stockSuggestion.js › sugestaoDeCompra).
import React, { useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { textoIntervalo, textoVenda, PRAZO_ENTREGA_DIAS } from "@/lib/stockSuggestion";
import { BTN_PRIMARIO, BTN_SECUNDARIO, CARTAO, H3_CARTAO, LINK_ACAO } from "@/components/shared/adminUi";
import { ChipSituacao } from "./EstoqueV2";

const VISIVEIS = 8;
const fmt = (n) => (parseFloat(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function LinhaSugestao({ l }) {
  const partes = [`Tem ${fmt(l.estoque).replace("-", "−")}`];
  if (l.aCaminho > 0) partes.push(`${fmt(l.aCaminho)} a caminho`);
  partes.push(textoVenda(l));
  if (l.motivo === "minimo") partes.push(`mínimo ${fmt(l.minimo)}`);
  return (
    <li className="flex items-center gap-3 border-t border-surface-line py-3 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-ink">{l.item.product_name}</span>
          <ChipSituacao s={l} />
        </p>
        <p className="mt-0.5 text-sm text-ink-2 tabular-nums">{partes.join(" · ")}</p>
      </div>
      <p className="shrink-0 text-right tabular-nums">
        <span className="block text-xs text-ink-3">pedir</span>
        <span className="font-plus-jakarta text-lg font-extrabold text-ink">{l.repor}</span>
      </p>
    </li>
  );
}

export default function ReposicaoV2({
  status,
  onTentarDeNovo,
  resumo,
  intervalo,
  temVenda,
  primeiroPedido,
  onMontar,
  onNovo,
  onRepetir,
  podeRepetir,
}) {
  const [verTodos, setVerTodos] = useState(false);
  const pronto = status === "ok";
  const lista = resumo?.paraPedir || [];
  const visiveis = verTodos ? lista : lista.slice(0, VISIVEIS);
  const escondidos = lista.length - visiveis.length;

  const botaoRepetir = (
    <button type="button" onClick={onRepetir} disabled={!podeRepetir} className={`${BTN_SECUNDARIO} min-h-11`}>
      <MaterialIcon icon="replay" size={18} aria-hidden="true" />
      Repetir último pedido
    </button>
  );

  return (
    <section className={`${CARTAO} space-y-4`} aria-labelledby="titulo-proximo-pedido">
      <div>
        <h2 id="titulo-proximo-pedido" className={H3_CARTAO}>Próximo pedido à fábrica</h2>
        {primeiroPedido ? (
          <p className="mt-1 text-sm text-ink-2">
            É o seu primeiro pedido: abrimos com o pedido modelo da Maxi. Mude o que quiser antes de enviar.
          </p>
        ) : status === "carregando" ? (
          <p className="mt-1 text-sm text-ink-2">Conferindo o que já está a caminho…</p>
        ) : status === "erro" ? (
          <p className="mt-1 text-sm text-ink-2">
            Não conseguimos ver seus pedidos abertos agora. A sugestão fica desligada para não pedir em dobro.
          </p>
        ) : lista.length > 0 ? (
          <p className="mt-1 text-sm text-ink-2">
            Pelas suas vendas, sugerimos <b className="text-ink">{lista.length} {lista.length === 1 ? "produto" : "produtos"}</b>,{" "}
            {resumo.unidades} {resumo.unidades === 1 ? "unidade" : "unidades"} no total.
          </p>
        ) : (
          <p className="mt-1 flex items-start gap-2 text-sm text-ink-2">
            <MaterialIcon icon="check_circle" size={18} className="mt-0.5 shrink-0 text-ok-ink" aria-hidden="true" />
            {temVenda
              ? "Nada para pedir agora: o que você tem cobre até a entrega seguinte."
              : "Ainda sem vendas para calcular. Faça o pedido do seu jeito."}
          </p>
        )}
      </div>

      {/* Ações: uma principal */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {primeiroPedido ? (
          <button type="button" onClick={onNovo} className={`${BTN_PRIMARIO} min-h-11`}>
            <MaterialIcon icon="add_shopping_cart" size={18} aria-hidden="true" />
            Novo pedido
          </button>
        ) : pronto && lista.length > 0 ? (
          <>
            <button type="button" onClick={onMontar} className={`${BTN_PRIMARIO} min-h-11`}>
              <MaterialIcon icon="add_shopping_cart" size={18} aria-hidden="true" />
              Montar pedido com a sugestão
            </button>
            {botaoRepetir}
          </>
        ) : status === "erro" ? (
          <>
            <button type="button" onClick={onTentarDeNovo} className={`${BTN_PRIMARIO} min-h-11`}>
              <MaterialIcon icon="refresh" size={18} aria-hidden="true" />
              Tentar de novo
            </button>
            <button type="button" onClick={onNovo} className={`${BTN_SECUNDARIO} min-h-11`}>
              Novo pedido sem sugestão
            </button>
          </>
        ) : status === "carregando" ? (
          <button type="button" disabled className={`${BTN_PRIMARIO} min-h-11`}>
            <MaterialIcon icon="add_shopping_cart" size={18} aria-hidden="true" />
            Montar pedido com a sugestão
          </button>
        ) : (
          <>
            <button type="button" onClick={onNovo} className={`${BTN_PRIMARIO} min-h-11`}>
              <MaterialIcon icon="add_shopping_cart" size={18} aria-hidden="true" />
              Novo pedido
            </button>
            {botaoRepetir}
          </>
        )}
      </div>

      {status === "carregando" && !primeiroPedido && (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl motion-reduce:animate-none" />)}
        </div>
      )}

      {pronto && !primeiroPedido && lista.length > 0 && (
        <>
          <ul aria-label="Produtos sugeridos">
            {visiveis.map((l) => <LinhaSugestao key={l.item.id} l={l} />)}
          </ul>
          {escondidos > 0 && (
            <button type="button" onClick={() => setVerTodos(true)} className={LINK_ACAO}>
              Ver os outros {escondidos} →
            </button>
          )}
          <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
            <b className="text-ink">Como calculamos:</b> o que você vende por semana, para durar até a entrega seguinte.
            Você costuma pedir {textoIntervalo(intervalo?.dias)}
            {intervalo?.daUnidade ? "" : " (média da rede)"}, a entrega leva ~{PRAZO_ENTREGA_DIAS} dias e somamos 1 semana de
            folga. Já descontamos o que você tem e o que está a caminho. O seu mínimo vale como piso para o que vende. Produto sem venda em 3 meses não entra.
          </p>
        </>
      )}
    </section>
  );
}
