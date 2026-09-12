/**
 * Converte erros Supabase/PostgREST em mensagens seguras para o usuário.
 * NUNCA expõe error.details, nomes de tabela, colunas ou SQL.
 */

const CODE_MAP = {
  "23505": "Este registro já existe.",
  "23503": "Este registro está vinculado a outros dados e não pode ser alterado.",
  "42501": "Sem permissão para esta ação.",
  "42P01": "Erro interno de configuração. Contate o suporte.",
  PGRST301: "Sessão expirada. Faça login novamente.",
  PGRST204: "Nenhum registro encontrado.",
};

/**
 * Mensagens de REGRA DE NEGOCIO que os nossos triggers escrevem PARA a franqueada
 * ler — nao carregam nome de tabela, coluna nem SQL. Sao devolvidas inteiras.
 *
 * Um `23514` que nao case com nenhum prefixo daqui e uma CHECK constraint qualquer
 * do Postgres ('violates check constraint "sales_value_check"') e continua caindo
 * no fallback generico.
 *
 * O caso que criou a lista: 08/09/2026, a franqueada do Guaruja lancando venda com
 * a data da entrega. O trigger `sales_bloqueia_data_futura` explicava o motivo e a
 * tela mostrava "Erro inesperado. Tente novamente."
 */
const PREFIXOS_SEGUROS = ["A data da venda", "Frete:", "Sem permissão para alterar esta unidade"];

const MESSAGE_MAP = [
  { match: "Invalid login credentials", msg: "Email ou senha incorretos." },
  { match: "Email not confirmed", msg: "Confirme seu email antes de fazer login." },
  { match: "User already registered", msg: "Este email já está cadastrado." },
  { match: "JWT expired", msg: "Sessão expirada. Faça login novamente." },
  { match: "Tempo limite", msg: "Tempo limite excedido. Verifique sua conexão e tente novamente." },
  { match: "Failed to fetch", msg: "Erro de conexão. Verifique sua internet." },
  { match: "NetworkError", msg: "Erro de conexão. Verifique sua internet." },
  { match: "rate limit", msg: "Muitas tentativas. Aguarde um momento." },
];

export function safeErrorMessage(error, fallback) {
  if (!error) return fallback || "Erro inesperado. Tente novamente ou contate o suporte.";

  // Check Supabase error code
  const code = error?.code;
  if (code && CODE_MAP[code]) return CODE_MAP[code];

  // Check known message patterns
  const raw = error?.message || String(error);

  // Regra de negocio escrita para a pessoa ler (ver PREFIXOS_SEGUROS)
  if (PREFIXOS_SEGUROS.some((p) => raw.startsWith(p))) return raw;
  for (const { match, msg } of MESSAGE_MAP) {
    if (raw.includes(match)) return msg;
  }

  return fallback || "Erro inesperado. Tente novamente ou contate o suporte.";
}

/**
 * O erro veio de uma REGRA (data, permissão, duplicidade) e não de falha técnica?
 * Se sim, retentar é inútil: o resultado será o mesmo em 2s, em 4s e em 4 minutos.
 *
 * Nasceu de um caso medido: em 06/09/2026 a franqueada de Cajamar clicou 8 vezes em
 * "Registrar" numa venda datada de amanhã e o `withRetry` do SaleForm transformou
 * isso em 24 POSTs — todos recusados pelo mesmo trigger, cada rodada com dois
 * "Tentando novamente em 2s..." na cara dela.
 *
 * Classes do Postgres que são decisão do banco, não infraestrutura:
 *   23xxx integridade (23514 check, 23505 unique, 23503 FK)
 *   42501 permissão negada (RLS)
 *   P0001 raise exception de função nossa
 */
export function ehErroDeRegra(error) {
  const code = error?.code;
  if (!code) return false;
  return code.startsWith("23") || code === "42501" || code === "P0001";
}

/**
 * Gera lista legível de queries que falharam sem expor nomes internos.
 */
export function safeFailedQueriesMessage(failedQueries) {
  if (!failedQueries || failedQueries.length === 0) return null;
  return `Alguns dados não carregaram (${failedQueries.length} fonte${failedQueries.length > 1 ? "s" : ""}). Tente atualizar a página.`;
}
