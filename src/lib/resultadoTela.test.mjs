// P3 S17 (itens 2 e 4): regras de exibição da tela nova do Resultado. node src/lib/resultadoTela.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { textoComparacaoSobrou, blocosDoResultado } from "./resultadoTela.js";
import { montarResultadoMes } from "./monthlyReport.js";

const nb = (s) => s.replace(/ /g, " ");

// Setembro com uma venda de data FUTURA (dia 30): conta no total do mês, não no trecho até hoje.
const sales = [
  { id: "a", sale_date: "2026-08-10", value: 300, delivery_fee: 0, discount_amount: 0, card_fee_amount: 0 },
  { id: "b", sale_date: "2026-09-10", value: 400, delivery_fee: 0, discount_amount: 0, card_fee_amount: 0 },
  { id: "c", sale_date: "2026-09-30", value: 1000, delivery_fee: 0, discount_amount: 0, card_fee_amount: 0 },
];
const HOJE = new Date(2026, 8, 28);
const m = montarResultadoMes({ sales, saleItems: [], expenses: [], mesSelecionado: HOJE, hoje: HOJE });

test("item 2: número grande = total do mês; a comparação diz a base (até o dia X) com os dois valores", () => {
  assert.equal(m.sobrou, 1400); // inclui a venda do dia 30
  const t = nb(textoComparacaoSobrou(m.comparacao, m.diaCorte));
  assert.equal(t, "Até o dia 28: R$ 400,00, contra R$ 300,00 em agosto no mesmo trecho (+33%)");
  // o texto nunca pode sugerir que a diferença é sobre o total mostrado
  assert.ok(!t.includes("1.400"));
});

test("item 2: mês fechado compara o mês inteiro e mostra a base do anterior", () => {
  const out = montarResultadoMes({ sales, saleItems: [], expenses: [], mesSelecionado: HOJE, hoje: new Date(2026, 9, 2) });
  assert.equal(nb(textoComparacaoSobrou(out.comparacao, out.diaCorte)), "R$ 1.100,00 a mais que agosto (R$ 300,00) (+367%)");
  assert.equal(textoComparacaoSobrou(null, 28), null);
});

test("item 4: mês vazio troca só os blocos do mês; Estoque, O que mudou, por mês e gastos ficam", () => {
  const vazio = blocosDoResultado({ hasData: false });
  for (const b of ["topo", "avisoFabrica", "vazio", "oQueMudou", "estoque", "porMes", "gastos"]) assert.ok(vazio.includes(b), b);
  assert.ok(!vazio.includes("doMes"));
  assert.ok(!vazio.includes("planilhaVendas"));
  const cheio = blocosDoResultado({ hasData: true });
  assert.ok(cheio.includes("doMes") && !cheio.includes("vazio"));
});
