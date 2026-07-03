/**
 * Conjuntos de colunas (PostgREST `select`) compartilhados entre telas.
 *
 * Objetivo: evitar que um edit de `columns:` deixe cair silenciosamente uma
 * coluna que o cálculo consome (o PostgREST simplesmente omite o campo → o
 * cálculo usa `undefined`, sem erro visível — foi assim que o DRE já contou
 * taxa repassada como custo). Centralizar o conjunto crítico trava o invariante.
 */

/**
 * Campos que TODA tela que chama `calculatePnL` DEVE selecionar.
 * `card_fee_amount` + `fee_passed_to_customer` são obrigatórios: sem eles o DRE
 * subtrai a taxa de cartão repassada ao cliente (subestima o lucro).
 * Compõe o `columns:` das telas de DRE (Financeiro admin + Gestão › Resultado).
 */
export const SALE_PNL_COLUMNS =
  "value, delivery_fee, discount_amount, card_fee_amount, fee_passed_to_customer";

/**
 * Campos mínimos para faturamento por venda (`getSaleNetValue`): telas que só
 * somam receita (dashboards, gráficos, ranking) e NÃO calculam DRE.
 */
export const SALE_REVENUE_COLUMNS = "value, delivery_fee, discount_amount";
