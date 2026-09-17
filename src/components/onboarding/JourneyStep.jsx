import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { PASSO_ICONES } from "@/components/onboarding/journeySteps.js";

const DESTINO_ABRE = { drive: "abre o Drive", canva: "abre o Canva", video: "abre o vídeo" };
const TAREFA_ICON = { dica: "lightbulb", material: "folder_open" };

function formatarData(iso) {
  if (!iso) return "";
  try {
    return format(new Date(iso), "dd/MM", { locale: ptBR });
  } catch {
    return "";
  }
}

function SinalTarefa({ tarefa, numero }) {
  if (tarefa.tipo === "auto" || tarefa.tipo === "confirmacao") {
    if (tarefa.feita) {
      return (
        <span className="w-[30px] h-[30px] rounded-full bg-ok text-white flex items-center justify-center shrink-0">
          <MaterialIcon icon="check" size={17} />
        </span>
      );
    }
    return (
      <span className="w-[30px] h-[30px] rounded-full border-2 border-brand text-brand font-plus-jakarta font-extrabold text-[14px] flex items-center justify-center shrink-0">
        {numero}
      </span>
    );
  }
  // dica/material: ícone neutro, sem check — não contam pro progresso do passo
  return (
    <span className="w-[30px] h-[30px] rounded-full bg-surface-2 text-ink-3 flex items-center justify-center shrink-0">
      <MaterialIcon icon={TAREFA_ICON[tarefa.tipo] || "info"} size={16} />
    </span>
  );
}

function DestinoBotao({ destino, onClick }) {
  if (destino.tipo === "app") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="min-h-[40px] px-3.5 rounded-xl bg-brand-soft text-brand text-sm font-bold flex items-center gap-1.5"
      >
        {destino.rotulo}
        <MaterialIcon icon="arrow_forward" size={16} />
      </button>
    );
  }
  // drive/canva/video: link real, abre em nova aba
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <a
        href={destino.href}
        target="_blank"
        rel="noopener noreferrer"
        className="min-h-[40px] px-3.5 rounded-xl bg-surface-2 text-ink text-sm font-bold flex items-center gap-1.5"
      >
        {destino.rotulo}
        <MaterialIcon icon="open_in_new" size={16} />
      </a>
      <span className="text-xs font-semibold text-ink-3">{DESTINO_ABRE[destino.tipo]}</span>
    </div>
  );
}

function ConfirmacaoToggle({ tarefa, readOnly, onToggle }) {
  if (readOnly) {
    return (
      <div
        className={`min-h-[44px] rounded-xl px-4 flex items-center gap-2 text-sm font-semibold ${
          tarefa.feita ? "bg-ok-soft text-ok-ink" : "bg-surface-2 text-ink-3"
        }`}
      >
        <MaterialIcon icon={tarefa.feita ? "check_circle" : "radio_button_unchecked"} size={18} />
        {tarefa.feita ? `Confirmado${tarefa.feitaEm ? ` em ${formatarData(tarefa.feitaEm)}` : ""}` : "Ainda não confirmado"}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`min-h-[56px] rounded-2xl px-4 flex items-center justify-center gap-2.5 text-[16px] font-bold transition-colors ${
        tarefa.feita
          ? "bg-ok-soft text-ok-ink border-2 border-ok/30"
          : "bg-white border-2 border-brand text-brand"
      }`}
    >
      <MaterialIcon icon={tarefa.feita ? "check_circle" : "radio_button_unchecked"} size={20} filled={tarefa.feita} />
      {tarefa.feita ? "Confirmado — toque para desfazer" : tarefa.titulo}
    </button>
  );
}

/**
 * Um passo da trilha, em formato acordeão: cabeçalho sempre visível (avatar,
 * título, "X de Y feitas"/"Pronto"), corpo só quando `isOpen` — com as tarefas NA
 * ORDEM do processo, cada uma com seu botão de destino ou o toggle de confirmação.
 */
export default function JourneyStep({
  passo,
  isOpen,
  onToggleOpen,
  onDestino,
  onToggleConfirmacao,
  readOnly = false,
  fiscalGate = null,
}) {
  const icon = PASSO_ICONES[passo.id] || "task_alt";
  let contador = 0;

  return (
    <div className="bg-white border border-surface-line rounded-[18px] overflow-hidden">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        className="w-full min-h-[64px] px-4 py-3 flex items-center gap-3 text-left"
      >
        {passo.pronto ? (
          <span className="w-9 h-9 rounded-full bg-ok text-white flex items-center justify-center shrink-0">
            <MaterialIcon icon="check" size={20} />
          </span>
        ) : (
          <span className="w-9 h-9 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0">
            <MaterialIcon icon={icon} size={18} />
          </span>
        )}
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-[16px] font-bold text-ink">
            {passo.numero} · {passo.titulo}
          </span>
          <span className="text-sm text-ink-3">
            {passo.total === 0
              ? "Sem confirmação pendente"
              : `${passo.feitas} de ${passo.total} ${passo.total === 1 ? "feita" : "feitas"}`}
          </span>
        </span>
        {passo.pronto && <span className="text-sm font-bold text-ok-ink shrink-0">Pronto</span>}
        <MaterialIcon icon={isOpen ? "expand_less" : "expand_more"} size={22} className="text-ink-3 shrink-0" />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-surface-line pt-3">
          {passo.tarefas.map((tarefa) => {
            const conta = tarefa.tipo === "auto" || tarefa.tipo === "confirmacao";
            if (conta) contador += 1;
            const destinosVisiveis = (tarefa.destinos || []).filter((d) => d.tipo !== "acao");

            return (
              <div key={tarefa.id} className="flex gap-3">
                <SinalTarefa tarefa={tarefa} numero={contador} />
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <span className="text-[15px] font-bold text-ink leading-snug">{tarefa.titulo}</span>
                  {tarefa.texto && (
                    <span className="text-sm text-ink-2 leading-relaxed whitespace-pre-line">{tarefa.texto}</span>
                  )}

                  {tarefa.id === "fiscal" && fiscalGate}

                  {tarefa.tipo === "confirmacao" && (
                    <div className="mt-1">
                      <ConfirmacaoToggle
                        tarefa={tarefa}
                        readOnly={readOnly}
                        onToggle={() => onToggleConfirmacao?.(passo.id, tarefa.id)}
                      />
                    </div>
                  )}

                  {/* readOnly (visão admin): sem botão clicável parado (dead click) — só o texto já
                      conta a história. Confirmação também some (ConfirmacaoToggle cuida disso). */}
                  {!readOnly && destinosVisiveis.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {destinosVisiveis.map((destino, idx) => (
                        <DestinoBotao
                          key={`${tarefa.id}-${idx}`}
                          destino={destino}
                          onClick={() => onDestino?.(destino, passo.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
