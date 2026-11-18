// Assessor do CS (17/11/2026): chat dentro do dashboard para a equipe de CS e admins.
// O Celso pergunta ("como está a Lapa?", "o que faço hoje?", "prepara a reunião com Campinas") e a
// Edge Function `cs-assessor` responde com os dados reais, lidos com o login dele (só leitura).
//   <AssessorChat />                                         // Mural: conversa geral
//   <AssessorChat franchiseEvo={evo} nomeUnidade="Lapa" />   // Ficha: já com a unidade em foco
//
// - A conversa vive em src/lib/assessorStore.js (uma por unidade ou "geral"): fechar o painel não cancela a pergunta.
// - Voz: botão de gravar (MediaRecorder, funciona no iPhone) → a Edge transcreve → o texto cai no campo para conferir.
// - Anexos: áudio encaminhado (.ogg/.opus/.m4a/.mp3) vira "[Áudio transcrito]"; imagem é reduzida aqui e vai ao modelo.
// - Registro no Mural: o assessor só PROPÕE (AssessorPropostas); quem grava é o botão Confirmar.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BTN_CONTORNO_MARCA, BTN_PRIMARIO, BTN_SECUNDARIO } from "@/components/shared/adminUi";
import { useAuth } from "@/lib/AuthContext";
import { registrarEvento } from "@/lib/telemetria";
import {
  atualizarMensagem, chaveDe, enviarFeedback, enviarPergunta, limparConversa, marcarLida, reduzirImagem,
  transcreverAudio, useAssessorOcupado, useConversa,
} from "@/lib/assessorStore";
import { baixarCsv, copiarTexto, imprimirResposta, markdownParaTexto } from "@/lib/assessorExport";
import MarkdownSimples from "./MarkdownSimples";
import AssessorPropostas from "./AssessorPropostas";

const PAPEIS = ["admin", "manager", "customer_success"];
const MAX_IMAGENS = 3;
const MAX_GRAVACAO_S = 180;
const MAX_ARQUIVO_AUDIO = 6 * 1024 * 1024;

const SUGESTOES_GERAIS = [
  "O que faço hoje?",
  "Resumo da minha semana no CS",
  "Quem está há mais de 30 dias sem comprar?",
  "Qual a mediana de venda da rede no mês?",
  "Prepara as reuniões de hoje",
];
const sugestoesDaUnidade = (nome) => [
  `Prepara a reunião com ${nome}`,
  `Como está ${nome}?`,
  `O que foi combinado com ${nome}?`,
  `Escreve uma mensagem para ${nome}`,
];

const podeGravar = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined";

// Formato que o navegador sabe gravar (Safari/iPhone grava mp4; Chrome/Firefox, webm/ogg).
function mimeDeGravacao() {
  const opcoes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return opcoes.find((m) => window.MediaRecorder.isTypeSupported?.(m)) || "";
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// ---------------------------------------------------------------- uma resposta do assessor
function RespostaIA({ m, chave, nomeUnidade, onRegistrado }) {
  const corpoRef = useRef(null);
  const [comentando, setComentando] = useState(false);
  const [comentario, setComentario] = useState("");
  const nota = m.feedback?.nota ?? 0;

  const copiarMensagem = async () => {
    const ok = await copiarTexto(m.mensagem);
    toast[ok ? "success" : "error"](ok ? "Mensagem copiada. É só colar no WhatsApp." : "Não consegui copiar.");
  };
  const copiarResposta = async () => {
    const ok = await copiarTexto(markdownParaTexto(m.content));
    toast[ok ? "success" : "error"](ok ? "Resposta copiada." : "Não consegui copiar.");
  };
  const imprimir = () => {
    if (!imprimirResposta(corpoRef.current, { titulo: "Assessor do CS", unidade: nomeUnidade })) toast.error("Libere as janelas pop-up para imprimir.");
  };
  const votar = async (valor, texto) => {
    if (!m.logId) { toast.error("Esta resposta não tem registro para avaliar."); return; }
    try {
      await enviarFeedback(m.logId, valor, texto);
      atualizarMensagem(chave, m.id, { feedback: { nota: valor, comentario: texto || "" } });
      registrarEvento("assessor_feedback", { detalhe: valor > 0 ? "bom" : "ruim" });
      return true;
    } catch {
      toast.error("Não consegui salvar a avaliação.");
      return false;
    }
  };
  const bom = async () => { setComentando(false); if (await votar(1, "")) toast.success("Obrigado pelo retorno."); };
  const ruim = async () => { if (await votar(-1, m.feedback?.comentario || "")) setComentando(true); };
  const enviarComentario = async () => {
    if (await votar(-1, comentario.trim())) { setComentando(false); toast.success("Obrigado. Isso ajuda a melhorar."); }
  };

  const BOTAO = "inline-flex min-h-10 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-ink-2 hover:bg-surface";
  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-surface-line bg-white p-3.5">
        <div ref={corpoRef}>
          <MarkdownSimples texto={m.content} />
        </div>
        {m.mensagem && (
          <div className="mt-3 rounded-xl border border-surface-line bg-surface p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-ink-3">Rascunho de mensagem</div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{m.mensagem}</p>
            <button type="button" onClick={copiarMensagem} className={`${BTN_PRIMARIO} mt-2 min-h-11 w-full`}>
              <MaterialIcon icon="content_copy" size={18} aria-hidden="true" />
              Copiar mensagem
            </button>
          </div>
        )}
        {m.tabela?.linhas?.length > 0 && (
          <button type="button" onClick={() => { baixarCsv(m.tabela); registrarEvento("assessor_planilha"); }} className={`${BTN_CONTORNO_MARCA} mt-3 min-h-11 w-full`}>
            <MaterialIcon icon="download" size={18} aria-hidden="true" />
            Baixar planilha ({m.tabela.linhas.length} {m.tabela.linhas.length === 1 ? "linha" : "linhas"})
          </button>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-surface-line pt-2">
          <button type="button" onClick={copiarResposta} className={BOTAO}>
            <MaterialIcon icon="content_copy" size={16} aria-hidden="true" />Copiar
          </button>
          <button type="button" onClick={imprimir} className={BOTAO}>
            <MaterialIcon icon="print" size={16} aria-hidden="true" />Imprimir / PDF
          </button>
          <span className="ml-auto flex items-center gap-1">
            <button type="button" onClick={bom} aria-pressed={nota > 0} aria-label="Resposta boa" className={`${BOTAO} ${nota > 0 ? "bg-brand-soft text-brand-dark" : ""}`}>
              <MaterialIcon icon="thumb_up" filled={nota > 0} size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={ruim} aria-pressed={nota < 0} aria-label="Resposta ruim" className={`${BOTAO} ${nota < 0 ? "bg-warn-soft text-ink" : ""}`}>
              <MaterialIcon icon="thumb_down" filled={nota < 0} size={16} aria-hidden="true" />
            </button>
          </span>
        </div>
        {(comentando || (nota < 0 && m.feedback?.comentario)) && (
          <div className="mt-2 space-y-2">
            {comentando ? (
              <>
                <label className="block text-xs font-semibold text-ink-2" htmlFor={`fb-${m.id}`}>O que faltou? (opcional)</label>
                <textarea id={`fb-${m.id}`} value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} maxLength={1000}
                  className="w-full rounded-xl border border-surface-line bg-white p-3 text-sm text-ink focus:border-brand focus:outline-none" />
                <div className="flex gap-2">
                  <button type="button" onClick={enviarComentario} className={`${BTN_PRIMARIO} min-h-11 flex-1`}>Enviar</button>
                  <button type="button" onClick={() => setComentando(false)} className={`${BTN_SECUNDARIO} min-h-11`}>Agora não</button>
                </div>
              </>
            ) : (
              <p className="text-xs text-ink-3">Seu comentário: {m.feedback.comentario}</p>
            )}
          </div>
        )}
      </div>
      {m.propostas?.length > 0 && <AssessorPropostas chave={chave} msgId={m.id} logId={m.logId} propostas={m.propostas} onFeito={onRegistrado} />}
    </div>
  );
}

// ---------------------------------------------------------------- painel
function Painel({ chave, franchiseEvo, nomeUnidade, onRegistrado }) {
  const conv = useConversa(chave);
  const [texto, setTexto] = useState("");
  const [imagens, setImagens] = useState([]); // data URLs
  const [audiosMeta, setAudiosMeta] = useState([]); // [{tipo, bytes}] só metadado
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const fimRef = useRef(null);
  const gravRef = useRef(null);
  const arquivoRef = useRef(null);
  const gravar = podeGravar();

  useEffect(() => { marcarLida(chave); }, [chave, conv.naoLida]);
  useEffect(() => { fimRef.current?.scrollIntoView({ block: "end" }); }, [conv.mensagens.length, conv.pendente, conv.erro]);
  useEffect(() => () => { try { gravRef.current?.parar?.(true); } catch { /* já parado */ } }, []);

  const enviar = useCallback((pergunta) => {
    const t = String(pergunta ?? texto).trim();
    if (!t || conv.pendente || transcrevendo) return;
    enviarPergunta(chave, { texto: t, franchiseEvo, imagens, anexos: audiosMeta });
    setTexto("");
    setImagens([]);
    setAudiosMeta([]);
  }, [texto, conv.pendente, transcrevendo, chave, franchiseEvo, imagens, audiosMeta]);

  const inserirTranscricao = (t, comoAnexo) => {
    const limpo = t.trim();
    if (!limpo) { toast.error("Não ouvi nada nesse áudio."); return; }
    setTexto((atual) => (comoAnexo ? `${atual ? `${atual}\n` : ""}[Áudio transcrito]: "${limpo}"\n` : `${atual ? `${atual} ` : ""}${limpo}`));
  };

  const iniciarGravacao = async () => {
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = mimeDeGravacao();
      const rec = mime ? new window.MediaRecorder(fluxo, { mimeType: mime }) : new window.MediaRecorder(fluxo);
      const pedacos = [];
      let cancelado = false;
      let relogio = null;
      rec.ondataavailable = (e) => { if (e.data?.size) pedacos.push(e.data); };
      rec.onstop = async () => {
        clearInterval(relogio);
        fluxo.getTracks().forEach((t) => t.stop());
        setGravando(false);
        if (cancelado || !pedacos.length) return;
        const blob = new Blob(pedacos, { type: rec.mimeType || mime || "audio/webm" });
        setTranscrevendo(true);
        try {
          const r = await transcreverAudio(blob, "gravacao");
          inserirTranscricao(r.texto, false);
          setAudiosMeta((a) => [...a, { tipo: "audio", bytes: r.bytes }]);
          registrarEvento("assessor_voz");
        } catch (e) {
          toast.error(e.message || "Não consegui transcrever. Tente de novo.");
        } finally {
          setTranscrevendo(false);
        }
      };
      gravRef.current = { parar: (cancela) => { cancelado = !!cancela; if (rec.state !== "inactive") rec.stop(); } };
      rec.start();
      setSegundos(0);
      setGravando(true);
      relogio = setInterval(() => setSegundos((s) => { if (s + 1 >= MAX_GRAVACAO_S) gravRef.current?.parar(false); return s + 1; }), 1000);
    } catch (e) {
      setGravando(false);
      toast.error(e?.name === "NotAllowedError" ? "Microfone bloqueado: clique no ícone à esquerda do endereço do site (cadeado ou dois tracinhos), ligue o Microfone e recarregue a página." : "Não consegui acessar o microfone.");
    }
  };
  const alternarGravacao = () => { if (gravando) gravRef.current?.parar(false); else iniciarGravacao(); };

  const aoEscolherArquivo = async (e) => {
    const arquivos = [...(e.target.files || [])];
    e.target.value = "";
    for (const f of arquivos) {
      const ehAudio = f.type.startsWith("audio/") || /\.(ogg|oga|opus|m4a|mp3|wav|aac)$/i.test(f.name);
      const ehImagem = f.type.startsWith("image/");
      if (ehAudio) {
        if (f.size > MAX_ARQUIVO_AUDIO) { toast.error("Áudio acima de 6 MB. Use um mais curto."); continue; }
        setTranscrevendo(true);
        try {
          const r = await transcreverAudio(f, f.name);
          inserirTranscricao(r.texto, true);
          setAudiosMeta((a) => [...a, { tipo: "audio", bytes: r.bytes }]);
        } catch (err) {
          toast.error(err.message || "Não consegui transcrever esse áudio.");
        } finally {
          setTranscrevendo(false);
        }
      } else if (ehImagem) {
        if (imagens.length >= MAX_IMAGENS) { toast.error(`No máximo ${MAX_IMAGENS} imagens por pergunta.`); continue; }
        try {
          const url = await reduzirImagem(f);
          setImagens((l) => [...l, url].slice(0, MAX_IMAGENS));
        } catch (err) {
          toast.error(err.message || "Não consegui usar essa imagem.");
        }
      } else {
        toast.error("Anexe uma imagem ou um áudio.");
      }
    }
  };

  const sugestoes = franchiseEvo && nomeUnidade ? sugestoesDaUnidade(nomeUnidade) : SUGESTOES_GERAIS;
  const ocupadoEntrada = conv.pendente || transcrevendo;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
        {conv.mensagens.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-2">
              Pergunte sobre uma unidade ou sobre a rede, mande um áudio ou um print. Respondo com os números do banco e a data; o que não tiver no dado, eu digo.
            </p>
            <div className="flex flex-col gap-2">
              {sugestoes.map((s) => (
                <button key={s} type="button" onClick={() => enviar(s)} disabled={ocupadoEntrada}
                  className="min-h-11 rounded-xl border border-surface-line bg-white px-3 py-2 text-left text-sm font-medium text-ink hover:bg-surface disabled:opacity-60">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {conv.mensagens.map((m) => (
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-brand px-3.5 py-2 text-sm text-white">
                {m.content}
                {(m.imagens > 0 || m.audio) && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-white/80">
                    {m.imagens > 0 && <><MaterialIcon icon="image" size={14} aria-hidden="true" />{m.imagens} {m.imagens === 1 ? "imagem" : "imagens"}</>}
                    {m.audio && <><MaterialIcon icon="mic" size={14} aria-hidden="true" />áudio</>}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <RespostaIA key={m.id} m={m} chave={chave} nomeUnidade={nomeUnidade} onRegistrado={onRegistrado} />
          )
        ))}
        {conv.pendente && (
          <div className="flex items-center gap-2 text-sm text-ink-3" role="status">
            <MaterialIcon icon="progress_activity" size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Consultando os dados… pode fechar o painel, aviso quando chegar.
          </div>
        )}
        {conv.erro && <div className="rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm text-ink" role="alert">{conv.erro}</div>}
        <div ref={fimRef} />
      </div>

      <div className="border-t border-surface-line bg-white px-4 py-2 sm:px-5 sm:py-3">
        {conv.mensagens.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {sugestoes.slice(0, 2).map((s) => (
              <button key={s} type="button" onClick={() => enviar(s)} disabled={ocupadoEntrada}
                className="hidden min-h-8 rounded-full border border-surface-line px-3 py-1 text-xs font-medium text-ink-2 hover:bg-surface disabled:opacity-60 sm:inline-flex sm:items-center">{s}</button>
            ))}
            <button type="button" onClick={() => limparConversa(chave)} className="ml-auto min-h-8 rounded-full px-3 py-1 text-xs font-semibold text-brand-dark hover:underline">Limpar conversa</button>
          </div>
        )}
        {(imagens.length > 0 || audiosMeta.length > 0 || gravando || transcrevendo) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {imagens.map((u, i) => (
              <span key={i} className="relative inline-block">
                <img src={u} alt={`Imagem anexada ${i + 1}`} className="h-14 w-14 rounded-lg border border-surface-line object-cover" />
                <button type="button" onClick={() => setImagens((l) => l.filter((_, k) => k !== i))} aria-label={`Remover imagem ${i + 1}`}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white">
                  <MaterialIcon icon="close" size={14} aria-hidden="true" />
                </button>
              </span>
            ))}
            {gravando && (
              <span className="inline-flex items-center gap-2 rounded-full border border-err/40 bg-err/10 px-3 py-1 text-sm font-semibold text-err" role="status">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-err motion-reduce:animate-none" aria-hidden="true" />
                Gravando {mmss(segundos)}
              </span>
            )}
            {transcrevendo && (
              <span className="inline-flex items-center gap-2 text-sm text-ink-3" role="status">
                <MaterialIcon icon="progress_activity" size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Transcrevendo o áudio…
              </span>
            )}
            {audiosMeta.length > 0 && !gravando && !transcrevendo && (
              <span className="inline-flex items-center gap-1 text-xs text-ink-3"><MaterialIcon icon="mic" size={14} aria-hidden="true" />áudio transcrito no campo: confira antes de enviar</span>
            )}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia?.("(min-width: 640px)").matches) { e.preventDefault(); enviar(); } }}
            rows={2}
            maxLength={4000}
            placeholder="Pergunte ou dite aqui"
            aria-label="Pergunta para o Assessor"
            className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-surface-line bg-white p-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
          />
          <input ref={arquivoRef} type="file" accept="image/*,audio/*,.ogg,.oga,.opus,.m4a,.mp3" multiple className="hidden" onChange={aoEscolherArquivo} />
          <button type="button" onClick={() => arquivoRef.current?.click()} disabled={ocupadoEntrada || gravando} aria-label="Anexar imagem ou áudio"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-surface-line bg-white text-ink-2 hover:bg-surface disabled:opacity-50">
            <MaterialIcon icon="attach_file" size={22} aria-hidden="true" />
          </button>
          {gravar && (
            <button type="button" onClick={alternarGravacao} disabled={transcrevendo || conv.pendente} aria-pressed={gravando} aria-label={gravando ? "Parar e transcrever" : "Gravar áudio"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border disabled:opacity-50 ${gravando ? "border-err bg-err/10 text-err" : "border-surface-line bg-white text-ink-2 hover:bg-surface"}`}>
              <MaterialIcon icon={gravando ? "stop" : "mic"} size={22} aria-hidden="true" />
            </button>
          )}
          <button type="submit" disabled={ocupadoEntrada || gravando || !texto.trim()} aria-label="Enviar pergunta" className={`${BTN_PRIMARIO} h-11 w-11 shrink-0 px-0`}>
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
  const chave = chaveDe(franchiseEvo);
  const conv = useConversa(chave);
  const ocupado = useAssessorOcupado();
  if (!user || !PAPEIS.includes(user.role)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => { setAberto(true); registrarEvento("assessor_aberto"); }}
        className={`relative ${secundario ? BTN_SECUNDARIO : BTN_CONTORNO_MARCA} ${className}`}
      >
        <MaterialIcon icon="support_agent" size={20} aria-hidden="true" />
        Assessor
        {!aberto && (conv.pendente || ocupado) && (
          <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-brand motion-reduce:animate-none" role="status" aria-label="Respondendo" />
        )}
        {!aberto && !conv.pendente && conv.naoLida && (
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-brand-gold" role="status" aria-label="Resposta nova" />
        )}
      </button>
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b border-surface-line px-4 py-4 pr-12 text-left sm:px-5">
            <SheetTitle className="font-plus-jakarta text-lg font-bold text-ink">Assessor do CS</SheetTitle>
            <SheetDescription className="sr-only text-sm text-ink-2 sm:not-sr-only">
              {franchiseEvo && nomeUnidade ? `Em foco: ${nomeUnidade}. ` : ""}Só lê dados: não envia mensagem nem grava nada sem a sua confirmação.
            </SheetDescription>
          </SheetHeader>
          <Painel chave={chave} franchiseEvo={franchiseEvo} nomeUnidade={nomeUnidade} onRegistrado={onRegistrado} />
        </SheetContent>
      </Sheet>
    </>
  );
}
