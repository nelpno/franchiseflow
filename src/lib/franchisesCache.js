import { Franchise } from "@/entities/all";
import { queryClientInstance } from "@/lib/query-client";

/**
 * Uma busca da lista de franquias por vez, para o app inteiro.
 *
 * O Layout carrega `Franchise.list()` e a página carrega de novo, no mesmo instante. Medido
 * em produção: DUAS requisições `franchises?select=*` em todo carregamento de página, de
 * 32.447 bytes cada — 64.894 bytes para a mesma lista de 67 unidades, que muda uma vez por
 * mês. São 13% de tudo que o boot baixa, gastos duas vezes.
 *
 * A onda 4 resolveu isso com um cache escrito à mão (promessa em voo + TTL). Agora quem
 * guarda é o react-query, que já era o cache do app (`useSubscriptionStatus`,
 * `PageNotFound`) e cujo cliente é um singleton de módulo — dá para chamar `fetchQuery`
 * fora de React. `fetchQuery` já faz as duas coisas que o código à mão fazia: chamadas
 * concorrentes compartilham a MESMA busca, e o resultado vale enquanto estiver fresco.
 *
 * O ganho de trocar não é performance (o cache à mão media igual): é ter UM cache no app
 * em vez de dois, e é a chave `["franquias"]` passar a existir — um componente novo pode
 * fazer `useQuery({queryKey: ["franquias"]})` e reaproveitar a mesma lista, com estados de
 * loading e erro de graça, sem nenhum dos 13 pontos de chamada mudar.
 *
 * A assinatura NÃO mudou: quem chama continua recebendo uma promessa de array.
 *
 * Cada chamador recebe uma CÓPIA do array — várias telas ordenam a lista no lugar, e
 * devolver a mesma referência (que aqui é a que vive DENTRO do cache) faria uma tela
 * embaralhar a lista da outra e, pior, corromper o que está guardado.
 */

export const CHAVE_FRANQUIAS = ["franquias"];
const TTL_MS = 60000;

export async function listarFranquias({ force = false } = {}) {
  if (force) queryClientInstance.removeQueries({ queryKey: CHAVE_FRANQUIAS });
  const linhas = await queryClientInstance.fetchQuery({
    queryKey: CHAVE_FRANQUIAS,
    queryFn: () => Franchise.list(),
    staleTime: TTL_MS,
    gcTime: TTL_MS * 5,
  });
  return [...(linhas || [])];
}

/** Chamar depois de criar, editar ou excluir franquia. */
export function invalidarFranquias() {
  queryClientInstance.invalidateQueries({ queryKey: CHAVE_FRANQUIAS });
}
