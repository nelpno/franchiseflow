// Peças pequenas da tela Canais de venda (cartão do Hoje e página CanaisVenda).
import { formatBRLInteger, formatPct } from "@/lib/formatters";
import { variacaoPct } from "@/lib/canaisVenda";

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
/** "28/10 a 03/11 até 18h33": o período anterior é cortado na mesma hora de agora (RPC: corte_anterior). */
export const contraTexto = (d) => {
  if (!d) return "";
  const h = horaBR(d.corte_anterior);
  return `${trecho(d.inicio_anterior, d.fim_anterior)}${h ? ` até ${h}` : ""}`;
};

export const TOM_SINAL = {
  err: "bg-err-soft text-err",
  warn: "bg-warn-soft text-warn-ink",
};

/** K7: só o número ganha cor. `semBase` quando o anterior é 0. */
export function Comparacao({ atual, anterior, contra, className = "mt-1 text-sm text-ink-2" }) {
  const v = variacaoPct(atual, anterior);
  if (v === null) return <p className={className}>Sem vendas {contra ? `em ${contra}` : "no período anterior"}</p>;
  const cor = v > 0.05 ? "text-ok-ink" : v < -0.05 ? "text-err" : "text-ink";
  return (
    <p className={className}>
      <span className={`font-semibold ${cor}`}>{formatPct(v, { sinal: true })}</span> contra {contra}
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
