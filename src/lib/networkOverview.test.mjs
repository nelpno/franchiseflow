// node src/lib/networkOverview.test.mjs
import assert from "node:assert/strict";
import {
  FILTROS, aplicarFiltro, buscar, contarFiltros, isFiltroValido, nomeCurto, nomesResumo, resumoRede,
  caiu, subiu, deltaVendas, semVenda, semVerba, ehNova, novaNaTrilha, mesesVerba, rotuloMesVerba,
  infoMesSeguinte, textoSemVerba, linhaDaFicha, sinaisUnidade, linkFicha, voltarDaFicha,
  LIMITE_QUEDA_PCT, PISO_BASE_QUEDA, DIAS_SEM_VENDA,
  OPCOES_ORDEM, ORDEM_OPCOES_LISTA, ordenarPor, isOrdemValida, direcaoPadraoOrdem, FILTROS_REV_90D,
} from "./networkOverview.js";
import { nomeMes, somarMeses, haDias, dataCurta, diasDesde, idadeUnidade, primeiroNome } from "./adminFormat.js";
import { formatPct } from "./formatters.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    console.error(`FALHOU: ${name}`);
    throw error;
  }
}

const base = {
  is_new: false, days_since_last_sale: 1, days_since_last_bot: 0, rev_delta_pct: null,
  rev_mtd: 1000, rev_prev_same: 1000, rev_90d: 3000,
  marketing_month_paid: true, marketing_target_paid: false, onboarding_pct: 100,
};
const u = (over) => ({ ...base, ...over });

test("nova sem venda fica só em Novas, nunca em Sem venda", () => {
  const r = u({ is_new: true, days_since_last_sale: null });
  assert.equal(FILTROS.sem_venda.match(r), false);
  assert.equal(FILTROS.novas.match(r), true);
});

test("unidade antiga que nunca vendeu entra em Sem venda", () => {
  assert.equal(FILTROS.sem_venda.match(u({ days_since_last_sale: null })), true);
});

test("sem venda: 7 entra, 6 não", () => {
  assert.equal(FILTROS.sem_venda.match(u({ days_since_last_sale: 7 })), true);
  assert.equal(FILTROS.sem_venda.match(u({ days_since_last_sale: 6 })), false);
});

test("robô sem histórico (null) não conta como parado", () => {
  assert.equal(FILTROS.robo_parado.match(u({ days_since_last_bot: null })), false);
  assert.equal(FILTROS.robo_parado.match(u({ days_since_last_bot: 7 })), true);
});

test("delta null (base abaixo do piso) fica fora de caiu e subiu", () => {
  const r = u({ rev_delta_pct: null });
  assert.equal(FILTROS.caiu.match(r), false);
  assert.equal(FILTROS.subiu.match(r), false);
});

test("delta vem como string do PostgREST", () => {
  assert.equal(FILTROS.caiu.match(u({ rev_delta_pct: "-20.0" })), true);
  assert.equal(FILTROS.subiu.match(u({ rev_delta_pct: "19.9" })), false);
});

test("sem verba: pagou o mês-alvo já basta", () => {
  assert.equal(FILTROS.sem_verba.match(u({ marketing_month_paid: false, marketing_target_paid: true })), false);
  assert.equal(FILTROS.sem_verba.match(u({ marketing_month_paid: false, marketing_target_paid: false })), true);
});

test("filtro inválido cai em todas", () => {
  assert.equal(isFiltroValido("xyz"), false);
  assert.equal(isFiltroValido("toString"), false);
  assert.equal(aplicarFiltro([u({}), u({})], "xyz").length, 2);
});

test("caiu ordena da maior queda para a menor", () => {
  const out = aplicarFiltro([u({ franchise_name: "A", rev_delta_pct: -25 }), u({ franchise_name: "B", rev_delta_pct: -60 })], "caiu");
  assert.deepEqual(out.map((r) => r.franchise_name), ["B", "A"]);
});

test("contagem do chip = tamanho da lista filtrada", () => {
  const rows = [u({}), u({ days_since_last_sale: 10 }), u({ is_new: true }), u({ rev_delta_pct: -30 })];
  const c = contarFiltros(rows);
  for (const k of Object.keys(c)) assert.equal(c[k], aplicarFiltro(rows, k).length, k);
  assert.equal(c.todas, 4);
});

test("busca ignora acento e caixa", () => {
  const rows = [u({ franchise_name: "Vila dos Remédios" }), u({ franchise_name: "Itatiba", owner_name: "Gustavo" })];
  assert.equal(buscar(rows, "remedios").length, 1);
  assert.equal(buscar(rows, "GUSTAVO").length, 1);
  assert.equal(buscar(rows, "  ").length, 2);
});

test("resumo da rede: delta em %, 1 casa", () => {
  const r = resumoRede([u({ rev_mtd: 95, rev_prev_same: 100 }), u({ rev_mtd: 0, rev_prev_same: 0, days_since_last_sale: null })]);
  assert.equal(r.deltaPct, -5);
  assert.equal(r.venderam7d, 1);
  assert.equal(r.abaixo, 1);
  assert.equal(r.acima, 0);
});

test("resumo sem base anterior não inventa %", () => {
  assert.equal(resumoRede([u({ rev_mtd: 10, rev_prev_same: 0 })]).deltaPct, null);
});

test("nomesResumo", () => {
  const rs = ["A", "B", "C", "D", "E"].map((n) => ({ franchise_name: n }));
  assert.equal(nomesResumo(rs), "A, B, C e mais 2");
  assert.equal(nomesResumo(rs.slice(0, 2)), "A, B");
});

test("nomeCurto tira o prefixo da marca", () => {
  assert.equal(nomeCurto("Maxi Massas Vila Maria"), "Vila Maria");
  assert.equal(nomeCurto("maxi massas - Itatiba"), "Itatiba");
  assert.equal(nomeCurto("Maxi Massas"), "Maxi Massas");
  assert.equal(nomeCurto("Santos"), "Santos");
});

// ---------- régua única (Onda 1, decisões 1-4) ----------

// Dia 26/09: últimos 5 dias → mês-alvo = outubro. Dia 15/09: alvo = mês do calendário.
const dia26 = { marketing_month: "2026-09", marketing_target_month: "2026-10" };
const dia15 = { marketing_month: "2026-09", marketing_target_month: "2026-09" };
const virada = { marketing_month: "2026-12", marketing_target_month: "2027-01" };

test("caiu: -20 entra, -19,9 não; mesma régua em linha do banco e em {rev, prev}", () => {
  assert.equal(caiu(u({ rev_delta_pct: -20 })), true);
  assert.equal(caiu(u({ rev_delta_pct: -19.9 })), false);
  assert.equal(caiu({ rev: 8000, prev: 10000 }), true);
  assert.equal(caiu({ rev: 8100, prev: 10000 }), false);
  assert.equal(LIMITE_QUEDA_PCT, -20);
});

test("caiu: base < R$ 3 mil nunca entra (nem calculando a partir de rev/prev)", () => {
  assert.equal(caiu({ rev: 0, prev: 2999 }), false);
  assert.equal(deltaVendas({ rev: 0, prev: PISO_BASE_QUEDA - 1 }), null);
  assert.equal(deltaVendas({ rev_mtd: 1500, rev_prev_same: 3000 }), -50);
  assert.equal(caiu(u({ rev_delta_pct: null, rev_mtd: 0, rev_prev_same: 2500 })), false);
  assert.equal(subiu({ rev: 5000, prev: 1000 }), false);
});

test("Financeiro 'Mais caíram' pode ordenar por delta, mas a lista é a do chip", () => {
  const rows = [u({ rev_delta_pct: -5 }), u({ rev_delta_pct: -25 }), u({ rev_delta_pct: -40 })];
  assert.equal(rows.filter(caiu).length, contarFiltros(rows).caiu);
  assert.equal(resumoRede(rows).cairam, 2);
  assert.equal(resumoRede(rows).abaixo, 0); // distribuição informativa usa rev_mtd × rev_prev_same
});

test("sem venda: a régua usa DIAS_SEM_VENDA", () => {
  assert.equal(semVenda(u({ days_since_last_sale: DIAS_SEM_VENDA })), true);
  assert.equal(semVenda(u({ days_since_last_sale: DIAS_SEM_VENDA - 1 })), false);
});

test("unidade nova: protegida até 30 dias sem venda; trilha aprovada = régua normal", () => {
  const nova = u({ is_new: true, age_days: 20, days_since_last_sale: null, onboarding_status: "in_progress" });
  assert.equal(ehNova(nova), true);
  assert.equal(novaNaTrilha(nova), true);
  assert.equal(semVenda(nova), false);
  assert.equal(semVenda({ ...nova, days_since_last_sale: 31 }), true);
  assert.equal(semVenda({ ...nova, days_since_last_sale: 30 }), false);
  const aprovada = { ...nova, onboarding_status: "approved" };
  assert.equal(novaNaTrilha(aprovada), false);
  assert.equal(semVenda(aprovada), true);
  assert.equal(FILTROS.novas.match(aprovada), false);
  // age_days manda sobre is_new
  assert.equal(ehNova(u({ is_new: true, age_days: 30 })), false); // 29/09: nova é < 30 dias
  assert.equal(ehNova(u({ is_new: true, age_days: 29 })), true);
});

test("sem verba: mês do calendário OU mês-alvo pago basta (26/09)", () => {
  assert.equal(semVerba(u({ ...dia26, marketing_month_paid: true, marketing_target_paid: false })), false);
  assert.equal(semVerba(u({ ...dia26, marketing_month_paid: false, marketing_target_paid: true })), false);
  assert.equal(semVerba(u({ ...dia26, marketing_month_paid: false, marketing_target_paid: false })), true);
});

test("mês principal da verba = calendário; 26/09 continua 'setembro'", () => {
  assert.equal(rotuloMesVerba(dia26), "setembro");
  assert.equal(rotuloMesVerba([dia26]), "setembro");
  assert.equal(rotuloMesVerba(dia15), "setembro");
  assert.equal(rotuloMesVerba({ marketing: { calendar_month: "2026-09", target_month: "2026-10" } }), "setembro");
  assert.equal(textoSemVerba(7, [dia26]), "7 unidades não pagaram a verba de setembro");
  assert.equal(textoSemVerba(1, dia26), "1 unidade não pagou a verba de setembro");
  assert.equal(FILTROS.sem_verba.titulo(7, [dia26]), "7 unidades não pagaram a verba de setembro");
  assert.equal(textoSemVerba(2), "2 unidades não pagaram a verba do mês");
});

test("mês seguinte: só nos últimos 5 dias, neutro, sem zerar o principal", () => {
  assert.equal(infoMesSeguinte([u(dia15)]), null);
  assert.equal(infoMesSeguinte(u(dia15)), null);
  const rede = [u({ ...dia26, marketing_target_paid: true }), u({ ...dia26, marketing_target_paid: false })];
  const i = infoMesSeguinte(rede);
  assert.equal(i.texto, "Outubro: 1 já pagou");
  assert.equal(i.tom, "neutro");
  assert.equal(i.total, 2);
  assert.equal(infoMesSeguinte(rede[1]).texto, "Out: ainda pode pagar");
  assert.equal(infoMesSeguinte(rede[0]).texto, "Out: já pagou");
  assert.deepEqual(mesesVerba(dia26), { mes: "2026-09", alvo: "2026-10", janela: true });
});

test("virada de ano: dezembro → janeiro", () => {
  assert.equal(rotuloMesVerba(virada), "dezembro");
  assert.equal(infoMesSeguinte([u({ ...virada, marketing_target_paid: false })]).texto, "Janeiro: 0 já pagaram");
  assert.equal(somarMeses("2026-12", 1), "2027-01");
  assert.equal(somarMeses("2027-01", -1), "2026-12");
  assert.equal(nomeMes("2027-01", { ano: true, maiuscula: true }), "Janeiro de 2027");
});

// get_unit_360 de uma unidade parada há 82 dias (caso Uberlândia) em 26/09.
const unit360 = {
  franchise_id: "franquiauberlandiamg",
  franchise_name: "Maxi Massas Uberlândia",
  owner_name: "Ana Paula Souza",
  phone: "34999990000",
  city: "Uberlândia - MG",
  age_days: 185,
  is_new: false,
  sales: { rev_mtd: 0, rev_prev_same: 0, rev_delta_pct: null, days_since_last_sale: 82 },
  bot: { days_since_last_conversation: 40, people_7d: 0 },
  marketing: {
    calendar_month: "2026-09",
    target_month: "2026-10",
    months: [
      { month: "2026-10", status: "pending", amount: 300 },
      { month: "2026-08", status: "confirmed", amount: 300 },
    ],
  },
  subscription: { payment_status: "OVERDUE", due_date: "2026-09-05" },
  purchase_orders: { days_since_last: 120, pending_count: 0 },
  onboarding: { status: "approved", pct: 100 },
  health: { tier: "healthy", flags: [] },
};

test("linhaDaFicha: mesmas chaves da overview; pendente não conta como pago", () => {
  const r = linhaDaFicha(unit360);
  assert.equal(r.days_since_last_sale, 82);
  assert.equal(r.days_since_last_bot, 40);
  assert.equal(r.marketing_month, "2026-09");
  assert.equal(r.marketing_month_paid, false);
  assert.equal(r.marketing_target_paid, false);
  assert.equal(r.subscription_payment_status, "OVERDUE");
  assert.equal(r.phone, "34999990000");
  assert.equal(linhaDaFicha(null), null);
});

test("sinaisUnidade: Ficha e lista chegam no mesmo motivo (o cache 'healthy' não manda)", () => {
  const s = sinaisUnidade(linhaDaFicha(unit360));
  assert.deepEqual(s.map((x) => x.chave), ["sem_venda", "robo_parado", "sem_verba", "mensalidade"]);
  assert.equal(s[0].titulo, "Sem venda há 82 dias");
  assert.equal(s[0].tom, "err");
  assert.equal(s[2].titulo, "Não pagou a verba de setembro");
  assert.equal(s[3].titulo, "Mensalidade vencida desde 05/09");
  // a mesma linha, vinda da overview, cai nos mesmos filtros
  const r = linhaDaFicha(unit360);
  assert.equal(FILTROS.sem_venda.match(r), true);
  assert.equal(FILTROS.sem_verba.match(r), true);
});

test("sinaisUnidade: caiu com vírgula; unidade saudável → []", () => {
  const s = sinaisUnidade(u({ rev_delta_pct: -27.34, marketing_month_paid: true }));
  assert.equal(s.length, 1);
  assert.equal(s[0].titulo, "Vendendo 27,3% menos que no mesmo trecho do mês passado");
  assert.deepEqual(sinaisUnidade(u({})), []);
});

test("sinaisUnidade: nova na trilha = 'nova' neutra; problema real vem antes", () => {
  const nova = u({ is_new: true, age_days: 20, days_since_last_sale: null, onboarding_status: "in_progress",
    onboarding_pct: 40, marketing_month_paid: false, marketing_target_paid: false, ...dia26 });
  const s = sinaisUnidade(nova);
  assert.equal(s[0].chave, "nova");
  assert.equal(s[0].titulo, "Nova na trilha: 40% dos Primeiros passos");
  assert.ok(s.every((x) => x.tom === "neutro"), "nova na trilha nunca em vermelho");
  const parada = sinaisUnidade({ ...nova, days_since_last_sale: 35 });
  assert.equal(parada[0].chave, "sem_venda");
  assert.equal(parada[0].tom, "err");
  assert.equal(parada[1].chave, "nova");
  const aprovada = sinaisUnidade({ ...nova, onboarding_status: "approved" });
  assert.equal(aprovada[0].chave, "sem_venda");
  assert.ok(!aprovada.some((x) => x.chave === "nova"));
});

test("linkFicha e voltarDaFicha", () => {
  assert.deepEqual(linkFicha("evo 1", { from: "/Unidades?filtro=caiu", label: "Unidades" }), {
    to: "/Unidade?id=evo%201",
    state: { from: "/Unidades?filtro=caiu", label: "Unidades" },
  });
  assert.equal(linkFicha("x").state, undefined);
  assert.equal(voltarDaFicha({ state: { from: "/Financeiro?tab=fechamento", label: "Fechamento do mês" } }).texto,
    "← Voltar para Fechamento do mês");
  assert.equal(voltarDaFicha({ state: { from: "//evil.com", label: "x" } }).to, "/Unidades");
  assert.equal(voltarDaFicha({ search: "?id=a&voltar=%2FMarketing%3Ftab%3Dinvestimento" }).to, "/Marketing?tab=investimento");
  assert.equal(voltarDaFicha({ search: "?id=a&voltar=filtro%3Dsem_venda" }).to, "/Unidades?filtro=sem_venda");
  assert.equal(voltarDaFicha({ search: "?voltar=https://x" }).to, "/Unidades");
  assert.deepEqual(voltarDaFicha(null), { to: "/Unidades", label: "Unidades", texto: "← Unidades" });
});

// ---------- adminFormat / formatPct ----------

test("formatPct: vírgula, menos tipográfico, sinal opcional", () => {
  assert.equal(formatPct(-27.34), "−27,3%");
  assert.equal(formatPct(13.2, { sinal: true }), "+13,2%");
  assert.equal(formatPct(13.2), "13,2%");
  assert.equal(formatPct(27.3, { casas: 0 }), "27%");
  assert.equal(formatPct(0, { sinal: true }), "0,0%");
  assert.equal(formatPct("-20.0"), "−20,0%");
  assert.equal(formatPct(null), "");
  assert.equal(formatPct("abc"), "");
});

test("nomeMes / haDias / dataCurta / idade / primeiro nome", () => {
  assert.equal(nomeMes("2026-09"), "setembro");
  assert.equal(nomeMes("2026-09-26"), "setembro");
  assert.equal(nomeMes("2026-10", { curto: true }), "Out");
  assert.equal(nomeMes("2026-13"), "");
  assert.equal(nomeMes(null), "");
  assert.equal(haDias(0), "hoje");
  assert.equal(haDias(1), "há 1 dia");
  assert.equal(haDias(82), "há 82 dias");
  assert.equal(haDias(null), "");
  assert.equal(dataCurta("2026-09-05"), "05/09");
  assert.equal(dataCurta("2026-09-05T02:00:00Z"), "04/09"); // 23h do dia 4 em SP
  assert.equal(diasDesde("2026-09-20", new Date("2026-09-26T15:00:00Z")), 6);
  assert.equal(diasDesde("2026-09-26T01:00:00Z", new Date("2026-09-26T15:00:00Z")), 1); // 22h de 25/09 em SP
  assert.equal(idadeUnidade(12), "12 dias");
  assert.equal(idadeUnidade(95), "3 meses");
  assert.equal(idadeUnidade(430), "1 ano e 2 meses");
  assert.equal(primeiroNome("  Maria Aparecida Prado "), "Maria");
  assert.equal(primeiroNome(null), "");
});

// ---------- ordenação (clique no cabeçalho / seletor do celular, pedido 26/09) ----------

test("ordenarPor: unidade A-Z (e Z-A)", () => {
  const rows = [u({ franchise_name: "Maxi Massas Suzano" }), u({ franchise_name: "Maxi Massas Araras" }), u({ franchise_name: "Maxi Massas Bauru" })];
  assert.deepEqual(ordenarPor(rows, "unidade", "asc").map((r) => r.franchise_name), ["Maxi Massas Araras", "Maxi Massas Bauru", "Maxi Massas Suzano"]);
  assert.deepEqual(ordenarPor(rows, "unidade", "desc").map((r) => r.franchise_name), ["Maxi Massas Suzano", "Maxi Massas Bauru", "Maxi Massas Araras"]);
});

test("ordenarPor: faturamento usa rev_90d quando o filtro troca a coluna (T8)", () => {
  const rows = [u({ franchise_name: "A", rev_mtd: 100, rev_90d: 900 }), u({ franchise_name: "B", rev_mtd: 200, rev_90d: 300 })];
  assert.deepEqual(ordenarPor(rows, "faturamento", "desc").map((r) => r.franchise_name), ["B", "A"]); // rev_mtd
  assert.deepEqual(ordenarPor(rows, "faturamento", "desc", "sem_venda").map((r) => r.franchise_name), ["A", "B"]); // rev_90d
});

test("ordenarPor: variação usa a MESMA régua de deltaVendas (piso de R$ 3 mil)", () => {
  const rows = [u({ franchise_name: "Caiu muito", rev_delta_pct: -60 }), u({ franchise_name: "Subiu", rev_delta_pct: 30 }), u({ franchise_name: "Sem base", rev_delta_pct: null })];
  assert.deepEqual(ordenarPor(rows, "variacao", "asc").map((r) => r.franchise_name), ["Caiu muito", "Subiu", "Sem base"]);
});

test("ordenarPor: valores nulos SEMPRE no fim, nas duas direções", () => {
  const rows = [u({ franchise_name: "A", days_since_last_sale: 10 }), u({ franchise_name: "Nunca vendeu", days_since_last_sale: null }), u({ franchise_name: "B", days_since_last_sale: 3 })];
  assert.deepEqual(ordenarPor(rows, "sem_venda", "asc").map((r) => r.franchise_name), ["B", "A", "Nunca vendeu"]);
  assert.deepEqual(ordenarPor(rows, "sem_venda", "desc").map((r) => r.franchise_name), ["A", "B", "Nunca vendeu"]);
});

test("ordenarPor: robô parado (dias) e último pedido", () => {
  const rows = [u({ franchise_name: "A", days_since_last_bot: 2 }), u({ franchise_name: "B", days_since_last_bot: 20 })];
  assert.deepEqual(ordenarPor(rows, "robo", "desc").map((r) => r.franchise_name), ["B", "A"]);
  const rows2 = [u({ franchise_name: "A", days_since_last_po: 5 }), u({ franchise_name: "B", days_since_last_po: 90 })];
  assert.deepEqual(ordenarPor(rows2, "ultimo_pedido", "desc").map((r) => r.franchise_name), ["B", "A"]);
});

test("ordenarPor: verba — quem não pagou nada primeiro no asc", () => {
  const rows = [
    u({ franchise_name: "Pagou os dois", marketing_month_paid: true, marketing_target_paid: true }),
    u({ franchise_name: "Não pagou nada", marketing_month_paid: false, marketing_target_paid: false }),
    u({ franchise_name: "Pagou 1", marketing_month_paid: true, marketing_target_paid: false }),
  ];
  assert.deepEqual(ordenarPor(rows, "verba", "asc").map((r) => r.franchise_name), ["Não pagou nada", "Pagou 1", "Pagou os dois"]);
});

test("ordenarPor: chave/direção inválida não quebra — usa a direção padrão da coluna", () => {
  const rows = [u({ franchise_name: "A", days_since_last_sale: 10 }), u({ franchise_name: "B", days_since_last_sale: 3 })];
  assert.deepEqual(ordenarPor(rows, "sem_venda", "xyz").map((r) => r.franchise_name), ["A", "B"]); // padrão = desc
  assert.equal(ordenarPor(rows, "nao-existe", "asc"), rows); // devolve sem mexer
});

test("isOrdemValida / direcaoPadraoOrdem / listas", () => {
  assert.equal(isOrdemValida("faturamento"), true);
  assert.equal(isOrdemValida("toString"), false);
  assert.equal(direcaoPadraoOrdem("unidade"), "asc");
  assert.equal(direcaoPadraoOrdem("verba"), "asc");
  assert.equal(direcaoPadraoOrdem("robo"), "desc");
  for (const k of ORDEM_OPCOES_LISTA) assert.ok(OPCOES_ORDEM[k], k);
  assert.deepEqual(FILTROS_REV_90D, new Set(["sem_venda", "robo_parado"]));
});

console.log(`networkOverview: ${passed} testes ok`);
