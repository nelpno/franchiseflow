// Desenho do cardápio A4 (12/11/2026) no padrão do site novo: Roboto, vinho #9A1915 chapado, papel #FFF7EC, foto de prato.
// Gabarito: cs-celso/unidades/uberaba/2026-11-12-cardapio (o feito à mão para Uberaba). Coordenadas em mm; o canvas
// escala para a saída (150 dpi = imagem do robô/WhatsApp, 300 dpi = PDF para gráfica). Recursos em public/cardapio-arte/
// (mesma origem: imagem de outro domínio "suja" o canvas e o toBlob falha).
import { RECHEADAS } from "./cardapioArte.js";

const W = 210, H = 297, X0 = 14, X1 = 196;
const FONTE = "RobotoCardapio";
const COR = {
  vinho: "#9A1915", ouro: "#FBB900", papel: "#FFF7EC", noite: "#2B1A17", texto: "#4A3A35",
  creme: "#FEE9CA", linha: "#EAD9C8", ponto: "#CDB8A4", branco: "#FFFFFF",
};
const RODAPE_Y = 276;

let recursosPromessa = null;
let fontesProntas = false;

function carregarImagem(src) {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error(`Não carregou ${src}`));
    i.src = src;
  });
}

export function carregarRecursos() {
  if (!recursosPromessa) recursosPromessa = carregar().catch((e) => { recursosPromessa = null; throw e; });
  return recursosPromessa;
}

async function carregar() {
  const base = `${import.meta.env?.BASE_URL || "/"}cardapio-arte/`;
  if (!fontesProntas) {
    const fontes = await Promise.all([["400", "Roboto-400.ttf"], ["700", "Roboto-700.ttf"], ["900", "Roboto-900.ttf"]]
      .map(([peso, arq]) => new FontFace(FONTE, `url(${base}${arq})`, { weight: peso }).load()));
    fontes.forEach((ff) => document.fonts.add(ff));
    fontesProntas = true;
  }
  const [logo, pacote, ...fotos] = await Promise.all([
    carregarImagem(`${base}logo.png`),
    carregarImagem(`${base}pacote-pao-de-queijo-480.webp`),
    ...RECHEADAS.map((f) => carregarImagem(`${base}${f.foto}`)),
  ]);
  return { logo, pacote, fotos: Object.fromEntries(RECHEADAS.map((f, i) => [f.foto, fotos[i]])) };
}

const fonte = (ctx, tam, peso = 400) => { ctx.font = `${peso} ${tam}px ${FONTE}`; };

// Texto espaçado em caixa alta (o "olho" do site). Devolve a largura.
function olho(ctx, txt, x, y, tam, cor, maxW) {
  const t = String(txt).toUpperCase();
  let esp = tam * 0.16;
  fonte(ctx, tam, 700);
  const larg = () => [...t].reduce((s, ch) => s + ctx.measureText(ch).width + esp, -esp);
  if (maxW && larg() > maxW) { esp = Math.max(0, esp * 0.4); if (larg() > maxW) { tam *= maxW / larg(); fonte(ctx, tam, 700); } }
  ctx.fillStyle = cor;
  ctx.textBaseline = "top";
  let cx = x;
  for (const ch of t) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + esp; }
  return cx - x;
}

function quebrar(ctx, txt, maxW) {
  const palavras = String(txt || "").split(/ +/).filter(Boolean); // só espaço comum: "500 g" com espaço fixo não quebra
  const linhas = [];
  let atual = "";
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(teste).width <= maxW || !atual) atual = teste;
    else { linhas.push(atual); atual = p; }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [""];
}

function retanguloArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fotoCobrindo(ctx, img, x, y, w, h, r) {
  ctx.save();
  retanguloArredondado(ctx, x, y, w, h, r);
  ctx.clip();
  const escala = Math.max(w / img.width, h / img.height);
  const iw = img.width * escala, ih = img.height * escala;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}

// Linha "sabores ........ R$ 39,80". Mede (desenhar=false) ou desenha. Devolve a altura usada.
function linhaPreco(ctx, { x, y, w, rotulo, preco, tam, lh, desenhar = true, corRotulo = COR.texto }) {
  const precoTxt = `R$ ${preco}`;
  fonte(ctx, tam * 1.1, 900);
  const pw = ctx.measureText(precoTxt).width;
  fonte(ctx, tam, 400);
  const linhas = quebrar(ctx, rotulo, w - pw - 6);
  if (desenhar) {
    ctx.textBaseline = "alphabetic";
    linhas.forEach((l, i) => { ctx.fillStyle = corRotulo; ctx.fillText(l, x, y + tam * 0.95 + i * lh); });
    const ultima = linhas[linhas.length - 1];
    const by = y + tam * 0.95 + (linhas.length - 1) * lh;
    const ini = x + ctx.measureText(ultima).width + 1.6;
    const fim = x + w - pw - 1.6;
    ctx.fillStyle = COR.ponto;
    for (let px = ini; px < fim; px += 0.9) ctx.fillRect(px, by - 0.5, 0.3, 0.3);
    fonte(ctx, tam * 1.1, 900);
    ctx.fillStyle = COR.noite;
    ctx.fillText(precoTxt, x + w - pw, by);
  }
  return linhas.length * lh;
}

// ---------- layout ----------

function alturaGrupo(ctx, g, colW, k) {
  const tam = 3.0 * k, lh = 4.0 * k;
  let h = 0;
  if (g.tipo === "pao") h += 2.4 + 12.5 + 1.6;
  else h += 4.6 * k;
  const w = g.tipo === "pao" ? colW - 4.8 : colW;
  for (const l of g.linhas) h += linhaPreco(ctx, { x: 0, y: 0, w, rotulo: l.rotulo, preco: l.preco, tam, lh, desenhar: false });
  if (g.tipo === "pao") h += 2.4;
  return h + 3.2 * k;
}

const fotoDe = (base) => { const h = Math.max(18, base - 4); return { h, w: Math.min(46, h * 1.77) }; };

function planejar(ctx, cardapio, base, k) {
  const linhasX = X0 + fotoDe(base).w + 6, linhasW = X1 - linhasX;
  const tam = 3.35, lh = 4.4;
  let y = cardapio.principais.length ? 75.5 : 69;
  const linhas = cardapio.principais.map((p) => {
    const alt = p.linhas.reduce((s, l) => s + linhaPreco(ctx, { x: 0, y: 0, w: linhasW, rotulo: l.rotulo, preco: l.preco, tam, lh, desenhar: false }), 0);
    const altura = Math.max(base, 10.6 + alt + 3);
    const item = { ...p, y, altura };
    y += altura;
    return item;
  });
  const colGap = 6, ncol = 3;
  const colW = (X1 - X0 - colGap * (ncol - 1)) / ncol;
  const secY = cardapio.grupos.length ? (linhas.length ? y + 3 : 69) : y;
  const cols = Array.from({ length: ncol }, () => ({ h: 0, grupos: [] }));
  for (const g of cardapio.grupos) {
    const h = alturaGrupo(ctx, g, colW, k);
    const alvo = cols.reduce((m, c) => (c.h < m.h ? c : m), cols[0]);
    alvo.grupos.push({ ...g, y: alvo.h, h });
    alvo.h += h;
  }
  const secH = cardapio.grupos.length ? 6 + Math.max(...cols.map((c) => c.h)) : 0;
  return { linhas, linhasX, secY, cols, colW, colGap, k, base, fim: secY + secH };
}

export function desenharCardapio(canvas, dados, rec, pxPorMm) {
  canvas.width = Math.round(W * pxPorMm);
  canvas.height = Math.round(H * pxPorMm);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(pxPorMm, 0, 0, pxPorMm, 0, 0);
  ctx.imageSmoothingQuality = "high";

  // fundo + topo vinho
  ctx.fillStyle = COR.papel; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COR.vinho; ctx.fillRect(0, 0, W, 62);
  const lw = 44, lh = lw * (rec.logo.height / rec.logo.width);
  ctx.drawImage(rec.logo, X0, 12 + (36 - lh) / 2, lw, lh);
  olho(ctx, `Cardápio · ${dados.unidade}`, 70, 13.6, 3.3, COR.ouro, 126);
  fonte(ctx, 12.2, 900);
  ctx.fillStyle = COR.branco; ctx.textBaseline = "top";
  ctx.fillText("MASSA ARTESANAL", 70, 20.4);
  ctx.fillText("CONGELADA", 70, 32.4);
  fonte(ctx, 3.6, 400);
  ctx.fillStyle = COR.creme;
  quebrar(ctx, "Feita na nossa fábrica em Araraquara desde 1994. Embalada e congelada para você servir quando quiser.", 126)
    .forEach((l, i) => ctx.fillText(l, 70, 47 + i * 5));

  // escolhe o tamanho que cabe (linhas com foto encolhem primeiro, depois a letra de baixo)
  const tentativas = [];
  for (const base of [30, 28, 26, 24, 22]) tentativas.push([base, 1]);
  for (const k of [0.92, 0.85, 0.78, 0.72]) tentativas.push([22, k]);
  let plano = null;
  for (const [base, k] of tentativas) { plano = planejar(ctx, dados.cardapio, base, k); if (plano.fim <= RODAPE_Y - 2) break; }

  // massas recheadas
  if (plano.linhas.length) {
    olho(ctx, "Massas recheadas · 700 g · servem de 2 a 3 pessoas", X0, 69, 3.3, COR.vinho, X1 - X0);
    plano.linhas.forEach((p, i) => {
      const { h: fh, w: fw } = fotoDe(plano.base);
      const tx = plano.linhasX;
      const foto = rec.fotos[p.foto];
      if (foto) fotoCobrindo(ctx, foto, X0, p.y, fw, fh, 2.4);
      fonte(ctx, 6.2, 900); ctx.fillStyle = COR.vinho; ctx.textBaseline = "top";
      ctx.fillText(p.nome.toUpperCase(), tx, p.y + 1.2);
      let ly = p.y + 9.4;
      for (const l of p.linhas) ly += linhaPreco(ctx, { x: tx, y: ly, w: X1 - tx, rotulo: l.rotulo, preco: l.preco, tam: 3.35, lh: 4.4 });
      if (i < plano.linhas.length - 1) { ctx.fillStyle = COR.linha; ctx.fillRect(tx, p.y + p.altura - 1.8, X1 - tx, 0.3); }
    });
  }

  // também temos (colunas)
  if (dados.cardapio.grupos.length) {
    if (plano.linhas.length) { ctx.fillStyle = COR.linha; ctx.fillRect(0, plano.secY - 1.6, W, 0.4); }
    olho(ctx, "Também temos", X0, plano.secY + 1, 3.0, COR.vinho);
    const k = plano.k;
    plano.cortados = 0;
    plano.cols.forEach((c, ci) => {
      const cx = X0 + ci * (plano.colW + plano.colGap);
      for (const g of c.grupos) {
        let y = plano.secY + 6 + g.y;
        if (y > RODAPE_Y - 3) { plano.cortados += g.linhas.length; continue; }
        if (g.tipo === "pao") {
          ctx.save();
          ctx.shadowColor = "rgba(43,26,23,.18)"; ctx.shadowBlur = 1.4; ctx.shadowOffsetY = 0.3;
          ctx.fillStyle = COR.branco; retanguloArredondado(ctx, cx, y, plano.colW, g.h - 3.2 * k, 2.2); ctx.fill();
          ctx.restore();
          const iw = 12.5, ih = iw * (rec.pacote.height / rec.pacote.width);
          ctx.drawImage(rec.pacote, cx + 2.4, y + 2.4 + (12.5 - ih) / 2, iw, ih);
          fonte(ctx, 4.2 * k, 900); ctx.fillStyle = COR.vinho; ctx.textBaseline = "top";
          ctx.fillText("PÃO DE QUEIJO", cx + 17, y + 6.6 - 2.1 * k);
          y += 2.4 + 12.5 + 1.6;
          for (const l of g.linhas) {
            if (y > RODAPE_Y - 4) { plano.cortados += 1; continue; }
            y += linhaPreco(ctx, { x: cx + 2.4, y, w: plano.colW - 4.8, rotulo: l.rotulo, preco: l.preco, tam: 3.0 * k, lh: 4.0 * k });
          }
        } else {
          fonte(ctx, 3.15 * k, 700); ctx.fillStyle = COR.noite; ctx.textBaseline = "top";
          ctx.fillText(g.titulo, cx, y);
          y += 4.6 * k;
          for (const l of g.linhas) {
            if (y > RODAPE_Y - 4) { plano.cortados += 1; continue; }
            y += linhaPreco(ctx, { x: cx, y, w: plano.colW, rotulo: l.rotulo, preco: l.preco, tam: 3.0 * k, lh: 4.0 * k });
          }
        }
      }
    });
  }

  // rodapé vinho
  ctx.fillStyle = COR.vinho; ctx.fillRect(0, RODAPE_Y, W, H - RODAPE_Y);
  const temQr = Boolean(rec.qr);
  const meioX = 86, meioW = (temQr ? 174 : X1) - meioX;
  if (dados.whatsapp) {
    olho(ctx, "Peça pelo WhatsApp", X0, 279.6, 2.8, COR.ouro);
    fonte(ctx, 7.4, 900); ctx.fillStyle = COR.branco; ctx.textBaseline = "top";
    ctx.fillText(dados.whatsapp, X0, 283.6);
  } else if (dados.link) {
    olho(ctx, "Peça pelo cardápio online", X0, 279.6, 2.8, COR.ouro, meioX - X0 - 4);
  }
  const meio = [];
  if (dados.link) meio.push([dados.whatsapp ? "Ou monte o pedido no cardápio online" : "Monte o pedido em", 400], [dados.link, 700]);
  if (dados.atendimento) meio.push([dados.atendimento, 400]);
  ctx.textBaseline = "top";
  meio.forEach(([txt, peso], i) => {
    let tam = 3.0;
    fonte(ctx, tam, peso);
    const larg = ctx.measureText(txt).width;
    if (larg > meioW) { tam *= meioW / larg; fonte(ctx, tam, peso); }
    ctx.fillStyle = peso === 700 ? COR.branco : COR.creme;
    ctx.fillText(txt, meioX, 280.2 + i * 4.3 + (meio.length < 3 ? 2.1 : 0));
  });
  if (temQr) {
    ctx.fillStyle = COR.branco; retanguloArredondado(ctx, 177, 278.2, 17.6, 17.6, 1.4); ctx.fill();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(rec.qr, 178.1, 279.3, 15.4, 15.4);
    ctx.imageSmoothingEnabled = true;
  }
  return plano;
}

async function qrCanvas(url) {
  const QRCode = (await import("qrcode")).default;
  const c = document.createElement("canvas");
  await QRCode.toCanvas(c, url, { margin: 0, width: 400, errorCorrectionLevel: "M" });
  return c;
}

/** Canvas pronto + quantas linhas não couberam na folha. pxPorMm: 1240/210 ≈ 5,9 (imagem 1240 x 1754) · 300/25,4 (PDF). */
export async function gerarCardapioCanvas(dados, { pxPorMm = 1240 / 210 } = {}) {
  const rec = await carregarRecursos();
  const qr = dados.qrUrl ? await qrCanvas(dados.qrUrl) : null;
  const canvas = document.createElement("canvas");
  const plano = desenharCardapio(canvas, dados, { ...rec, qr }, pxPorMm);
  return { canvas, cortados: plano.cortados || 0 };
}

export const canvasParaJpeg = (canvas, qualidade = 0.9) =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem"))), "image/jpeg", qualidade));

export async function baixarCardapioPdf(dados, nomeArquivo) {
  const { canvas } = await gerarCardapioCanvas(dados, { pxPorMm: 300 / 25.4 });
  const mod = await import("jspdf");
  const JsPDF = mod.jsPDF || mod.default;
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, W, H);
  doc.save(nomeArquivo);
}
