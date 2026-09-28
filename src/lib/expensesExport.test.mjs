// node src/lib/expensesExport.test.mjs — ordem e planilha das despesas (pedido de Ubatuba, 28/09/2026)
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { sortExpenses, buildExpensesExportRows, EXPENSES_EXPORT_COLUMNS } from "./expensesExport.js";
import { buildExportWorksheet } from "./exportSheet.js";

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

// ids "aleatórios" de propósito: a ordem antiga era a do id
const despesas = [
  { id: "f1", expense_date: "2026-09-05", created_at: "2026-09-05T13:00:00Z", category: "marketing", description: "Verba", amount: "500", source: "marketing_payment" },
  { id: "a2", expense_date: "2026-09-20", created_at: "2026-09-21T02:30:00Z", category: "outros", description: "=cmd", supplier: "Mercado", amount: 12.5, source: "manual" },
  { id: "c3", expense_date: "2026-09-20", created_at: "2026-09-20T10:00:00Z", category: "transporte", description: "Frete", amount: "30", source: "purchase_order" },
  { id: "b4", expense_date: "2026-09-01", created_at: "2026-09-01T09:00:00Z", category: "pacote_sistema", description: "Mensalidade", amount: 150, source: "asaas_subscription" },
];

test("mais recente primeiro; no mesmo dia, a lançada por último primeiro", () => {
  assert.deepEqual(sortExpenses(despesas).map((e) => e.id), ["a2", "c3", "f1", "b4"]);
});

test("não muda a lista original", () => {
  sortExpenses(despesas);
  assert.equal(despesas[0].id, "f1");
});

test("linhas com número, data, origem e anti-fórmula", () => {
  const rows = buildExpensesExportRows(despesas, { includeTotalsRow: true });
  assert.equal(rows[0].amount, 12.5);
  assert.equal(rows[0].expense_date.getDate(), 20);
  assert.equal(rows[0].origem, "Lançada à mão");
  assert.ok(!rows[0].descricao.startsWith("="));
  // 02:30 UTC do dia 21 = 23:30 do dia 20 em Brasília
  assert.equal(rows[0].lancado_em.getDate(), 20);
  assert.equal(rows[0].lancado_em.getHours(), 23);
  const total = rows[rows.length - 1];
  assert.equal(total.categoria, "TOTAL");
  assert.equal(total.amount, 692.5);
});

test("o .xlsx sai com valor numérico e data (lido de volta)", () => {
  const rows = buildExpensesExportRows(despesas, { includeTotalsRow: true });
  const ws = buildExportWorksheet(XLSX, rows, EXPENSES_EXPORT_COLUMNS);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  const back = XLSX.read(XLSX.write(wb, { bookType: "xlsx", type: "array" }), { type: "array", cellDates: true });
  const sh = back.Sheets.Dados;
  const col = (k) => EXPENSES_EXPORT_COLUMNS.findIndex((c) => c.key === k);
  const at = (r, k) => sh[XLSX.utils.encode_cell({ r, c: col(k) })];
  assert.equal(at(1, "amount").t, "n");
  assert.equal(at(1, "amount").v, 12.5);
  assert.equal(at(1, "expense_date").t, "d");
  assert.notEqual(at(1, "lancado_em").t, "s");
  assert.equal(at(5, "amount").v, 692.5);
});

console.log(`\n${passed} testes ok`);
