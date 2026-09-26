// node src/lib/csMural.test.mjs
import assert from "node:assert/strict";
import {
  CANAL_LABEL,
  RESULTADO_LABEL,
  DESFECHO_LABEL,
  MOTIVO_LABEL,
  VOLTAR_EM_OPCOES,
  agruparPorRaia,
  calcularNextAt,
  linhaVenda,
  rotuloVoltaEm,
  dataDDMM,
  fraseReabertura,
  linhaAcordo,
  linhaUltimoCombinado,
  validarRegistro,
  motivoChipClasse,
} from "./csMural.js";
import { formatBRLInteger } from "./formatters.js";

let n = 0;
const test = (name, fn) => { fn(); n++; };

test("rótulos têm as chaves do contrato", () => {
  assert.equal(CANAL_LABEL.mensagem, "Mensagem");
  assert.equal(CANAL_LABEL.reuniao, "Reunião feita");
  assert.equal(RESULTADO_LABEL.vai_fazer, "Respondeu e vai fazer");
  assert.equal(DESFECHO_LABEL.vai_para_nelson, "Vai para o Nelson");
  assert.equal(MOTIVO_LABEL.sem_venda, "Sem venda");
  assert.equal(Object.keys(MOTIVO_LABEL).length, 6);
});

test("agruparPorRaia separa resolveu_sozinho de resolvidos", () => {
  const cards = [
    { id: "1", lane: "falar_hoje" },
    { id: "2", lane: "esperando" },
    { id: "3", lane: "resolvidos", closed_reason: "resolvido" },
    { id: "4", lane: "resolvidos", closed_reason: "resolveu_sozinho" },
    { id: "5", lane: "com_nelson" },
    { id: "6", lane: "estacionado" },
  ];
  const g = agruparPorRaia(cards);
  assert.equal(g.falar_hoje.length, 1);
  assert.equal(g.esperando.length, 1);
  assert.equal(g.resolvidos.length, 1);
  assert.equal(g.resolvidos[0].id, "3");
  assert.equal(g.resolveu_sozinho.length, 1);
  assert.equal(g.resolveu_sozinho[0].id, "4");
  assert.equal(g.com_nelson.length, 1);
  assert.equal(g.estacionado.length, 1);
});

test("agruparPorRaia ignora lane desconhecida sem quebrar", () => {
  const g = agruparPorRaia([{ id: "x", lane: "desconhecida" }]);
  assert.equal(g.falar_hoje.length, 0);
});

test("calcularNextAt: 2 dias / 1 semana / 2 semanas somam a partir de 'agora'", () => {
  const agora = new Date(2026, 8, 26); // 26/09/2026 (mês 0-based)
  assert.equal(calcularNextAt("2d", null, agora), "2026-09-28");
  assert.equal(calcularNextAt("1s", null, agora), "2026-10-03");
  assert.equal(calcularNextAt("2s", null, agora), "2026-10-10");
});

test("calcularNextAt usa o dia em America/Sao_Paulo, não o fuso do aparelho", () => {
  // 01:00 UTC de 26/09 é 22:00 de 25/09 em SP (UTC-3) — se a conta usasse o dia UTC
  // (ou o fuso local da máquina, quando não for SP), "hoje" viraria 26/09 em vez de 25/09
  // e a soma de dias saía adiantada em 1 dia.
  const agoraUtcNoite = new Date("2026-09-26T01:00:00Z");
  assert.equal(calcularNextAt("2d", null, agoraUtcNoite), "2026-09-27");
  assert.equal(calcularNextAt("1s", null, agoraUtcNoite), "2026-10-02");
});

test("calcularNextAt: 'data' usa a data escolhida, sem chave inválida usa null", () => {
  const agora = new Date(2026, 8, 26);
  assert.equal(calcularNextAt("data", "2026-10-15", agora), "2026-10-15");
  assert.equal(calcularNextAt("data", null, agora), null);
  assert.equal(calcularNextAt("nao-existe", null, agora), null);
});

test("VOLTAR_EM_OPCOES tem as 4 opções na ordem do contrato", () => {
  assert.deepEqual(VOLTAR_EM_OPCOES.map((o) => o.key), ["2d", "1s", "2s", "data"]);
});

test("linhaVenda: com antes e depois", () => {
  assert.equal(
    linhaVenda({ rev_month_before: 900, rev_mtd: 300 }),
    `vendia ${formatBRLInteger(900)}/mês · agora ${formatBRLInteger(300)}`
  );
});

test("linhaVenda: sem venda no mês (0) diz 'agora sem vendas'", () => {
  assert.equal(
    linhaVenda({ rev_month_before: 900, rev_mtd: 0 }),
    `vendia ${formatBRLInteger(900)}/mês · agora sem vendas`
  );
});

test("linhaVenda: sem baseline (rev_month_before ausente/zero) devolve null", () => {
  assert.equal(linhaVenda({ rev_month_before: 0, rev_mtd: 300 }), null);
  assert.equal(linhaVenda({}), null);
});

test("rotuloVoltaEm formata 'volta em DD/MM'", () => {
  assert.equal(rotuloVoltaEm("2026-10-03"), "volta em 03/10");
  assert.equal(rotuloVoltaEm(null), "");
  assert.equal(rotuloVoltaEm("data-invalida"), "");
});

test("dataDDMM", () => {
  assert.equal(dataDDMM("2026-09-15T10:00:00Z"), "15/09");
  assert.equal(dataDDMM(null), "");
});

test("fraseReabertura monta a frase com desfecho traduzido", () => {
  const f = fraseReabertura({ last_closed_at: "2026-09-11", last_closed_reason: "combinado_feito" });
  assert.equal(f, 'Fechado em 11/09 como "Combinado feito"; o motivo continua.');
});

test("fraseReabertura devolve null sem histórico de fechamento", () => {
  assert.equal(fraseReabertura({}), null);
  assert.equal(fraseReabertura(null), null);
});

test("linhaAcordo e linhaUltimoCombinado", () => {
  assert.equal(
    linhaAcordo({ reason: "Nelson conduz desde 11/09", review_at: "2026-10-01" }),
    "Acordo: Nelson conduz desde 11/09 · revisar em 01/10"
  );
  assert.equal(linhaAcordo(null), null);
  assert.equal(
    linhaUltimoCombinado({ commitment: "Carla volta com a rotina até 29/09", created_at: "2026-09-15" }),
    "Combinado em 15/09: Carla volta com a rotina até 29/09"
  );
  assert.equal(linhaUltimoCombinado({}), null);
});

test("validarRegistro exige canal e resultado", () => {
  assert.equal(validarRegistro({}), "Escolha como você falou com a unidade.");
  assert.equal(validarRegistro({ channel: "mensagem" }), "Escolha o resultado da conversa.");
  assert.equal(validarRegistro({ channel: "mensagem", outcome: "vai_fazer" }), null);
});

test("validarRegistro exige data quando 'voltar em' = escolher data (fora de resolvido)", () => {
  assert.equal(
    validarRegistro({ channel: "mensagem", outcome: "vai_fazer", nextAtChave: "data", nextAtData: null }),
    "Escolha a data de voltar."
  );
  assert.equal(
    validarRegistro({ channel: "mensagem", outcome: "vai_fazer", nextAtChave: "data", nextAtData: "2026-10-01" }),
    null
  );
  // "resolvido" não precisa de data de voltar
  assert.equal(
    validarRegistro({ channel: "mensagem", outcome: "resolvido", nextAtChave: "data", nextAtData: null }),
    null
  );
});

test("validarRegistro limita a nota a 1000 caracteres", () => {
  const nota = "a".repeat(1001);
  assert.equal(
    validarRegistro({ channel: "mensagem", outcome: "vai_fazer", note: nota }),
    "A nota pode ter no máximo 1000 caracteres."
  );
});

test("motivoChipClasse usa tokens, nunca cor crua", () => {
  for (const m of ["sem_venda", "caiu", "robo_parado", "nao_lanca", "sem_comprar", "manual"]) {
    const c = motivoChipClasse(m);
    assert.ok(!/#[0-9a-fA-F]{3,6}/.test(c), `sem hex em ${m}`);
    assert.ok(!/text-gray-|bg-red-|text-red-|text-green-/.test(c), `sem cor crua em ${m}`);
  }
});

console.log(`csMural.test.mjs: ${n} testes OK`);
