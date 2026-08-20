// node src/lib/documentUtils.test.mjs
import assert from "node:assert";
import { isValidCpfCnpj, cpfCnpjError } from "./documentUtils.js";

let pass = 0;
function check(label, fn) {
  fn();
  pass++;
  console.log(`  ok  ${label}`);
}

console.log("documentUtils");

// --- casos REAIS da base (19/08/2026) ---
check("CNPJ real da Giuliana (Nova Odessa/Americana) é válido", () => {
  assert.equal(isValidCpfCnpj("45259662000119"), true, "45.259.662/0001-19 deveria ser válido");
});
check("o typo que quebrou a Americana é recusado", () => {
  assert.equal(isValidCpfCnpj("42259662000119"), false, "42.259.662/0001-19 tem DV errado e deveria ser recusado");
});
check("CPF real da franqueada de Cotia é válido", () => {
  assert.equal(isValidCpfCnpj("11638574839"), true);
});
check("CPF real da franqueada de Cajamar é válido", () => {
  assert.equal(isValidCpfCnpj("27109189864"), true);
});

// --- formato ---
check("aceita documento formatado com pontuação", () => {
  assert.equal(isValidCpfCnpj("45.259.662/0001-19"), true);
  assert.equal(isValidCpfCnpj("116.385.748-39"), true);
});
check("recusa tamanho errado", () => {
  assert.equal(isValidCpfCnpj("4525966200011"), false, "13 dígitos");
  assert.equal(isValidCpfCnpj("452596620001199"), false, "15 dígitos");
  assert.equal(isValidCpfCnpj(""), false);
  assert.equal(isValidCpfCnpj(null), false);
});
check("recusa dígito repetido (11111111111 / 00000000000000)", () => {
  assert.equal(isValidCpfCnpj("11111111111"), false);
  assert.equal(isValidCpfCnpj("00000000000000"), false);
});

// --- controle negativo: um dígito trocado em CADA posição tem de reprovar ---
check("trocar 1 dígito de um CNPJ válido reprova em todas as posições", () => {
  const base = "45259662000119";
  let reprovados = 0;
  for (let i = 0; i < 12; i++) {
    for (let d = 0; d <= 9; d++) {
      const alterado = base.slice(0, i) + d + base.slice(i + 1);
      if (alterado === base) continue;
      if (!isValidCpfCnpj(alterado)) reprovados++;
    }
  }
  // com DV fixo, nenhuma alteração da base pode passar
  assert.equal(reprovados, 12 * 9, `esperava 108 reprovações, teve ${reprovados}`);
});

// --- mensagens ---
check("cpfCnpjError distingue vazio, incompleto e inválido", () => {
  assert.match(cpfCnpjError(""), /não preenchido/);
  assert.match(cpfCnpjError("452596620001"), /incompleto/);
  assert.match(cpfCnpjError("42259662000119"), /CNPJ inválido/);
  assert.match(cpfCnpjError("11638574838"), /CPF inválido/);
  assert.equal(cpfCnpjError("45259662000119"), null);
  assert.equal(cpfCnpjError("116.385.748-39"), null);
});

console.log(`\n${pass} verificações OK`);
