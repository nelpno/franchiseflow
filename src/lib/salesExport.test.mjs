// node src/lib/salesExport.test.mjs — planilha de vendas (S6.3): número como número, data
// como data, hora de Brasília e nº/cliente/telefone vindos da própria venda.
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { buildSalesExportRows, SALES_EXPORT_COLUMNS, SALES_EXPORT_QUERY_COLUMNS } from "./salesExport.js";
import { buildExportWorksheet } from "./exportSheet.js";

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const sales = [
  {
    id: "a",
    sale_date: "2026-09-05",
    // 23:30 em Brasília = 02:30 UTC do dia seguinte
    created_at: "2026-09-06T02:30:00Z",
    sale_number: 42,
    contact_id: null,
    customer_name: "Cliente Ficticio",
    contact_phone: "11999990000",
    payment_method: "pix",
    value: "100.50",
    discount_amount: "10",
    delivery_fee: "8.4",
    payment_confirmed: false,
    delivery_method: "delivery",
    observacoes: "=HYPERLINK(1)",
  },
  {
    id: "b",
    sale_date: "2026-09-01",
    created_at: "2026-09-01T12:05:00Z",
    sale_number: null,
    contact_id: "c1",
    customer_name: "Nome Antigo",
    value: 50,
    discount_amount: 0,
    delivery_fee: 0,
    payment_confirmed: true,
    delivery_method: "pickup",
  },
];
const contacts = { c1: { id: "c1", nome: "Contato Vivo", telefone: "11888887777" } };

const rows = buildSalesExportRows(sales, contacts, { includeTotalsRow: true });

test("linha guarda número e data crus", () => {
  const r = rows[0];
  assert.equal(r.value, 100.5);
  assert.equal(r.net_value, 98.9);
  assert.ok(r.sale_date instanceof Date);
  assert.equal(r.sale_date.getFullYear(), 2026);
  assert.equal(r.sale_date.getMonth(), 8);
  assert.equal(r.sale_date.getDate(), 5, "DATE puro não pode voltar um dia pelo fuso");
  assert.equal(r.sale_number, 42);
});

test("hora do lançamento em Brasília, não no fuso do aparelho", () => {
  const col = SALES_EXPORT_COLUMNS.find((c) => c.key === "hora");
  assert.equal(col.header, "Hora do lançamento");
  assert.equal(col.format(rows[0].hora), "23:30");
  assert.equal(col.format(rows[1].hora), "09:05");
});

test("nº, cliente e telefone da venda quando não há contato carregado", () => {
  assert.equal(rows[0].customer, "Cliente Ficticio");
  assert.equal(rows[0].phone, "11999990000");
  assert.equal(rows[1].customer, "Contato Vivo", "contato vivo ganha do snapshot");
  assert.equal(rows[1].sale_number, null);
});

test("status e fórmula anti-injeção", () => {
  assert.equal(rows[0].status, "A receber");
  assert.equal(rows[1].status, "Recebido");
  assert.ok(!String(rows[0].observacoes).startsWith("="));
});

test("linha de total soma o recebido", () => {
  const t = rows[rows.length - 1];
  assert.equal(t.customer, "TOTAL");
  assert.equal(t.net_value, 148.9);
  assert.equal(t.sale_date, null);
});

test("a consulta traz as colunas que o export usa", () => {
  for (const c of ["sale_number", "customer_name", "contact_phone", "created_at"]) {
    assert.ok(SALES_EXPORT_QUERY_COLUMNS.includes(c), c);
  }
});

test("o arquivo .xlsx tem célula de número, data e hora (lido de volta)", () => {
  const ws = buildExportWorksheet(XLSX, rows, SALES_EXPORT_COLUMNS);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const back = XLSX.read(buf, { type: "array", cellDates: true, cellNF: true });
  const sh = back.Sheets.Dados;
  const col = (key) => SALES_EXPORT_COLUMNS.findIndex((c) => c.key === key);
  const at = (r, key) => sh[XLSX.utils.encode_cell({ r, c: col(key) })];

  assert.equal(at(0, "hora").v, "Hora do lançamento");
  const money = at(1, "net_value");
  assert.equal(money.t, "n");
  assert.equal(money.v, 98.9);
  assert.equal(money.z, "#,##0.00");
  const date = at(1, "sale_date");
  assert.equal(date.t, "d");
  assert.equal(date.v.getUTCDate() === 5 || date.v.getDate() === 5, true);
  assert.equal(at(1, "sale_number").t, "n");
  assert.notEqual(at(1, "hora").t, "s", "hora é célula de hora, não texto");
  assert.equal(at(1, "phone").t, "s", "telefone segue texto (zero à esquerda)");
  // total: sem data, com soma numérica
  assert.equal(at(3, "sale_date"), undefined);
  assert.equal(at(3, "net_value").v, 148.9);
});

test("coluna sem type continua como texto do format (compatível)", () => {
  const ws = buildExportWorksheet(XLSX, [{ a: 1.5 }], [{ key: "a", header: "A", format: (v) => `x${v}` }]);
  assert.equal(ws.A2.v, "x1.5");
});

console.log(`\n${passed} testes ok`);
