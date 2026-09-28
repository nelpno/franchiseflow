import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

// S8.2 (28/09/2026): janela de busca do TabResultado — antes buscava TODO o histórico da
// franquia (fetchAll sem data) só pra mostrar 1 mês + evolução de 6 meses + acumulado do ano.
// A janela de JANELA_MESES meses pra trás do mês em tela cobre com folga:
//   - evolucaoData: 6 meses pra trás do mês selecionado;
//   - anoResumo: janeiro até o mês selecionado, no MESMO ano (até 11 meses pra trás em dezembro);
//   - mediaMensalReceita e prevMonth*: 6 meses / 1 mês pra trás.
// 13 é o maior desses (11, com folga) + 2 de margem.
export const JANELA_MESES = 13;

/** Janela [start,end] em 'yyyy-MM-dd' que cobre tudo que a tela precisa pra `targetMonth`. */
export function janelaResultado(targetMonth, mesesJanela = JANELA_MESES) {
  return {
    start: format(startOfMonth(subMonths(targetMonth, mesesJanela)), "yyyy-MM-dd"),
    end: format(endOfMonth(targetMonth), "yyyy-MM-dd"),
  };
}

/** A janela já carregada (`loadedRange`) cobre tudo que `targetMonth` precisaria buscar de novo? */
export function janelaCobre(loadedRange, targetMonth, mesesJanela = JANELA_MESES) {
  if (!loadedRange) return false;
  const { start, end } = janelaResultado(targetMonth, mesesJanela);
  return start >= loadedRange.start && end <= loadedRange.end;
}

// Janela é de largura FIXA (13 meses): andar 1 mês pra frente ou pra trás desloca as duas
// pontas, então uma janela "just enough" nunca cobre o mês vizinho — recarregava a cada clique
// de navegação, o que troca "nunca mais busca" (antes) por "busca toda hora" (pior).
// Em vez de buscar só o necessário, busca a UNIÃO com o que já está carregado: a janela nunca
// encolhe, só cresce conforme a franqueada navega, e depois de explorar uma faixa a navegação
// dentro dela fica sem busca nenhuma — igual ao comportamento de antes, mas partindo de um
// carregamento inicial pequeno em vez do histórico inteiro.
export function janelaParaBuscar(loadedRange, targetMonth, mesesJanela = JANELA_MESES) {
  const necessaria = janelaResultado(targetMonth, mesesJanela);
  if (!loadedRange) return necessaria;
  return {
    start: necessaria.start < loadedRange.start ? necessaria.start : loadedRange.start,
    end: necessaria.end > loadedRange.end ? necessaria.end : loadedRange.end,
  };
}
