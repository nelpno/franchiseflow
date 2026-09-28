// Regras de EXIBIÇÃO da tela nova do Resultado (S17, chave ui_v2), fora do JSX para testar.
import { formatBRL } from "./formatters.js";

/**
 * Linha de comparação do Sobrou (P3 S17, item 2). O número grande é o TOTAL do mês (contrato:
 * venda com data futura dentro do mês conta). A comparação do mês em andamento corta no dia de
 * hoje, então ela diz a BASE: "Até o dia 28: R$ X, contra R$ Y em agosto no mesmo trecho".
 * Mês fechado: mês inteiro contra mês inteiro.
 */
export function textoComparacaoSobrou(c, diaCorte) {
  if (!c) return null;
  const pct = c.pct !== null && c.pct !== undefined ? ` (${c.pct > 0 ? "+" : ""}${c.pct}%)` : "";
  if (c.mesmoTrecho) {
    return `Até o dia ${diaCorte}: ${formatBRL(c.agora)}, contra ${formatBRL(c.antes)} em ${c.mesAnterior} no mesmo trecho${pct}`;
  }
  if (Math.abs(c.diff) < 0.005) return `Igual a ${c.mesAnterior} (${formatBRL(c.antes)})`;
  const lado = c.diff > 0 ? "a mais" : "a menos";
  return `${formatBRL(Math.abs(c.diff))} ${lado} que ${c.mesAnterior} (${formatBRL(c.antes)})${pct}`;
}

/**
 * Blocos da tela, na ordem (P3 S17, item 4). Mês sem venda nem gasto troca SÓ os blocos do mês
 * (De onde veio, Para onde foi, Mais vendidos) pelo aviso "vazio"; Estoque, O que mudou,
 * Quanto sobrou por mês e Gastos do mês continuam (cada um tem o seu próprio vazio).
 */
export function blocosDoResultado({ hasData }) {
  return [
    "topo",
    "avisoFabrica",
    hasData ? "doMes" : "vazio",
    "oQueMudou",
    "estoque",
    "porMes",
    "gastos",
    ...(hasData ? ["planilhaVendas"] : []),
    "historico",
  ];
}
