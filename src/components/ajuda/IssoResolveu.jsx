import { useState } from "react";
import { CARTAO } from "@/components/shared/adminUi";
import { registrarAjudaResolveu } from "@/lib/guiasAjuda";

// "Isso resolveu?" (S10.2, 28/09/2026): só aparece no guia aberto pela tela Ajuda v2
// (atrás de ui_v2). Um clique, sem confirmação — o registro é só telemetria (Clarity),
// nunca grava nada que a pessoa precise desfazer. S21.3 lê o evento por guia: mais de
// 30% de "Não" no mês = reescrever.
export default function IssoResolveu({ slug }) {
  const [resposta, setResposta] = useState(null);

  const escolher = (valor) => {
    setResposta(valor);
    registrarAjudaResolveu(slug, valor);
  };

  if (resposta) {
    return (
      <div className={`${CARTAO} text-center text-sm text-ink-2`} role="status">
        {resposta === "sim" ? "Que bom! Obrigado por avisar." : "Anotado — vamos rever este guia."}
      </div>
    );
  }

  return (
    <div className={`${CARTAO} flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left`}>
      <p className="text-sm font-semibold text-ink">Isso resolveu?</p>
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
    </div>
  );
}
