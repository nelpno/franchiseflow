// Testes puros (node:assert, sem framework) — trava a leitura da regra de frete.
// Rodar: node src/lib/deliveryFeeRules.test.mjs
//
// TODOS os casos abaixo sao JSON REAL de `franchise_configurations.delivery_fee_rules`
// lido do banco em 07/09/2026 — inclusive o lixo (fee "" e label ""), que e o que
// derruba um parser escrito em cima de fixture inventada.
import assert from "node:assert";
import { parseDeliveryFeeOptions, autoDeliveryFee } from "./deliveryFeeRules.js";

// ── por distancia: faixas de km, ordem certa ──
assert.deepEqual(
  parseDeliveryFeeOptions([
    { fee: "7.00", max_km: "3" },
    { fee: "8.00", max_km: "5" },
    { fee: "12.00", max_km: "30" },
  ]),
  [
    { label: "até 3 km", fee: 7 },
    { label: "até 5 km", fee: 8 },
    { label: "até 30 km", fee: 12 },
  ]
);

// ── real: faixa de 3 km gravada por ULTIMO; tem de sair ordenada por km ──
assert.deepEqual(
  parseDeliveryFeeOptions([
    { fee: "5.00", max_km: "6" },
    { fee: "10.00", max_km: "10" },
    { fee: "12.00", max_km: "15" },
    { fee: "15.00", max_km: "20" },
    { fee: "20.00", max_km: "25" },
    { fee: "0.00", max_km: "3" },
    { fee: "8.00", max_km: "8" },
  ]).map((o) => o.label),
  ["até 3 km", "até 6 km", "até 8 km", "até 10 km", "até 15 km", "até 20 km", "até 25 km"]
);

// ── frete GRATIS ate 3 km e uma opcao valida, nao um vazio ──
assert.deepEqual(
  parseDeliveryFeeOptions([{ fee: "0", max_km: "2" }, { fee: "5", max_km: "5" }]),
  [{ label: "até 2 km", fee: 0 }, { label: "até 5 km", fee: 5 }]
);

// ── por modalidade: bairros nomeados ──
assert.deepEqual(
  parseDeliveryFeeOptions({
    mode: "modality",
    rules: [
      { fee: "15.00", label: "Ibitinga " },
      { fee: "0.00", label: " Itápolis: entrega grátis " },
      { fee: "15.00", label: "Tapinas" },
    ],
  }),
  [
    { label: "Ibitinga", fee: 15 },
    { label: "Itápolis: entrega grátis", fee: 0 },
    { label: "Tapinas", fee: 15 },
  ]
);

// ── LIXO REAL: faixa em branco que o wizard gravou -> sai da lista ──
assert.deepEqual(parseDeliveryFeeOptions([{ fee: "", max_km: "" }]), []);
assert.deepEqual(parseDeliveryFeeOptions([{ fee: "", max_km: "3" }]), []);
assert.deepEqual(
  parseDeliveryFeeOptions({ mode: "modality", rules: [{ fee: "", label: "" }] }),
  []
);

// ── entradas invalidas nao explodem ──
for (const entrada of [null, undefined, {}, [], "texto", 7, { mode: "modality" }]) {
  assert.deepEqual(parseDeliveryFeeOptions(entrada), [], `entrada ${JSON.stringify(entrada)}`);
}

// ── autoDeliveryFee: preenche sozinho SO quando nao ha escolha ──
assert.equal(autoDeliveryFee([{ fee: "10.00", max_km: "30" }]), 10);
assert.equal(
  autoDeliveryFee({ mode: "modality", rules: [{ fee: "10", label: "taxa de entrega " }] }),
  10
);
// duas ou mais faixas: NAO adivinha (a venda manual nao sabe a distancia)
assert.equal(autoDeliveryFee([{ fee: "7.00", max_km: "3" }, { fee: "8.00", max_km: "5" }]), null);
assert.equal(autoDeliveryFee([{ fee: "", max_km: "" }]), null);
assert.equal(autoDeliveryFee(null), null);

// ── frete unico e ZERO tambem preenche (0 e valor, nao ausencia) ──
assert.equal(autoDeliveryFee([{ fee: "0", max_km: "10" }]), 0);

// ── virgula decimal (a franqueada digita "7,50") ──
assert.deepEqual(parseDeliveryFeeOptions([{ fee: "7,50", max_km: "3" }]), [
  { label: "até 3 km", fee: 7.5 },
]);

// ── km fracionado no rotulo ──
assert.deepEqual(parseDeliveryFeeOptions([{ fee: "6.99", max_km: "2.5" }]), [
  { label: "até 2,5 km", fee: 6.99 },
]);

console.log("deliveryFeeRules: todas as verificações OK");
