/**
 * Lista os nomes de icone do Material Symbols que o app pode renderizar.
 *
 * Por que existe: a fonte deixou de vir inteira do Google (1,1 MB) e passou a ser um subset
 * self-hosted. Icone que nao entrar no subset NAO some — ele aparece como a PALAVRA
 * ("wb_sunny") no lugar do desenho, calado. Este script e a guarda contra isso.
 *
 *   node scripts/icones-usados.mjs           imprime a lista
 *   node scripts/icones-usados.mjs --check   falha (exit 1) se houver icone usado fora do subset
 *
 * Estrategia deliberadamente LARGA: alem dos usos diretos (icon="x", icon: "x"), entra
 * qualquer string literal do src que seja um nome valido do catalogo do Material Symbols.
 * Falso-positivo custa alguns bytes de glifo; falso-negativo custa um icone quebrado em
 * producao. Os 103 usos dinamicos (icon={cfg.icon}) so sao cobertos por essa rede larga.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = fileURLToPath(import.meta.url); // .pathname quebra em pasta com espaco (OneDrive)
const RAIZ = path.resolve(AQUI, "../..");
const CATALOGO = path.join(RAIZ, "scripts/material-symbols-catalogo.json"); // 6.104 nomes do catalogo oficial
const SUBSET = path.join(RAIZ, "src/assets/icones-do-app.txt");

function arquivos(dir, acc = [], padrao = /\.(jsx?|tsx?|html|css)$/) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) arquivos(p, acc, padrao);
    else if (padrao.test(e.name)) acc.push(p);
  }
  return acc;
}

export function icones() {
  const catalogo = new Set(JSON.parse(fs.readFileSync(CATALOGO, "utf8")));
  const usados = new Set();
  const fontes = [...arquivos(path.join(RAIZ, "src")), path.join(RAIZ, "index.html")];
  for (const f of fontes) {
    const txt = fs.readFileSync(f, "utf8");
    // rede larga: toda string literal que e um nome de icone valido. Funciona no JSX porque
    // string solta ali quase sempre E um icone; o custo sao raros falsos positivos, que se
    // resolvem reescrevendo o texto (ja aconteceu com uma crase em comentario).
    for (const m of txt.matchAll(/["'`]([a-z][a-z0-9_]{1,40})["'`]/g)) {
      if (catalogo.has(m[1])) usados.add(m[1]);
    }
  }

  // Os .sql tambem gravam nome de icone: a `sentinela_diaria` chama
  // `notify_admins(titulo, mensagem, tipo, ICONE, link)` e o valor vai para
  // notifications.icon, que o NotificationBell renderiza. Varrendo so `src/`, esse nome nunca
  // era visto — em 08/09/2026 a sentinela mandou `health_and_safety`, fora do subset, e o
  // sino mostrou a PALAVRA "HEALTH_AND_SAFETY" com a guarda verde.
  //
  // Aqui a rede LARGA nao serve: em SQL, `key`, `mode`, `public`, `source` e `segment` sao
  // palavras comuns que por acaso sao nomes de icone validos — deram 7 falsos positivos.
  // Entao olhamos so DENTRO das chamadas a notify_admins, e sem os comentarios (a propria
  // mencao a um icone num comentario `--` seria falso positivo).
  for (const f of arquivos(path.join(RAIZ, "supabase"), [], /\.sql$/)) {
    const txt = fs.readFileSync(f, "utf8").replace(/^\s*--[^\n]*$/gm, "");
    for (const chamada of txt.matchAll(/notify_admins\s*\(([\s\S]{0,600}?)\)\s*;/g)) {
      for (const m of chamada[1].matchAll(/'([a-z][a-z0-9_]{1,40})'/g)) {
        if (catalogo.has(m[1])) usados.add(m[1]);
      }
    }
  }
  return [...usados].sort();
}

const subsetAtual = () =>
  fs.existsSync(SUBSET)
    ? fs.readFileSync(SUBSET, "utf8").split(/\s+/).filter(Boolean)
    : [];

const executadoDireto = process.argv[1] && path.resolve(process.argv[1]) === AQUI;

if (!executadoDireto) {
  // importado por outro script (baixa-icon-font.mjs): so exporta, nao imprime nada
} else if (process.argv.includes("--check")) {
  const lista = icones();
  const tem = new Set(subsetAtual());
  const faltando = lista.filter((i) => !tem.has(i));
  if (!tem.size) {
    console.error("subset nao encontrado em src/assets/icones-do-app.txt");
    process.exit(1);
  }
  if (faltando.length) {
    console.error(
      `${faltando.length} icone(s) usados no codigo estao FORA do subset da fonte —\n` +
        `eles vao aparecer como a palavra no lugar do desenho:\n  ${faltando.join(", ")}\n\n` +
        `Conserto: rode 'node scripts/baixa-icon-font.mjs' para regerar a fonte e a lista.`
    );
    process.exit(1);
  }
  console.log(`ok — ${lista.length} icones usados, todos presentes no subset (${tem.size} no total)`);
} else {
  console.log(icones().join("\n"));
}
