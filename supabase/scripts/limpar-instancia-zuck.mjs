/**
 * Apaga a instância de WhatsApp de uma franquia excluída, no ZuckZapGo.
 *
 *   node supabase/scripts/limpar-instancia-zuck.mjs franquiacataguasesmg           # confere só
 *   node supabase/scripts/limpar-instancia-zuck.mjs franquiacataguasesmg --apply   # apaga
 *
 * Por que não é o dashboard que faz: apagar instância exige o token de ADMIN do
 * ZuckZapGo, e esse token não pode ir para o browser. Então a exclusão de franquia
 * avisa na tela e a remoção da instância é este passo, à mão.
 *
 * Por que importa: `auto_generate_instance_id` deriva o `evolution_instance_id` da
 * CIDADE, então uma franquia nova na mesma cidade recebe o MESMO id — e herdaria esta
 * instância, com o número da franqueada anterior ainda pareado nela.
 *
 * Trava: recusa apagar instância que ainda está CONECTADA (seria derrubar um bot vivo)
 * e recusa um id que ainda exista em `franchises` (a franquia não foi excluída).
 */
import fs from "node:fs";

const ZUCK = "https://zuck.dynamicagents.tech";
const evo = process.argv[2];
const APLICAR = process.argv.includes("--apply");

if (!evo || evo.startsWith("--")) {
  console.error("uso: node supabase/scripts/limpar-instancia-zuck.mjs <evolution_instance_id> [--apply]");
  process.exit(2);
}

function lerEnv(caminho) {
  const env = {};
  for (const l of fs.readFileSync(caminho, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const cofre = lerEnv(`${process.env.USERPROFILE || process.env.HOME}/.secrets/zuckzapgo.env`);
const ADMIN = cofre.ZUCKZAPGO_ADMIN_TOKEN;
if (!ADMIN) throw new Error("ZUCKZAPGO_ADMIN_TOKEN vazio em ~/.secrets/zuckzapgo.env");

// --- a franquia realmente saiu do banco? -----------------------------------
const local = lerEnv(".env");
const resp = await fetch(
  `${local.VITE_SUPABASE_URL}/rest/v1/franchises?select=name&evolution_instance_id=eq.${encodeURIComponent(evo)}`,
  { headers: { apikey: local.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${local.SUPABASE_SERVICE_ROLE_KEY}` } }
);
const aindaExiste = await resp.json();
if (Array.isArray(aindaExiste) && aindaExiste.length > 0) {
  console.error(`ABORTADO: "${evo}" ainda existe em franchises (${aindaExiste[0].name}). Exclua a franquia primeiro.`);
  process.exit(1);
}

// --- acha a instância -------------------------------------------------------
const users = await (await fetch(`${ZUCK}/admin/users`, { headers: { Authorization: ADMIN } })).json();
const lista = Array.isArray(users?.data) ? users.data : Array.isArray(users) ? users : [];
const alvo = lista.find((u) => u.name === evo);

if (!alvo) {
  console.log(`Nada a fazer: não há instância chamada "${evo}" no ZuckZapGo.`);
  process.exit(0);
}

console.log(`instância: ${alvo.name} | id=${alvo.id} | jid=${alvo.jid || "(sem número)"} | connected=${alvo.connected} | loggedIn=${alvo.loggedIn}`);

if (alvo.connected || alvo.loggedIn) {
  console.error("ABORTADO: a instância está CONECTADA. Desconecte antes — apagar agora derruba um bot em uso.");
  process.exit(1);
}

if (!APLICAR) {
  console.log("\n(confere só) rode de novo com --apply para apagar.");
  process.exit(0);
}

const del = await fetch(`${ZUCK}/admin/users/${alvo.id}/full`, {
  method: "DELETE",
  headers: { Authorization: ADMIN },
});
const corpo = await del.text();
console.log(`DELETE /admin/users/${alvo.id}/full -> HTTP ${del.status} ${corpo.slice(0, 200)}`);

// Conferir por LEITURA, nunca pelo status do POST.
const depois = await (await fetch(`${ZUCK}/admin/users`, { headers: { Authorization: ADMIN } })).json();
const listaDepois = Array.isArray(depois?.data) ? depois.data : Array.isArray(depois) ? depois : [];
const sumiu = !listaDepois.some((u) => u.name === evo);
console.log(sumiu ? `OK — "${evo}" não está mais na lista (${listaDepois.length} instâncias).` : `ATENÇÃO: "${evo}" ainda aparece na lista.`);
process.exitCode = sumiu ? 0 : 1;
