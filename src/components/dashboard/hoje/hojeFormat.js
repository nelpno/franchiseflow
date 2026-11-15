// Helpers de texto só da tela "Hoje" do admin — nada de regra de negócio aqui (isso mora em
// src/lib/networkOverview.js). Nome de mês, percentual e primeiro nome vêm de
// src/lib/adminFormat.js; dinheiro de src/lib/formatters.js. O mês vem do banco
// (mesesVerba(overview).mes), o dia é o de São Paulo.
import { nomeMes, somarMeses } from "@/lib/adminFormat";

const FUSO = "America/Sao_Paulo";

export function saudacao() {
  const hora = Number(new Date().toLocaleString("en-US", { timeZone: FUSO, hour: "numeric", hour12: false }));
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export function dataExtenso() {
  const s = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: FUSO });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function diaDeHojeSP() {
  return Number(new Date().toLocaleString("en-US", { timeZone: FUSO, day: "numeric" }));
}

// mes = 'YYYY-MM' do banco. "SETEMBRO ATÉ DIA 26"
export function mesAtualLabel(mes) {
  const nome = nomeMes(mes);
  return nome ? `${nome.toUpperCase()} ATÉ DIA ${diaDeHojeSP()}` : `ATÉ DIA ${diaDeHojeSP()}`;
}

// "contra 1 a 26 de agosto"
export function trechoMesAnteriorLabel(mes) {
  const anterior = nomeMes(somarMeses(mes, -1));
  return anterior ? `contra 1 a ${diaDeHojeSP()} de ${anterior}` : "contra o mesmo trecho do mês passado";
}

export function nomeMesAnterior(mes) {
  return nomeMes(somarMeses(mes, -1)) || "o mês passado";
}

// Diferença entre duas taxas, em pontos percentuais: "+1,5 pontos" / "−0,8 pontos".
export function formatPontos(delta) {
  const r = Math.round(Math.abs(delta) * 10) / 10;
  const corpo = r.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (r === 0) return `${corpo} pontos`;
  return `${delta < 0 ? "−" : "+"}${corpo} pontos`;
}

export function plural(n, singular, pluralForm) {
  return n === 1 ? singular : pluralForm;
}
