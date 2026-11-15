/**
 * Copia o motor de frete do robô para o painel (plano de frete 12/09/2026, Fase 5b).
 *
 * A fonte única é bots/vendedor/scripts/assets/cota-frete.js, o mesmo código do nó "Cota Frete" do n8n.
 * O "Teste rápido" e a etapa "Como o robô vai responder" usam uma CÓPIA dele, gerada por este script,
 * com o sha256 da fonte no cabeçalho. O teste src/lib/cotaFrete.sync.test.mjs falha se a cópia
 * divergir da fonte: sem isso, o painel mostraria um frete e o robô cobraria outro.
 *
 *   node scripts/sync-cota-frete.mjs          regera src/lib/cotaFrete.gen.js
 *   node scripts/sync-cota-frete.mjs --check  só confere (exit 1 se divergir)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
export const FONTE = path.resolve(RAIZ, "../../bots/vendedor/scripts/assets/cota-frete.js");
export const COPIA = path.join(RAIZ, "src/lib/cotaFrete.gen.js");
const EXPORTS = ["cotarFrete", "cotaAcharZona", "cotaBase", "cotaDiaDaSemana", "cotaRotuloDias", "cotaResolverDia"];

export function hashDe(texto) {
  return crypto.createHash("sha256").update(texto.replace(/\r\n/g, "\n")).digest("hex");
}

export function gerar(fonte) {
  const corpo = fonte.replace(/\r\n/g, "\n");
  return [
    "// GERADO por scripts/sync-cota-frete.mjs — NÃO EDITAR. Fonte: bots/vendedor/scripts/assets/cota-frete.js",
    `// sha256 da fonte: ${hashDe(fonte)}`,
    "/* eslint-disable */",
    corpo.trimEnd(),
    "",
    `export { ${EXPORTS.join(", ")} };`,
    "",
  ].join("\n");
}

const DIRETO = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (DIRETO) {
  if (!fs.existsSync(FONTE)) {
    console.error(`fonte não encontrada: ${FONTE}`);
    process.exit(1);
  }
  const esperado = gerar(fs.readFileSync(FONTE, "utf8"));
  if (process.argv.includes("--check")) {
    const atual = fs.existsSync(COPIA) ? fs.readFileSync(COPIA, "utf8").replace(/\r\n/g, "\n") : "";
    if (atual !== esperado) {
      console.error("cotaFrete.gen.js DIVERGE da fonte do robô. Rode: node scripts/sync-cota-frete.mjs");
      process.exit(1);
    }
    console.log("cotaFrete.gen.js em dia com a fonte do robô.");
  } else {
    fs.writeFileSync(COPIA, esperado);
    console.log(`gerado ${path.relative(RAIZ, COPIA)} (sha256 ${hashDe(fs.readFileSync(FONTE, "utf8")).slice(0, 12)}…)`);
  }
}
