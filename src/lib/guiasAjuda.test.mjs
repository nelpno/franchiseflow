// Travas dos textos da Ajuda e do "?" — node src/lib/guiasAjuda.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GUIAS, VIDEOS, guiasParaPapel, acharGuia, linkDoGuia, textoWhatsApp, linkWhatsAppDoGuia, ehEquipe,
} from "./guiasAjuda.js";
import { HELP_TIPS } from "./helpTips.js";

let n = 0;
const t = (nome, fn) => { fn(); n++; };

// Todo texto que chega à pessoa: título, resumo, passos, nota, mensagem do WhatsApp e "?".
const textos = [];
for (const g of GUIAS) {
  textos.push([g.slug, g.titulo], [g.slug, g.resumo], [g.slug, g.whatsapp]);
  if (g.nota) textos.push([g.slug, g.nota]);
  for (const p of g.passos) {
    textos.push([g.slug, p.titulo], [g.slug, p.texto]);
    if (p.botao) textos.push([g.slug, p.botao]);
  }
}
for (const [k, h] of Object.entries(HELP_TIPS)) textos.push([`?${k}`, h.titulo], [`?${k}`, h.texto], [`?${k}`, h.exemplo]);

// Regras de linguagem do CLAUDE.md: "sem fundo de marketing" (nunca "taxa de marketing"), "markup" (nunca
// "margem"), "Estoque" (nunca "Inventário"), "Valor Médio" (nunca "Ticket Médio"), nunca "Líquido",
// nunca prometer "amanhã", e a franquia é ponto de retirada, nunca fábrica/cozinha/loja.
const PROIBIDAS = [
  [/taxa de marketing/i, "taxa de marketing"],
  [/\bmargem\b/i, "margem"],
  [/invent[aá]rio/i, "Inventário"],
  [/ticket m[eé]dio/i, "Ticket Médio"],
  [/l[ií]quido/i, "Líquido"],
  [/amanh[aã]/i, "amanhã"],
  [/(sua|na sua|da sua|nossa) (f[aá]brica|cozinha)|f[aá]brica da unidade|cozinha da unidade/i, "franquia como fábrica/cozinha"],
  [/\bsua loja\b|\bna loja\b|\bloja da unidade\b/i, "loja (só unidade com ponto comercial)"],
  [/\b(reservar|reserva|separar|guardar)\b/i, "reserva/separar (sem reserva sem pagamento)"],
];

t("nenhum texto usa palavra proibida", () => {
  for (const [onde, txt] of textos) {
    for (const [re, nome] of PROIBIDAS) {
      assert.ok(!re.test(txt), `${onde}: "${nome}" em "${txt}"`);
    }
  }
});

t("'fundo de marketing' só aparece negado ('sem fundo de marketing')", () => {
  for (const [onde, txt] of textos) {
    const achados = txt.match(/.{0,4}fundo de marketing/gi) || [];
    for (const a of achados) assert.match(a, /sem fundo de marketing/i, `${onde}: "${a}"`);
  }
});

t("'fábrica' só como a fábrica da Maxi (pedido à fábrica)", () => {
  for (const [onde, txt] of textos) {
    const achados = txt.match(/.{0,12}f[aá]brica/gi) || [];
    for (const a of achados) assert.match(a, /(pedido|pedidos) à f[aá]brica|à f[aá]brica/i, `${onde}: "${a}"`);
  }
});

t("canário: a trava pega o que deve pegar", () => {
  const achou = (s) => PROIBIDAS.some(([re]) => re.test(s));
  assert.ok(achou("A entrega sai amanhã"));
  assert.ok(achou("Veja o Inventário"));
  assert.ok(achou("margem de 50%"));
  assert.ok(achou("Sua fábrica produz"));
  assert.ok(!achou("markup recomendado de 100%"));
  assert.ok(!achou("Fazer pedido à fábrica"));
});

t("slugs únicos, passos numerados e mensagem de WhatsApp em todo guia", () => {
  const slugs = GUIAS.flatMap((g) => [g.slug, ...(g.aliases || [])]);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const g of GUIAS) {
    assert.ok(g.passos.length >= 3, g.slug);
    assert.ok(g.whatsapp && g.whatsapp.length <= 200, `${g.slug}: mensagem curta`);
    assert.ok(["franqueado", "equipe"].includes(g.publico), g.slug);
    for (const p of g.passos) assert.ok(p.titulo && p.texto, g.slug);
  }
});

t("deep-links antigos continuam abrindo (primeiros-passos, clientes, estoque)", () => {
  assert.equal(acharGuia("primeiros-passos", "franchisee")?.slug, "primeiros-passos");
  assert.equal(acharGuia("clientes", "franchisee")?.slug, "clientes");
  assert.equal(acharGuia("estoque", "franchisee")?.slug, "pedido-fabrica");
  assert.equal(acharGuia("nao-existe", "admin"), null);
  assert.equal(acharGuia(null, "admin"), null);
});

t("franqueado não vê guia da equipe; equipe vê os dois", () => {
  const f = guiasParaPapel("franchisee");
  assert.ok(f.every((g) => g.publico === "franqueado"));
  assert.equal(acharGuia("ronda-manha", "franchisee"), null);
  for (const r of ["admin", "manager", "customer_success"]) {
    assert.ok(ehEquipe(r));
    assert.equal(guiasParaPapel(r).length, GUIAS.length);
    assert.ok(acharGuia("ronda-manha", r));
  }
  assert.ok(!ehEquipe("franchisee"));
  assert.ok(!ehEquipe(undefined));
});

t("link do WhatsApp: sem número, texto + link do guia", () => {
  const g = acharGuia("vendas", "franchisee");
  assert.equal(linkDoGuia("vendas"), "https://app.maximassas.tech/Tutoriais?abrir=vendas");
  assert.ok(textoWhatsApp(g).endsWith("https://app.maximassas.tech/Tutoriais?abrir=vendas"));
  const url = linkWhatsAppDoGuia(g);
  assert.ok(url.startsWith("https://wa.me/?text="), url);
  assert.equal(decodeURIComponent(url.slice("https://wa.me/?text=".length)), textoWhatsApp(g));
});

t("imagens só das que existem em /public/tutoriais", () => {
  const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");
  for (const g of GUIAS) for (const p of g.passos) {
    if (p.imagem) assert.ok(fs.existsSync(path.join(pub, p.imagem)), `${g.slug}: ${p.imagem}`);
  }
});

t("vídeos têm id do YouTube", () => {
  for (const v of VIDEOS) assert.match(v.youtubeId, /^[\w-]{11}$/);
});

t("HelpTip: 5 campos, com texto e exemplo", () => {
  assert.deepEqual(Object.keys(HELP_TIPS).sort(), ["formaPagamento", "horarioCorte", "pedidoMinimo", "taxaEntrega", "verbaMarketing"]);
  for (const h of Object.values(HELP_TIPS)) assert.ok(h.titulo && h.texto && h.exemplo);
  assert.match(HELP_TIPS.verbaMarketing.texto, /R\$ 200/);
  assert.match(HELP_TIPS.verbaMarketing.texto, /14%/);
  assert.match(HELP_TIPS.verbaMarketing.exemplo, /R\$ 172/);
});

console.log(`guiasAjuda: ${n} testes ok`);
