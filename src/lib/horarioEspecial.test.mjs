// node src/lib/horarioEspecial.test.mjs
import assert from "node:assert/strict";
import { hojeBRT, normalizarHorarioEspecial, problemasHorarioEspecial, normalizarInstagram, instagramValido, novoItem, vencido } from "./horarioEspecial.js";

const H = "2026-11-06";
let n = 0; const t = (nome, f) => { f(); n++; };

t("hojeBRT: 23h30 em SP ainda é o mesmo dia (UTC já virou)", () => {
  assert.equal(hojeBRT(new Date("2026-11-07T02:30:00Z")), "2026-11-06");
  assert.equal(hojeBRT(new Date("2026-11-07T03:30:00Z")), "2026-11-07");
});

t("normalizar: tira vencido, completa até/vale, limpa abre/fecha do fechado, ordena; idempotente", () => {
  const lista = [
    { de: "2026-11-20", tipo: "fechado", abre: "09:00", fecha: "10:00" },
    { de: "2026-11-01", ate: "2026-11-05", tipo: "fechado", vale: "ambos" },
    { de: "2026-11-06", ate: "2026-11-09", tipo: "horario", abre: "09:00", fecha: "15:00", vale: "retirada" },
    { de: "", tipo: "fechado" }, null,
  ];
  const a = normalizarHorarioEspecial(lista, H);
  assert.deepEqual(a, [
    { de: "2026-11-06", ate: "2026-11-06", tipo: "horario", vale: "retirada", abre: "09:00", fecha: "15:00" },
    { de: "2026-11-20", ate: "2026-11-20", tipo: "fechado", vale: "ambos" },
  ]);
  assert.deepEqual(normalizarHorarioEspecial(a, H), a);
  // só uma modalidade: o item da que existe vira "ambos"; o da que foi desligada sai (não fecha a outra)
  assert.equal(normalizarHorarioEspecial([{ de: H, tipo: "fechado", vale: "entrega" }], H, { hasDelivery: true, hasPickup: false })[0].vale, "ambos");
  assert.deepEqual(normalizarHorarioEspecial([{ de: H, tipo: "fechado", vale: "retirada" }], H, { hasDelivery: true, hasPickup: false }), []);
  assert.deepEqual(normalizarHorarioEspecial([{ de: H, tipo: "fechado", vale: "entrega" }], H, { hasDelivery: false, hasPickup: true }), []);
  assert.deepEqual(normalizarHorarioEspecial(undefined, H), []);
});

t("problemas: data, ordem, período, horas, mesmo dia", () => {
  assert.match(problemasHorarioEspecial([novoItem()], H)[0], /escolha a data/, "item novo sem data barra o salvar");
  assert.deepEqual(normalizarHorarioEspecial([novoItem()], H), [], "e nunca vai ao banco");
  assert.deepEqual(problemasHorarioEspecial([{ de: H, ate: H, tipo: "fechado", vale: "ambos" }], H), []);
  assert.match(problemasHorarioEspecial([{ de: "2026-11-10", ate: "2026-11-08", tipo: "fechado" }], H)[0], /data final vem antes/);
  assert.match(problemasHorarioEspecial([{ de: "2026-11-10", ate: "2027-02-10", tipo: "fechado" }], H)[0], /até 62 dias/);
  assert.match(problemasHorarioEspecial([{ de: H, tipo: "horario", abre: "15:00", fecha: "09:00" }], H)[0], /depois da de abrir/);
  assert.match(problemasHorarioEspecial([{ de: H, tipo: "horario", abre: "", fecha: "" }], H)[0], /preencha a hora/);
  assert.match(problemasHorarioEspecial([{ de: "", tipo: "fechado" }], H)[0], /escolha a data/);
  assert.match(problemasHorarioEspecial([{ de: "2026-11-10", ate: "2026-11-12", tipo: "fechado" }, { de: "2026-11-12", tipo: "horario", abre: "09:00", fecha: "12:00" }], H)[0], /mesmo dia \(12\/11\)/);
  // entrega num, retirada no outro, mesmo dia: pode
  assert.deepEqual(problemasHorarioEspecial([{ de: H, tipo: "fechado", vale: "entrega" }, { de: H, tipo: "horario", abre: "09:00", fecha: "12:00", vale: "retirada" }], H), []);
  // vencido não barra
  assert.deepEqual(problemasHorarioEspecial([{ de: "2026-11-01", ate: "2026-10-01", tipo: "fechado" }], H), []);
  assert.equal(vencido({ de: "2026-11-05" }, H), true);
  assert.equal(vencido({ de: "2026-11-05", ate: H }, H), false);
});

t("instagram: só o usuário", () => {
  for (const v of ["maximassas.jdsantamaria", "@maximassas.jdsantamaria", "https://www.instagram.com/MaxiMassas.JdSantaMaria/?igsh=abc", "instagram.com/maximassas.jdsantamaria"]) {
    assert.equal(normalizarInstagram(v), "maximassas.jdsantamaria", v);
    assert.ok(instagramValido(v));
  }
  assert.equal(normalizarInstagram("https://m.instagram.com/maximassas.itu"), "maximassas.itu");
  assert.equal(normalizarInstagram("instagr.am/maximassas.itu"), "maximassas.itu");
  assert.equal(instagramValido("m.instagram.com"), false);
  assert.equal(normalizarInstagram(""), "");
  assert.equal(instagramValido(""), false);
  assert.equal(instagramValido("nome com espaço"), false);
  assert.equal(instagramValido("a".repeat(31)), false);
});

console.log(`horarioEspecial: ${n} testes ok`);

// pela regra da tela (barra só o que esta tela mexeu)
const { validarEtapa } = await import("./vendedorValidation.js");
const ruim = { has_delivery: true, has_pickup: true, horario_especial: [{ de: "2099-01-10", tipo: "horario", abre: "15:00", fecha: "09:00" }], social_media_links: { instagram: "nome com espaço" } };
assert.match(validarEtapa(2, ruim, ["horario_especial"]).erros.join(" "), /depois da de abrir/);
assert.equal(validarEtapa(2, ruim, []).erros.some((e) => /Horário especial/.test(e)), false, "não mexeu: só aviso");
assert.match(validarEtapa(1, ruim, ["social_media_links"]).erros.join(" "), /Instagram da loja/);
assert.equal(validarEtapa(1, { ...ruim, social_media_links: { instagram: "@maximassas.itu" } }, ["social_media_links"]).erros.some((e) => /Instagram/.test(e)), false);
console.log("horarioEspecial: validação da tela ok");
