// Uma linha da tela Unidades. Mesmo componente serve de linha de tabela (desktop, grid)
// e de cartão empilhado (celular, grid-cols-1) — só troca a grade no breakpoint md.
import MaterialIcon from "@/components/ui/MaterialIcon";
import { safeHref } from "@/lib/safeHref";
import { getWhatsAppLink } from "@/lib/whatsappUtils";
import { nomeCurto } from "@/lib/networkOverview";
import { GRID_COLS, faturamentoInfo, idadeLabel, pedidoLabel, roboLabel, semVendaLabel, verbaInfo } from "./unidadeDisplay";

// Rótulo (só no celular, o header desktop já diz a coluna) + valor alinhado à direita
// no celular (par "rótulo: valor") e à esquerda no desktop (célula da grade).
function Field({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-2 md:block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3 md:hidden">{label}</span>
      <span className="text-right md:text-left">{children}</span>
    </div>
  );
}

const VERBA_TOM = {
  nao_pagou: "font-semibold text-err",
  sem_campanha: "text-warn-ink",
  paga: "text-ok-ink",
};

export default function UnidadeRow({ row, contato }) {
  const idade = idadeLabel(row);
  const fat = faturamentoInfo(row);
  const semVenda = semVendaLabel(row);
  const robo = roboLabel(row);
  const pedido = pedidoLabel(row);
  const verba = verbaInfo(row);
  const phone = contato?.phone || null;

  return (
    <div className={`grid grid-cols-1 gap-2.5 p-4 md:items-center md:gap-3 md:px-5 md:py-3.5 ${GRID_COLS}`}>
      <div className="min-w-0">
        <p className="font-semibold leading-snug text-ink">{nomeCurto(row.franchise_name)}</p>
        <p className="truncate text-sm text-ink-3">
          {row.owner_name || "—"}
          {idade ? ` · ${idade}` : ""}
        </p>
      </div>

      <Field label="Faturamento no mês">
        <span className="font-semibold text-ink">{fat.valor}</span>
        {fat.deltaLabel && <span className={`ml-1.5 text-sm font-semibold ${fat.tone}`}>{fat.deltaLabel}</span>}
      </Field>

      <Field label="Sem venda há">
        <span className={semVenda.destaque ? "font-semibold text-err" : "text-ink-2"}>{semVenda.texto}</span>
      </Field>

      <Field label="Robô">
        <span className={robo.destaque ? "font-semibold text-err" : "text-ink-2"}>{robo.texto}</span>
      </Field>

      <Field label="Último pedido à fábrica">
        <span className="text-ink-2">{pedido.texto}</span>
        {pedido.extra && <span className="ml-1.5 block text-xs font-semibold text-brand-dark md:inline">{pedido.extra}</span>}
      </Field>

      <Field label="Verba do mês">
        <span className={VERBA_TOM[verba.status]}>{verba.texto}</span>
      </Field>

      <div className="flex justify-end pt-1 md:pt-0">
        {phone ? (
          <a
            href={safeHref(getWhatsAppLink(phone))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-brand-dark hover:underline"
          >
            <MaterialIcon icon="chat" size={16} aria-hidden="true" />
            Chamar no WhatsApp →
          </a>
        ) : (
          <span className="text-sm text-ink-3">Sem telefone cadastrado</span>
        )}
      </div>
    </div>
  );
}
