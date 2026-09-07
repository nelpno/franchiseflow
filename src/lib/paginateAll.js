/**
 * Paginação além do limite de 1000 linhas do Supabase (max_rows).
 *
 * Lotes especulativos que CRESCEM: 1 página extra, depois 2, 4, até PAGE_CONCURRENCY.
 * Antes o primeiro lote já disparava 6 páginas de uma vez, e o caso mais comum do app é
 * justo o que isso pune: 1.079 vendas custavam SETE requisições — a página 0 vem cheia,
 * dispara 6, a página 1 traz 79 linhas e as outras cinco voltam vazias. Medido em
 * produção na tela Gestão > Resultado: 42 requisições ao PostgREST, sendo 7 de `sales` e
 * 22 de `sale_items`. Crescendo o lote, esse mesmo caso custa DUAS, e a tela realmente
 * grande (admin, ~209 mil conversas) continua paralelizando: 1+1+2+4+6+6…
 *
 * O tie-breaker por `id` no ORDER BY (aplicado por quem chama) é o que garante ordem
 * determinística entre páginas — sem duplicar nem omitir linhas. É a invariante do fix
 * 5333224, quando 63 vendas apareciam em duas páginas e outras 63 em nenhuma.
 *
 * Testes: node src/lib/paginateAll.test.mjs
 */

export const PAGE_SIZE = 1000;
export const PAGE_CONCURRENCY = 6;

/**
 * @param {(from:number,to:number)=>Promise<Array>} buscarPagina  devolve as linhas do range
 * @param {{pageSize?:number, concurrency?:number}} [opcoes]
 */
export async function paginateAll(buscarPagina, { pageSize = PAGE_SIZE, concurrency = PAGE_CONCURRENCY } = {}) {
  const pagina = (indice) => buscarPagina(indice * pageSize, indice * pageSize + pageSize - 1);

  // 1ª página sozinha: se vier curta, acabou aqui (caminho das telas pequenas)
  const primeira = await pagina(0);
  if (primeira.length < pageSize) return primeira;

  let todas = primeira;
  let base = 1;
  let lote = 1; // 1 -> 2 -> 4 -> 6: não paga 5 requisições vazias no caso comum
  for (;;) {
    const paginas = await Promise.all(Array.from({ length: lote }, (_, i) => pagina(base + i)));
    for (const p of paginas) todas = todas.concat(p);
    if (paginas.some((p) => p.length < pageSize)) break; // chegou ao fim
    base += lote;
    lote = Math.min(lote * 2, concurrency);
  }
  return todas;
}
