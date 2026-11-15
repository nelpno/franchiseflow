// Entrega de hoje (v8, 10/11/2026, feedback do Imirim: "às vezes a Cida tem que dar uma saída"). Um toque pausa a
// entrega ("hoje" ou "até HH:MM") e ela volta sozinha. Vale para o cardápio E para o robô (vw_dadosunidade.entrega_pausada_ate,
// patch ped-pausa-hora do V5, desde 10/11 20:02Z). RPC cardapio_configurar {entrega_pausa: null|"hoje"|"HH:MM"}.
// Junção Meu robô × Cardápio (10/11/2026): o prazo do "o quanto antes" e o "pedidos até" são só do Meu robô; aqui só
// mostra (painel.entrega_prazo_min = cardapio_prazo_unidade, a regra do robô; null = dentro da janela, sem "o quanto antes").
// Aparece também antes de ligar o cardápio (a pausa vale para o robô).
import { useState } from "react";
import { Link } from "react-router-dom";
import { BTN_PRIMARIO, BTN_SECUNDARIO, CARTAO, H3_CARTAO, LINK_ACAO, TOM_ATENCAO } from "@/components/shared/adminUi";
import { erroPausaAte, linkMeuRobo, situacaoPausa } from "@/lib/cardapioDigital";

const CAMPO = "h-11 rounded-xl border border-surface-line bg-white px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30";

// "18:30" -> "18h30", "18:00" -> "18h"
const hora = (t) => { const m = String(t || "").match(/^(\d{1,2}):(\d{2})/); return m ? `${Number(m[1])}h${m[2] === "00" ? "" : m[2]}` : ""; };

function agoraMinBRT() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
}

export default function EntregaHojeCard({ painel, hojeISO, salvando, onPausar }) {
  const [ate, setAte] = useState("");
  const [erroAte, setErroAte] = useState("");
  if (!painel?.tem_entrega) return null;

  const pausa = situacaoPausa(painel.entrega_pausa_ate, hojeISO, agoraMinBRT());
  const prazo = painel.entrega_prazo_min; // regra do robô, do banco (cardapio_prazo_unidade); null = dentro da janela
  const fim = hora(painel.entrega_fim_hoje);
  const pausarAte = () => {
    const e = erroPausaAte(ate, agoraMinBRT());
    setErroAte(e);
    if (!e) onPausar(ate);
  };
  const ocupado = !!salvando;

  return (
    <section className={`${pausa.pausada ? TOM_ATENCAO : CARTAO} space-y-4`} aria-labelledby="cardapio-entrega-hoje">
      <div className="space-y-1">
        <h2 id="cardapio-entrega-hoje" className={H3_CARTAO}>Entrega de hoje</h2>
        {pausa.pausada ? (
          <p className="text-sm font-semibold text-ink" role="status">{pausa.texto}</p>
        ) : prazo ? (
          <p className="text-sm text-ink-2" data-entrega-status="prazo">
            Entrega funcionando. No cardápio e no robô, a primeira opção de hoje é <strong className="font-semibold text-ink">“em cerca de {prazo} min”</strong>.
          </p>
        ) : (
          <p className="text-sm text-ink-2" data-entrega-status="janela">
            Entrega funcionando, dentro da janela {fim ? <>de hoje (até as <strong className="font-semibold text-ink">{fim}</strong>)</> : "do dia"}. Sem “o quanto antes”: você entrega na rota do dia.
          </p>
        )}
        {pausa.pausada && <p className="text-sm text-ink-2">O cliente vê o aviso e ainda pode retirar ou agendar a entrega para depois.</p>}
      </div>

      {pausa.pausada ? (
        <button type="button" className={`${BTN_PRIMARIO} min-h-11`} disabled={ocupado} onClick={() => onPausar(null)}>
          {salvando ? "Salvando…" : "Voltar a entregar agora"}
        </button>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} disabled={ocupado} onClick={() => onPausar("hoje")}>
            {salvando ? "Salvando…" : "Pausar a entrega hoje"}
          </button>
          <div className="flex items-end gap-2">
            <label className="flex flex-col text-sm font-semibold text-ink" htmlFor="entrega-pausa-ate">
              <span className="mb-1">ou pausar até</span>
              <input id="entrega-pausa-ate" type="time" className={`${CAMPO} w-32`} value={ate}
                onChange={(e) => { setAte(e.target.value); setErroAte(""); }} aria-invalid={!!erroAte} aria-describedby={erroAte ? "entrega-pausa-erro" : undefined} />
            </label>
            <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} disabled={ocupado} onClick={pausarAte}>Pausar</button>
          </div>
        </div>
      )}
      {erroAte && !pausa.pausada && <p id="entrega-pausa-erro" className="text-sm text-err" role="alert">{erroAte}</p>}
      <p className="text-sm text-ink-3">Vale para o cardápio e para o robô: os dois param de oferecer entrega hoje e voltam sozinhos.</p>

      {/* "pedidos até" do dia e prazo: os MESMOS campos do Meu robô que o robô lê; editam só lá */}
      <div className="border-t border-surface-line pt-4 text-sm text-ink-2">
        {painel.entrega_fim_hoje && painel.entrega_corte_hoje && (
          <p className="mb-1">Aceita pedido para entrega hoje até as <strong className="font-semibold text-ink">{hora(painel.entrega_corte_hoje)}</strong>.</p>
        )}
        <p>
          Prazo e horário-limite vêm do Meu robô.{" "}
          <Link to={linkMeuRobo(2, "entrega")} className={LINK_ACAO}>Mudar no Meu robô →</Link>
        </p>
      </div>
    </section>
  );
}
