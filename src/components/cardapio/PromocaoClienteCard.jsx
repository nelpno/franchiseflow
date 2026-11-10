// Texto da promoção que o CLIENTE vê no topo do cardápio (10l, 10/11/2026). O texto livre do Meu robô (promotions_combo) é
// escrito PARA O ROBÔ (regras, códigos, "nunca diga…") e não vai mais ao cardápio; aqui a unidade escreve até 160 letras,
// com a prévia "Como o cliente vê" e uma sugestão tirada do texto do robô. Promoção estruturada (kit/leve N) gera o próprio texto.
import { useEffect, useState } from "react";
import { BTN_PRIMARIO, BTN_SECUNDARIO, CARTAO, H3_CARTAO } from "@/components/shared/adminUi";
import { PROMO_CLIENTE_MAX, sugestaoPromocaoCliente } from "@/lib/cardapioDigital";

export default function PromocaoClienteCard({ painel, salvando, onSalvar }) {
  const salvo = painel?.promocao_cliente || "";
  const sugestao = salvo ? "" : sugestaoPromocaoCliente(painel?.promocao_texto);
  const [texto, setTexto] = useState(salvo || sugestao);
  useEffect(() => { setTexto(painel?.promocao_cliente || sugestaoPromocaoCliente(painel?.promocao_texto)); }, [painel?.promocao_cliente, painel?.promocao_texto]);
  const limpo = texto.replace(/\s+/g, " ").trim();
  const exibida = painel?.promocao_cliente_exibida || "";
  const mudou = limpo !== salvo;

  return (
    <section className={`${CARTAO} space-y-3`} aria-labelledby="cardapio-promo-cliente">
      <div className="space-y-1">
        <h2 id="cardapio-promo-cliente" className={H3_CARTAO}>Promoção no cardápio</h2>
        <p className="text-sm text-ink-2">
          O texto do Meu robô é para o robô. Aqui vai a frase curta que o cliente lê no topo do cardápio.
        </p>
      </div>
      <p className="text-sm text-ink" data-promo-status>
        {exibida ? <>No ar agora: <strong className="font-semibold">“{exibida}”</strong></> : "Hoje o cardápio não mostra promoção."}
      </p>
      <div>
        <label htmlFor="promo-cliente" className="text-sm font-semibold text-ink">Texto para o cliente</label>
        <textarea id="promo-cliente" rows={3} maxLength={PROMO_CLIENTE_MAX} value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: Leve 2 kg de nhoque e ganhe 5% de desconto."
          className="mt-1 w-full resize-y rounded-xl border border-surface-line bg-white px-3 py-2 text-base text-ink focus:border-brand focus:outline-none" />
        <p className="mt-1 text-xs text-ink-3">
          {limpo.length}/{PROMO_CLIENTE_MAX}{sugestao && !salvo && limpo === sugestao ? " · sugestão tirada do texto do robô: confira antes de salvar" : ""}
        </p>
      </div>
      {limpo && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-3">Como o cliente vê</p>
          <p className="mt-1 rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark" data-promo-previa>{limpo}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${BTN_PRIMARIO} min-h-11`} disabled={salvando || !limpo || !mudou} onClick={() => onSalvar(limpo)}>
          {salvando ? "Salvando…" : "Salvar texto"}
        </button>
        {salvo && (
          <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} disabled={salvando} onClick={() => onSalvar(null)}>
            Não mostrar promoção
          </button>
        )}
      </div>
    </section>
  );
}
