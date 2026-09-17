// node src/lib/onboardingJourney.test.mjs
// Casos com as unidades REAIS medidas em 16/09/2026 (ver plano
// ~/.claude/plans/buzzing-jumping-mango.md, "O que os dados mostraram") — dados fiscais
// completos em todas as unidades novas, então FRANCHISE_OK/CONFIG_COMPLETA valem para
// todos os cenários abaixo (só o que muda é `facts`/`items`/completude do wizard).
import assert from "node:assert/strict";
import { montarJornada, CHAVES_CONFIRMACAO, CHAVES_MAXI_V2 } from "./onboardingJourney.js";

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

const FRANCHISE_OK = {
  billing_email: "unidade@maximassas.com.br",
  cpf_cnpj: "12345678000199",
  address_number: "100",
  neighborhood: "Centro",
  city: "Teste - SP",
  state_uf: "SP",
};

// Linha de franchise_configurations: tem tanto os campos fiscais (cep/street_address)
// quanto os do wizard "Meu Vendedor" (has_delivery, agent_name...) — é a mesma tabela.
const CONFIG_COMPLETA = {
  cep: "12345678",
  street_address: "Rua Teste, 100",
  franchise_name: "Maxi Massas Teste",
  neighborhood: "Centro",
  city: "Teste - SP",
  has_delivery: true,
  has_pickup: false,
  max_delivery_radius_km: 20,
  delivery_schedule: [{ days: ["mon"], delivery_start: "18:00", delivery_end: "21:00" }],
  payment_delivery: ["pix"],
  agent_name: "Roberta",
  catalog_image_url: "https://exemplo.com/catalogo.jpg",
};

// Mesma base, mas sem nada do wizard (só o fiscal) — para os cenários "nada feito ainda".
const CONFIG_SO_FISCAL = {
  cep: "12345678",
  street_address: "Rua Teste, 100",
  neighborhood: "Centro",
  city: "Teste - SP",
};

test("CHAVES_CONFIRMACAO e CHAVES_MAXI_V2 batem com journeySteps.js", () => {
  assert.deepEqual(CHAVES_CONFIRMACAO, ["p_whatsapp_ok", "p_espaco_ok", "p_pedido_ok"]);
  assert.deepEqual(CHAVES_MAXI_V2, [
    "maxi_contrato", "maxi_kickoff",
    "maxi_redes", "maxi_grupo", "maxi_validacao",
    "maxi_anuncios",
  ]);
});

test("Santa Isabel: robô respondeu e cardápio prontos; sem p_whatsapp_ok -> agora = confirmação do passo 2", () => {
  const jornada = montarJornada({
    franchise: FRANCHISE_OK,
    config: CONFIG_COMPLETA, // "config do Meu Vendedor completa"
    facts: {
      stock_now: false,
      has_catalog: true,
      first_bot_reply_at: "2026-09-10T16:11:11Z",
      first_order_at: null,
      first_delivered_at: null,
      first_sale_at: null,
      first_sale_with_contact_at: null,
    },
    items: {}, // sem p_whatsapp_ok
  });

  const passoRobo = jornada.passos.find((p) => p.id === "robo");
  const cardapio = passoRobo.tarefas.find((t) => t.id === "cardapio");
  const roboRespondeu = passoRobo.tarefas.find((t) => t.id === "robo_respondeu");
  const pWhatsappOk = passoRobo.tarefas.find((t) => t.id === "p_whatsapp_ok");
  assert.equal(cardapio.feita, true);
  assert.equal(roboRespondeu.feita, true);
  assert.equal(pWhatsappOk.feita, false);

  const passoPedido = jornada.passos.find((p) => p.id === "pedido");
  assert.equal(passoPedido.tarefas.find((t) => t.id === "pedido_enviado").feita, false);

  assert.ok(jornada.agora, "deveria ter uma tarefa 'agora'");
  assert.equal(jornada.agora.passoId, "robo");
  assert.equal(jornada.agora.tarefaId, "p_whatsapp_ok");
});

test("Uberaba: pedido enviado, ainda não entregue", () => {
  const jornada = montarJornada({
    franchise: FRANCHISE_OK,
    config: CONFIG_COMPLETA,
    facts: {
      stock_now: false,
      has_catalog: true,
      first_order_at: "2026-09-12T14:06:20Z",
      first_bot_reply_at: "2026-09-12T15:43:29Z",
      first_delivered_at: null,
      first_sale_at: null,
      first_sale_with_contact_at: null,
    },
    items: {},
  });

  const passoPedido = jornada.passos.find((p) => p.id === "pedido");
  assert.equal(passoPedido.tarefas.find((t) => t.id === "pedido_enviado").feita, true);
  assert.equal(passoPedido.tarefas.find((t) => t.id === "pedido_entregue").feita, false);
});

test("Itapevi: primeira venda feita mas robô não; aviso de vincular cliente; agora aponta pro passo 2 (robô)", () => {
  const jornada = montarJornada({
    franchise: FRANCHISE_OK,
    config: CONFIG_SO_FISCAL, // wizard incompleto, sem catálogo subido no app
    facts: {
      stock_now: true,
      has_catalog: false,
      first_sale_at: "2026-09-15T14:01:26Z",
      first_order_at: "2026-08-23T23:21:41Z",
      first_delivered_at: "2026-08-27T22:44:33Z",
      first_bot_reply_at: null,
      first_sale_with_contact_at: null,
    },
    items: {},
  });

  const passoLancamento = jornada.passos.find((p) => p.id === "lancamento");
  assert.equal(passoLancamento.tarefas.find((t) => t.id === "primeira_venda").feita, true);

  const passoRobo = jornada.passos.find((p) => p.id === "robo");
  assert.equal(passoRobo.tarefas.find((t) => t.id === "robo_respondeu").feita, false);

  assert.equal(jornada.avisos.length, 1);
  assert.match(jornada.avisos[0], /vincul/i);

  assert.ok(jornada.agora);
  assert.equal(jornada.agora.passoNumero, 2);
});

test("SP20: tudo null/false com fiscal INCOMPLETO -> agora = passo 1 (fiscal)", () => {
  const franchiseIncompleta = { ...FRANCHISE_OK, billing_email: null };
  const jornada = montarJornada({
    franchise: franchiseIncompleta,
    config: CONFIG_SO_FISCAL,
    facts: {},
    items: {},
  });

  assert.ok(jornada.agora);
  assert.equal(jornada.agora.passoId, "dados");
  assert.equal(jornada.agora.tarefaId, "fiscal");
});

test("SP20: tudo null/false com fiscal completo -> agora = primeira tarefa contada do passo 2", () => {
  const jornada = montarJornada({
    franchise: FRANCHISE_OK,
    config: CONFIG_SO_FISCAL, // fiscal ok, mas nada do wizard/catálogo
    facts: {},
    items: {},
  });

  const passoDados = jornada.passos.find((p) => p.id === "dados");
  assert.equal(passoDados.pronto, true);

  assert.ok(jornada.agora);
  assert.equal(jornada.agora.passoNumero, 2);
  assert.equal(jornada.agora.tarefaId, "cardapio");
});

test("legado: maxi_grupo entra pela chave antiga 4-4, marcado como legado", () => {
  const jornada = montarJornada({
    franchise: FRANCHISE_OK,
    config: CONFIG_COMPLETA,
    facts: {},
    items: { "4-4": true },
  });
  const passoRobo = jornada.passos.find((p) => p.id === "robo");
  const maxiGrupo = passoRobo.maxi.find((m) => m.id === "maxi_grupo");
  assert.equal(maxiGrupo.feito, true);
  assert.equal(maxiGrupo.legado, true);

  const maxiRedes = passoRobo.maxi.find((m) => m.id === "maxi_redes");
  assert.equal(maxiRedes.feito, false);
});

test("legado: '1-1' não migra para maxi_contrato (era automático falso)", () => {
  const jornada = montarJornada({
    franchise: FRANCHISE_OK,
    config: CONFIG_COMPLETA,
    facts: {},
    items: { "1-1": true, "1-2": true },
  });
  const passoDados = jornada.passos.find((p) => p.id === "dados");
  const maxiContrato = passoDados.maxi.find((m) => m.id === "maxi_contrato");
  const maxiKickoff = passoDados.maxi.find((m) => m.id === "maxi_kickoff");
  assert.equal(maxiContrato.feito, false);
  assert.equal(maxiKickoff.feito, false);
});

test("maxi direto (chave nova) marca feito com data, sem legado", () => {
  const jornada = montarJornada({
    franchise: FRANCHISE_OK,
    config: CONFIG_COMPLETA,
    facts: {},
    items: { maxi_contrato: "2026-09-01T10:00:00Z" },
  });
  const passoDados = jornada.passos.find((p) => p.id === "dados");
  const maxiContrato = passoDados.maxi.find((m) => m.id === "maxi_contrato");
  assert.equal(maxiContrato.feito, true);
  assert.equal(maxiContrato.legado, false);
  assert.equal(maxiContrato.feitoEm, "2026-09-01T10:00:00Z");
});

test("tudo feito: completo=true, agora=null, porcentagem=100, sem aviso", () => {
  const jornada = montarJornada({
    franchise: FRANCHISE_OK,
    config: CONFIG_COMPLETA,
    facts: {
      stock_now: true,
      has_catalog: true,
      first_order_at: "2026-09-12T11:06:00Z",
      first_delivered_at: "2026-09-21T00:00:00Z",
      first_bot_reply_at: "2026-09-12T15:43:29Z",
      first_sale_at: "2026-09-15T14:01:26Z",
      first_sale_with_contact_at: "2026-09-15T14:05:00Z",
    },
    items: {
      p_whatsapp_ok: true,
      p_espaco_ok: true,
      p_pedido_ok: true,
      maxi_contrato: true,
      maxi_kickoff: true,
      maxi_redes: true,
      maxi_grupo: true,
      maxi_validacao: true,
      maxi_anuncios: true,
    },
  });

  assert.equal(jornada.completo, true);
  assert.equal(jornada.agora, null);
  assert.equal(jornada.porcentagem, 100);
  assert.equal(jornada.prontos, 5);
  assert.equal(jornada.avisos.length, 0);
});

console.log(`${passed} testes de onboardingJourney passaram.`);
