// A cópia do motor de frete no painel tem de ser igual à fonte do robô.
// Sem a pasta do robô ao lado (build no VPS, que só tem este repositório), o teste é pulado.
import assert from "node:assert/strict";
import fs from "node:fs";
import { FONTE, COPIA, gerar } from "../../scripts/sync-cota-frete.mjs";
import { cotarFrete } from "./cotaFrete.gen.js";

if (fs.existsSync(FONTE)) {
  const esperado = gerar(fs.readFileSync(FONTE, "utf8"));
  const atual = fs.readFileSync(COPIA, "utf8").replace(/\r\n/g, "\n");
  assert.equal(atual, esperado, "cotaFrete.gen.js diverge da fonte do robô: rode node scripts/sync-cota-frete.mjs");
} else {
  console.log("cotaFrete.sync: fonte do robô fora do alcance, conferência pulada");
}

// a cópia carrega como módulo e calcula
const pricing = { versao: 1, raio_km: 10, grupos: [{ dias: ["seg"], tipos: [{ nome: "Entrega", inicio: "10:00", fim: "18:00", promessa: "janela", taxa: { modo: "fixa", valor: 8 } }] }] };
const r = cotarFrete(pricing, { bairro_cliente: "Centro", km: 3 }, { data: "2026-09-14", hora: "09:00" }, {});
assert.equal(r.estado, "ok");
assert.equal(r.grupos[0].opcoes[0].taxa, 8);

console.log("cotaFrete.sync: ok");
