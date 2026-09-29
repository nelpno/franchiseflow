// Travas dos textos da Ajuda e do "?" — node src/lib/guiasAjuda.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GUIAS, VIDEOS, guiasParaPapel, acharGuia, linkDoGuia, textoWhatsApp, linkWhatsAppDoGuia, ehEquipe,
  buscarGuias, guiasPorArea, COMECE_POR_AQUI, guiasComecePorAqui, PERGUNTAS_FREQUENTES, registrarAjudaResolveu,
} from "./guiasAjuda.js";
import { HELP_TIPS } from "./helpTips.js";

let n = 0;
const t = (nome, fn) => { fn(); n++; };

// Todo texto que chega à pessoa: título, resumo, passos, nota, dica, erro comum, sinônimos,
// rótulo do link do Drive, mensagem do WhatsApp e "?".
const textos = [];
for (const g of GUIAS) {
  textos.push([g.slug, g.titulo], [g.slug, g.resumo], [g.slug, g.whatsapp], [g.slug, g.dica], [g.slug, g.erroComum]);
  if (g.nota) textos.push([g.slug, g.nota]);
  if (g.drive) textos.push([g.slug, g.drive.rotulo]);
  for (const s of g.sinonimos || []) textos.push([g.slug, s]);
  for (const p of g.passos) {
    textos.push([g.slug, p.titulo], [g.slug, p.texto]);
    if (p.botao) textos.push([g.slug, p.botao]);
  }
}
for (const [k, h] of Object.entries(HELP_TIPS)) textos.push([`?${k}`, h.titulo], [`?${k}`, h.texto], [`?${k}`, h.exemplo]);
// Tela Ajuda v2 (S10.1): as perguntas frequentes também passam pela trava de linguagem.
for (const f of PERGUNTAS_FREQUENTES) textos.push(["faq", f.pergunta], ["faq", f.resposta]);

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

// Campos v2 (S3, 28/09/2026): a tela nova (S10) usa area/sinonimos/dica/erroComum para
// busca e para os blocos "Dica"/"Erro comum" do guia. `drive` é o único opcional.
t("todo guia tem area, sinônimos, dica e erro comum (campos v2)", () => {
  const AREAS_VALIDAS = ["Começar", "Vender", "Clientes", "Estoque e pedido à fábrica", "Dinheiro", "Marketing", "Meu robô", "Ajuda", "Equipe"];
  for (const g of GUIAS) {
    assert.ok(AREAS_VALIDAS.includes(g.area), `${g.slug}: area "${g.area}" não está na lista`);
    assert.ok(Array.isArray(g.sinonimos) && g.sinonimos.length >= 2, `${g.slug}: sinonimos`);
    for (const s of g.sinonimos) assert.ok(s && s.length <= 40, `${g.slug}: sinônimo longo demais "${s}"`);
    assert.ok(g.dica && g.dica.length <= 240, `${g.slug}: dica`);
    assert.ok(g.erroComum && g.erroComum.length <= 320, `${g.slug}: erroComum`);
    if (g.drive) assert.ok(g.drive.href?.startsWith("https://") && g.drive.rotulo, `${g.slug}: drive`);
  }
});

// S24.1 (29/09/2026): o alias "estoque" passou a abrir "Contar o estoque" (a aba se chama
// Estoque); os links antigos da mensalidade continuam no guia de pagamentos.
t("deep-links antigos continuam abrindo (primeiros-passos, clientes, estoque, mensalidade)", () => {
  assert.equal(acharGuia("pedido-fabrica", "franchisee")?.slug, "pedido-fabrica");
  assert.equal(acharGuia("mensalidade", "franchisee")?.slug, "pagamentos");
  assert.equal(acharGuia("pagar-equipe-digital", "franchisee")?.slug, "pagamentos");
  assert.equal(acharGuia("primeiros-passos", "franchisee")?.slug, "primeiros-passos");
  assert.equal(acharGuia("clientes", "franchisee")?.slug, "clientes");
  assert.equal(acharGuia("estoque", "franchisee")?.slug, "contar-estoque");
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

// Controle positivo (S21.1, 28/09/2026): prova que a checagem acima REALMENTE falha
// quando o arquivo não existe — sem isso, um `imagem` com nome errado passaria calado.
t("controle positivo: nome de arquivo inexistente FALHA na checagem de imagem", () => {
  const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");
  const inventado = "/tutoriais/isso-nao-existe-de-verdade-123.webp";
  assert.ok(!fs.existsSync(path.join(pub, inventado)), "o arquivo canário não deveria existir");
  assert.throws(() => assert.ok(fs.existsSync(path.join(pub, inventado)), "canário"), assert.AssertionError);
});

// Toda imagem citada nos guias precisa também estar visivelmente ligada a um guia da
// PRIORIDADE da S21.1 (Vendas, pedido à fábrica, Pagamentos, Resultado) — sem isso,
// a foto pode ter sido gerada mas esquecida sem `imagem` em nenhum passo.
t("guias prioritários da S21.1 têm pelo menos 1 imagem cada", () => {
  for (const slug of ["vendas", "pedido-fabrica", "pagamentos", "resultado"]) {
    const g = acharGuia(slug, "franchisee");
    assert.ok(g, slug);
    assert.ok(g.passos.some((p) => p.imagem), `${slug}: nenhum passo com imagem`);
  }
});

// S24.1 (29/09/2026): o documento docs/guias-ajuda-v2.md e o app andam juntos. Todo slug do
// índice do documento existe no app com a mesma quantidade de passos (a foto <slug>-<n>.webp
// é o passo n do documento), e o texto dos guias não tem mais marca de revisão pendente.
const DOC = fs
  .readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docs/guias-ajuda-v2.md"), "utf8")
  .replace(/\r\n/g, "\n");

function guiasDoDocumento(doc) {
  const indice = doc.slice(doc.indexOf("## Índice"), doc.indexOf("# COMEÇAR"));
  const slugs = [...indice.matchAll(/^\d+\. .+? — `([a-z0-9-]+)`/gm)].map((m) => m[1]);
  const corpo = doc.slice(doc.indexOf("# COMEÇAR"), doc.indexOf("# (1)"));
  const passos = {};
  for (const sec of corpo.split(/^## \d+\. /m).slice(1)) {
    const slug = (sec.match(/slug: ([a-z0-9-]+)/) || [])[1];
    if (slug) passos[slug] = (sec.match(/^\d+\. /gm) || []).length;
  }
  return { slugs, passos, corpo };
}

// Guias com fotos de numeração própria (anteriores ao documento): o app tem mais passos que o texto.
const NUMERACAO_PROPRIA = new Set(["primeiros-passos", "clientes"]);

t("documento × app: os 34 guias do índice existem no app, com o mesmo número de passos", () => {
  const { slugs, passos } = guiasDoDocumento(DOC);
  assert.equal(slugs.length, 34, "o índice do documento tem 34 guias");
  for (const slug of slugs) {
    const g = acharGuia(slug, "franchisee");
    assert.ok(g && g.slug === slug, `${slug}: não está no app com esse slug`);
    if (!NUMERACAO_PROPRIA.has(slug)) {
      assert.equal(g.passos.length, passos[slug], `${slug}: app ${g.passos.length} passos × documento ${passos[slug]}`);
    }
  }
});

t("documento: nenhum guia com marca de revisão pendente", () => {
  const { corpo } = guiasDoDocumento(DOC);
  for (const marca of ["[tela nova]", "[conferir", "[decisão Nelson"]) assert.ok(!corpo.includes(marca), marca);
});

// Controle positivo das duas travas acima: documento adulterado tem de ser pego.
t("controle positivo: guia a mais, marca pendente ou passo a menos no documento são pegos", () => {
  const ultimo = "33. Ver as vendas por produto — `vendas-por-produto`";
  assert.ok(DOC.includes(ultimo), "âncora do índice");
  const comGuiaFalso = guiasDoDocumento(DOC.replace(ultimo, `${ultimo}\n32. Guia inventado — \`guia-inventado\``));
  assert.equal(comGuiaFalso.slugs.length, 35);
  assert.equal(acharGuia("guia-inventado", "franchisee"), null);
  const comMarca = guiasDoDocumento(DOC.replace("## 11. Contar o estoque", "## 11. Contar o estoque [tela nova]"));
  assert.ok(comMarca.corpo.includes("[tela nova]"));
  const passoFinal = "5. Confira a lista: os números devem bater com o freezer.";
  assert.ok(DOC.includes(passoFinal), "âncora do passo");
  const menosUm = guiasDoDocumento(DOC.replace(passoFinal, "Confira a lista."));
  assert.notEqual(menosUm.passos["contar-estoque"], acharGuia("contar-estoque", "franchisee").passos.length);
});

t("vídeos têm id do YouTube", () => {
  for (const v of VIDEOS) assert.match(v.youtubeId, /^[\w-]{11}$/);
});

// Tela Ajuda v2 (S10.1, 28/09/2026): busca, "Comece por aqui", por área e FAQ.
t("buscarGuias: acha por título, sinônimo e área; ignora acento e maiúscula", () => {
  assert.ok(buscarGuias("franchisee", "venda").some((g) => g.slug === "vendas"));
  assert.ok(buscarGuias("franchisee", "VENDA").some((g) => g.slug === "vendas")); // maiúscula
  assert.ok(buscarGuias("franchisee", "nova venda").some((g) => g.slug === "vendas")); // sinônimo
  assert.ok(buscarGuias("franchisee", "dinheiro").some((g) => g.slug === "resultado")); // área
  assert.ok(buscarGuias("franchisee", "reposicao").some((g) => g.slug === "pedido-fabrica")); // sem acento
  assert.deepEqual(buscarGuias("franchisee", ""), []); // termo vazio não retorna tudo
  assert.deepEqual(buscarGuias("franchisee", "xyz-nao-existe"), []);
  assert.ok(!buscarGuias("franchisee", "ronda da manha").length); // guia de equipe não aparece pro franqueado
});

t("guiasPorArea: agrupa sem perder nenhum guia e sem repetir área", () => {
  const grupos = guiasPorArea("franchisee");
  const total = grupos.reduce((soma, g) => soma + g.guias.length, 0);
  assert.equal(total, guiasParaPapel("franchisee").length);
  const areas = grupos.map((g) => g.area);
  assert.equal(new Set(areas).size, areas.length);
});

t("COMECE_POR_AQUI: todo slug existe e vira guia de verdade pro franqueado", () => {
  assert.ok(COMECE_POR_AQUI.length >= 3);
  const guias = guiasComecePorAqui("franchisee");
  assert.equal(guias.length, COMECE_POR_AQUI.length);
  for (const g of guias) assert.equal(g.publico, "franqueado");
});

t("PERGUNTAS_FREQUENTES: pergunta e resposta curtas, guiaSlug (quando existe) aponta pra guia real", () => {
  assert.ok(PERGUNTAS_FREQUENTES.length >= 5);
  for (const f of PERGUNTAS_FREQUENTES) {
    assert.ok(f.pergunta && f.pergunta.length <= 80, f.pergunta);
    assert.ok(f.resposta && f.resposta.length <= 240, f.pergunta);
    if (f.guiaSlug) assert.ok(acharGuia(f.guiaSlug, "franchisee"), f.guiaSlug);
  }
});

t("registrarAjudaResolveu: o slug vai no NOME do evento (não em 'set', que é tag de sessão), nunca derruba a tela", () => {
  const chamadas = [];
  const clarityAntes = globalThis.window?.clarity;
  globalThis.window = globalThis.window || {};
  globalThis.window.clarity = (...args) => chamadas.push(args);
  registrarAjudaResolveu("vendas", "sim");
  registrarAjudaResolveu("vendas", "nao");
  registrarAjudaResolveu("pedido-fabrica", "sim"); // hífen no slug vira "_" no nome
  registrarAjudaResolveu(null, "sim"); // sem slug: cai pro nome genérico
  registrarAjudaResolveu("vendas", "resposta-invalida"); // ignorada, sem disparar nada
  assert.deepEqual(chamadas[0], ["event", "ajuda_resolveu_vendas_sim"]);
  assert.deepEqual(chamadas[1], ["event", "ajuda_resolveu_vendas_nao"]);
  assert.deepEqual(chamadas[2], ["event", "ajuda_resolveu_pedido_fabrica_sim"]);
  assert.deepEqual(chamadas[3], ["event", "ajuda_resolveu_sim"]);
  assert.equal(chamadas.length, 4); // a 5ª chamada (resposta inválida) não gerou evento
  assert.ok(chamadas.every(([, nome]) => /^[a-z0-9_]+$/.test(nome)), "nome do evento só com [a-z0-9_]");
  assert.ok(chamadas.every(([acao]) => acao === "event")); // nunca "set" — tag de sessão inteira, não do evento
  // Clarity quebrado não pode derrubar a tela.
  globalThis.window.clarity = () => { throw new Error("clarity fora do ar"); };
  assert.doesNotThrow(() => registrarAjudaResolveu("vendas", "sim"));
  globalThis.window.clarity = clarityAntes;
});

t("HelpTip: 5 campos, com texto e exemplo", () => {
  assert.deepEqual(Object.keys(HELP_TIPS).sort(), ["formaPagamento", "horarioCorte", "pedidoMinimo", "taxaEntrega", "verbaMarketing"]);
  for (const h of Object.values(HELP_TIPS)) assert.ok(h.titulo && h.texto && h.exemplo);
  assert.match(HELP_TIPS.verbaMarketing.texto, /R\$ 200/);
  assert.match(HELP_TIPS.verbaMarketing.texto, /14%/);
  assert.match(HELP_TIPS.verbaMarketing.exemplo, /R\$ 172/);
});

console.log(`guiasAjuda: ${n} testes ok`);
