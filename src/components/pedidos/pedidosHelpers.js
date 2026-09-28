// Regras puras da tela Pedidos (admin) — Fase 3 do redesenho.
// Sem "Em rota" no fluxo (decisão Nelson 26/09: 0 pedidos nesse status, motorista sai de
// madrugada). O fluxo é pendente -> confirmado -> entregue. "em_rota"/"cancelado" seguem
// existindo no banco (cancelamento continua possível) mas não aparecem nas 3 seções.
import { differenceInCalendarDays, parseISO } from "date-fns";

export const CAPACIDADE_CAMINHAO_KG = 1500;

// Colunas enxutas — a tela nunca lia a linha inteira (achado carga.md: select * + sem
// teto). Cobre tudo que ParaConfirmarSection/ParaEntregarSection/EntreguesSection/
// OrderDetailDialog usam. `confirmed_at` veio com supabase/2026-09-26-admin-14-purchase-orders-
// confirmed-at.sql (aplicada 26/09); pode ser null em pedido antigo sem backfill.
export const COLUNAS_PEDIDO =
  "id, franchise_id, status, ordered_at, delivered_at, estimated_delivery, total_amount, total_weight_kg, freight_cost, notes, confirmed_at, delivery_notice_status, delivery_notified_at, delivery_notice_error";

export const STATUS_LABEL = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  em_rota: "Em Rota",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

// Pedido some das seções ativas (1/2) quando sai de pendente/confirmado.
export function isAcionavel(order) {
  return order?.status === "pendente" || order?.status === "confirmado";
}

// "yyyy-MM-dd" em BRT de um timestamp qualquer (ISO ou Date) — NUNCA `.substring(0,10)`
// (isso é a data em UTC do timestamptz). Entre 21h e 24h BRT o UTC já virou o dia seguinte:
// um `confirmed_at`/`ordered_at` gravado às 22h BRT tirado por substring aparenta ser do dia
// seguinte, o que ENCURTA a espera calculada em 1 dia (achado 26/09: pedido com 5 dias reais
// de atraso contava 4 e não ficava vermelho). Ver `dataBRT()` (mesmo padrão) mais abaixo.
function paraDataBRT(ref) {
  return new Date(ref).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// Dias desde o pedido, contados em dias-calendário de BRT (não UTC).
export function diasDesdePedido(order) {
  if (!order?.ordered_at) return null;
  try {
    return differenceInCalendarDays(parseISO(dataBRT()), parseISO(paraDataBRT(order.ordered_at)));
  } catch {
    return null;
  }
}

export function haNDiasLabel(order) {
  const dias = diasDesdePedido(order);
  if (dias === null) return "";
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}

// Dias desde a CONFIRMAÇÃO (confirmed_at). Pedido confirmado ontem não pode nascer vermelho
// pelo dia em que foi pedido — mas pedido antigo, de antes da coluna existir (sem backfill
// ainda aplicado), cai no fallback de ordered_at (mesmo comportamento de antes).
export function diasDesdeConfirmacao(order) {
  const ref = order?.confirmed_at || order?.ordered_at;
  if (!ref) return null;
  try {
    return differenceInCalendarDays(parseISO(dataBRT()), parseISO(paraDataBRT(ref)));
  } catch {
    return null;
  }
}

// Limiares de atraso (26/09): confirmado > 5 dias (perto da mediana pedido→entrega, 4,9
// dias) e pendente > 3 dias (Hortolândia esperava 4 dias e não aparecia em vermelho).
export const LIMIAR_ATRASO_PENDENTE_DIAS = 3;
export const LIMIAR_ATRASO_CONFIRMADO_DIAS = 5;

export function isAtrasado(order) {
  if (!isAcionavel(order)) return false;
  if (order?.status === "confirmado") {
    const dias = diasDesdeConfirmacao(order);
    return dias !== null && dias > LIMIAR_ATRASO_CONFIRMADO_DIAS;
  }
  const dias = diasDesdePedido(order);
  return dias !== null && dias > LIMIAR_ATRASO_PENDENTE_DIAS;
}

// 2ª linha da unidade na lista: confirmado com `confirmed_at` conta a partir daí (e mostra a
// data do pedido como apoio); os outros casos (pendente, ou confirmado sem backfill ainda)
// mantêm "pedido há N dias".
export function linhaEsperaLabel(order) {
  if (order?.status === "confirmado" && order?.confirmed_at) {
    const dias = diasDesdeConfirmacao(order);
    const rotulo = dias === null ? "confirmado" : dias <= 0 ? "confirmado hoje" : dias === 1 ? "confirmado há 1 dia" : `confirmado há ${dias} dias`;
    const pedidoEm = order.ordered_at ? ` · pedido em ${new Date(order.ordered_at).toLocaleDateString("pt-BR")}` : "";
    return `${rotulo}${pedidoEm}`;
  }
  const pedidoEm = order?.ordered_at ? ` · ${new Date(order.ordered_at).toLocaleDateString("pt-BR")}` : "";
  return `pedido ${haNDiasLabel(order)}${pedidoEm}`;
}

// Frete zero é legítimo (acréscimo já embutido no total ou retirada pela própria
// unidade) — nunca tratar como pedido incompleto/erro. CLAUDE.md: "Frete zero no pedido
// à fábrica = acréscimo ou retirada, não erro".
export function freteLabel(order) {
  const v = parseFloat(order?.freight_cost);
  if (!(v > 0)) return null;
  return v;
}

export function formatKg(value) {
  const v = Number(value) || 0;
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;
}

// "1 caminhão de 1.500 kg" / "2 caminhões de 1.500 kg"
export function caminhoesLabel(totalKg) {
  const kg = Number(totalKg) || 0;
  if (kg <= 0) return null;
  const n = Math.ceil(kg / CAPACIDADE_CAMINHAO_KG);
  const cap = CAPACIDADE_CAMINHAO_KG.toLocaleString("pt-BR");
  return `${n} ${n === 1 ? "caminhão" : "caminhões"} de ${cap} kg`;
}

export function somaPedidos(orders) {
  return orders.reduce(
    (acc, o) => {
      acc.total += parseFloat(o.total_amount) || 0;
      acc.kg += parseFloat(o.total_weight_kg) || 0;
      return acc;
    },
    { total: 0, kg: 0 }
  );
}

// Ordena "mais antigo primeiro" — quem espera há mais tempo aparece no topo, tanto em
// "Para confirmar" quanto em "Para separar e entregar".
export function ordenarPorEsperaAsc(orders) {
  return [...orders].sort((a, b) => new Date(a.ordered_at || 0) - new Date(b.ordered_at || 0));
}

export function filtrarPorTermo(orders, termo, getFranchiseName) {
  const t = (termo || "").trim().toLowerCase();
  if (!t) return orders;
  return orders.filter((o) => getFranchiseName(o.franchise_id).toLowerCase().includes(t));
}

export function isDeletable(order) {
  return order?.status === "pendente" || order?.status === "cancelado";
}

// --- Frete na lista (fluxo em lote, 26/09) ---
//
// Regra das franquias desde 30/08/2026: min(350, max(250, 10% do pedido)). A sugestão é
// arredondada para a dezena de reais, que é como o frete vem sendo digitado (R$ 300 para
// um pedido de R$ 3.001; R$ 270 para R$ 2.702). É SÓ sugestão: frete zero é legítimo
// (acréscimo de outro pedido ou retirada) e o valor combinado por distância existe (R$ 400,
// R$ 450). Nunca sobrescreve o que já foi digitado.
export const FRETE_MIN = 250;
export const FRETE_MAX = 350;
export const FRETE_PCT = 0.1;

export function freteSugerido(totalAmount) {
  const total = parseFloat(totalAmount) || 0;
  const bruto = Math.min(FRETE_MAX, Math.max(FRETE_MIN, FRETE_PCT * total));
  return Math.round(bruto / 10) * 10;
}

// --- Acréscimo (mesma unidade já tem outro pedido em aberto) ---
//
// Mapa franchise_id -> pedido aberto (pendente/confirmado) mais antigo da unidade. Achado
// 26/09: 9 de 11 pedidos feitos com outro pedido já pendente/confirmado da mesma unidade
// foram entregues com frete 0 (o frete já foi/vai ser cobrado no pedido-base). Recebe a
// lista de pedidos já carregada pela tela (só pendente+confirmado).
export function pedidoAbertoMaisAntigoPorUnidade(orders) {
  const map = new Map();
  (orders || []).forEach((o) => {
    if (o.status !== "pendente" && o.status !== "confirmado") return;
    const atual = map.get(o.franchise_id);
    if (!atual || new Date(o.ordered_at || 0) < new Date(atual.ordered_at || 0)) {
      map.set(o.franchise_id, o);
    }
  });
  return map;
}

// true quando ESTE pedido não é o mais antigo em aberto da própria unidade — ou seja, é um
// acréscimo lançado em cima de um pedido que já está pendente/confirmado.
export function ehAcrescimo(order, maisAntigoPorUnidade) {
  const base = maisAntigoPorUnidade?.get(order?.franchise_id);
  return !!base && base.id !== order?.id;
}

// Texto digitado -> número. "" = sem frete (0). "R$ 1.250,50" / "250,5" / "250.5" aceitos.
// Devolve NaN para texto que não é valor (quem chama avisa e não salva).
export function parseFrete(texto) {
  if (texto === null || texto === undefined) return 0;
  const s = String(texto).replace(/r\$|\s/gi, "");
  if (s === "") return 0;
  if (!/^[\d.,]+$/.test(s)) return NaN;
  // Com vírgula: ponto é milhar ("1.250,50"). Sem vírgula: ponto é decimal ("250.5").
  const normal = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if ((normal.match(/\./g) || []).length > 1) return NaN;
  const v = parseFloat(normal);
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : NaN;
}

// Valor salvo no banco, ou null quando ninguém nunca definiu (freight_cost null).
export function freteSalvo(order) {
  const raw = order?.freight_cost;
  if (raw === null || raw === undefined || raw === "") return null;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : null;
}

// "250" / "250,50" — valor no campo de texto.
export function freteParaTexto(v) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "";
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
}

// O que o campo mostra e de onde veio: "digitando" (rascunho não salvo), "salvo" (banco),
// "acrescimo" (unidade já tem outro pedido aberto: sugere 0, nunca a regra) ou "sugerido"
// (banco vazio e a seção pré-preenche — só "Para confirmar"). Sem nada: "vazio".
export function estadoFrete(order, rascunho, { sugerir, acrescimo } = {}) {
  if (rascunho !== undefined) return { texto: rascunho, origem: "digitando" };
  const salvo = freteSalvo(order);
  if (salvo !== null) return { texto: freteParaTexto(salvo), origem: "salvo" };
  if (sugerir && acrescimo) return { texto: "0", origem: "acrescimo" };
  if (sugerir) return { texto: freteParaTexto(freteSugerido(order?.total_amount)), origem: "sugerido" };
  return { texto: "", origem: "vazio" };
}

// Frete que vai junto no "Confirmar": rascunho > salvo > acréscimo (0) > sugerido. Nunca
// troca um valor já salvo. NaN = rascunho inválido (a ação para e avisa).
export function freteNaConfirmacao(order, rascunho, { acrescimo } = {}) {
  if (rascunho !== undefined) return parseFrete(rascunho);
  const salvo = freteSalvo(order);
  if (salvo !== null) return salvo;
  if (acrescimo) return 0;
  return freteSugerido(order?.total_amount);
}

// Último frete pago pela unidade (histórico de entregue/confirmado, freight_cost > 0),
// excluindo o próprio pedido. `historico` é a lista crua vinda do banco (qualquer ordem).
export function ultimoFretePorUnidade(historico) {
  const map = new Map();
  (historico || []).forEach((o) => {
    const v = parseFloat(o.freight_cost);
    if (!(v > 0)) return;
    const atual = map.get(o.franchise_id);
    if (!atual || new Date(o.ordered_at || 0) > new Date(atual.ordered_at || 0)) {
      map.set(o.franchise_id, { valor: v, data: o.ordered_at });
    }
  });
  return map;
}

// Mensagem pronta para "Chamar no WhatsApp" da linha (avisar atraso ou confirmar
// acréscimo). Sem emoji, sem travessão — voz do Nelson.
export function mensagemChamarPedido(order, { ownerName, atrasado, acrescimo } = {}) {
  const primeiro = String(ownerName || "").trim().split(/\s+/)[0];
  const saudacao = primeiro ? `Oi, ${primeiro}!` : "Oi!";
  const dataPedido = order?.ordered_at ? new Date(order.ordered_at).toLocaleDateString("pt-BR") : "";
  if (acrescimo) {
    return `${saudacao} O pedido de ${dataPedido} é acréscimo de outro pedido que já está em aberto, certo? Confirma comigo antes de eu separar.`;
  }
  if (atrasado) {
    return order?.status === "pendente"
      ? `${saudacao} O pedido de ${dataPedido} ainda está esperando confirmação aqui. Posso confirmar?`
      : `${saudacao} O pedido de ${dataPedido} está confirmado, vou dar andamento na separação. Só avisando.`;
  }
  return `${saudacao} Passando para falar sobre o pedido de ${dataPedido} à fábrica.`;
}

// Resumo do lote selecionado: pedidos, R$ dos itens, frete, kg e caminhões de 1.500 kg.
export function resumoLote(orders, freteDe = (o) => freteSalvo(o) || 0) {
  const base = somaPedidos(orders);
  const frete = orders.reduce((acc, o) => {
    const v = freteDe(o);
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);
  const kg = Math.round(base.kg * 10) / 10;
  return {
    qtd: orders.length,
    total: Math.round(base.total * 100) / 100,
    frete: Math.round(frete * 100) / 100,
    kg,
    caminhoes: kg > 0 ? Math.ceil(kg / CAPACIDADE_CAMINHAO_KG) : 0,
  };
}

// "1 pedido" / "3 pedidos"
export function pedidosLabel(n) {
  return `${n} ${n === 1 ? "pedido" : "pedidos"}`;
}

// "yyyy-MM-dd" de hoje/ontem, fuso BRT — default e atalho do campo "Entregue em".
export function dataBRT(offsetDias = 0) {
  const agoraBRT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  agoraBRT.setDate(agoraBRT.getDate() + offsetDias);
  const yyyy = agoraBRT.getFullYear();
  const mm = String(agoraBRT.getMonth() + 1).padStart(2, "0");
  const dd = String(agoraBRT.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// "yyyy-MM-dd" -> timestamptz ao meio-dia de SP (mesmo padrão de `recompute_contact_purchase_stats`).
export function meioDiaBRT(dataYYYYMMDD) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataYYYYMMDD || ""))) return null;
  return `${dataYYYYMMDD}T12:00:00-03:00`;
}

// --- Resumo mensal de entregas (26/09) ---
//
// "Quantas entregas fizemos no mês e o tempo médio, pra ter ideia" (pedido do Nelson). O
// resumo fica SEMPRE visível (não precisa abrir "Ver entregues"); busca 1 consulta enxuta
// por mês (status entregue, delivered_at no intervalo, sem select *) — nunca a tabela
// inteira. Mês anterior é comparado no MESMO TRECHO (ex.: até dia 26), não o mês inteiro,
// senão setembro parcial perderia sempre para agosto completo.

// "yyyy-MM" do mês corrente, em BRT (mesmo fuso de `dataBRT()`).
export function mesAtualBRT() {
  return dataBRT().slice(0, 7);
}

// Último dia do mês "yyyy-MM" (28-31) sem depender do fuso do navegador.
function ultimoDiaDoMes(yyyyMm) {
  const m = String(yyyyMm ?? "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
}

// Início/fim (ISO, fuso BRT fixo -03:00 — Brasil não tem horário de verão desde 2019) do
// mês "yyyy-MM", recortado no dia `ateDia` quando informado (clampado ao último dia do
// mês, então pedir dia 31 de um mês de 30 não estoura). Usado pra buscar só o intervalo
// certo e pra recortar o mês anterior no mesmo trecho.
export function limitesMesBRT(yyyyMm, ateDia = null) {
  const m = String(yyyyMm ?? "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const ultimoDia = ultimoDiaDoMes(yyyyMm);
  const dia = ateDia ? Math.min(ateDia, ultimoDia) : ultimoDia;
  const pad = (n) => String(n).padStart(2, "0");
  return {
    inicio: `${m[1]}-${m[2]}-01T00:00:00-03:00`,
    fim: `${m[1]}-${m[2]}-${pad(dia)}T23:59:59.999-03:00`,
    ultimoDia,
  };
}

// Dia do mês "até onde" contar: o dia de hoje (BRT) quando `yyyyMm` é o mês corrente, ou o
// mês inteiro (último dia) quando já é mês passado — pra só recortar o mês anterior no
// MESMO TRECHO enquanto o mês visto ainda está em andamento.
export function ateDiaBRT(yyyyMm, hojeYYYYMMDD = dataBRT()) {
  if (yyyyMm === hojeYYYYMMDD.slice(0, 7)) return Number(hojeYYYYMMDD.slice(8, 10));
  return ultimoDiaDoMes(yyyyMm);
}

// Diferença em dias-calendário BRT entre o pedido e a entrega (nunca `.substring`/UTC cru —
// mesmo cuidado de `paraDataBRT` acima). Null se faltar alguma das duas datas; negativo
// (dado quebrado) também vira null em vez de puxar a média pra baixo.
export function diasPedidoAteEntrega(order) {
  if (!order?.ordered_at || !order?.delivered_at) return null;
  try {
    const dias = differenceInCalendarDays(parseISO(paraDataBRT(order.delivered_at)), parseISO(paraDataBRT(order.ordered_at)));
    return dias >= 0 ? dias : null;
  } catch {
    return null;
  }
}

function mediana(numeros) {
  if (numeros.length === 0) return null;
  const s = [...numeros].sort((a, b) => a - b);
  const meio = Math.floor(s.length / 2);
  return s.length % 2 ? s[meio] : Math.round(((s[meio - 1] + s[meio]) / 2) * 10) / 10;
}

// Resumo de um lote de pedidos ENTREGUES: entregas, unidades distintas, R$ em produtos,
// frete e peso (null = "peso não registrado" — a coluna só existe desde 29/06/2026; se
// faltar em QUALQUER pedido do lote a soma ficaria subcontada, então não soma nada, nunca
// trata falta como zero) + dias do pedido até a entrega (média e mediana).
export function resumoEntregas(orders) {
  const lista = orders || [];
  const unidades = new Set(lista.map((o) => o.franchise_id)).size;
  const valor = lista.reduce((acc, o) => acc + (parseFloat(o.total_amount) || 0), 0);
  const frete = lista.reduce((acc, o) => acc + (parseFloat(o.freight_cost) || 0), 0);
  const pesoCompleto = lista.length > 0 && lista.every((o) => o.total_weight_kg !== null && o.total_weight_kg !== undefined);
  const pesoTotal = pesoCompleto ? lista.reduce((acc, o) => acc + (parseFloat(o.total_weight_kg) || 0), 0) : null;
  const dias = lista.map(diasPedidoAteEntrega).filter((d) => d !== null);
  const diasMedio = dias.length ? Math.round((dias.reduce((a, d) => a + d, 0) / dias.length) * 10) / 10 : null;
  return {
    entregas: lista.length,
    unidades,
    valor: Math.round(valor * 100) / 100,
    frete: Math.round(frete * 100) / 100,
    peso: pesoTotal === null ? null : Math.round(pesoTotal * 10) / 10,
    diasMedio,
    diasMediana: mediana(dias),
  };
}

// S15.1: colunas da conferência da unidade (supabase/2026-09-28-s15-conferir-entrega.sql).
// Vão numa busca à parte com volta para COLUNAS_PEDIDO: se o front sair antes do SQL, a lista
// de entregues continua abrindo (só sem o rótulo da conferência).
export const COLUNAS_CONFERENCIA = "received_mode, ordered_total_amount";

/** Erro de coluna que ainda não existe no banco (42703 do Postgres / PGRST204). */
export function colunaAusente(error) {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column .* does not exist/i.test(String(error.message || ""));
}
