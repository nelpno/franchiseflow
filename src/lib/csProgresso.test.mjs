// node src/lib/csProgresso.test.mjs
import assert from "node:assert/strict";
import {
  hojeSP, segundaDaSemana, domingoDaSemana, inicioDoMes, fimDoMes,
  periodoRange, periodoAnterior, periodoProximo, podeAvancar, rotuloPeriodo,
  periodoValido, refValida, textoMedianaContato, serieSemanal,
  textoFalarHojeAtrasado, textoEsquecidos, textoQuedasSemCartao,
  poucosCasos, textoPoucosCasos, textoAcimaControle, textoMedianaVsControle,
  textoAntesDepois, textoJaVinha, corVsControle, rotuloTipoImpacto,
  MOTIVO_LABEL, DESFECHO_LABEL, CANAL_LABEL, ORDEM_DESFECHOS, RESSALVAS_PADRAO,
} from "./csProgresso.js";

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

// ---- período: semana ----

test("segundaDaSemana/domingoDaSemana: sábado 26/09/2026 -> semana 21-27/09", () => {
  assert.equal(segundaDaSemana("2026-09-26"), "2026-09-21");
  assert.equal(domingoDaSemana("2026-09-26"), "2026-09-27");
});

test("segundaDaSemana: a própria segunda-feira fica nela mesma", () => {
  assert.equal(segundaDaSemana("2026-09-21"), "2026-09-21");
});

test("segundaDaSemana: domingo pertence à semana que começou na segunda anterior", () => {
  assert.equal(segundaDaSemana("2026-09-27"), "2026-09-21");
});

test("periodoRange(semana): ini/fim = segunda/domingo", () => {
  const r = periodoRange("semana", "2026-09-26", "2026-09-26");
  assert.deepEqual(r, { ini: "2026-09-21", fim: "2026-09-27" });
});

// ---- período: mês ----

test("inicioDoMes/fimDoMes", () => {
  assert.equal(inicioDoMes("2026-09-26"), "2026-09-01");
  assert.equal(fimDoMes("2026-09-26"), "2026-09-30");
  assert.equal(fimDoMes("2026-02-10"), "2026-02-28"); // 2026 não é bissexto
});

test("periodoRange(mes): mês corrente corta no hoje (setembro provisório, regra do estudo)", () => {
  const r = periodoRange("mes", "2026-09-01", "2026-09-26");
  assert.deepEqual(r, { ini: "2026-09-01", fim: "2026-09-26" });
});

test("periodoRange(mes): mês passado vai até o último dia", () => {
  const r = periodoRange("mes", "2026-08-05", "2026-09-26");
  assert.deepEqual(r, { ini: "2026-08-01", fim: "2026-08-31" });
});

// ---- navegação ----

test("periodoAnterior/periodoProximo (semana)", () => {
  assert.equal(periodoAnterior("semana", "2026-09-26"), "2026-09-14");
  assert.equal(periodoProximo("semana", "2026-09-14"), "2026-09-21");
});

test("periodoAnterior/periodoProximo (mes)", () => {
  assert.equal(periodoAnterior("mes", "2026-09-01"), "2026-08-01");
  assert.equal(periodoProximo("mes", "2026-08-01"), "2026-09-01");
});

test("podeAvancar: falso na semana/mês atual, verdadeiro no passado", () => {
  const hoje = "2026-09-26";
  assert.equal(podeAvancar("semana", "2026-09-26", hoje), false);
  assert.equal(podeAvancar("semana", "2026-09-14", hoje), true);
  assert.equal(podeAvancar("mes", "2026-09-01", hoje), false);
  assert.equal(podeAvancar("mes", "2026-08-01", hoje), true);
});

test("periodoValido/refValida", () => {
  assert.equal(periodoValido("semana"), true);
  assert.equal(periodoValido("mes"), true);
  assert.equal(periodoValido("ano"), false);
  assert.equal(periodoValido(undefined), false);
  assert.equal(refValida("2026-09-26"), true);
  assert.equal(refValida("26/09/2026"), false);
  assert.equal(refValida(""), false);
});

test("rotuloPeriodo(mes)", () => {
  assert.equal(rotuloPeriodo("mes", "2026-09-01"), "Setembro de 2026");
});

test("rotuloPeriodo(semana): mesmo mês", () => {
  assert.equal(rotuloPeriodo("semana", "2026-09-26", "2026-09-26"), "21–27 de setembro");
});

test("rotuloPeriodo(semana): atravessa o mês", () => {
  // semana de 28/09 a 04/10/2026 (segunda 28/09)
  assert.equal(rotuloPeriodo("semana", "2026-09-30", "2026-09-30"), "28 de setembro–4 de outubro");
});

// ---- Bloco 1 ----

test("textoMedianaContato", () => {
  assert.equal(textoMedianaContato(2), "Mediana: 2 dias até o 1º contato");
  assert.equal(textoMedianaContato(1), "Mediana: 1 dia até o 1º contato");
  assert.equal(textoMedianaContato(0), "Mediana: no mesmo dia");
  assert.equal(textoMedianaContato(null), "Sem dado ainda");
  assert.equal(textoMedianaContato(undefined), "Sem dado ainda");
});

test("serieSemanal: normaliza altura pela maior semana (dados reais da tabela 4.1)", () => {
  const porSemana = [
    { semana_ini: "2026-07-06", conversas: 40, unidades: 12, reunioes: 2 },
    { semana_ini: "2026-07-13", conversas: 26, unidades: 10, reunioes: 0 },
  ];
  const s = serieSemanal(porSemana, "conversas");
  assert.equal(s.length, 2);
  assert.equal(s[0].valor, 40);
  assert.equal(s[0].alturaPct, 100);
  assert.equal(s[1].valor, 26);
  assert.equal(s[1].alturaPct, 65);
});

test("serieSemanal: série toda zero não divide por zero", () => {
  const s = serieSemanal([{ semana_ini: "2026-09-21", conversas: 0 }], "conversas");
  assert.equal(s[0].alturaPct, 0);
});

test("serieSemanal: campo ausente/lista vazia não quebra", () => {
  assert.deepEqual(serieSemanal(undefined, "conversas"), []);
  assert.deepEqual(serieSemanal(null, "conversas"), []);
});

// ---- Bloco 2 ----

test("textoFalarHojeAtrasado/textoEsquecidos/textoQuedasSemCartao", () => {
  assert.equal(textoFalarHojeAtrasado(0), "Nenhum esperando há mais de 2 dias.");
  assert.equal(textoFalarHojeAtrasado(1), "1 unidade esperando há mais de 2 dias.");
  assert.equal(textoFalarHojeAtrasado(3), "3 unidades esperando há mais de 2 dias.");
  assert.equal(textoEsquecidos(0), "Nenhum cartão esquecido.");
  assert.equal(textoEsquecidos(5), "5 cartões parados há 7+ dias.");
  assert.equal(textoQuedasSemCartao([]), "Nenhuma queda sem cartão.");
  assert.equal(textoQuedasSemCartao([{ franchise_id: "x" }]), "1 queda sem cartão.");
  assert.equal(
    textoQuedasSemCartao([{ franchise_id: "x" }, { franchise_id: "y" }]),
    "2 quedas sem cartão."
  );
});

// ---- Bloco 5 (placar de impacto) ----

test("poucosCasos: regra n < 5 do prompt", () => {
  assert.equal(poucosCasos(4), true);
  assert.equal(poucosCasos(5), false);
  assert.equal(poucosCasos(0), true);
  assert.equal(poucosCasos(null), true);
  assert.equal(poucosCasos(undefined), true);
  assert.equal(textoPoucosCasos(), "Poucos casos para concluir.");
});

test("textoAcimaControle: reunião estruturada 6 de 7 (tabela 4.3 do estudo)", () => {
  assert.equal(textoAcimaControle(6, 7), "6 de 7 acima do controle");
});

test("textoMedianaVsControle", () => {
  assert.equal(textoMedianaVsControle(21), "+21 p.p. vs controle");
  assert.equal(textoMedianaVsControle(-5), "−5 p.p. vs controle");
  assert.equal(textoMedianaVsControle(null), "");
  assert.equal(textoMedianaVsControle(undefined), "");
});

test("textoAntesDepois: episódio Campo Belo (tabela 4.3)", () => {
  assert.equal(textoAntesDepois(82, 152), "R$ 82 → R$ 152/dia");
  assert.equal(textoAntesDepois(null, 100), "— → R$ 100/dia");
});

test("textoJaVinha: sinais opostos (Campo Belo caindo, Santo André subindo)", () => {
  assert.equal(textoJaVinha(-55), "caindo (−55%)");
  assert.equal(textoJaVinha(32), "subindo (+32%)");
  assert.equal(textoJaVinha(null), "");
});

test("corVsControle: acima do controle = ok, abaixo = err", () => {
  assert.equal(corVsControle(63), "text-ok-ink");
  assert.equal(corVsControle(-7), "text-err");
  assert.equal(corVsControle(null), "text-ink-2");
});

test("rotuloTipoImpacto", () => {
  assert.equal(rotuloTipoImpacto("reuniao"), "Reunião estruturada");
  assert.equal(rotuloTipoImpacto("mensagem"), "Mensagem/contato solto");
  assert.equal(rotuloTipoImpacto("outro"), "outro");
});

// ---- rótulos (contrato) ----

test("rótulos batem com o CONTRATO.md (motivo/desfecho/canal)", () => {
  assert.equal(MOTIVO_LABEL.sem_venda, "Sem venda");
  assert.equal(MOTIVO_LABEL.caiu, "Caiu");
  assert.equal(MOTIVO_LABEL.nao_lanca, "Não lança venda");
  assert.equal(MOTIVO_LABEL.robo_parado, "Robô parado");
  assert.equal(MOTIVO_LABEL.sem_comprar, "Sem comprar da fábrica");
  assert.equal(MOTIVO_LABEL.manual, "Cartão manual");
  assert.equal(DESFECHO_LABEL.resolvido, "Resolvido");
  assert.equal(DESFECHO_LABEL.combinado_feito, "Combinado feito");
  assert.equal(DESFECHO_LABEL.recusou, "Franqueado recusou");
  assert.equal(DESFECHO_LABEL.nao_responde, "Não responde");
  assert.equal(DESFECHO_LABEL.vai_para_nelson, "Vai para o Nelson");
  assert.equal(DESFECHO_LABEL.resolveu_sozinho, "Resolveu sozinho");
  assert.equal(CANAL_LABEL.mensagem, "Mensagem");
  assert.equal(CANAL_LABEL.ligacao, "Ligação");
  assert.equal(CANAL_LABEL.reuniao, "Reunião feita");
  assert.equal(ORDEM_DESFECHOS[ORDEM_DESFECHOS.length - 1], "resolveu_sozinho");
  assert.equal(ORDEM_DESFECHOS.length, 6);
});

test("ressalvas padrão: sempre presentes (amostra pequena, engajamento, regressão, subnotificação)", () => {
  assert.equal(RESSALVAS_PADRAO.length, 4);
  assert.ok(RESSALVAS_PADRAO.some((t) => /amostra/i.test(t)));
  assert.ok(RESSALVAS_PADRAO.some((t) => /engajad/i.test(t)));
  assert.ok(RESSALVAS_PADRAO.some((t) => /regress/i.test(t)));
  assert.ok(RESSALVAS_PADRAO.some((t) => /subnotifica/i.test(t)));
});

test("hojeSP: string 'YYYY-MM-DD'", () => {
  assert.match(hojeSP(new Date("2026-09-26T15:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
});

console.log(`OK — ${passed} testes`);
