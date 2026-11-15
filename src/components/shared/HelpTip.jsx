import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { HELP_TIPS } from "@/lib/helpTips";

/**
 * "?" ao lado de um campo que gera dúvida (Fase 4, 26/09/2026).
 *
 *   <HelpTip tip="pedidoMinimo" />                    texto de src/lib/helpTips.js
 *   <HelpTip titulo="X" texto="..." exemplo="..." />  texto avulso
 *
 * Por que não o Tooltip do shadcn: tooltip do Radix não abre no toque (celular é o
 * público principal) e some ao tirar o mouse. Aqui é um botão de 40 px que abre e fecha
 * no clique/toque/Enter/Espaço; Esc e toque fora fecham e o foco volta ao botão.
 * O painel é `position: fixed`, preso à largura da tela (16 px de margem), então não
 * estoura em 390 px nem dentro de tabela com rolagem.
 *
 * O "?" é texto, não ícone: rótulo de cabeçalho de tabela costuma ter `uppercase`, que
 * quebra a ligadura do Material Symbols (ícone vira palavra).
 */
const LARGURA = 320;
const MARGEM = 16;

export default function HelpTip({ tip, titulo, texto, exemplo, className = "" }) {
  const dados = tip ? HELP_TIPS[tip] : { titulo, texto, exemplo };
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState(null);
  const botaoRef = useRef(null);
  const painelRef = useRef(null);
  const id = useId();

  const posicionar = useCallback(() => {
    const b = botaoRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const largura = Math.min(LARGURA, vw - MARGEM * 2);
    const left = Math.min(Math.max(r.left + r.width / 2 - largura / 2, MARGEM), vw - MARGEM - largura);
    const alturaPainel = painelRef.current?.offsetHeight || 200;
    const cabeEmbaixo = r.bottom + 4 + alturaPainel <= vh - MARGEM;
    const top = cabeEmbaixo || r.top < alturaPainel + MARGEM ? r.bottom + 4 : r.top - 4 - alturaPainel;
    setPos({ left, top: Math.max(MARGEM, top), width: largura });
  }, []);

  useLayoutEffect(() => {
    if (aberto) posicionar();
  }, [aberto, posicionar]);

  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = (devolverFoco) => {
      setAberto(false);
      if (devolverFoco) botaoRef.current?.focus();
    };
    const onKey = (e) => {
      if (e.key === "Escape") fechar(true);
    };
    const onFora = (e) => {
      if (painelRef.current?.contains(e.target) || botaoRef.current?.contains(e.target)) return;
      fechar(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onFora);
    // Tela girou/mudou de largura: reposiciona. (ResizeObserver no lugar do evento de janela:
    // a string do evento é nome de ícone e acusaria falso positivo no icons:check.)
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(posicionar) : null;
    ro?.observe(document.documentElement);
    window.addEventListener("scroll", posicionar, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onFora);
      ro?.disconnect();
      window.removeEventListener("scroll", posicionar, true);
    };
  }, [aberto, posicionar]);

  if (!dados?.texto) return null;

  return (
    <span className={`relative inline-flex align-middle normal-case tracking-normal ${className}`}>
      <button
        ref={botaoRef}
        type="button"
        aria-label={`O que é ${dados.titulo || "este campo"}?`}
        aria-expanded={aberto}
        aria-controls={id}
        onClick={(e) => {
          // Dentro de <label>, o clique não pode marcar/focar o campo.
          e.preventDefault();
          e.stopPropagation();
          setAberto((v) => !v);
        }}
        className="-my-2.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:text-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <span
          aria-hidden="true"
          className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs font-bold leading-none ${
            aberto ? "border-brand-dark bg-brand-dark text-white" : "border-current"
          }`}
        >
          ?
        </span>
      </button>
      {aberto && (
        <span
          ref={painelRef}
          id={id}
          role="note"
          style={pos ? { left: pos.left, top: pos.top, width: pos.width } : { visibility: "hidden" }}
          className="fixed z-50 block rounded-2xl border border-surface-line bg-white p-4 text-left shadow-lg"
        >
          {dados.titulo && (
            <span className="block font-plus-jakarta text-sm font-bold text-ink">{dados.titulo}</span>
          )}
          <span className="mt-1 block text-sm font-normal leading-relaxed text-ink-2">{dados.texto}</span>
          {dados.exemplo && (
            <span className="mt-2 block rounded-xl bg-surface-2 px-3 py-2 text-sm font-normal text-ink-2">
              <span className="font-semibold text-ink">Exemplo: </span>
              {dados.exemplo}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
