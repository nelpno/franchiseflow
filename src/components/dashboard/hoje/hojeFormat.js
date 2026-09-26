// Helpers de texto/data só da tela "Hoje" do admin — nada de regra de negócio aqui
// (isso mora em src/lib/networkOverview.js). Datas mostradas ao Nelson usam o relógio
// do dispositivo (mesmo padrão de src/lib/monthlyReport.js), não é cálculo de banco.
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export function saudacao() {
  const hora = Number(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false })
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export function primeiroNome(fullName) {
  return fullName?.split(" ")[0] || "";
}

export function dataExtenso() {
  const s = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// "SETEMBRO ATÉ DIA 26"
export function mesAtualLabel() {
  const now = new Date();
  return `${format(now, "MMMM", { locale: ptBR }).toUpperCase()} ATÉ DIA ${now.getDate()}`;
}

// "contra 1 a 26 de agosto"
export function trechoMesAnteriorLabel() {
  const now = new Date();
  const mesAnterior = format(subMonths(now, 1), "MMMM", { locale: ptBR });
  return `contra 1 a ${now.getDate()} de ${mesAnterior}`;
}

export function nomeMesAnterior() {
  return format(subMonths(new Date(), 1), "MMMM", { locale: ptBR });
}

// "YYYY-MM" -> "outubro" (mês por extenso, sem depender de fuso: monta a data ao meio-dia)
export function nomeDoMes(yyyyMm) {
  if (!yyyyMm) return "";
  return format(new Date(`${yyyyMm}-01T12:00:00`), "MMMM", { locale: ptBR });
}

// R$ 307,3 mil — só para os cartões grandes da home; tabela/valor unitário continua
// usando formatBRL/formatBRLInteger de src/lib/formatters.js.
export function formatBRLMil(value) {
  const n = Number(value) || 0;
  if (Math.abs(n) < 1000) {
    return `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
  }
  return `R$ ${(n / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;
}

export function formatPct1(value) {
  return `${Number(value).toFixed(1).replace(".", ",")}%`;
}

export function formatPontos(delta) {
  const sinal = delta >= 0 ? "+" : "";
  return `${sinal}${delta.toFixed(1).replace(".", ",")} pontos`;
}

export function plural(n, singular, pluralForm) {
  return n === 1 ? singular : pluralForm;
}
