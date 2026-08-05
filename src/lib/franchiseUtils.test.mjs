// Testes puros (node:assert, sem framework) — travam o isolamento entre franquias.
// Rodar: node src/lib/franchiseUtils.test.mjs
//
// Bug de origem (05/08/2026, Emerson — Araras + Limeira na mesma conta): telas que
// escolhiam "a primeira da lista" mostravam a unidade ERRADA enquanto o seletor do
// topo dizia outra. `resolveActiveFranchise` nunca pode adivinhar quando há 2+.
import assert from "node:assert";
import { resolveActiveFranchise, getAvailableFranchises } from "./franchiseUtils.js";

const ARARAS = {
  id: "a4eab8b8-f966-4b68-97c4-05915d4fcf28",
  evolution_instance_id: "franquiaararassp",
  city: "Araras - SP",
};
const LIMEIRA = {
  id: "8dc645be-1ca7-44d0-91ea-f61005d5547b",
  evolution_instance_id: "franquialimeirasp",
  city: "Limeira - SP",
};
const OUTRA = {
  id: "11111111-1111-1111-1111-111111111111",
  evolution_instance_id: "franquiaoutrasp",
  city: "Outra - SP",
};

// Ordem do banco (Limeira primeiro) — é justamente a que enganava as telas.
const TODAS = [LIMEIRA, ARARAS, OUTRA];

// Perfil real do Emerson: Limeira aparece 2x (UUID + evo_id), Araras só pelo evo_id.
const EMERSON = {
  role: "franchisee",
  managed_franchise_ids: [LIMEIRA.id, LIMEIRA.evolution_instance_id, ARARAS.evolution_instance_id],
};

// ── O caso do bug: seletor em Araras -> tem que devolver Araras, não a primeira ──
assert.equal(resolveActiveFranchise(TODAS, EMERSON, ARARAS)?.evolution_instance_id, "franquiaararassp");

// ── Trocou pra Limeira: acompanha ──
assert.equal(resolveActiveFranchise(TODAS, EMERSON, LIMEIRA)?.evolution_instance_id, "franquialimeirasp");

// ── Sem seleção e com 2+ franquias: NULL (aguardando), nunca "chuta" a primeira ──
assert.equal(resolveActiveFranchise(TODAS, EMERSON, null), null);

// ── Seleção inválida (franquia que ele não gerencia) não vaza ──
assert.equal(resolveActiveFranchise(TODAS, EMERSON, OUTRA), null);

// ── Uma franquia só (99% da rede): resolve sozinha, mesmo sem seleção ──
const SOLO = { role: "franchisee", managed_franchise_ids: [LIMEIRA.id, LIMEIRA.evolution_instance_id] };
assert.equal(resolveActiveFranchise(TODAS, SOLO, null)?.evolution_instance_id, "franquialimeirasp");

// ── Seleção guardada no localStorage traz objeto "velho": casa por id OU evo_id ──
assert.equal(
  resolveActiveFranchise(TODAS, EMERSON, { id: ARARAS.id })?.evolution_instance_id,
  "franquiaararassp"
);
assert.equal(
  resolveActiveFranchise(TODAS, EMERSON, { evolution_instance_id: ARARAS.evolution_instance_id })?.city,
  "Araras - SP"
);

// ── Objeto de seleção sem id nem evo_id não pode casar por `undefined === undefined` ──
assert.equal(resolveActiveFranchise(TODAS, EMERSON, { city: "Araras - SP" }), null);

// ── Sem vínculo nenhum ──
assert.equal(resolveActiveFranchise(TODAS, { role: "franchisee", managed_franchise_ids: [] }, ARARAS), null);

// ── Admin: enxerga todas; sem seleção continua null (as telas dele têm seletor próprio) ──
const ADMIN = { role: "admin", managed_franchise_ids: [] };
assert.equal(getAvailableFranchises(TODAS, ADMIN).length, 3);
assert.equal(resolveActiveFranchise(TODAS, ADMIN, LIMEIRA)?.city, "Limeira - SP");
assert.equal(resolveActiveFranchise(TODAS, ADMIN, null), null);

// ── Guardas de entrada ──
assert.equal(resolveActiveFranchise([], EMERSON, ARARAS), null);
assert.equal(resolveActiveFranchise(TODAS, null, ARARAS), null);
assert.equal(resolveActiveFranchise(null, EMERSON, ARARAS), null);

console.log("franchiseUtils: todos os testes passaram");
