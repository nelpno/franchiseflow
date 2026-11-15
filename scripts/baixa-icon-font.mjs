/**
 * Gera o subset self-hosted do Material Symbols Outlined.
 *
 * Antes: index.html puxava a familia INTEIRA do Google (6.104 icones) — 1.128.840 bytes de
 * woff2 em todo boot, para 215 nomes que o app pode usar. E vinha com display=swap, entao
 * ate a fonte chegar cada icone aparecia como a PALAVRA ("wb_sunny").
 *
 * Agora: pedimos ao Google so os icones da lista (scripts/icones-usados.mjs), salvamos o
 * woff2 em src/assets/ (o Vite carimba hash e o nginx serve como imutavel por 1 ano) e
 * declaramos o @font-face no index.css com font-display: block — sem palavra piscando.
 *
 *   node scripts/baixa-icon-font.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { icones } from "./icones-usados.mjs";

const RAIZ = path.resolve(fileURLToPath(import.meta.url), "../..");
const DESTINO_FONTE = path.join(RAIZ, "src/assets/material-symbols-subset.woff2");
const DESTINO_LISTA = path.join(RAIZ, "src/assets/icones-do-app.txt");

const lista = icones();
const url =
  // SO o eixo FILL fica variavel. O app usa 'wght' 400, 'GRAD' 0 e 'opsz' 24 fixos
  // (MaterialIcon.jsx e index.css), e manter os 4 eixos custa 227.676 bytes contra 28.424.
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:FILL@0..1" +
  `&icon_names=${lista.join(",")}&display=block`;

// UA de Chrome moderno: sem isso o Google devolve ttf em vez de woff2
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const css = await (await fetch(url, { headers: { "User-Agent": UA } })).text();
// a URL do subset NAO termina em .woff2 (e /l/font?kit=...): casar pelo format('woff2')
const m = css.match(/url\((https:\/\/[^)]+)\)\s*format\(['"]woff2['"]\)/);
if (!m) {
  console.error("nao achei woff2 no CSS devolvido:\n", css.slice(0, 800));
  process.exit(1);
}
const woff2 = Buffer.from(await (await fetch(m[1])).arrayBuffer());
fs.writeFileSync(DESTINO_FONTE, woff2);
fs.writeFileSync(DESTINO_LISTA, lista.join("\n") + "\n");

console.log(`icones no subset : ${lista.length}`);
console.log(`woff2            : ${woff2.length.toLocaleString("pt-BR")} bytes -> src/assets/material-symbols-subset.woff2`);
console.log(`unicode-range/CSS: ${m[1]}`);
