// Peças visuais da lista "Quem chamar hoje" (dados e gravação ficam em DailyActionsList).
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatters";
import { getWhatsAppLink } from "@/lib/whatsappUtils";
import { ACTION_TYPES, nomeCurtoProduto, nomeExibicao, primeiroNome } from "@/lib/customerActions";
import { CustomerMark, Recency } from "./CustomerBadges";

const FAIXA = { quente: "bg-brand", frio: "bg-brand-gold", normal: "bg-surface-line" };

export function MonthSummary({ summary, className = "" }) {
  if (!(summary?.enviadas > 0)) return null;
  const mes = new Date(`${summary.mes}-01T12:00:00Z`).toLocaleDateString("pt-BR", {
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
  return (
    <p className={`text-sm text-ink-2 ${className}`}>
      Em {mes}: <span className="font-mono-numbers">{summary.enviadas}</span>{" "}
      {summary.enviadas === 1 ? "cliente chamado" : "clientes chamados"} ·{" "}
      <span className="font-mono-numbers">{summary.compraram}</span>{" "}
      {summary.compraram === 1 ? "comprou" : "compraram"} até 7 dias depois
      {summary.valor > 0 && (
        <>
          {" "}(<span className="font-mono-numbers">{formatBRL(summary.valor)}</span>)
        </>
      )}
    </p>
  );
}

// Bolinhas do dia: verde = chamado, cinza = pulado, contorno = falta
export function DayProgress({ items }) {
  const feitos = items.filter((i) => i.status_hoje).length;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-live="polite">
      <div className="flex flex-wrap gap-1" aria-hidden="true">
        {items.slice(0, 20).map((item) => (
          <span
            key={item.contact_id}
            className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors ${
              item.status_hoje === "sent"
                ? "border-ok-ink bg-ok-ink text-white"
                : item.status_hoje === "skipped"
                ? "border-surface-line bg-surface-line text-ink-3"
                : "border-ink-3 bg-white"
            }`}
          >
            {item.status_hoje && (
              <MaterialIcon icon={item.status_hoje === "sent" ? "check" : "remove"} size={12} />
            )}
          </span>
        ))}
      </div>
      <span className="text-xs font-medium text-ink-2">
        <span className="font-mono-numbers">{feitos}</span> de{" "}
        <span className="font-mono-numbers">{items.length}</span> feitos
      </span>
    </div>
  );
}

export function Avatar({ item, size = "h-10 w-10" }) {
  const inicial = primeiroNome(item.nome).charAt(0);
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-brand/10 font-plus-jakarta font-bold text-brand`}
      aria-hidden="true"
    >
      {inicial || <MaterialIcon icon="person" size={20} />}
    </div>
  );
}

// Botão verde do WhatsApp: abre a conversa com o texto pronto e registra a ação.
export function CallButton({ item, message, onCall, compact = false }) {
  return (
    <a
      href={getWhatsAppLink(item.telefone, message)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onCall(item)}
      className={`flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-ok-ink font-semibold text-white transition-colors hover:bg-ok-ink/90 active:scale-[0.98] ${
        compact ? "h-11 px-3 text-sm" : "h-12 w-full px-3 text-[15px]"
      }`}
    >
      <MaterialIcon icon="chat" size={18} />
      {compact ? "Chamar" : "Chamar no WhatsApp"}
    </a>
  );
}

// Cartão completo (aba Hoje)
export function ActionCard({ item, message, onCall, onSkip, animationDelay }) {
  const tipo = ACTION_TYPES[item.tipo] || ACTION_TYPES.quase_comprou;
  const favorito = nomeCurtoProduto(item.favorito);
  const animar = animationDelay != null;
  const detalhes = [
    item.tipo === "voltou_a_falar" && item.dias != null && {
      key: "ultima",
      node: <Recency days={item.dias} prefix="Última compra" />,
    },
    item.total > 0 && {
      key: "gasto",
      node: (
        <span>
          Já gastou <span className="font-mono-numbers">{formatBRL(item.total)}</span>
        </span>
      ),
    },
    favorito && { key: "fav", node: <span className="min-w-0 truncate">Gosta de {favorito}</span> },
  ].filter(Boolean);

  return (
    <article
      style={animar ? { animationDelay: `${animationDelay}ms`, animationFillMode: "both" } : undefined}
      className={`relative min-w-0 overflow-hidden rounded-xl border border-surface-line bg-white p-4 pl-5 shadow-sm ${
        animar ? "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2" : ""
      }`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${FAIXA[tipo.tom]}`} aria-hidden="true" />

      <div className="flex min-w-0 items-center gap-3">
        <Avatar item={item} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-plus-jakarta text-base font-semibold text-ink">{nomeExibicao(item)}</p>
          <div className="mt-0.5">
            <CustomerMark purchases={item.compras} />
          </div>
        </div>
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-2">
        <MaterialIcon icon={tipo.icone} size={18} className={tipo.tom === "quente" ? "text-brand" : "text-ink-3"} />
        <span className="min-w-0">{tipo.motivo(item)}</span>
      </p>

      {detalhes.length > 0 && (
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 pl-6 text-xs text-ink-3">
          {detalhes.map((d, i) => (
            <span key={d.key} className="inline-flex min-w-0 items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">·</span>}
              {d.node}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 ml-6 min-w-0">
        <p className="mb-1 text-right text-[11px] text-ink-3">Mensagem pronta · dá pra mudar no WhatsApp</p>
        <p className="whitespace-pre-line break-words rounded-2xl rounded-tr-sm border border-ok/20 bg-ok-soft px-3 py-2 text-sm leading-relaxed text-ink">
          {message}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <CallButton item={item} message={message} onCall={onCall} />
        </div>
        <button
          type="button"
          onClick={() => onSkip(item)}
          className="h-12 shrink-0 rounded-xl px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-surface"
        >
          Pular
        </button>
      </div>
    </article>
  );
}

// Linha de quem já foi tratado hoje (chamado ou pulado)
export function HandledRow({ item, onUndo }) {
  const chamado = item.status_hoje === "sent";
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-surface-line bg-surface px-3 py-2">
      <MaterialIcon
        icon={chamado ? "check_circle" : "remove"}
        size={22}
        filled={chamado}
        className={chamado ? "text-ok" : "text-ink-3"}
      />
      <div className="min-w-0 flex-1">
        <p className={`truncate font-plus-jakarta font-semibold ${chamado ? "text-ink" : "text-ink-3"}`}>
          {nomeExibicao(item)}
        </p>
        <p className="text-xs text-ink-3">{chamado ? "Chamado hoje" : "Pulado hoje"}</p>
      </div>
      <button
        type="button"
        onClick={() => onUndo(item)}
        className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-white"
      >
        Desfazer
      </button>
    </div>
  );
}

// Linha enxuta da tela Início
export function CompactRow({ item, message, onCall }) {
  const tipo = ACTION_TYPES[item.tipo] || ACTION_TYPES.quase_comprou;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative">
        <Avatar item={item} />
        {tipo.tom === "quente" && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-brand" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-plus-jakarta font-semibold text-ink">{nomeExibicao(item)}</p>
        <p className="line-clamp-2 text-xs text-ink-2">{tipo.motivo(item)}</p>
      </div>
      <CallButton item={item} message={message} onCall={onCall} compact />
    </div>
  );
}
