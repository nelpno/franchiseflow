import { useEffect, useRef, useState } from "react";
import { CARTAO } from "@/components/shared/adminUi";
import { registrarAjudaResolveu } from "@/lib/guiasAjuda";

// "Isso resolveu?" (S10.2, 28/09/2026): só aparece no guia aberto pela tela Ajuda v2
// (atrás de ui_v2). Um clique, sem confirmação — o registro é só telemetria (Clarity),
// nunca grava nada que a pessoa precise desfazer. S21.3 lê o evento por guia: mais de
// 30% de "Não" no mês = reescrever.
//
// A região `role="status"` fica MONTADA o tempo todo, mesmo vazia (P3, 28/09/2026):
// leitor de tela só anuncia mudança de uma live region que já existia ANTES da troca
// de conteúdo — criar a região só na hora da resposta (como a 1ª versão fazia,
// trocando o card inteiro) não anuncia nada em parte dos leitores. Ao responder, o
// foco vai pra essa região (`tabIndex={-1}` + `.focus()`) — sem isso o foco ficava
// "perdido" no botão que acabou de sumir do DOM.
export default function IssoResolveu({ slug }) {
  const [resposta, setResposta] = useState(null);
  const confirmacaoRef = useRef(null);

  useEffect(() => {
    if (resposta) confirmacaoRef.current?.focus();
  }, [resposta]);

  const escolher = (valor) => {
    setResposta(valor);
    registrarAjudaResolveu(slug, valor);
  };

  return (
    <div className={`${CARTAO} flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left`}>
      {!resposta && <p className="text-sm font-semibold text-ink">Isso resolveu?</p>}
      {!resposta && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => escolher("sim")}
            className="min-h-10 rounded-xl border-2 border-brand bg-white px-5 font-semibold text-brand-dark touch-manipulation active:opacity-70"
          >
            Sim
          </button>
          <button
            type="button"
            onClick={() => escolher("nao")}
            className="min-h-10 rounded-xl border border-surface-line bg-white px-5 font-semibold text-ink-2 touch-manipulation active:opacity-70"
          >
            Não
          </button>
        </div>
      )}
      <div
        ref={confirmacaoRef}
        role="status"
        tabIndex={-1}
        className={resposta ? "w-full text-sm text-ink-2 outline-none" : "sr-only"}
      >
        {resposta === "sim" && "Que bom! Obrigado por avisar."}
        {resposta === "nao" && "Anotado — vamos rever este guia."}
      </div>
    </div>
  );
}
