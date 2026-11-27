// Categorias de expenses (sincronizado com CHECK constraint em supabase/expense-category-migration.sql)
// Usado em: ExpenseForm, TabResultado (cards "Onde foi o dinheiro"), Sheet "Lançar Compra"

export const EXPENSE_CATEGORIES = [
  { value: "compra_produto", label: "Compra de produto", icon: "shopping_basket", color: "#b91c1c", help: "Massas, molhos, sobremesas comprados de fornecedor" },
  { value: "compra_embalagem", label: "Embalagem", icon: "inventory_2", color: "#7c2d12", help: "Sacolas, filme, etiquetas, lacres" },
  { value: "compra_insumo", label: "Insumos", icon: "kitchen", color: "#a16207", help: "Gás, tempero, óleo, água" },
  { value: "aluguel", label: "Aluguel", icon: "home_work", color: "#1e40af", help: "Aluguel do ponto, condomínio" },
  { value: "pessoal", label: "Pessoal", icon: "groups", color: "#0e7490", help: "Salário, comissão, ajudante, uniforme" },
  { value: "energia", label: "Energia / Luz", icon: "bolt", color: "#ca8a04", help: "Conta de luz" },
  { value: "internet_telefone", label: "Internet / Telefone", icon: "wifi", color: "#0284c7", help: "Internet, telefone fixo e celular" },
  { value: "transporte", label: "Transporte", icon: "local_shipping", color: "#15803d", help: "Frete, motoboy, combustível, Uber" },
  { value: "marketing", label: "Marketing", icon: "campaign", color: "#9333ea", help: "Tráfego pago, panfletos, anúncios, leads" },
  { value: "pacote_sistema", label: "Equipe Digital Maxi", icon: "auto_awesome", color: "#dc2626", help: "Mensalidade da Equipe Digital Maxi (dashboard + robô + tráfego + artes)" },
  { value: "impostos", label: "Impostos", icon: "receipt_long", color: "#475569", help: "DAS, INSS, ISS, NFS-e" },
  { value: "outros", label: "Outros gastos", icon: "more_horiz", color: "#4a3d3d", help: "Despesas que não se encaixam nas demais" },
];

// Pedido de ABERTURA (27/11/2026): investimento, fora do Sobrou no mês. Quem grava é o banco
// (purchase_orders.estoque_inicial → despesa com esta categoria); a franqueada não escolhe no formulário.
// Regra: supabase/2026-11-27-estoque-inicial.sql e docs/claude/sobrou-no-mes.md.
export const CATEGORIA_ESTOQUE_INICIAL = "estoque_inicial";
const META_ESTOQUE_INICIAL = {
  value: CATEGORIA_ESTOQUE_INICIAL,
  label: "Estoque inicial (investimento)",
  icon: "storefront",
  color: "#64748b",
  help: "Pedido de abertura da unidade, pago com o investimento inicial. Não entra no Sobrou do mês.",
};

export function ehEstoqueInicial(expense) {
  return expense?.category === CATEGORIA_ESTOQUE_INICIAL;
}

export const CATEGORY_BY_VALUE = Object.fromEntries(
  [...EXPENSE_CATEGORIES, META_ESTOQUE_INICIAL].map((c) => [c.value, c])
);

export function getCategoryMeta(value) {
  return CATEGORY_BY_VALUE[value] || CATEGORY_BY_VALUE.outros;
}
