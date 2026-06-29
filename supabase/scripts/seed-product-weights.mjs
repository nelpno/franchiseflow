// Seed/reseed de product_weights a partir do nome dos produtos do catálogo padrão.
// Uso: node supabase/scripts/seed-product-weights.mjs            (dry-run, só relatório)
//      node supabase/scripts/seed-product-weights.mjs --apply    (grava)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { parseWeightKg } from "../../src/lib/productWeight.js";

// .env do dashboard (VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
const env = Object.fromEntries(
  readFileSync(new URL("../../.env", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env"); process.exit(1); }

const apply = process.argv.includes("--apply");
const sb = createClient(url, key, { auth: { persistSession: false } });

// Catálogo padrão da rede (DISTINCT ON product_name, created_by_franchisee=false,
// active IS DISTINCT FROM false). Server-side → sem cap de 1000 linhas do PostgREST.
const { data: catalog, error } = await sb.rpc("get_standard_product_catalog");
if (error) { console.error("Erro lendo catálogo:", error.message); process.exit(1); }

const names = [...new Set((catalog || []).map((i) => i.product_name).filter(Boolean))];
const rows = [];
const missing = [];
for (const name of names) {
  const kg = parseWeightKg(name);
  if (kg == null) { missing.push(name); continue; }
  rows.push({ product_name: name, weight_kg: kg });
}

console.log(`Nomes distintos: ${names.length} | com peso: ${rows.length} | sem peso: ${missing.length}`);
if (missing.length) console.log("SEM PESO (revisar):", missing);

if (!apply) { console.log("\nDry-run. Rode com --apply pra gravar."); process.exit(0); }

// Preserva overrides manuais: só upsert onde ainda é is_auto=true OU não existe.
const { data: existing } = await sb.from("product_weights").select("product_name, is_auto");
const manual = new Set((existing || []).filter((r) => r.is_auto === false).map((r) => r.product_name));
const toUpsert = rows.filter((r) => !manual.has(r.product_name)).map((r) => ({ ...r, is_auto: true, updated_at: new Date().toISOString() }));

const { error: upErr } = await sb.from("product_weights").upsert(toUpsert, { onConflict: "product_name" });
if (upErr) { console.error("Erro no upsert:", upErr.message); process.exit(1); }
console.log(`Gravadas ${toUpsert.length} linhas (preservados ${manual.size} overrides manuais).`);
