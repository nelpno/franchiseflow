// node src/lib/primeirosPassosAviso.test.mjs
import assert from "node:assert/strict";
import { tarefasFeitas, mensagemPronto, uniao, chaveFeitas } from "./primeirosPassosAviso.js";
import { montarJornada } from "./onboardingJourney.js";

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

const jornada = (feitas, agoraTitulo = "Fazer o primeiro pedido") => ({
  agora: agoraTitulo ? { titulo: agoraTitulo } : null,
  passos: [
    {
      tarefas: [
        { id: "fiscal", tipo: "auto", titulo: "Confirmar os dados", feita: feitas.includes("fiscal") },
        { id: "dica_x", tipo: "dica", titulo: "Uma dica", feita: null },
        { id: "p_whatsapp_ok", tipo: "confirmacao", titulo: "WhatsApp pronto", feita: feitas.includes("p_whatsapp_ok") },
      ],
    },
    {
      tarefas: [
        { id: "vendedor", tipo: "auto", titulo: "Preencher o Meu Vendedor", feita: feitas.includes("vendedor") },
        { id: "material_y", tipo: "material", titulo: "Drive", feita: null },
      ],
    },
  ],
});

test("só automáticas e confirmações contam", () => {
  assert.deepEqual(tarefasFeitas(jornada(["fiscal", "p_whatsapp_ok"])), ["fiscal", "p_whatsapp_ok"]);
  assert.deepEqual(tarefasFeitas(null), []);
});

test("sem base (null) não avisa", () => {
  assert.equal(mensagemPronto(jornada(["fiscal"]), null), null);
});

test("base vazia avisa a primeira tarefa feita (unidade que começou do zero)", () => {
  assert.equal(
    mensagemPronto(jornada(["fiscal"]), []),
    "Pronto: Confirmar os dados. Próximo: Fazer o primeiro pedido"
  );
});

test("nada novo não avisa", () => {
  assert.equal(mensagemPronto(jornada(["fiscal", "vendedor"]), ["fiscal", "vendedor"]), null);
});

test("tarefa desfeita não avisa", () => {
  assert.equal(mensagemPronto(jornada(["fiscal"]), ["fiscal", "vendedor"]), null);
});

test("última tarefa: sem 'Próximo'", () => {
  assert.equal(mensagemPronto(jornada(["fiscal", "vendedor"], null), ["fiscal"]), "Pronto: Preencher o Meu Vendedor");
});

test("união não repete e aceita null", () => {
  assert.deepEqual(uniao(["a", "b"], ["b", "c"]), ["a", "b", "c"]);
  assert.deepEqual(uniao(null, ["a"]), ["a"]);
});

test("chave por unidade", () => {
  assert.equal(chaveFeitas("maxiexemplo"), "primeiros_passos_feitas_maxiexemplo");
});

test("formato real do montarJornada: confirmação marcada entra, e o aviso usa o título dela", () => {
  const antes = montarJornada({ franchise: {}, config: {}, facts: {}, items: {} });
  const depois = montarJornada({ franchise: {}, config: {}, facts: {}, items: { p_whatsapp_ok: "2026-09-17T10:00:00Z" } });
  assert.ok(!tarefasFeitas(antes).includes("p_whatsapp_ok"));
  assert.ok(tarefasFeitas(depois).includes("p_whatsapp_ok"));
  const msg = mensagemPronto(depois, tarefasFeitas(antes));
  assert.match(msg, /^Pronto: Meu WhatsApp Business está pronto/);
  assert.match(msg, /Próximo: /);
});

console.log(`${passed} testes de primeirosPassosAviso passaram.`);
