// Peças pequenas da tela Canais de venda (cartão do Hoje e página CanaisVenda).
import { formatBRLInteger } from "@/lib/formatters";
import { baseComparacao, comparacaoCurta } from "@/lib/canaisVenda";

export const n = (v) => (Number(v) || 0).toLocaleString("pt-BR");
export const brl = (v) => formatBRLInteger(v);
/** "1 visita" / "3 visitas" */
export const qtd = (v, um, varios) => `${n(v)} ${Number(v) === 1 ? um : varios}`;

const dm = (iso) => {
  const [, mm, dd] = String(iso || "").split("-");
  return dd && mm ? `${dd}/${mm}` : "";
};
/** "04 a 10/11" */
export const trecho = (ini, fim) => {
  const a = dm(ini), b = dm(fim);
  if (!a || !b) return "";
  return a.slice(3) === b.slice(3) ? `${a.slice(0, 2)} a ${b}` : `${a} a ${b}`;
};

const horaBR = (iso) => {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(t)).replace(":", "h");
};
/** Letra miúda / dica: "01 a 10/11 até agora · base 01 a 10/10 até 20h39" (as datas só aqui, não na comparação). */
export const detalhePeriodo = (d) => {
  if (!d) return "";
  const h = horaBR(d.corte_anterior);
  const agora = d.fim === d.hoje ? " até agora" : "";
  return `${trecho(d.inicio, d.fim)}${agora} · base ${trecho(d.inicio_anterior, d.fim_anterior)}${h ? ` até ${h}` : ""}`;
};

export const TOM_SINAL = {
  err: "bg-err-soft text-err",
  warn: "bg-warn-soft text-warn-ink",
};

const COR_COMPARACAO = { ok: "text-ok-ink", err: "text-err", neutro: "text-ink" };

/**
 * K7: só o número ganha cor. Curta: "+16% vs. semana anterior"; sem base: "novo" (agora tem) ou "—".
 * As datas exatas vão no `title` (dica ao passar o mouse) e na letra miúda do cabeçalho.
 */
export function Comparacao({ atual, anterior, dados, className = "mt-1 text-sm text-ink-2" }) {
  const c = comparacaoCurta(atual, anterior);
  const base = baseComparacao(dados);
  const semBase = c.texto === "novo" || c.texto === "—";
  return (
    <p className={className} title={detalhePeriodo(dados)}>
      <span className={`font-semibold ${COR_COMPARACAO[c.tom]}`}>{c.texto}</span>
      {!semBase && base ? ` vs. ${base}` : ""}
    </p>
  );
}

export function ChipSinal({ sinal, extra = 0 }) {
  if (!sinal) return null;
  return (
    <span className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TOM_SINAL[sinal.tom] || TOM_SINAL.warn}`}>
      <span className="line-clamp-2">{sinal.rotulo}{extra > 0 ? ` · +${extra}` : ""}</span>
    </span>
  );
}
