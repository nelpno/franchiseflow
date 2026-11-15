/**
 * Validação de CPF/CNPJ pelos dígitos verificadores.
 *
 * Por que existe: até 19/08/2026 o cadastro só conferia a QUANTIDADE de dígitos.
 * A Americana entrou com "42.259.662/0001-19" (o CNPJ da mesma dona é 45.259.662/0001-19 —
 * um dígito trocado), o ASAAS recusou com "O CPF/CNPJ informado é inválido", a assinatura
 * nunca foi criada e o painel mostrava sucesso. Doc com dígito errado passa em qualquer
 * checagem de tamanho; só o DV pega.
 */

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function isValidCpf(digits) {
  if (/^(\d)\1{10}$/.test(digits)) return false; // 00000000000, 11111111111...
  const base = digits.slice(0, 9).split("").map(Number);
  let sum = base.reduce((acc, d, i) => acc + d * (10 - i), 0);
  const d1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  const base2 = [...base, d1];
  sum = base2.reduce((acc, d, i) => acc + d * (11 - i), 0);
  const d2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return `${d1}${d2}` === digits.slice(9);
}

function isValidCnpj(digits) {
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const base = digits.slice(0, 12).split("").map(Number);
  let sum = base.reduce((acc, d, i) => acc + d * W1[i], 0);
  const d1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  const base2 = [...base, d1];
  sum = base2.reduce((acc, d, i) => acc + d * W2[i], 0);
  const d2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return `${d1}${d2}` === digits.slice(12);
}

/** true só quando o documento tem 11/14 dígitos E os verificadores fecham. */
export function isValidCpfCnpj(value) {
  const digits = onlyDigits(value);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

/**
 * Mensagem PT-BR do problema, ou null se o documento está bom.
 * Usado no cadastro de franquia e na edição inline do painel de mensalidades —
 * os dois caminhos que alimentam o cliente ASAAS.
 */
export function cpfCnpjError(value) {
  const digits = onlyDigits(value);
  if (!digits) return "CPF/CNPJ não preenchido.";
  if (digits.length !== 11 && digits.length !== 14) {
    return "CPF/CNPJ incompleto. Digite todos os dígitos — CPF tem 11, CNPJ tem 14.";
  }
  if (!isValidCpfCnpj(digits)) {
    const tipo = digits.length === 11 ? "CPF" : "CNPJ";
    return `${tipo} inválido: confira os dígitos. Com o documento errado o ASAAS recusa o cadastro e a mensalidade não é criada.`;
  }
  return null;
}
