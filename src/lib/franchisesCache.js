import { Franchise } from "@/entities/all";

/**
 * Uma busca da lista de franquias por vez, para o app inteiro.
 *
 * O Layout carrega `Franchise.list()` e a página carrega de novo, no mesmo instante. Medido
 * em produção: DUAS requisições `franchises?select=*` em todo carregamento de página, de
 * 32.447 bytes cada — 64.894 bytes para a mesma lista de 67 unidades, que muda uma vez por
 * mês. São 13% de tudo que o boot baixa, gastos duas vezes.
 *
 * Aqui as chamadas concorrentes compartilham a MESMA promessa e o resultado vale por 60 s.
 * Quem chama continua recebendo um array e um `await` — nenhum fluxo de tela muda.
 *
 * Por que não react-query (que é o que a auditoria sugeria): o provider já existe, mas
 * migrar os 13 pontos de chamada significa reescrever o `Promise.allSettled` e os estados
 * de loading de 8 páginas. Isto resolve a duplicação medida com uma linha por ponto de
 * chamada. A migração para react-query continua valendo, e fica mais fácil com um ponto
 * de entrada só.
 *
 * Cada chamador recebe uma CÓPIA do array — várias telas ordenam a lista no lugar, e
 * devolver a mesma referência faria uma tela embaralhar a lista da outra.
 */

const TTL_MS = 60000;

let cache = null;
let carregadoEm = 0;
let emVoo = null;

export function listarFranquias({ force = false } = {}) {
  if (!force && cache && Date.now() - carregadoEm < TTL_MS) {
    return Promise.resolve([...cache]);
  }
  if (emVoo) return emVoo.then((linhas) => [...linhas]);
  emVoo = Franchise.list()
    .then((linhas) => {
      cache = linhas;
      carregadoEm = Date.now();
      return linhas;
    })
    .finally(() => {
      emVoo = null;
    });
  return emVoo.then((linhas) => [...linhas]);
}

/** Chamar depois de criar, editar ou excluir franquia. */
export function invalidarFranquias() {
  cache = null;
  carregadoEm = 0;
}
