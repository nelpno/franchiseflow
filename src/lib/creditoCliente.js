// Crédito do cliente (23/11/2026, pedido do Ricardo/Tatuapé). Desenho: docs/arquitetura-beneficios.md (raiz da Maxi)
// § "Crédito do cliente". Regras puras, sem tela (testes: node src/lib/creditoCliente.test.mjs).
//
// O banco é a fonte: cliente_creditos guarda só as ENTRADAS; o uso é sales.credito_usado (DENTRO do discount_amount).
// Saldo = entradas − créditos usados nas vendas (view cliente_credito_saldos). A trava (gatilho sales_credito_trava)
// recusa uso acima do saldo; aqui só a prévia da tela.

export const MOTIVOS_CREDITO = [
  { id: "troco", rotulo: "Troco que ficou" },
  { id: "pagou_a_mais", rotulo: "Pagou a mais" },
  { id: "faltou_produto", rotulo: "Faltou produto" },
  { id: "permuta", rotulo: "Permuta" },
  { id: "outro", rotulo: "Outro" },
];

export const CREDITO_MAXIMO = 1000; // mesmo teto da tabela (valor <= 1000): pega R$ 2000 digitado no lugar de 20

export function rotuloMotivoCredito(id) {
  return MOTIVOS_CREDITO.find((m) => m.id === id)?.rotulo || "Crédito";
}

const centavos = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Saldo que ESTA venda pode usar: o saldo do cliente + o que a própria venda já usava (na edição, o crédito dela
// já saiu do saldo). Só vale se o cliente da venda é o mesmo; trocou de cliente = o da venda antiga não conta.
export function creditoDisponivelNaVenda({ saldo, creditoDaVenda = 0, mesmoCliente = true }) {
  const base = centavos(saldo) + (mesmoCliente ? centavos(creditoDaVenda) : 0);
  return Math.max(0, centavos(base));
}

// Quanto do crédito entra: o que couber nos PRODUTOS depois do outro desconto (nunca no frete).
export function creditoAplicado({ disponivel, subtotal, outroDesconto = 0 }) {
  const espaco = Math.max(0, centavos(subtotal) - centavos(outroDesconto));
  return Math.max(0, Math.min(centavos(disponivel), centavos(espaco)));
}

// Motivo gravado na venda: só crédito = "credito"; crédito + outro desconto = o motivo do outro (o crédito
// continua separado em credito_usado). Sem desconto nenhum = null.
export function origemDoDesconto({ descontoManual, creditoUsado, motivoManual }) {
  if (centavos(descontoManual) > 0) return motivoManual && motivoManual !== "credito" ? motivoManual : null;
  if (centavos(creditoUsado) > 0) return "credito";
  return null;
}

// Erro do formulário "Dar crédito" (null = pode salvar).
export function erroNovoCredito({ valor, motivo }) {
  const v = Number(valor);
  if (!Number.isFinite(v) || v <= 0) return "Digite o valor do crédito.";
  if (v > CREDITO_MAXIMO) return `O crédito vai até ${CREDITO_MAXIMO.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Confira o valor.`;
  if (Math.abs(Math.round(v * 100) - v * 100) > 1e-6) return "Use no máximo dois números depois da vírgula.";
  if (!MOTIVOS_CREDITO.some((m) => m.id === motivo)) return "Escolha o motivo do crédito.";
  return null;
}

// { contact_id: saldo } a partir das linhas da view (só saldo > 0 entra).
export function mapaDeSaldos(linhas) {
  const m = {};
  for (const l of linhas || []) {
    const s = centavos(l?.saldo);
    if (l?.contact_id && s > 0) m[l.contact_id] = s;
  }
  return m;
}
