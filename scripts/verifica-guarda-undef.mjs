/**
 * Prova que a guarda de tela branca funciona de verdade.
 *
 * Nao basta rodar `lint:undef` e ver "0 erros": isso tanto pode significar
 * "o codigo esta limpo" quanto "a regra nao esta ligada". Este script cria um
 * arquivo-canario com os 3 defeitos que causam tela branca, roda a guarda em
 * cima dele e exige que ela ACUSE. Depois roda no `src/` real e exige silencio.
 *
 *   node scripts/verifica-guarda-undef.mjs
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";

const CANARIO_DIR = "src/__canario_guarda__";
const CANARIO = `${CANARIO_DIR}/canario.jsx`;

// chama o binario do eslint pelo Node, nao por `npx.cmd`: no Windows o spawn de
// um .cmd sem shell falha em silencio e o teste passaria a "reprovar" tudo.
const ESLINT_BIN = "node_modules/eslint/bin/eslint.js";
const run = (args) => {
  try {
    const out = execFileSync(process.execPath, [ESLINT_BIN, ...args], {
      encoding: "utf8",
      stdio: "pipe",
    });
    return { code: 0, out: out || "" };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ""}${e.stderr || ""}` };
  }
};

let falhou = false;
const ok = (msg) => console.log(`  ok   ${msg}`);
const erro = (msg) => { falhou = true; console.log(`  FALHA ${msg}`); };

// 1) o canario TEM de ser reprovado
mkdirSync(CANARIO_DIR, { recursive: true });
writeFileSync(
  CANARIO,
  `export default function Canario() {
  const x = simboloQueNinguemImportou(1);      // no-undef
  return <ComponenteFantasma valor={x} />;      // react/jsx-no-undef
}
export const outro = () => OutraCoisaSolta;     // no-undef
`
);

console.log("1. canario com 3 defeitos de tela branca");
const r1 = run(["-c", "eslint.strict.config.js", CANARIO]);
rmSync(CANARIO_DIR, { recursive: true, force: true });

if (r1.code === 0) {
  erro("a guarda NAO acusou o canario — as regras nao estao ativas");
} else {
  for (const esperado of ["simboloQueNinguemImportou", "ComponenteFantasma", "OutraCoisaSolta"]) {
    r1.out.includes(esperado) ? ok(`acusou ${esperado}`) : erro(`nao acusou ${esperado}`);
  }
}

// 2) o src/ real TEM de passar
console.log("2. src/ real");
const r2 = run(["-c", "eslint.strict.config.js", "src"]);
if (r2.code === 0) ok("nenhum simbolo solto em src/");
else erro(`src/ tem simbolo usado e nao importado:\n${r2.out}`);

console.log(falhou ? "\nGUARDA QUEBRADA" : "\nguarda verificada");
process.exit(falhou ? 1 : 0);
