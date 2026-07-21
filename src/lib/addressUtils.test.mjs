// Testes puros (node:assert, sem framework) — trava o formato do unit_address.
// Rodar: node src/lib/addressUtils.test.mjs
import assert from "node:assert";
import { assembleUnitAddress, foldStreetNumber, stripCityUf } from "./addressUtils.js";

// ── Caso fiscal-only: número separado, rua sem número -> anexa (bug Campo Limpo) ──
assert.equal(
  assembleUnitAddress({
    street: "Rua Hugo Sardella",
    number: "47",
    neighborhood: "Jardim Vera Regina",
    city: "Campo Limpo Paulista - SP",
    cep: "13236320",
  }),
  "Rua Hugo Sardella 47, Jardim Vera Regina, Campo Limpo Paulista - 13236320"
);

// ── Caso wizard: número já embutido na rua -> NÃO duplica ──
assert.equal(
  assembleUnitAddress({
    street: "Rua Wilson Muner 47",
    number: "47",
    neighborhood: "Jardim do Lago",
    city: "Bragança Paulista",
    cep: "12914550",
  }),
  "Rua Wilson Muner 47, Jardim do Lago, Bragança Paulista - 12914550"
);

// ── Wizard com vírgula antes do número (não duplica) ──
assert.equal(
  assembleUnitAddress({
    street: "Avenida Conselheiro Carrão, 3474",
    number: "3474",
    neighborhood: "Vila Carrão",
    city: "São Paulo",
    cep: "03402003",
  }),
  "Avenida Conselheiro Carrão, 3474, Vila Carrão, São Paulo - 03402003"
);

// ── Sem número: usa a rua como veio ──
assert.equal(
  assembleUnitAddress({
    street: "Rua Sem Numero",
    neighborhood: "Centro",
    city: "Itu - SP",
    cep: "13300000",
  }),
  "Rua Sem Numero, Centro, Itu - 13300000"
);

// ── Partes faltando não deixam vírgula/traço solto ──
assert.equal(assembleUnitAddress({ street: "Rua Só Rua", cep: "01000000" }), "Rua Só Rua - 01000000");
assert.equal(assembleUnitAddress({ street: "Rua X" }), "Rua X");
assert.equal(assembleUnitAddress({}), "");

// ── foldStreetNumber ──
assert.equal(foldStreetNumber("Rua A", "10"), "Rua A 10");
assert.equal(foldStreetNumber("Rua A 10", "10"), "Rua A 10");
assert.equal(foldStreetNumber("Rua A, 10", "10"), "Rua A, 10");
assert.equal(foldStreetNumber("Rua A", ""), "Rua A");
assert.equal(foldStreetNumber("", "10"), "10");

// ── stripCityUf ──
assert.equal(stripCityUf("São Paulo - SP"), "São Paulo");
assert.equal(stripCityUf("São Paulo"), "São Paulo");
assert.equal(stripCityUf("Rio de Janeiro - RJ"), "Rio de Janeiro");
assert.equal(stripCityUf("Itu - SP"), "Itu");

console.log("addressUtils: todos os testes passaram ✓");
