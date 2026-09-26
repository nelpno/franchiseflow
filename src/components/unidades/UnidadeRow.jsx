// Uma linha da tela Unidades. Desktop (md+) é a grade de colunas; celular é um cartão
// compacto de 3 linhas (T9): nome + 1º sinal em chip / o número que importa para o
// filtro atual / "Abrir ficha →". Os dois usam os MESMOS helpers de unidadeDisplay.js.
import { Link, useLocation } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { safeHref } from "@/lib/safeHref";
import { getWhatsAppLink } from "@/lib/whatsappUtils";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";
import { linkFicha, nomeCurto, sinaisUnidade } from "@/lib/networkOverview";
import { LINK_ACAO } from "@/components/shared/adminUi";
import {
  GRID_COLS,
  faturamentoInfo,
  idadeLabel,
  pedidoLabel,
  roboLabel,
  rotuloColunaFaturamento,
  semVendaLabel,
  verbaInfo,
} from "./unidadeDisplay";

// Célula da grade — só desktop (o cabeçalho da tabela já nomeia a coluna). O celular usa
// o cartão compacto acima, não esta grade (T9: nada de 5 linhas de rótulo/valor).
function Field({ children }) {
  return <div className="hidden md:block md:text-left">{children}</div>;
}

const VERBA_TOM = {
  nao_pagou: "font-semibold text-err",
  nao_pagou_nova: "text-ink-3",
  sem_campanha: "text-warn-ink",
  paga: "text-ok-ink",
};

// Chip do 1º sinal (T9) — mesmos 2 tons de sinaisUnidade (err/warn); neutro fica cinza.
const CHIP_TOM_SINAL = {
  err: "border-err/40 bg-err-soft text-err",
  warn: "border-warn/40 bg-warn-soft text-warn-ink",
  neutro: "border-surface-line bg-surface-2 text-ink-2",
};

// sinaisUnidade() dá o título LONGO ("Vendendo 24,7% menos que no mesmo trecho do mês
// passado", pensado pra frase/ficha) — não cabe num chip de cartão de 390px (achado do
// print unidades-390: o chip não encolhia e empurrava o nome pra 1 letra). O número
// específico (dias, %) já aparece na linha de baixo; o chip só precisa dizer O QUÊ.
const CHIP_CURTO = {
  sem_venda: "Sem venda",
  robo_parado: "Robô parado",
  caiu: "Vendendo menos",
  sem_verba: "Sem verba",
  mensalidade: "Mensalidade vencida",
  nova: "Nova",
};

// Sem telefone (item 7, B10): NÃO existe hoje tela nenhuma pra cadastrar phone_number/
// personal_phone_for_summary (conferido em FranchiseForm.jsx e no fluxo de dados fiscais) —
// um link "Cadastrar telefone →" pra Ficha ou pra Franchises seria a MESMA promessa vazia
// com outra cara. Admin/gerente ganha um link honesto pro cadastro (pelo menos confirma o
// que está gravado e de lá dá pra seguir por fora do app); CS não acessa Franchises, então
// fica com o texto neutro sem link (regra já usada em Unidades.jsx: "podeCriar").
function SemTelefoneAcao({ evo, podeVerCadastro, className }) {
  if (!podeVerCadastro) {
    return <span className={`text-sm text-ink-3 ${className || ""}`}>Sem telefone cadastrado</span>;
  }
  return (
    <Link to={`${createPageUrl("Franchises")}?id=${encodeURIComponent(evo ?? "")}&openSheet=1`} className={`${LINK_ACAO} ${className || ""}`}>
      Ver cadastro →
    </Link>
  );
}

function SinalChip({ sinal }) {
  if (!sinal) return null;
  return (
    <span
      className={`inline-flex max-w-[45%] shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CHIP_TOM_SINAL[sinal.tom] || CHIP_TOM_SINAL.neutro}`}
    >
      {CHIP_CURTO[sinal.chave] || sinal.titulo}
    </span>
  );
}

// `filtro` (opcional, decisão 12): troca "Faturamento no mês" por "Vendia em 90 dias"
// quando a lista está filtrada por sem_venda/robo_parado (T8: a coluna que ordena
// precisa aparecer).
export default function UnidadeRow({ row, filtro }) {
  const location = useLocation();
  const { user } = useAuth();
  // Mesma regra de Unidades.jsx ("podeCriar"): CS não acessa Franchises.
  const podeVerCadastro = user?.role === "admin" || user?.role === "manager";
  const idade = idadeLabel(row);
  const fat = faturamentoInfo(row, filtro);
  const semVenda = semVendaLabel(row);
  const robo = roboLabel(row);
  const pedido = pedidoLabel(row);
  const verba = verbaInfo(row);
  const sinal = sinaisUnidade(row)[0] || null;
  const rotuloFat = rotuloColunaFaturamento(filtro);
  // Telefone vem da overview (row.phone): supabase/2026-09-26-admin-08-overview-enxuta.sql.
  // Investigado 26/09 (item 7): não é bug de regex — Itapevi, Itatiba e Lapa de Baixo
  // não têm NENHUM telefone cadastrado (phone_number e personal_phone_for_summary vazios
  // nas duas), não um regexp que zera um dado que existe. B10: dado ausente vira o
  // caminho para resolver, nunca texto cinza morto.
  const phone = row.phone || null;
  // Decisão 7: todo link para a Ficha leva {from, label} para o "← Voltar" voltar aqui.
  const { to: fichaTo, state: fichaState } = linkFicha(row.franchise_id, {
    from: location.pathname + location.search,
    label: "Unidades",
  });

  return (
    <div className={`grid grid-cols-1 gap-2.5 p-4 md:items-center md:gap-3 md:px-5 md:py-3.5 ${GRID_COLS}`}>
      {/* Celular (T9): nome + chip do 1º sinal / número que importa / ação. Desktop some
          (a grade abaixo cobre >=md). */}
      <div className="flex flex-col gap-2 md:hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold leading-snug text-ink">{nomeCurto(row.franchise_name)}</p>
            <p className="truncate text-sm text-ink-3">
              {row.owner_name || "—"}
              {idade ? ` · ${idade}` : ""}
            </p>
          </div>
          <SinalChip sinal={sinal} />
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">{rotuloFat}</span>
          <span className="text-right tabular-nums">
            <span className="font-semibold text-ink">{fat.valor}</span>
            {fat.deltaLabel && <span className={`ml-1.5 text-sm font-semibold ${fat.tone}`}>{fat.deltaLabel}</span>}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          {phone ? (
            <a
              href={safeHref(getWhatsAppLink(phone))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-brand-dark hover:underline"
            >
              <MaterialIcon icon="chat" size={16} aria-hidden="true" />
              WhatsApp
            </a>
          ) : (
            <SemTelefoneAcao evo={row.franchise_id} podeVerCadastro={podeVerCadastro} />
          )}
          <Link to={fichaTo} state={fichaState} className={LINK_ACAO}>
            Abrir ficha →
          </Link>
        </div>
      </div>

      {/* Desktop: a grade de colunas (GRID_COLS), some no celular. */}
      <div className="hidden min-w-0 md:block">
        <p className="font-semibold leading-snug text-ink">{nomeCurto(row.franchise_name)}</p>
        <p className="truncate text-sm text-ink-3">
          {row.owner_name || "—"}
          {idade ? ` · ${idade}` : ""}
        </p>
      </div>

      <Field>
        <span className="font-semibold text-ink">{fat.valor}</span>
        {fat.deltaLabel && <span className={`ml-1.5 text-sm font-semibold ${fat.tone}`}>{fat.deltaLabel}</span>}
      </Field>

      <Field>
        <span className={semVenda.destaque ? "font-semibold text-err" : "text-ink-2"}>{semVenda.texto}</span>
      </Field>

      <Field>
        <span className={`whitespace-nowrap ${robo.destaque ? "font-semibold text-err" : "text-ink-2"}`}>{robo.texto}</span>
      </Field>

      <Field>
        <span className="whitespace-nowrap text-ink-2">{pedido.texto}</span>
        {pedido.extra && <span className="ml-1.5 block text-xs font-semibold text-brand-dark md:inline">{pedido.extra}</span>}
      </Field>

      <Field>
        <span className={`whitespace-nowrap ${VERBA_TOM[verba.status]}`} title={verba.tooltip || undefined}>
          {verba.texto}
        </span>
        {verba.secundario && <span className="ml-1.5 block text-xs text-ink-3 md:inline md:ml-1.5">{verba.secundario}</span>}
      </Field>

      <div className="hidden items-center justify-end gap-1 md:flex">
        {phone ? (
          <a
            href={safeHref(getWhatsAppLink(phone))}
            target="_blank"
            rel="noopener noreferrer"
            title="Chamar no WhatsApp"
            aria-label="Chamar no WhatsApp"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface hover:text-brand-dark"
          >
            <MaterialIcon icon="chat" size={18} aria-hidden="true" />
          </a>
        ) : podeVerCadastro ? (
          // Ícone de 40px (mesmo tamanho do botão de WhatsApp acima) em vez do texto longo
          // "Cadastrar telefone →"/"Ver cadastro →": texto comprido só nas linhas sem telefone
          // empurrava essa coluna e desalinhava o resto da grade (achado médio 26/09, item 3).
          <Link
            to={`${createPageUrl("Franchises")}?id=${encodeURIComponent(row.franchise_id ?? "")}&openSheet=1`}
            title="Ver cadastro da unidade"
            aria-label="Ver cadastro da unidade"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface hover:text-brand-dark"
          >
            <MaterialIcon icon="visibility" size={18} aria-hidden="true" />
          </Link>
        ) : null}
        <Link to={fichaTo} state={fichaState} className={LINK_ACAO}>
          Abrir ficha →
        </Link>
      </div>
    </div>
  );
}
