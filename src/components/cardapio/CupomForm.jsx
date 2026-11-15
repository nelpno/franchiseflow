// Cartão "Cupom de desconto" do Cardápio digital (Fase 1, 11/11/2026; mockup cs-celso/analises/2026-11-11-cupom-fidelidade-mockup.html, tela A).
// Quatro campos: interruptor, desconto (5/10/15/20%), código e "vale até" (opcional). Vale para o cardápio E para o robô (quem só
// fala com o robô digita o código na conversa). Texto fixo: cada cliente usa uma vez, não soma com promoção, só nos produtos.
// RPC cardapio_configurar { cupom: {ativo, pct, codigo, vale_ate} } (SQL site/pedido/supabase/2026-11-11b-cupom.sql). Desligado por padrão.
// O interruptor grava na hora (com o que já está salvo); os campos gravam em "Salvar cupom".
import { useEffect, useState } from "react";
import Interruptor from "@/components/cardapio/Interruptor";
import { BTN_PRIMARIO, CARTAO, CHIP, CHIP_ATIVO, CHIP_INATIVO, H2, H3_CARTAO, TOM_ATENCAO } from "@/components/shared/adminUi";
import { CUPOM_PCTS, cupomDoPainel, erroCupom, fraseCupomCliente, limparCodigo } from "@/lib/cupom";
import { formatBRL as formatCurrency } from "@/lib/formatters";

const CAMPO = "h-11 w-full rounded-xl border border-surface-line bg-white px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30";
const ROTULO_CAMPO = "mb-1 block text-sm font-semibold text-ink";

export default function CupomForm({ painel, hojeISO, salvando, onSalvar }) {
  const salvo = cupomDoPainel(painel);
  const [pct, setPct] = useState(salvo?.pct ?? 10);
  const [codigo, setCodigo] = useState(salvo?.codigo ?? "");
  const [ate, setAte] = useState(salvo?.vale_ate ?? "");
  const [tentou, setTentou] = useState(false);
  // volta ao salvo quando o painel muda (gravou, outra aba, troca de unidade)
  const chave = salvo ? `${salvo.pct}|${salvo.codigo}|${salvo.vale_ate || ""}` : "";
  useEffect(() => {
    if (!salvo) return;
    setPct(salvo.pct); setCodigo(salvo.codigo); setAte(salvo.vale_ate || ""); setTentou(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, painel?.evo]);
  if (!salvo) return null; // banco sem a coluna (rollback): o cartão some

  const campos = { pct, codigo: limparCodigo(codigo), vale_ate: ate || null };
  const mudou = campos.pct !== salvo.pct || campos.codigo !== salvo.codigo || (campos.vale_ate || null) !== (salvo.vale_ate || null);
  const erro = erroCupom({ ...campos, ativo: salvo.ativo }, hojeISO);
  const ocupado = !!salvando;
  const bloqueadoPelaMaxi = !salvo.ativo && !salvo.chaveLigada;

  const alternar = (ligar) => {
    // liga com o que está SALVO (prévia e código já vêm preenchidos); editar é no botão Salvar
    const e = erroCupom({ pct: salvo.pct, codigo: salvo.codigo, vale_ate: salvo.vale_ate, ativo: ligar }, hojeISO);
    if (ligar && e) { setTentou(true); return; }
    onSalvar({ ativo: ligar, pct: salvo.pct, codigo: salvo.codigo, vale_ate: salvo.vale_ate }, ligar ? "ligado" : "desligado");
  };
  const salvar = () => {
    setTentou(true);
    if (erro) return;
    onSalvar({ ativo: salvo.ativo, ...campos }, "salvo");
  };

  return (
    <section className="space-y-3" aria-labelledby="cardapio-cupom">
      <div className="space-y-1">
        <h2 id="cardapio-cupom" className={H2}>Cupom de desconto</h2>
        <p className="text-sm text-ink-3">Vale para o cardápio e para o robô. Seu cliente digita o código e o desconto entra sozinho.</p>
      </div>

      <div className={`${CARTAO} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={H3_CARTAO}>{salvo.ativo ? `Cupom ${salvo.codigo}` : "Cupom desligado"}</h3>
            {salvo.ativo && !salvo.vencido && <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok-ink">Ligado</span>}
            {salvo.ativo && salvo.vencido && <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-semibold text-warn-ink">Venceu</span>}
          </div>
          <Interruptor checked={salvo.ativo} disabled={ocupado || bloqueadoPelaMaxi} ariaLabel="Cupom ligado"
            rotulo={salvo.ativo ? "Ligado" : "Desligado"} onCheckedChange={alternar} />
        </div>

        {bloqueadoPelaMaxi && (
          <p className={`${TOM_ATENCAO} text-sm text-ink`}>A Maxi pausou o cupom da sua unidade. Fale com a Maxi para voltar.</p>
        )}
        {salvo.ativo && salvo.vencido && (
          <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn-ink">O cupom venceu e não está valendo. Mude o "vale até" ou desligue.</p>
        )}

        <div>
          <p className={ROTULO_CAMPO}>Desconto</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Desconto do cupom">
            {CUPOM_PCTS.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={pct === p} onClick={() => setPct(p)}
                className={`${CHIP} ${pct === p ? CHIP_ATIVO : CHIP_INATIVO}`}>{p}%</button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={ROTULO_CAMPO} htmlFor="cupom-codigo">Código do cupom</label>
            <input id="cupom-codigo" className={`${CAMPO} font-mono uppercase tracking-wide`} maxLength={20} autoCapitalize="characters" autoComplete="off"
              value={codigo} onChange={(e) => setCodigo(limparCodigo(e.target.value))} />
            <p className="mt-1 text-xs text-ink-3">Seu cliente digita este código. Sem espaço nem acento.</p>
          </div>
          <div>
            <label className={ROTULO_CAMPO} htmlFor="cupom-ate">Vale até (opcional)</label>
            <input id="cupom-ate" className={CAMPO} type="date" min={hojeISO} value={ate} onChange={(e) => setAte(e.target.value)} />
            <p className="mt-1 text-xs text-ink-3">Sem data, vale até você desligar.</p>
          </div>
        </div>

        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
          Cada cliente usa uma vez. Não soma com promoção: vale o maior desconto. O desconto é só nos produtos, não no frete.
        </p>

        <div>
          <p className={ROTULO_CAMPO}>Como o cliente vê</p>
          <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">{fraseCupomCliente({ ...campos })}</p>
        </div>

        {tentou && erro && <p className="text-sm font-semibold text-err" role="alert">{erro}</p>}

        <button type="button" className={`${BTN_PRIMARIO} min-h-11 w-full sm:w-auto`} onClick={salvar} disabled={ocupado || (!mudou && !tentou)}>
          {salvando ? "Salvando…" : "Salvar cupom"}
        </button>
      </div>

      <div className={`${CARTAO} space-y-2`}>
        <h3 className={H3_CARTAO}>Resultado do cupom (30 dias)</h3>
        {salvo.usos30d > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="font-plus-jakarta text-2xl font-extrabold tabular-nums text-ink">{salvo.usos30d}</p>
              <p className="text-sm text-ink-2">{salvo.usos30d === 1 ? "uso do cupom" : "usos do cupom"}</p>
            </div>
            <div>
              <p className="font-plus-jakarta text-2xl font-extrabold tabular-nums text-ink">{formatCurrency(salvo.desconto30d)}</p>
              <p className="text-sm text-ink-2">de desconto dado</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-2">Ainda sem uso nos últimos 30 dias. Quando um cliente usar, a venda aparece em Vendas com a etiqueta do cupom.</p>
        )}
      </div>
    </section>
  );
}
