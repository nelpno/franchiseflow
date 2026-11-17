// Assessor do CS (17/11/2026): chat dentro do dashboard para a equipe de CS e admins.
// O Celso pergunta ("como está a Lapa?", "o que faço hoje?", "prepara a reunião com Campinas") e a
// Edge Function `cs-assessor` responde com os dados reais, lidos com o login dele (só leitura).
//   <AssessorChat />                                   // Mural: conversa geral
//   <AssessorChat franchiseEvo={evo} nomeUnidade="Lapa" />   // Ficha: já com a unidade em foco
//
// Registro no Mural pelo chat: o assessor só PROPÕE (campo `proposta` da resposta); quem grava é o botão
// "Confirmar" deste componente, direto na RPC `registrar_cs_conversa` com o JWT do usuário.
// Voz: Web Speech API do navegador (pt-BR, sem custo); o texto ditado cai no campo e a pessoa confere antes
// de enviar. Sem suporte no navegador, o botão do microfone não aparece.
import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BTN_CONTORNO_MARCA, BTN_PRIMARIO, BTN_SECUNDARIO } from "@/components/shared/adminUi";
import { registrarCsConversa } from "@/entities/csMural";
import { CANAL_LABEL, RESULTADO_LABEL } from "@/lib/csMural";
import { registrarEvento } from "@/lib/telemetria";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import MarkdownSimples from "./MarkdownSimples";

const PAPEIS = ["admin", "manager", "customer_success"];
const CHAVE_HISTORICO = "cs-assessor-historico-v1";
const MAX_ENVIADAS = 16;

const SUGESTOES_GERAIS = [
  "O que faço hoje?",
  "Quem está há mais de 30 dias sem comprar?",
  "Qual a mediana de venda da rede no mês?",
  "Quais unidades estão críticas no radar?",
];
const sugestoesDaUnidade = (nome) => [
  "O que faço hoje?",
  `Prepara a reunião com ${nome}`,
  `Como está ${nome}?`,
  `O que foi combinado com ${nome}?`,
];

function lerHistorico() {
  try {
    const bruto = sessionStorage.getItem(CHAVE_HISTORICO);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}
function gravarHistorico(lista) {
  try { sessionStorage.setItem(CHAVE_HISTORICO, JSON.stringify(lista.slice(-40))); } catch { /* sem storage */ }
}

async function perguntar(messages, franchiseEvo) {
  const { data, error } = await supabase.functions.invoke("cs-assessor", {
    body: { messages, franchise_evo: franchiseEvo || undefined },
  });
  if (error) {
    // A função escreve o motivo no corpo; o invoke só diz "non-2xx".
    let detalhe = "";
    try { detalhe = (await error.context?.json?.())?.error || ""; } catch { /* sem corpo */ }
    throw new Error(detalhe || "O Assessor não respondeu. Tente de novo.");
  }
  return data;
}

function suporteVoz() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// ---------------------------------------------------------------- cartão "Registrar no Mural?"
const RESULTADOS = ["vai_fazer", "recusou", "nao_respondeu", "causa_conhecida", "resolvido"];
const CAMPO = "h-11 w-full rounded-xl border border-surface-line bg-white px-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none";

function PropostaCard({ proposta, registrado, onRegistrado }) {
  const [canal, setCanal] = useState(proposta.canal || "mensagem");
  const [resultado, setResultado] = useState(proposta.resultado || "vai_fazer");
  const [combinado, setCombinado] = useState(proposta.combinado || "");
  const [data, setData] = useState(proposta.proxima_data || "");
  const [nota, setNota] = useState(proposta.nota || "");
  const [salvando, setSalvando] = useState(false);
  const hoje = format(new Date(), "yyyy-MM-dd");

  if (registrado) {
    return (
      <div className="rounded-2xl border border-surface-line bg-brand-soft p-3 text-sm text-ink">
        <MaterialIcon icon="check" size={18} className="mr-1 align-text-bottom text-brand-dark" aria-hidden="true" />
        Registrado no Mural: {proposta.unidade}.
      </div>
    );
  }

  const confirmar = async () => {
    if (resultado === "causa_conhecida" && combinado.trim().length < 3) { toast.error("Escreva a causa. Ela aparece no cartão."); return; }
    if (resultado !== "resolvido" && data && data < hoje) { toast.error("A data de voltar não pode ser no passado."); return; }
    setSalvando(true);
    try {
      await registrarCsConversa(
        proposta.franchise_id, null, canal, resultado,
        combinado.trim() || null,
        resultado === "resolvido" ? null : data || null,
        nota.trim() || null, null,
      );
      registrarEvento("assessor_registro_confirmado", { detalhe: resultado });
      toast.success("Registrado no Mural.");
      onRegistrado();
    } catch (e) {
      toast.error(safeErrorMessage(e, "Não foi possível registrar no Mural."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-brand-gold-line bg-brand-gold-soft p-3 sm:p-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-ink-3">Registrar no Mural?</div>
        <div className="font-plus-jakarta text-base font-bold text-ink">{proposta.unidade}</div>
        <p className="text-xs text-ink-2">Nada foi gravado ainda. Confira, edite se precisar e confirme.</p>
      </div>
      <label className="block text-xs font-semibold text-ink-2">
        Como falou
        <select value={canal} onChange={(e) => setCanal(e.target.value)} className={`${CAMPO} mt-1 font-normal`}>
          {Object.keys(CANAL_LABEL).map((c) => <option key={c} value={c}>{CANAL_LABEL[c]}</option>)}
        </select>
      </label>
      <label className="block text-xs font-semibold text-ink-2">
        Resultado
        <select value={resultado} onChange={(e) => setResultado(e.target.value)} className={`${CAMPO} mt-1 font-normal`}>
          {RESULTADOS.map((r) => <option key={r} value={r}>{RESULTADO_LABEL[r]}</option>)}
        </select>
      </label>
      <label className="block text-xs font-semibold text-ink-2">
        {resultado === "causa_conhecida" ? "Causa (aparece no cartão)" : "Combinado"}
        <input value={combinado} maxLength={300} onChange={(e) => setCombinado(e.target.value)} placeholder="O que ficou combinado" className={`${CAMPO} mt-1 font-normal`} />
      </label>
      {resultado !== "resolvido" && (
        <label className="block text-xs font-semibold text-ink-2">
          Voltar a olhar em
          <input type="date" value={data} min={hoje} onChange={(e) => setData(e.target.value)} className={`${CAMPO} mt-1 font-normal`} />
          {!data && <span className="mt-1 block text-xs font-normal text-ink-3">Sem data, o Mural usa o prazo padrão do resultado.</span>}
        </label>
      )}
      <label className="block text-xs font-semibold text-ink-2">
        Nota (opcional)
        <textarea value={nota} maxLength={1000} rows={2} onChange={(e) => setNota(e.target.value)} className="mt-1 w-full rounded-xl border border-surface-line bg-white p-3 text-sm font-normal text-ink focus:border-brand focus:outline-none" />
      </label>
      <button type="button" onClick={confirmar} disabled={salvando} className={`${BTN_PRIMARIO} w-full`}>
        {salvando ? "Registrando…" : "Confirmar registro"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- chat
function Painel({ franchiseEvo, nomeUnidade, onRegistrado }) {
  const [mensagens, setMensagens] = useState(lerHistorico);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [ouvindo, setOuvindo] = useState(false);
  const fimRef = useRef(null);
  const recRef = useRef(null);
  const SR = suporteVoz();

  useEffect(() => { gravarHistorico(mensagens); }, [mensagens]);
  useEffect(() => { fimRef.current?.scrollIntoView({ block: "end" }); }, [mensagens, enviando]);
  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* já parado */ } }, []);

  const enviar = useCallback(async (pergunta) => {
    const p = (pergunta ?? texto).trim();
    if (!p || enviando) return;
    const nova = [...mensagens, { role: "user", content: p }];
    setMensagens(nova);
    setTexto("");
    setErro("");
    setEnviando(true);
    registrarEvento("assessor_pergunta");
    try {
      const enviadas = nova.slice(-MAX_ENVIADAS).map(({ role, content }) => ({ role, content }));
      const r = await perguntar(enviadas, franchiseEvo);
      setMensagens((m) => [...m, { role: "assistant", content: r.answer || "Sem resposta.", proposta: r.proposta || null, registrado: false }]);
    } catch (e) {
      setErro(e.message || "Não foi possível falar com o Assessor.");
    } finally {
      setEnviando(false);
    }
  }, [texto, enviando, mensagens, franchiseEvo]);

  const alternarVoz = () => {
    if (!SR) return;
    if (ouvindo) { try { recRef.current?.stop(); } catch { /* já parado */ } return; }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    const base = texto.trim();
    rec.onresult = (ev) => {
      let dito = "";
      for (let i = 0; i < ev.results.length; i += 1) dito += ev.results[i][0].transcript;
      setTexto(`${base ? `${base} ` : ""}${dito}`.trim());
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") toast.error("Libere o microfone no navegador para ditar.");
      else if (ev.error !== "no-speech" && ev.error !== "aborted") toast.error("Não consegui ouvir. Tente de novo.");
    };
    rec.onend = () => setOuvindo(false);
    recRef.current = rec;
    try { rec.start(); setOuvindo(true); registrarEvento("assessor_voz"); } catch { setOuvindo(false); }
  };

  const limpar = () => { setMensagens([]); setErro(""); };
  const sugestoes = franchiseEvo && nomeUnidade ? sugestoesDaUnidade(nomeUnidade) : SUGESTOES_GERAIS;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
        {mensagens.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-2">
              Pergunte sobre uma unidade ou sobre a rede. Respondo com os números do banco, a data e a fonte; o que não tiver no dado, eu digo.
            </p>
            <div className="flex flex-col gap-2">
              {sugestoes.map((s) => (
                <button key={s} type="button" onClick={() => enviar(s)} disabled={enviando}
                  className="min-h-11 rounded-xl border border-surface-line bg-white px-3 py-2 text-left text-sm font-medium text-ink hover:bg-surface disabled:opacity-60">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {mensagens.map((m, i) => (
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-brand px-3.5 py-2 text-sm text-white">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="space-y-2">
              <div className="rounded-2xl border border-surface-line bg-white p-3.5"><MarkdownSimples texto={m.content} /></div>
              {m.proposta && (
                <PropostaCard
                  proposta={m.proposta}
                  registrado={!!m.registrado}
                  onRegistrado={() => {
                    setMensagens((lista) => lista.map((x, k) => (k === i ? { ...x, registrado: true } : x)));
                    onRegistrado?.();
                  }}
                />
              )}
            </div>
          )
        ))}
        {enviando && (
          <div className="flex items-center gap-2 text-sm text-ink-3" role="status">
            <MaterialIcon icon="progress_activity" size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Consultando os dados…
          </div>
        )}
        {erro && (
          <div className="rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm text-ink" role="alert">{erro}</div>
        )}
        <div ref={fimRef} />
      </div>

      <div className="border-t border-surface-line bg-white px-4 py-3 sm:px-5">
        {mensagens.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {sugestoes.slice(0, 2).map((s) => (
              <button key={s} type="button" onClick={() => enviar(s)} disabled={enviando}
                className="rounded-full border border-surface-line px-3 py-1 text-xs font-medium text-ink-2 hover:bg-surface disabled:opacity-60">{s}</button>
            ))}
            <button type="button" onClick={limpar} className="ml-auto rounded-full px-3 py-1 text-xs font-semibold text-brand-dark hover:underline">Limpar conversa</button>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            rows={2}
            maxLength={2000}
            placeholder={ouvindo ? "Ouvindo… fale agora" : "Pergunte ou dite (ex.: registra que falei com a Lapa)"}
            aria-label="Pergunta para o Assessor"
            className="min-h-11 flex-1 resize-none rounded-xl border border-surface-line bg-white p-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
          />
          {SR && (
            <button type="button" onClick={alternarVoz} aria-pressed={ouvindo} aria-label={ouvindo ? "Parar de ouvir" : "Ditar pergunta"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${ouvindo ? "border-err bg-err/10 text-err" : "border-surface-line bg-white text-ink-2 hover:bg-surface"}`}>
              <MaterialIcon icon="mic" size={22} aria-hidden="true" />
            </button>
          )}
          <button type="submit" disabled={enviando || !texto.trim()} aria-label="Enviar pergunta" className={`${BTN_PRIMARIO} h-11 w-11 shrink-0 px-0`}>
            <MaterialIcon icon="send" size={20} aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AssessorChat({ franchiseEvo, nomeUnidade, onRegistrado, className = "", secundario = false }) {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  if (!user || !PAPEIS.includes(user.role)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => { setAberto(true); registrarEvento("assessor_aberto"); }}
        className={`${secundario ? BTN_SECUNDARIO : BTN_CONTORNO_MARCA} ${className}`}
      >
        <MaterialIcon icon="support_agent" size={20} aria-hidden="true" />
        Assessor
      </button>
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-surface-line px-4 py-4 pr-12 text-left sm:px-5">
            <SheetTitle className="font-plus-jakarta text-lg font-bold text-ink">Assessor do CS</SheetTitle>
            <SheetDescription className="text-sm text-ink-2">
              {franchiseEvo && nomeUnidade ? `Em foco: ${nomeUnidade}. ` : ""}Só lê dados: não envia mensagem nem altera nada sem a sua confirmação.
            </SheetDescription>
          </SheetHeader>
          <Painel franchiseEvo={franchiseEvo} nomeUnidade={nomeUnidade} onRegistrado={onRegistrado} />
        </SheetContent>
      </Sheet>
    </>
  );
}
