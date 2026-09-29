// Cartão do Mural do CS (Onda 2). Uma coisa a fazer por cartão: por quê (motivo + prova
// datada), acordo/combinado se houver, e três ações — Chamar no WhatsApp, Registrar,
// Abrir ficha. O cartão inteiro NÃO é link (evita dead click — Clarity mediu 40% de
// cliques mortos no Mural antigo); só o nome linka para a Ficha.
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { CARTAO, LINK_ACAO } from "@/components/shared/adminUi";
import MaisAcoesMenu from "@/components/shared/MaisAcoesMenu";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { safeHref } from "@/lib/safeHref";
import { estacionarCsCartao } from "@/entities/csMural";
import { getWhatsAppLink } from "@/lib/whatsappUtils";
import { montarMensagemFranqueado } from "@/lib/mensagemFranqueado";
import { linkFicha, nomeCurto } from "@/lib/networkOverview";
import {
  MOTIVO_LABEL,
  DESFECHO_LABEL,
  motivoChipClasse,
  linhaVenda,
  linhaAcordo,
  linhaUltimoCombinado,
  linhaCurta,
  rotuloVoltaEm,
} from "@/lib/csMural";
import RegistrarSheet from "./RegistrarSheet";
import CartaoAcoesDialog from "./CartaoAcoesDialog";

// motive_key do Mural → motivo do gerador de mensagem (mensagemFranqueado.js). Sem
// correspondência exata cai no texto genérico ("default") — melhor que inventar frase.
const MOTIVO_PARA_MENSAGEM = {
  sem_venda: "sem_venda",
  caiu: "caiu",
  robo_parado: "robo_parado",
  sem_comprar: "stopped_buying",
};

// `compacto` (29/09, pedido do Celso): o cartão fechado mostra só nome, motivo, UMA frase e os
// botões; a seta abre o resto (venda, acordo, combinado, ficha, mais ações). Menos rolagem.
export default function MuralCard({ card, lane, onMudou, compacto = false }) {
  const location = useLocation();
  const [abertoAqui, setAbertoAqui] = useState(null); // null = segue o modo da tela
  const aberto = abertoAqui ?? !compacto;
  const [registrarAberto, setRegistrarAberto] = useState(false);
  const [modoAcao, setModoAcao] = useState(null);

  const nome = nomeCurto(card.franchise_name) || card.franchise_name || "Unidade";
  const linha = linhaVenda(card);
  const acordo = linhaAcordo(card.agreement);
  const combinado = linhaUltimoCombinado(card.last_event);
  const chipMotivo = MOTIVO_LABEL[card.motive_key] || null;

  const mensagem = montarMensagemFranqueado({
    motivo: MOTIVO_PARA_MENSAGEM[card.motive_key] || "default",
    nome: card.owner_name,
    franchiseName: card.franchise_name,
    dias: card.days_since_last_sale,
  });
  const linkWhats = card.phone ? getWhatsAppLink(card.phone, mensagem) : null;
  const { to: toFicha, state: stateFicha } = linkFicha(card.franchise_id, {
    from: location.pathname + location.search,
    label: "Mural do CS",
  });

  const somenteLeitura = lane === "resolvidos";
  // Tarefa geral (sem unidade): não há ficha nem telefone para onde levar.
  const temUnidade = !!card.franchise_id;
  // Cartão manual (criado pelo QuickAddCard) ou sem motive_evidence (não veio do
  // diagnóstico automático): sem isto, um cartão manual COM unidade mostrava só o nome
  // da unidade + chip — o título/descrição que o CS digitou sumia.
  const ehManual = card.motive_key === "manual" || !card.motive_evidence;

  const retomar = async () => {
    try {
      await estacionarCsCartao(card.id, null, null);
      toast.success("Cartão retomado.");
      onMudou?.();
    } catch (e) {
      toast.error(safeErrorMessage(e, "Não foi possível retomar o cartão."));
    }
  };

  const acoes = [
    !somenteLeitura && { label: "Concluir", icon: "check_circle", onClick: () => setModoAcao("concluir") },
    !somenteLeitura && lane !== "com_nelson" && { label: "Vai para o Nelson", icon: "arrow_forward", onClick: () => setModoAcao("nelson") },
    !somenteLeitura && lane !== "estacionado" && { label: "Estacionar (pausar até uma data)", icon: "schedule", onClick: () => setModoAcao("estacionar") },
    lane === "estacionado" && { label: "Retomar agora", icon: "play_circle", onClick: retomar },
  ].filter(Boolean);

  return (
    <div className={aberto ? CARTAO : "rounded-2xl border border-surface-line bg-white px-4 py-3"}>
      <div className="flex items-start justify-between gap-2">
        {temUnidade ? (
          <Link to={toFicha} state={stateFicha} className="font-plus-jakarta text-base font-bold text-ink hover:underline">
            {nome}
          </Link>
        ) : (
          <h3 className="font-plus-jakarta text-base font-bold text-ink">{card.title || "Tarefa geral"}</h3>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {chipMotivo && (
            <span className={`min-h-6 shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${motivoChipClasse(card.motive_key)}`}>
              {chipMotivo}
            </span>
          )}
          <button
            type="button"
            onClick={() => setAbertoAqui(!aberto)}
            aria-expanded={aberto}
            aria-label={aberto ? "Fechar detalhes" : "Ver detalhes"}
            className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-3 hover:bg-surface"
          >
            <MaterialIcon icon={aberto ? "expand_less" : "expand_more"} size={22} aria-hidden="true" />
          </button>
        </div>
      </div>

      {!aberto && linhaCurta(card) && <p className="mt-0.5 line-clamp-1 text-sm text-ink-2">{linhaCurta(card)}</p>}
      {!aberto && lane === "esperando" && card.next_at && <p className="mt-0.5 text-sm font-semibold text-ink-2">{rotuloVoltaEm(card.next_at)}</p>}

      {aberto && (<>

      {temUnidade && ehManual && (card.title || card.description) && (
        <div className="mt-1">
          {card.title && <p className="text-sm font-semibold text-ink">{card.title}</p>}
          {card.description && <p className="text-sm text-ink-3 line-clamp-3">{card.description}</p>}
        </div>
      )}

      {linha && <p className="mt-1 text-sm text-ink-2">{linha}</p>}
      {card.motive_evidence && <p className="mt-1 text-sm text-ink-2">{card.motive_evidence}</p>}
      {acordo && <p className="mt-1 text-sm text-ink-3">{acordo}</p>}
      {combinado && <p className="mt-1 text-sm text-ink-3">{combinado}</p>}
      {lane === "esperando" && card.next_at && <p className="mt-1 text-sm font-semibold text-ink-2">{rotuloVoltaEm(card.next_at)}</p>}
      {lane === "resolvidos" && card.closed_reason && (
        <p className="mt-1 text-sm text-ink-3">
          {card.closed_reason === "resolveu_sozinho" ? "Resolveu sozinho — motivo sumiu sem toque" : `Fechado: ${DESFECHO_LABEL[card.closed_reason] || card.closed_reason}`}
        </p>
      )}
      {lane === "com_nelson" && card.escalated_note && <p className="mt-1 text-sm text-ink-3">"{card.escalated_note}"</p>}
      {lane === "estacionado" && card.parked_reason && <p className="mt-1 text-sm text-ink-3">Estacionado: {card.parked_reason}</p>}
      </>)}

      {!somenteLeitura && (
        <div className={`${aberto ? "mt-3" : "mt-2"} grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center`}>
          {linkWhats ? (
            <a
              href={safeHref(linkWhats)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-ok-ink px-3 text-sm font-semibold text-white hover:bg-ok-ink/90 sm:px-4"
            >
              <MaterialIcon icon="chat" size={18} aria-hidden="true" />
              <span className="sm:hidden">WhatsApp</span>
              <span className="hidden sm:inline">Chamar no WhatsApp</span>
            </a>
          ) : temUnidade ? (
            <Link to={toFicha} state={stateFicha} className={LINK_ACAO}>
              Cadastrar telefone →
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setRegistrarAberto(true)}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-surface-line bg-white px-3 text-sm font-semibold text-ink-2 hover:bg-surface sm:px-4"
          >
            <MaterialIcon icon="edit" size={18} aria-hidden="true" />
            Registrar
          </button>
          {aberto && acoes.length > 0 && <MaisAcoesMenu actions={acoes} />}
        </div>
      )}

      {aberto && temUnidade && (
        <div className="mt-2">
          <Link to={toFicha} state={stateFicha} className={LINK_ACAO}>
            Abrir ficha →
          </Link>
        </div>
      )}

      <RegistrarSheet
        open={registrarAberto}
        onOpenChange={setRegistrarAberto}
        franchiseId={card.franchise_id}
        taskId={card.id}
        nomeUnidade={nome}
        onSalvo={() => { toast.success("Conversa registrada."); onMudou?.(); }}
      />
      <CartaoAcoesDialog
        modo={modoAcao}
        open={!!modoAcao}
        onOpenChange={(v) => { if (!v) setModoAcao(null); }}
        task={card}
        onFeito={() => onMudou?.()}
      />
    </div>
  );
}
