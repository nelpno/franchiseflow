// Classes do padrão visual do admin (docs/claude/padrao-visual-admin.md), num lugar só.
// Uso: import { CARTAO, BTN_PRIMARIO } from "@/components/shared/adminUi";
//      <div className={CARTAO}>…</div>   <button className={`${BTN_PRIMARIO} w-full`}>…</button>
// Cada constante cita a regra do padrão. Mudar aqui muda todas as telas que usam.

// P1 / P2 — invólucro da página (o fundo vem do Layout: a página não repinta bg-surface).
export const PAGINA = "mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8";
export const PAGINA_LARGA = "mx-auto max-w-none space-y-6 px-4 py-6 sm:px-6 lg:px-8"; // só o Kanban do Mural

// C2 / C3 / C4 — cabeçalho.
export const H1 = "font-plus-jakarta text-2xl font-extrabold tracking-tight text-ink sm:text-3xl";
export const SUBTITULO = "mt-1 max-w-2xl text-sm text-ink-2";
export const LINK_VOLTAR = "inline-flex min-h-10 items-center text-sm font-semibold text-brand-dark hover:underline";

// K1 / K2 — cartão plano; K11 — título dentro do cartão.
export const CARTAO = "rounded-2xl border border-surface-line bg-white p-4 sm:p-5";
export const CARTAO_CLICAVEL = `${CARTAO} transition-colors hover:bg-surface`;
export const H3_CARTAO = "font-plus-jakarta text-base font-bold text-ink";

// K5 — os 3 cartões de tom permitidos.
export const TOM_MAXI = "rounded-2xl border border-brand-gold-line bg-brand-gold-soft p-4 sm:p-5";
export const TOM_CHEGADA = "rounded-2xl bg-brand-soft p-4 sm:p-5";
export const TOM_ATENCAO = "rounded-2xl border border-warn/40 bg-warn-soft p-4 sm:p-5";

// K6 — indicador (número grande).
export const ROTULO = "text-xs font-bold uppercase tracking-wide text-ink-3";
export const NUMERO_GRANDE = "mt-2 font-plus-jakarta text-2xl font-extrabold tabular-nums text-ink sm:text-3xl";
export const COMPARACAO = "mt-1 text-sm text-ink-2";

// S1 / S2 — h2 fora de cartão.
export const H2 = "font-plus-jakarta text-xl font-bold text-ink";

// B1..B4, B7 — botões e link de ação.
export const BTN_PRIMARIO =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_SECUNDARIO =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-surface-line bg-white px-4 text-sm font-semibold text-ink-2 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_CONTORNO_MARCA =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-brand-dark bg-white px-4 text-sm font-semibold text-brand-dark hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50";
export const LINK_ACAO =
  "inline-flex min-h-10 items-center whitespace-nowrap text-sm font-semibold text-brand-dark hover:underline";

// T1 / T3 — lista dentro de cartão e cabeçalho da grade.
export const LISTA = "overflow-hidden rounded-2xl border border-surface-line bg-white";
export const CABECALHO_LISTA = "bg-surface-2 px-5 py-3 text-xs font-bold uppercase tracking-wide text-ink-3 whitespace-nowrap";

// F1..F3 — chip de filtro.
export const CHIP = "inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-sm";
export const CHIP_ATIVO = "border-brand-dark bg-brand-dark font-semibold text-white";
export const CHIP_INATIVO = "border-surface-line bg-white font-medium text-ink-2 hover:bg-surface";

// C5 — altura única dos controles do cabeçalho.
export const CONTROLE_CABECALHO = "h-11 rounded-xl";
