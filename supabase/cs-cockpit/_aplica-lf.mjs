// Aplica um .sql no Supabase NORMALIZANDO CRLF -> LF.
//   node supabase/cs-cockpit/_aplica-lf.mjs <arquivo.sql>
//
// Por que existe: no Windows o git deixa o .sql com CRLF no working copy, e mandar o
// arquivo como esta faz o Postgres GUARDAR os \r dentro do prosrc. Medido em 08/09/2026:
// 246 CR entraram no corpo de get_franchise_health_signals, o que inchou a funcao em 246
// bytes e quebrou a verificacao de paridade (o _verifica-paridade-live.mjs normaliza o
// ARQUIVO, mas o banco ja estava sujo). Funciona, mas polui e impede provar paridade.
import fs from "node:fs";
const REF = "sulgicnqqopyhulglakd";
const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const src = process.argv[2];
const query = (src === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(src, "utf8")).replace(/\r\n/g, "\n");
const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${env.SUPABASE_MANAGEMENT_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const text = await res.text();
if (!res.ok) { console.error("HTTP", res.status, text.slice(0, 4000)); process.exit(1); }
console.log(text);
