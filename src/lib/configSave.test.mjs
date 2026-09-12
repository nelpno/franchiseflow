// Testes puros (node:assert, sem framework) — salvar Configurações sem desfazer o que outra pessoa gravou.
// Rodar: node src/lib/configSave.test.mjs
import assert from "node:assert";
import {
  sameValue, diffPatch, findConflicts, camposDoRascunhoADescartar, nomesDosCampos,
  incompleteFeeRows, validateDeliverySchedule, rotuloDias,
} from "./configSave.js";

// ── ordem das chaves do jsonb não conta; null e ausente são o mesmo; "" não ──
assert.ok(sameValue({ fee: "10", label: "x" }, { label: "x", fee: "10" }));
assert.ok(sameValue(null, undefined));
assert.ok(!sameValue("", null));

// ── só vai ao banco o que a tela mudou ──
const base = { a: 1, b: { x: 1 }, c: "t" };
assert.deepEqual(diffPatch(base, { a: 1, b: { x: 1 }, c: "novo" }), { c: "novo" });
assert.deepEqual(diffPatch(base, { ...base }), {});

// ── caso Guarujá 11/09: o suporte corrigiu o frete à tarde; a aba dela, aberta de manhã, salvou ──
const carregado = { promotions_combo: "A", delivery_schedule: [{ fee_rules: "velho" }] };
const noBanco = { promotions_combo: "A", delivery_schedule: [{ fee_rules: "corrigido pelo suporte" }] };
// ela só mexeu na promoção: o frete nem vai no patch, e não há conflito
const patchPromo = diffPatch(carregado, { ...carregado, promotions_combo: "B" });
assert.deepEqual(Object.keys(patchPromo), ["promotions_combo"]);
assert.deepEqual(findConflicts(carregado, noBanco, patchPromo), []);
// ela mexeu no frete também: conflito, não grava
const patchFrete = diffPatch(carregado, { ...carregado, delivery_schedule: [{ fee_rules: "dela" }] });
assert.deepEqual(findConflicts(carregado, noBanco, patchFrete), ["delivery_schedule"]);
// as duas chegaram ao mesmo valor: não é conflito
assert.deepEqual(findConflicts(carregado, noBanco, { delivery_schedule: noBanco.delivery_schedule }), []);

// ── depois do conflito, o rascunho perde o grupo inteiro do campo (a cópia legada junto) ──
assert.deepEqual(
  camposDoRascunhoADescartar(["delivery_schedule"]).sort(),
  ["charges_delivery_fee", "delivery_fee_rules", "delivery_schedule", "delivery_start_time",
    "opening_hours", "operating_hours", "order_cutoff_time", "working_days"]
);
assert.deepEqual(camposDoRascunhoADescartar(["promotions_combo"]), ["promotions_combo"]);
assert.equal(nomesDosCampos(["delivery_schedule", "delivery_fee_rules", "xyz"]), "horários e taxas de entrega, outros dados");

// ── linhas pela metade: JSON REAL do Guarujá salvo às 18:47 de 11/09 (fim de semana) ──
const fimDeSemana = { days: ["sab", "dom"], charges_fee: true, fee_rules: { mode: "modality", rules: [
  { fee: "15.00", label: "Entrega entre 10h e 13h (sem horário marcado, a rota passa dentro da janela)" },
  { fee: "20.00", label: "Bairro Acapulco (taxa fixa em qualquer janela de entrega)" },
  { fee: "", label: "Bairro Mare Mansa " },
  { fee: "", label: "Bairro Pedreira " },
] } };
assert.deepEqual(incompleteFeeRows(fimDeSemana.fee_rules), [{ index: 2, falta: "valor" }, { index: 3, falta: "valor" }]);
assert.deepEqual(validateDeliverySchedule([fimDeSemana]), ["Sáb e Dom, linha 3: falta o valor", "Sáb e Dom, linha 4: falta o valor"]);

// por distância: valor sem km também é metade; linha toda em branco não é erro
assert.deepEqual(incompleteFeeRows([{ max_km: "3", fee: "7.00" }, { max_km: "", fee: "9" }, { max_km: "", fee: "" }]), [{ index: 1, falta: "km" }]);
assert.deepEqual(incompleteFeeRows({ mode: "modality", rules: [{ label: "", fee: "12" }] }), [{ index: 0, falta: "descrição" }]);

// faixa que cobra taxa sem nenhum valor (o caso de seg–sáb vazio no Jd. Marajoara)
assert.deepEqual(
  validateDeliverySchedule([{ days: ["seg", "ter", "qua", "qui", "sex", "sab"], charges_fee: true, fee_rules: [{ max_km: "", fee: "" }] }]),
  ['Seg a Sáb: está marcado "Cobro taxa de entrega", mas não tem nenhum valor']
);
// entrega grátis na faixa: nada a validar; faixa completa: ok
assert.deepEqual(validateDeliverySchedule([{ days: ["dom"], charges_fee: false, fee_rules: [{ max_km: "", fee: "" }] }]), []);
assert.deepEqual(validateDeliverySchedule([{ days: ["seg"], charges_fee: true, fee_rules: [{ max_km: "5", fee: "8" }] }]), []);

assert.equal(rotuloDias(["seg", "ter", "qua", "qui", "sex", "sab", "dom"]), "Todos os dias");
assert.equal(rotuloDias(["dom", "sab"]), "Sáb e Dom");
assert.equal(rotuloDias(["seg", "qua", "sex"]), "Seg, Qua, Sex");

console.log("configSave: ok");
