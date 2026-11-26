// Promoção estruturada do cardápio digital (10/11/2026, ESPEC do cardápio § 4.5–4.6).
// A franqueada escolhe da lista, não digita regra. Dois tipos na v1:
//   kit        {tipo:"kit", nome, itens:[{product_name, qtd}], preco, vale_ate}
//   percentual {tipo:"percentual", nome, itens:[{product_name, qtd:1}], min_qtd, pct, vale_ate}
//   brinde     {tipo:"brinde", nome, itens:[{product_name, qtd:1}] (os que contam, até 30), min_qtd, brinde:{product_name}, vale_ate}
//     24/11/2026 (Suzano, Black Friday): "compre N, ganhe 1 brinde"; o brinde não conta para o N; desconto = preço de 1 brinde, limite 1
//     por pedido, só com o brinde no pedido (site/pedido/supabase/2026-11-24a-promocao-brinde.sql)
// 24/11/2026 (b): so_pix opcional em qualquer tipo: "Pagamento só no Pix." no texto do robô, antes da validade. Só texto: a cobrança
//   e o cardápio não travam cartão (2026-11-24b-promocao-so-pix.sql). Pedido da Jennifer (Suzano).
// 19/11/2026: item À ESCOLHA, só no kit: {escolha:true, rotulo:"Massa recheada 700g", opcoes:["<nome do estoque>", ...], qtd}.
//   O preço normal conta a opção MAIS CARA; o banco (promocao_aplicar) conta a opção que o cliente pediu
//   (site/pedido/supabase/2026-11-19-kit-item-escolha.sql).
// O BANCO é quem manda: o trigger franchise_configurations_promocao_texto valida (promocao_regras_erro) e grava o texto
// que o robô lê (promocao_texto) em promotions_combo. Aqui fica a MESMA regra e o MESMO texto, para a prévia e para
// avisar antes de salvar (site/pedido/supabase/2026-11-10-cardapio-rede.sql). Mudou um lado, mude o outro:
// node src/lib/promocaoRegras.test.mjs compara com textos gerados pelo SQL.

export const TETO_DESCONTO = 0.35; // o mesmo teto do robô
export const MAX_ITENS = 6;
export const MAX_ITENS_BRINDE = 30; // "qualquer massa de 700g" (Suzano tem 20); 26/11/2026 também o Leve N (Vila Sônia)
export const maxItens = (tipo) => (tipo === "kit" ? MAX_ITENS : MAX_ITENS_BRINDE);
export const MAX_PROMOS = 3; // 12/11/2026: até 3 promoções ao mesmo tempo (o banco recusa a 4ª)
export const NOME_MAX = 40;
export const ROTULO_MAX = 40; // nome do item à escolha (3 a 40)
export const MIN_OPCOES = 2;
export const MAX_OPCOES = 30;

export const TIPOS = [
  { id: "kit", rotulo: "Kit com preço fechado" },
  { id: "percentual", rotulo: "Leve N e ganhe %" },
  { id: "brinde", rotulo: "Compre N, ganhe 1 brinde" },
];

const arred = (v) => Math.round(v * 100) / 100;
export const reais = (v) => (Number(v) || 0).toFixed(2).replace(".", ",");

/** Preço de venda de agora, pelo nome exato do estoque (só ativo e com preço). */
export function precoDe(produtos, nome) {
  const p = (produtos || []).find((x) => x.produto === nome && x.ativo !== false && Number(x.preco) > 0);
  return p ? Number(p.preco) : null;
}

/** Item à escolha? (só `escolha === true`, como o `x->'escolha' = 'true'` do banco) */
export const ehEscolha = (it) => !!it && typeof it === "object" && it.escolha === true;

/** Os nomes do estoque que o item aceita: fixo = [product_name]; à escolha = as opções (igual a public.promocao_item_nomes). */
export function nomesDoItem(it) {
  if (ehEscolha(it)) return Array.isArray(it.opcoes) ? it.opcoes.map((o) => String(o)) : [];
  return [it?.product_name];
}

/** Maior preço entre os nomes (null se nenhum tem preço). */
function maiorPreco(produtos, nomes, achar = precoDe) {
  let max = null;
  for (const n of nomes) {
    const p = achar(produtos, n);
    if (p != null && (max == null || p > max)) max = p;
  }
  return max;
}

/** Preço de um produto À VENDA (ativo, com preço, visível no cardápio): o maior entre linhas de mesmo nome, como o max() do banco. */
function precoVendavel(produtos, nome) {
  const ps = (produtos || []).filter((x) => x.produto === nome && x.ativo !== false && Number(x.preco) > 0 && x.visivel !== false).map((x) => Number(x.preco));
  return ps.length ? Math.max(...ps) : null;
}

/** O item ainda vende? Fixo: o produto à venda; à escolha: pelo menos uma opção (igual a public.promocao_regra_itens_ok). */
export function itemVendavel(it, produtos) {
  return nomesDoItem(it).some((n) => precoVendavel(produtos, n) != null);
}

/** "A", "A ou B", "A, B ou C" (igual a public.promocao_lista_ou) */
export function listaOu(nomes) {
  const l = nomes || [];
  if (l.length <= 1) return l[0] ?? "";
  return `${l.slice(0, -1).join(", ")} ou ${l[l.length - 1]}`;
}

/** "Preço normal" do kit = soma dos preços de agora × quantidade (nunca inventado); item à escolha conta a opção mais cara.
 *  null se faltar preço. */
export function precoNormal(regra, produtos) {
  const itens = regra?.itens || [];
  if (!itens.length) return null;
  let soma = 0;
  for (const it of itens) {
    const p = ehEscolha(it) ? maiorPreco(produtos, nomesDoItem(it)) : precoDe(produtos, it.product_name);
    if (p == null) return null;
    soma += p * (Number(it.qtd) || 0);
  }
  return arred(soma);
}

export function regraVazia(tipo = "kit") {
  if (tipo === "brinde") return { tipo, nome: "", itens: [], min_qtd: 3, brinde: null, vale_ate: null };
  return tipo === "percentual"
    ? { tipo, nome: "", itens: [], min_qtd: 2, pct: 5, vale_ate: null }
    : { tipo, nome: "", itens: [], preco: null, vale_ate: null };
}

/** Nome do produto do brinde (ou ""). */
export const nomeDoBrinde = (regra) => (regra && regra.brinde && typeof regra.brinde.product_name === "string" ? regra.brinde.product_name : "");

/** A promoção ainda vale (igual a public.promocao_regra_itens_ok)? kit/leve N: todo item à venda; brinde: pelo menos um que conta E o brinde. */
export function regraVendavel(regra, produtos) {
  const itens = regra?.itens || [];
  if (!itens.length) return false;
  if (regra.tipo === "brinde") return itens.some((it) => itemVendavel(it, produtos)) && precoVendavel(produtos, nomeDoBrinde(regra)) != null;
  return itens.every((it) => itemVendavel(it, produtos));
}

export function regraAtiva(regras) {
  return Array.isArray(regras) && regras.length > 0 && regras[0] && typeof regras[0] === "object" ? regras[0] : null;
}

/** A lista de promoções ativas (até 3), na ordem em que o banco guarda e o cardápio mostra. */
export function regrasAtivas(regras) {
  return Array.isArray(regras) ? regras.filter((r) => r && typeof r === "object") : [];
}

/** Lista nova com a promoção `indice` trocada por `nova`; indice < 0 = acrescenta no fim. As outras seguem como estão. */
export function trocaRegra(regras, indice, nova) {
  const lista = regrasAtivas(regras);
  if (indice < 0 || indice >= lista.length) return [...lista, nova];
  return lista.map((r, i) => (i === indice ? nova : r));
}

/** Lista sem a promoção `indice`. */
export function tiraRegra(regras, indice) {
  return regrasAtivas(regras).filter((_, i) => i !== indice);
}

/** Produtos que a promoção `indice` divide com outra: [{produto, com: [nomes das outras promoções]}]. Aviso na tela, não bloqueia. */
export function produtosDivididos(regras, indice) {
  const lista = regrasAtivas(regras);
  const eu = lista[indice];
  if (!eu) return [];
  // 19/11: as opções do item à escolha contam como produtos da promoção; 24/11: o produto do brinde também
  const nomes = (r) => [...(r.itens || []).flatMap(nomesDoItem), ...(nomeDoBrinde(r) ? [nomeDoBrinde(r)] : [])];
  return [...new Set(nomes(eu))].map((produto) => ({
    produto,
    com: lista.filter((o, j) => j !== indice && nomes(o).includes(produto)).map((o) => String(o.nome || "").trim()),
  })).filter((x) => x.com.length);
}

const chaveNome = (n) => String(n ?? "").trim().toLowerCase();

const inteiro = (v) => /^\d{1,2}$/.test(String(v ?? ""));

/** Mesmo texto e mesma ordem de checagem de public.promocao_regras_erro / promocao_regra_erro. null = pode salvar.
 *  `outras` = as outras promoções da lista (para o limite de 3 e o nome que não repete). */
export function erroDaRegra(regra, produtos, hojeISO, outras = []) {
  if (!regra || typeof regra !== "object") return "Promoção em formato inválido.";
  if (outras.length >= MAX_PROMOS) return "No máximo 3 promoções ao mesmo tempo. Encerre uma para criar outra.";
  if (outras.some((o) => chaveNome(o?.nome) === chaveNome(regra.nome))) return "Duas promoções com o mesmo nome. Dê um nome diferente a cada uma.";
  if (regra.so_pix !== undefined && typeof regra.so_pix !== "boolean") return "Promoção em formato inválido.";
  if (!["kit", "percentual", "brinde"].includes(regra.tipo)) return "Escolha o tipo da promoção.";
  const nome = String(regra.nome || "").trim();
  if (nome.length < 3 || nome.length > NOME_MAX) return "O nome da promoção precisa ter de 3 a 40 letras.";
  const itens = Array.isArray(regra.itens) ? regra.itens : [];
  if (!itens.length) return "Escolha pelo menos um produto.";
  if (regra.tipo !== "kit" && itens.length > MAX_ITENS_BRINDE) return "No máximo 30 produtos na promoção.";
  if (regra.tipo === "kit" && itens.length > MAX_ITENS) return "No máximo 6 produtos na promoção.";
  // 19/11: item à escolha (só no kit): nome e opções
  for (const it of itens) {
    if (!ehEscolha(it)) continue;
    if (regra.tipo !== "kit") return "Item à escolha só vale no kit.";
    const rotulo = String(it.rotulo ?? "").trim();
    if (rotulo.length < 3 || rotulo.length > ROTULO_MAX) return "Dê um nome ao item à escolha (ex.: Massa recheada 700g).";
    if (!Array.isArray(it.opcoes) || it.opcoes.length < MIN_OPCOES) return "Escolha pelo menos 2 opções para o item à escolha.";
    if (it.opcoes.length > MAX_OPCOES) return "No máximo 30 opções no item à escolha.";
    if (it.opcoes.some((o) => typeof o !== "string")) return "Promoção em formato inválido.";
  }
  // todo nome (fixos e opções de todos os itens) uma vez só
  const nomes = itens.flatMap(nomesDoItem);
  if (new Set(nomes).size !== nomes.length) return "O mesmo produto aparece duas vezes.";
  let normal = 0;
  let total = 0;
  let minPreco = null; // 24/11 brinde: o produto que conta mais barato
  for (const it of itens) {
    if (!inteiro(it.qtd) || Number(it.qtd) < 1 || Number(it.qtd) > 20) return "Quantidade de cada produto: de 1 a 20.";
    // fixo: o produto; à escolha: cada opção como se fosse um item fixo (o preço normal usa a mais cara)
    let max = null;
    for (const nome of nomesDoItem(it)) {
      const p = precoDe(produtos, nome);
      if (p == null) return `O produto "${String(nome || "").slice(0, 60)}" não está no seu estoque.`;
      // escondido do cardápio não entra (o kit sumiria de tudo, robô incluído); nome repetido: vale o visível, como no SQL
      const visivel = (produtos || []).some((x) => x.produto === nome && x.ativo !== false && Number(x.preco) > 0 && x.visivel !== false);
      if (!visivel) return `O produto "${String(nome || "").slice(0, 60)}" está escondido do cardápio.`;
      if (max == null || p > max) max = p;
    }
    normal += max * Number(it.qtd);
    if (minPreco == null || max < minPreco) minPreco = max;
    total += Number(it.qtd);
  }
  if (regra.vale_ate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(regra.vale_ate)) return "Data de validade inválida.";
    if (hojeISO && regra.vale_ate < hojeISO) return "A data de validade já passou.";
  }
  if (regra.tipo === "kit") {
    if (total < 2) return "O kit precisa de pelo menos 2 itens.";
    const preco = regra.preco == null || regra.preco === "" ? null : arred(Number(regra.preco));
    if (preco == null || !Number.isFinite(preco) || preco <= 0) return "Digite o preço do kit.";
    if (preco >= normal) return "O preço do kit precisa ser menor que o preço normal.";
    // em centavos, como o numeric do banco (16,80 / 48,00 é 35% exato e passa)
    if (Math.round((normal - preco) * 100) * 100 > Math.round(normal * 100) * Math.round(TETO_DESCONTO * 100)) return "O desconto passou de 35%.";
  } else if (regra.tipo === "brinde") {
    const min = Number(regra.min_qtd);
    if (!Number.isInteger(min) || min < 2 || min > 10) return "Quantas: de 2 a 10.";
    const b = nomeDoBrinde(regra);
    if (!b.trim()) return "Escolha o produto do brinde.";
    if (nomes.includes(b)) return "O brinde não pode ser um dos produtos que contam.";
    const pb = precoDe(produtos, b);
    if (pb == null) return `O brinde "${b.slice(0, 60)}" não está no seu estoque.`;
    const visivel = (produtos || []).some((x) => x.produto === b && x.ativo !== false && Number(x.preco) > 0 && x.visivel !== false);
    if (!visivel) return `O brinde "${b.slice(0, 60)}" está escondido do cardápio.`;
    // o mesmo teto de 35% da cobrança do robô, em centavos: brinde ÷ (N × o mais barato que conta + brinde)
    if (Math.round(pb * 100) * 100 > Math.round((min * minPreco + pb) * 100) * Math.round(TETO_DESCONTO * 100)) return "O brinde passou de 35% da compra mínima.";
  } else {
    const min = Number(regra.min_qtd);
    const pct = Number(regra.pct);
    if (!Number.isInteger(min) || min < 2 || min > 10) return "Quantas: de 2 a 10.";
    if (!Number.isInteger(pct) || pct < 1 || pct > 35) return "Desconto: de 1% a 35%, número inteiro.";
  }
  return null;
}

function ddmmaaaa(iso) {
  const [a, m, d] = String(iso).split("-");
  return `${d}/${m}/${a}`;
}

/** Mesmo texto de public.promocao_texto_um (o que o robô lê em PROMOÇÃO, uma linha por promoção; o banco junta com quebra de linha). */
export function textoDaRegra(regra, produtos) {
  if (!regra || typeof regra !== "object") return null;
  const itens = Array.isArray(regra.itens) ? regra.itens : [];
  const ate = (regra.so_pix === true ? " Pagamento só no Pix." : "")
    + (regra.vale_ate && /^\d{4}-\d{2}-\d{2}$/.test(regra.vale_ate) ? ` Válido até ${ddmmaaaa(regra.vale_ate)}.` : "");
  if (regra.tipo === "kit") {
    // item à escolha: "<qtd> <rótulo> à escolha (<opções à venda>)"; nenhuma à venda = todas (o banco também)
    const parte = (i) => {
      if (!ehEscolha(i)) return `${i.qtd} ${i.product_name}`;
      const vendaveis = nomesDoItem(i).filter((n) => precoVendavel(produtos, n) != null);
      return `${i.qtd} ${String(i.rotulo ?? "").trim()} à escolha (${listaOu(vendaveis.length ? vendaveis : nomesDoItem(i))})`;
    };
    const lista = itens.map(parte).join(" + ");
    const preco = arred(Number(regra.preco));
    // como o SQL: soma só o que achou no estoque (sum ignora nulo); item à escolha = a opção à venda mais cara
    const achados = itens.map((i) => ({ p: ehEscolha(i) ? maiorPreco(produtos, nomesDoItem(i), precoVendavel) : precoDe(produtos, i.product_name), q: Number(i.qtd) || 0 })).filter((x) => x.p != null);
    const normal = achados.length ? arred(achados.reduce((s, x) => s + x.p * x.q, 0)) : null;
    return `${String(regra.nome || "").trim()}: ${lista} por R$ ${reais(preco)}`
      + (normal != null && normal > preco ? ` (de R$ ${reais(normal)})` : "")
      + "." + ate;
  }
  if (regra.tipo === "percentual") {
    const nomes = itens.map((i) => i.product_name);
    const meio = nomes.length === 1
      ? ` ${nomes[0]} ou mais e ganhe `
      : ` ou mais, somando ${nomes.join(" e ")}, e ganhe `;
    return `Leve ${regra.min_qtd}${meio}${regra.pct}% de desconto.${ate}`;
  }
  if (regra.tipo === "brinde") {
    // começa pelo nome, como o kit; só os produtos à venda (nenhum à venda = todos)
    const todos = itens.map((i) => i.product_name);
    const vend = todos.filter((n) => precoVendavel(produtos, n) != null);
    const l = vend.length ? vend : todos;
    return `${String(regra.nome || "").trim()}: na compra de ${regra.min_qtd} ou mais${l.length === 1 ? ` ${l[0]}` : `, somando ${listaOu(l)}`}`
      + `, ganhe 1 ${nomeDoBrinde(regra)} grátis. Limite de 1 brinde por pedido.${ate}`;
  }
  return null;
}

/** Regra pronta para gravar: só os campos do tipo, números como número. */
export function limparRegra(regra) {
  const base = {
    tipo: regra.tipo,
    nome: String(regra.nome || "").trim(),
    itens: (regra.itens || []).map((i) => (ehEscolha(i)
      ? { escolha: true, rotulo: String(i.rotulo ?? "").trim(), opcoes: Array.isArray(i.opcoes) ? [...i.opcoes] : [], qtd: Number(i.qtd) || 1 }
      : { product_name: i.product_name, qtd: regra.tipo === "kit" ? Number(i.qtd) || 1 : 1 })),
    vale_ate: regra.vale_ate || null,
    ...(regra.so_pix === true ? { so_pix: true } : {}),
  };
  if (regra.tipo === "kit") return { ...base, preco: arred(Number(regra.preco)) };
  if (regra.tipo === "brinde") return { ...base, min_qtd: Number(regra.min_qtd), brinde: { product_name: nomeDoBrinde(regra) } };
  return { ...base, min_qtd: Number(regra.min_qtd), pct: Number(regra.pct) };
}

/** O que o robô lê em PROMOÇÃO com a lista toda: uma linha por promoção (igual a public.promocao_texto). */
export function textoDasRegras(regras, produtos) {
  return regrasAtivas(regras).map((r) => textoDaRegra(r, produtos)).filter(Boolean).join("\n") || null;
}
