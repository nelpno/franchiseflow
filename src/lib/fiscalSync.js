/**
 * Trocar o CPF/CNPJ de uma franquia significa DUAS coisas opostas — e nada no sistema
 * distingue as duas sozinho. Por isso o painel pergunta em vez de adivinhar.
 *
 *   a mesma empresa virou PJ  -> ATUALIZAR o cliente no ASAAS (assinatura intacta)
 *   a franquia trocou de dono -> CRIAR cliente novo, senão a cobrança e a NFe saem no
 *                                nome do dono anterior (foi o conserto do caso Araras)
 *
 * `registerCustomer` na edge sempre fez o segundo: busca por cpfCnpj e, não achando,
 * cria. Então salvar um CNPJ novo e clicar "Criar" produzia um cliente DUPLICADO, com a
 * assinatura ativa pendurada no cliente antigo.
 *
 * Medido em 09/09/2026: Bragança e Cajamar estavam com CNPJ no painel e CPF no ASAAS
 * havia semanas — cobrança correta, NFe no documento errado. Salvar nunca propagou.
 */

export function apenasDigitos(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

/**
 * O painel precisa parar e perguntar depois deste salvamento?
 * Só quando o documento MUDOU e já existe cliente no ASAAS para ficar desatualizado.
 * Sem cliente ainda, o "Criar" de Mensalidades já nasce com o documento certo.
 */
export function precisaSincronizarDocumento({ docAntigo, docNovo, temClienteAsaas }) {
  if (!temClienteAsaas) return false;
  const antigo = apenasDigitos(docAntigo);
  const novo = apenasDigitos(docNovo);
  if (!novo) return false;
  if (!antigo) return false; // nunca teve documento: não há o que "trocar"
  return antigo !== novo;
}

/** "CPF 063.982.918-08" / "CNPJ 20.101.159/0001-00" — o número inteiro, para conferência. */
export function formatarDocumento(valor) {
  const d = apenasDigitos(valor);
  if (d.length === 11) return `CPF ${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) {
    return `CNPJ ${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return d || "(vazio)";
}

/**
 * Como a troca deve ser lida por quem vai decidir. Serve para o texto do diálogo:
 * CPF -> CNPJ com o mesmo dono é o caso comum de virar PJ, e é o que mais engana.
 */
export function descreverTrocaDocumento(docAntigo, docNovo) {
  const antigo = apenasDigitos(docAntigo);
  const novo = apenasDigitos(docNovo);
  const viraPj = antigo.length === 11 && novo.length === 14;
  const viraPf = antigo.length === 14 && novo.length === 11;
  return {
    antigo: formatarDocumento(antigo),
    novo: formatarDocumento(novo),
    viraPj,
    viraPf,
    resumo: viraPj
      ? "de pessoa física para empresa"
      : viraPf
        ? "de empresa para pessoa física"
        : "documento diferente",
  };
}
