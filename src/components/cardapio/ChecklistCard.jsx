// Checklist de ligar o cardápio (10f, rede aberta 10/11/2026). A regra mora no banco (cardapio_checklist) e vem pronta no
// cardapio_painel: vermelho = trava (o servidor recusa ligar), amarelo = recomendação, verde = em dia. Cada item que falta
// tem o botão que leva para arrumar (lib/cardapioDigital ACAO_CHECKLIST). A lista se refaz ao voltar para a aba
// (refetchOnWindowFocus do painel): arrumou no Meu robô, voltou, o item fica verde.
import { useState } from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { BTN_PRIMARIO, BTN_SECUNDARIO, LINK_ACAO } from "@/components/shared/adminUi";
import { linkWhatsAppMaxi } from "@/lib/contatoMaxi";

const VISUAL = {
  trava: { icone: "cancel", cor: "text-err", leitor: "falta, trava o cardápio" },
  aviso: { icone: "error", cor: "text-warn-ink", leitor: "recomendado, não trava" },
  ok: { icone: "check_circle", cor: "text-ok", leitor: "em dia" },
};

// "Usar o número do robô" (10i): mostra o número e pede confirmação antes de gravar (nunca troca um número que já existe)
function UsarRobo({ item, onUsarRobo, salvando }) {
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) {
    return <button type="button" className={`${LINK_ACAO} min-h-10`} onClick={() => setConfirmando(true)}>{item.acao.rotulo} →</button>;
  }
  return (
    <div className="space-y-2 rounded-xl bg-surface-2 p-3 text-sm text-ink" role="group" aria-label="Confirmar o número">
      <p>Os pedidos do cardápio vão chegar no WhatsApp do robô: <strong className="whitespace-nowrap">{item.sugestao}</strong>. Confirma?</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${BTN_PRIMARIO} min-h-11`} disabled={salvando} onClick={() => onUsarRobo?.()}>
          {salvando ? "Salvando…" : "Usar este número"}
        </button>
        <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} disabled={salvando} onClick={() => setConfirmando(false)}>Agora não</button>
      </div>
    </div>
  );
}

function Acao({ item, nomeUnidade, onUsarRobo, salvandoRobo }) {
  const a = item.acao;
  if (!a) return null;
  if (a.tipo === "robo") return <UsarRobo item={item} onUsarRobo={onUsarRobo} salvando={salvandoRobo} />;
  if (a.tipo === "rota") return <Link to={a.to} className={`${LINK_ACAO} min-h-10`}>{a.rotulo}</Link>;
  if (a.tipo === "whatsapp") {
    const href = linkWhatsAppMaxi(`Olá! Quero ligar o cardápio digital da ${nomeUnidade || "minha unidade"} e ${a.mensagem}.`);
    return href ? <a href={href} target="_blank" rel="noopener noreferrer" className={`${LINK_ACAO} min-h-10`}>{a.rotulo}</a> : null;
  }
  return null;
}

export default function ChecklistCard({ itens, nomeUnidade, refItem, onUsarRobo, salvandoRobo }) {
  if (!itens?.length) return null;
  let primeiraTrava = true;
  return (
    <ul className="divide-y divide-surface-line">
      {itens.map((i) => {
        const v = VISUAL[i.estado];
        const ehPrimeira = i.estado === "trava" && primeiraTrava;
        if (ehPrimeira) primeiraTrava = false;
        return (
          <li key={i.id} className={`flex flex-col gap-1 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4 ${i.estado === "ok" ? "py-2" : "py-3"}`}
            data-checklist={i.id} data-estado={i.estado}>
            <div className="flex min-w-0 items-start gap-2">
              <MaterialIcon icon={v.icone} size={20} className={`mt-px shrink-0 ${v.cor}`} aria-hidden="true" />
              <p className="min-w-0 text-sm text-ink" ref={ehPrimeira ? refItem : undefined} tabIndex={ehPrimeira ? -1 : undefined}>
                <strong className="font-semibold">{i.titulo}</strong>
                <span className="sr-only"> ({v.leitor})</span>
                {/* verde = só o nome (a lista fica curta no celular); o porquê aparece no que falta */}
                {i.motivo && i.estado !== "ok" ? <span className="block text-ink-2">{i.motivo}</span> : null}
              </p>
            </div>
            {i.acao && (
              <div className="shrink-0 pl-7 sm:ml-auto sm:pl-0">
                <Acao item={i} nomeUnidade={nomeUnidade} onUsarRobo={onUsarRobo} salvandoRobo={salvandoRobo} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
