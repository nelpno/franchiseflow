// Regras puras da lista de vendas (TabLancar), testadas em vendasLista.test.mjs (S12, 28/09/2026).
//
// - filtrarVendas: o MESMO filtro que a tela sempre usou (período, busca, recebimento).
// - resumoVendas: os totais saem da lista FILTRADA inteira, nunca da página visível —
//   a paginação de 50 em 50 (S12.5, pendência da S8.2) só corta o que se desenha.
// - rotuloRecebimento: "Recebido em dd/mm" pelo confirmed_at em Brasília (S12.1).

import { getSaleNetValue } from "./financialCalcs.js";

export const PAGINA_VENDAS = 50;

const FMT_DIA_MES = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});

const FMT_DATA_SP = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "yyyy-MM-dd" do instante em Brasília. */
export function dataEmBrasilia(instante = new Date()) {
  return FMT_DATA_SP.format(instante);
}

/** confirmed_at (timestamptz) → "dd/mm" em Brasília; null se não houver. */
export function formatRecebidoEm(confirmedAt) {
  if (!confirmedAt) return null;
  const d = new Date(confirmedAt);
  if (isNaN(d.getTime())) return null;
  return FMT_DIA_MES.format(d);
}

export function rotuloRecebimento(sale) {
  if (!sale?.payment_confirmed) return "A receber";
  const dia = formatRecebidoEm(sale.confirmed_at);
  return dia ? `Recebido em ${dia}` : "Recebido";
}

function dataDaVenda(s) {
  return s.sale_date || s.created_at?.substring(0, 10) || "";
}

/**
 * @param {Array} sales
 * @param {{period:string, monthStart?:string, monthEnd?:string, todayStr:string, weekStart:string,
 *          searchTerm?:string, confirmationFilter?:string, contactsMap?:object}} f
 */
export function filtrarVendas(sales, f) {
  const {
    period, monthStart, monthEnd, todayStr, weekStart,
    searchTerm = "", confirmationFilter = "all", contactsMap = {},
  } = f;
  const lower = searchTerm.toLowerCase();
  const termDigits = searchTerm.replace(/[^0-9]/g, "");
  return sales
    .filter((s) => {
      const saleDate = dataDaVenda(s);
      if (period === "today" && saleDate !== todayStr) return false;
      if (period === "week" && saleDate < weekStart) return false;
      if (period === "month" && (saleDate < monthStart || saleDate > monthEnd)) return false;

      if (searchTerm) {
        const contact = s.contact_id ? contactsMap[s.contact_id] : null;
        const contactName = (contact?.nome || "").toLowerCase();
        const customerName = (s.customer_name || "").toLowerCase();
        // Telefone: compara so digitos, para casar "11 99999-1234", "(11)99999", "999991234"
        const phoneDigits = (contact?.telefone || "").replace(/[^0-9]/g, "");
        const phoneHit = termDigits.length >= 3 && phoneDigits.includes(termDigits);
        if (!contactName.includes(lower) && !customerName.includes(lower) && !phoneHit) return false;
      }

      if (confirmationFilter === "pending" && s.payment_confirmed) return false;
      if (confirmationFilter === "confirmed" && !s.payment_confirmed) return false;
      return true;
    })
    .sort((a, b) => {
      const dateA = a.sale_date || a.created_at || "";
      const dateB = b.sale_date || b.created_at || "";
      return dateB.localeCompare(dateA);
    });
}

export function resumoVendas(list) {
  const pending = list.filter((s) => !s.payment_confirmed);
  const confirmed = list.filter((s) => s.payment_confirmed);
  const soma = (arr) => arr.reduce((sum, s) => sum + getSaleNetValue(s), 0);
  return {
    count: list.length,
    total: soma(list),
    pendingCount: pending.length,
    pendingTotal: soma(pending),
    confirmedCount: confirmed.length,
    confirmedTotal: soma(confirmed),
  };
}

/** Primeiras `visiveis` linhas (a tela mostra "Ver mais 50"). */
export function paginar(list, visiveis = PAGINA_VENDAS) {
  const n = Math.max(0, Math.floor(visiveis) || 0);
  return { pagina: list.slice(0, n), restantes: Math.max(0, list.length - n) };
}

/** Vendas "a receber" (todas as carregadas), as mais antigas primeiro. */
export function vendasAReceber(sales) {
  return sales
    .filter((s) => !s.payment_confirmed)
    .sort((a, b) => {
      const da = a.sale_date || a.created_at || "";
      const db = b.sale_date || b.created_at || "";
      if (da !== db) return da.localeCompare(db);
      return (a.created_at || "").localeCompare(b.created_at || "");
    });
}

/**
 * Agrupa a lista (já ordenada) por dia da venda: [{ dia, rotulo, vendas, total }].
 * rotulo: "Hoje", "Ontem" ou "dd/mm".
 */
export function agruparPorDia(list, todayStr, ontemStr) {
  const grupos = [];
  let atual = null;
  for (const s of list) {
    const dia = dataDaVenda(s);
    if (!atual || atual.dia !== dia) {
      const rotulo = dia === todayStr ? "Hoje" : dia === ontemStr ? "Ontem" : dia ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}` : "Sem data";
      atual = { dia, rotulo, vendas: [], total: 0 };
      grupos.push(atual);
    }
    atual.vendas.push(s);
    atual.total += getSaleNetValue(s);
  }
  return grupos;
}

/** Telefone para o WhatsApp da linha: o do contato, senão o gravado na venda. */
export function telefoneDaVenda(sale, contactsMap = {}) {
  const c = sale?.contact_id ? contactsMap[sale.contact_id] : null;
  return c?.telefone || sale?.contact_phone || null;
}

/**
 * Corta os grupos do dia para desenhar só `visiveis` vendas, mantendo no cabeçalho de cada
 * grupo a contagem e o total do DIA INTEIRO (não da parte que coube na página).
 */
export function gruposVisiveis(grupos, visiveis = PAGINA_VENDAS) {
  let resta = Math.max(0, Math.floor(visiveis) || 0);
  const out = [];
  for (const g of grupos) {
    if (resta <= 0) break;
    const vendas = g.vendas.slice(0, resta);
    resta -= vendas.length;
    out.push({ ...g, vendas, quantidade: g.vendas.length });
  }
  return out;
}

const FMT_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

/** Hora do lançamento (created_at) em Brasília, "HH:mm"; "" se não houver. */
export function horaEmBrasilia(instante) {
  if (!instante) return "";
  const d = new Date(instante);
  return isNaN(d.getTime()) ? "" : FMT_HORA.format(d);
}

/** "yyyy-MM-dd" → "dd/mm" (data da venda é DATE, sem fuso). */
export function diaMes(dataStr) {
  if (!dataStr || dataStr.length < 10) return "";
  return `${dataStr.slice(8, 10)}/${dataStr.slice(5, 7)}`;
}
