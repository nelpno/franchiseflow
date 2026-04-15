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
  for (const { match, msg } of MESSAGE_MAP) {
    if (raw.includes(match)) return msg;
  }

  return fallback || "Erro inesperado. Tente novamente ou contate o suporte.";
}

/**
 * Gera lista legível de queries que falharam sem expor nomes internos.
 */
export function safeFailedQueriesMessage(failedQueries) {
  if (!failedQueries || failedQueries.length === 0) return null;
  return `Alguns dados não carregaram (${failedQueries.length} fonte${failedQueries.length > 1 ? "s" : ""}). Tente atualizar a página.`;
}
