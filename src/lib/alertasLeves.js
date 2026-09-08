import { differenceInDays, parseISO, format } from "date-fns";
// caminho relativo de proposito: os testes rodam em node puro, onde o alias @/ nao existe
import { getFranchiseDisplayName } from "./franchiseUtils.js";

/**
 * Os dois alertas que NAO custam busca nenhuma.
 *
 * O AlertsPanel do Painel Geral vive dentro de uma secao colapsada no fim da pagina, e
 * expandir dispara a busca dos 31 mil contatos + estoque + pedidos. Mas "sem vender" sai
 * de `allSales` e "robo parado" sai de `botSummary` — os dois JA estao em memoria desde a
 * primeira onda de carregamento. Medido em 08/09/2026: 8 unidades sem vender ha 7+ dias,
 * 10 ha 3 a 6 dias e 8 com o robo calado ha 7+ dias, tudo invisivel sem expandir.
 *
 * A regra vive aqui, e nao copiada em dois lugares: o AlertsPanel e a faixa do topo
 * chamam as mesmas funcoes. Testes: node src/lib/alertasLeves.test.mjs
 */

export const DIAS_SEM_VENDA_CRITICO = 7;
export const DIAS_SEM_VENDA_ATENCAO = 3;
export const DIAS_ROBO_PARADO = 7;

/**
 * Unidades que ja venderam alguma vez na janela e pararam.
 * Quem nunca vendeu NAO entra: pode ser implantacao, e nao "parou de vender".
 */
export function unidadesSemVender({ franchises = [], configMap = {}, allSales = [], agora = new Date() }) {
  const ultimaVenda = new Map();
  for (const s of allSales) {
    const atual = ultimaVenda.get(s.franchise_id);
    if (!atual || s.sale_date > atual) ultimaVenda.set(s.franchise_id, s.sale_date);
  }

  const criticas = [];
  const atencao = [];
  for (const f of franchises) {
    const evoId = f.evolution_instance_id;
    const ultima = ultimaVenda.get(evoId);
    if (!ultima) continue;
    // parseISO trata como hora local — evita o off-by-1 de UTC-3
    const dias = differenceInDays(agora, parseISO(ultima));
    const item = { evoId, name: getFranchiseDisplayName(f, configMap[evoId]), days: dias };
    if (dias >= DIAS_SEM_VENDA_CRITICO) criticas.push(item);
    else if (dias >= DIAS_SEM_VENDA_ATENCAO) atencao.push(item);
  }
  criticas.sort((a, b) => b.days - a.days);
  atencao.sort((a, b) => b.days - a.days);
  return { criticas, atencao };
}

/**
 * Unidades que tiveram robo na janela e nao tem conversa nenhuma nos ultimos 7 dias.
 * Quem nunca teve conversa nenhuma fica de fora: e "nao tem robo", nao "robo parou".
 */
export function unidadesComRoboParado({ franchises = [], configMap = {}, botSummary = [], agora = new Date() }) {
  const corte = format(new Date(agora.getTime() - DIAS_ROBO_PARADO * 86400000), "yyyy-MM-dd");

  const total = new Map();
  const recente = new Map();
  for (const s of botSummary) {
    const n = Number(s.total || 0);
    total.set(s.franchise_id, (total.get(s.franchise_id) || 0) + n);
    if (String(s.day) >= corte) recente.set(s.franchise_id, (recente.get(s.franchise_id) || 0) + n);
  }

  const paradas = [];
  for (const f of franchises) {
    const evoId = f.evolution_instance_id;
    const teveAlgumDia = (total.get(evoId) || 0) > 0 || total.has(evoId);
    if (!teveAlgumDia) continue;
    if ((recente.get(evoId) || 0) > 0) continue;
    paradas.push({ evoId, name: getFranchiseDisplayName(f, configMap[evoId]) });
  }
  return paradas;
}
