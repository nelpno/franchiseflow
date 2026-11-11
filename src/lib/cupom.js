// Cupom de desconto da unidade (Fase 1, 11/11/2026; plano cs-celso/analises/2026-11-11-cupom-fidelidade-plano.md).
// Regras puras, sem tela. O banco é a fonte (cardapio_configurar { cupom: {ativo, pct, codigo, vale_ate} } valida de novo);
// aqui só a prévia, a conferência antes de enviar e os rótulos de venda.
// Regra fixa (decisão do Nelson, 11/11/2026): cada cliente usa uma vez (pelo telefone), não soma com promoção (vale o
// maior desconto), só nos produtos e nunca no frete. Código vazio no painel = o sugerido da rede.

export const CUPOM_CODIGO_SUGERIDO = "MAXIMASSAS10";
export const CUPOM_PCTS = [5, 10, 15, 20];
export const CUPOM_PCT_PADRAO = 10;

// Letras e números, sem espaço nem acento, maiúsculas (o cliente digita de qualquer jeito; o banco compara assim).
export function limparCodigo(s) {
  return String(s ?? "").normalize("NFD").replace(/\p{M}/gu, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20);
}

// Estado do formulário a partir do cardapio_painel().cupom (ausente = banco antigo: sem cartão).
export function cupomDoPainel(painel) {
  const c = painel?.cupom;
  if (!c || typeof c !== "object") return null;
  return {
    ativo: c.ativo === true,
    pct: CUPOM_PCTS.includes(Number(c.pct)) ? Number(c.pct) : CUPOM_PCT_PADRAO,
    codigo: limparCodigo(c.codigo) || CUPOM_CODIGO_SUGERIDO,
    vale_ate: /^\d{4}-\d{2}-\d{2}$/.test(String(c.vale_ate || "")) ? c.vale_ate : null,
    vencido: c.vencido === true,
    chaveLigada: c.chave_ligada !== false,
    usos30d: Number(c.usos_30d) || 0,
    desconto30d: Number(c.desconto_30d) || 0,
  };
}

// Mesma regra de cupom_regras_erro (SQL). hojeISO = hoje em Brasília (AAAA-MM-DD).
export function erroCupom({ ativo, pct, codigo, vale_ate: ate }, hojeISO) {
  if (!CUPOM_PCTS.includes(Number(pct))) return "Escolha o desconto do cupom: 5%, 10%, 15% ou 20%.";
  const cod = String(codigo || "");
  if (!/^[A-Za-z0-9]{3,20}$/.test(cod) || !/[A-Za-z]/.test(cod)) {
    return "O código do cupom tem de 3 a 20 letras ou números, sem espaço nem acento, e pelo menos uma letra.";
  }
  if (ate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ate) || !dataValida(ate)) return 'A data do "vale até" está inválida.';
    if (ativo && hojeISO && ate < hojeISO) return 'O "vale até" já passou. Escolha uma data de hoje em diante ou deixe em branco.';
  }
  return null;
}

const dataValida = (iso) => { const d = new Date(`${iso}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso; };
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// "Cupom MAXIMASSAS10: 10% de desconto nos produtos, até 30/11." (prévia do que o cliente lê)
export function fraseCupomCliente({ pct, codigo, vale_ate: ate }) {
  return `Cupom ${codigo || "…"}: ${pct}% de desconto nos produtos${ate ? `, até ${dm(ate)}` : ""}.`;
}

// Rótulo do desconto de uma venda (sales.desconto_origem = cupom | promocao | fidelidade | cashback | manual; sales.desconto_codigo):
// "Cupom MAXIMASSAS10", "Promoção", "Fidelidade", "Cashback" ou só "Desconto" (venda antiga / sem motivo). Desenho genérico: tipo novo = uma linha aqui.
export function rotuloDesconto(sale) {
  const o = sale?.desconto_origem;
  if (o === "cupom") return sale.desconto_codigo ? `Cupom ${sale.desconto_codigo}` : "Cupom";
  if (o === "promocao") return "Promoção";
  if (o === "fidelidade") return "Fidelidade";
  if (o === "cashback") return "Cashback";
  if (o === "manual" || o === "outro") return "Desconto combinado";
  return "Desconto";
}

export const MOTIVOS_DESCONTO = [
  { id: "", rotulo: "Sem motivo" },
  { id: "promocao", rotulo: "Promoção" },
  { id: "cupom", rotulo: "Cupom" },
  { id: "manual", rotulo: "Outro (combinado com o cliente)" },
];
