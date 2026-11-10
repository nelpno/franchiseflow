// Entrega de hoje (v8, 10/11/2026, feedback do Imirim: "às vezes a Cida tem que dar uma saída"). Um toque pausa a
// entrega no cardápio ("hoje" ou "até HH:MM") e ela volta sozinha. Junto, o prazo do "o quanto antes" que o cardápio
// mostra ("Em cerca de 50 min"): é o MESMO "tempo de entrega" do Meu robô, que o robô também fala.
// RPC cardapio_configurar {entrega_pausa: null|"hoje"|"HH:MM"} e {entrega_prazo_min} (site/pedido/supabase/2026-11-10d-*).
// O robô NÃO sabe da pausa: só o cardápio muda.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BTN_PRIMARIO, BTN_SECUNDARIO, CARTAO, H3_CARTAO, LINK_ACAO, TOM_ATENCAO } from "@/components/shared/adminUi";
import { erroPausaAte, erroPrazo, situacaoPausa } from "@/lib/cardapioDigital";

const CAMPO = "h-11 rounded-xl border border-surface-line bg-white px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30";

// "18:30" -> "18h30", "18:00" -> "18h"
const hora = (t) => { const m = String(t || "").match(/^(\d{1,2}):(\d{2})/); return m ? `${Number(m[1])}h${m[2] === "00" ? "" : m[2]}` : ""; };

function agoraMinBRT() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
}

export default function EntregaHojeCard({ painel, hojeISO, salvando, onPausar, onPrazo }) {
  const [ate, setAte] = useState("");
  const [erroAte, setErroAte] = useState("");
  const [prazo, setPrazo] = useState(painel?.entrega_prazo_min ?? "");
  const [erroP, setErroP] = useState("");
  useEffect(() => { setPrazo(painel?.entrega_prazo_min ?? ""); }, [painel?.entrega_prazo_min]);
  if (!painel?.tem_entrega) return null;

  const pausa = situacaoPausa(painel.entrega_pausa_ate, hojeISO, agoraMinBRT());
  const prazoAtual = painel.entrega_prazo_min; // já com a regra do banco (cardapio_prazo_entrega)
  const pausarAte = () => {
    const e = erroPausaAte(ate, agoraMinBRT());
    setErroAte(e);
    if (!e) onPausar(ate);
  };
  const salvarPrazo = () => {
    const e = erroPrazo(prazo === "" ? "" : Number(prazo));
    setErroP(e);
    if (!e) onPrazo(Number(prazo));
  };
  const ocupado = !!salvando;

  return (
    <section className={`${pausa.pausada ? TOM_ATENCAO : CARTAO} space-y-4`} aria-labelledby="cardapio-entrega-hoje">
      <div className="space-y-1">
        <h2 id="cardapio-entrega-hoje" className={H3_CARTAO}>Entrega de hoje</h2>
        {pausa.pausada ? (
          <p className="text-sm font-semibold text-ink" role="status">{pausa.texto}</p>
        ) : (
          <p className="text-sm text-ink-2">
            Entrega funcionando.{prazoAtual ? <> No cardápio, a primeira opção de hoje é <strong className="font-semibold text-ink">Em cerca de {prazoAtual} min</strong>.</> : null}
          </p>
        )}
        {pausa.pausada && <p className="text-sm text-ink-2">No cardápio, o cliente vê o aviso e ainda pode retirar ou agendar a entrega para depois.</p>}
      </div>

      {pausa.pausada ? (
        <button type="button" className={`${BTN_PRIMARIO} min-h-11`} disabled={ocupado} onClick={() => onPausar(null)}>
          {salvando === "pausa" ? "Salvando…" : "Voltar a entregar agora"}
        </button>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} disabled={ocupado} onClick={() => onPausar("hoje")}>
            {salvando === "pausa" ? "Salvando…" : "Pausar a entrega hoje"}
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

      {/* "pedidos até" do dia: o MESMO campo do Meu robô que o robô lê (delivery_schedule[].order_cutoff); edita só lá */}
      {painel.entrega_fim_hoje && (
        <p className="text-sm text-ink-2">
          {painel.entrega_corte_hoje
            ? <>Aceita pedido para entrega hoje até as <strong className="font-semibold text-ink">{hora(painel.entrega_corte_hoje)}</strong>. Até lá o cardápio mostra o “o quanto antes”.</>
            : <>Sem horário-limite de pedido hoje: o “o quanto antes” sai do cardápio quando faltam menos de {prazoAtual || "N"} min para as {hora(painel.entrega_fim_hoje)}.</>}{" "}
          <Link to="/FranchiseSettings" className={LINK_ACAO}>Mudar no Meu robô →</Link>
        </p>
      )}

      <div className="border-t border-surface-line pt-4">
        <label className="block text-sm font-semibold text-ink" htmlFor="entrega-prazo">Prazo da entrega (o quanto antes)</label>
        <p className="mb-2 text-sm text-ink-2">É o mesmo tempo de entrega do Meu robô: o robô também fala esse prazo.</p>
        <div className="flex items-center gap-2">
          <input id="entrega-prazo" type="number" inputMode="numeric" step="5" className={`${CAMPO} w-24`}
            value={prazo} onChange={(e) => { setPrazo(e.target.value); setErroP(""); }}
            aria-invalid={!!erroP} aria-describedby={erroP ? "entrega-prazo-erro" : undefined} />
          <span className="text-sm text-ink-2">min</span>
          <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} disabled={ocupado || String(prazo) === String(painel.entrega_prazo_min ?? "")} onClick={salvarPrazo}>
            {salvando === "prazo" ? "Salvando…" : "Salvar"}
          </button>
        </div>
        {erroP && <p id="entrega-prazo-erro" className="mt-1 text-sm text-err" role="alert">{erroP}</p>}
      </div>
    </section>
  );
}
