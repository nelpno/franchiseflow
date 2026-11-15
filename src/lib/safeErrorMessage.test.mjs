/**
 * Testes do safeErrorMessage — em especial a regra do 23514.
 *
 * O caso que originou: a franqueada do Guaruja tentou lancar venda com a data da
 * entrega, o trigger `sales_bloqueia_data_futura` recusou com um texto claro e
 * explicativo, e a tela mostrou "Erro inesperado. Tente novamente." Ela ficou sem
 * saber o motivo (audios de 08/09/2026). A de Cajamar tentou 8x seguidas.
 *
 *   node src/lib/safeErrorMessage.test.mjs
 */
import assert from "node:assert";
import { safeErrorMessage, ehErroDeRegra } from "./safeErrorMessage.js";

let passou = 0;
function teste(nome, fn) {
  try {
    fn();
    passou++;
  } catch (e) {
    console.error(`FALHOU: ${nome}\n  ${e.message}`);
    process.exitCode = 1;
  }
}

// --- 23514: mensagem de regra de negocio escrita PARA a pessoa ---------------

teste("23514 do trigger de data futura chega inteiro na tela", () => {
  const msg = safeErrorMessage(
    {
      code: "23514",
      message:
        "A data da venda (23/09/2026) está longe demais. Dá para lançar até 22/09/2026 (14 dias à frente). Confira o dia e o mês.",
    },
    "fallback",
  );
  assert.match(msg, /^A data da venda/);
  assert.match(msg, /22\/09\/2026/);
});

teste("23514 desconhecido NAO vaza — cai no fallback", () => {
  const msg = safeErrorMessage(
    { code: "23514", message: 'new row for relation "sales" violates check constraint "sales_value_check"' },
    "Não foi possível salvar.",
  );
  assert.strictEqual(msg, "Não foi possível salvar.");
});

teste("23514 nao vaza nome de tabela nem de constraint", () => {
  const msg = safeErrorMessage(
    { code: "23514", message: 'violates check constraint "expenses_category_check" on table "expenses"' },
    "Erro ao salvar.",
  );
  assert.ok(!/expenses/.test(msg), `vazou nome interno: ${msg}`);
});

// --- ehErroDeRegra: o que NAO adianta retentar ------------------------------

teste("erro de regra de negocio e reconhecido (nao retentar)", () => {
  assert.strictEqual(ehErroDeRegra({ code: "23514" }), true);
  assert.strictEqual(ehErroDeRegra({ code: "23505" }), true);
  assert.strictEqual(ehErroDeRegra({ code: "42501" }), true);
});

teste("falha de rede/timeout NAO e erro de regra (pode retentar)", () => {
  assert.strictEqual(ehErroDeRegra({ message: "Failed to fetch" }), false);
  assert.strictEqual(ehErroDeRegra({ message: "Tempo limite excedido" }), false);
  assert.strictEqual(ehErroDeRegra(null), false);
  assert.strictEqual(ehErroDeRegra({ code: "XX000" }), false);
});

// --- os mapeamentos que ja existiam continuam valendo ------------------------

teste("codigos conhecidos seguem mapeados", () => {
  assert.strictEqual(safeErrorMessage({ code: "23505" }, "x"), "Este registro já existe.");
  assert.strictEqual(safeErrorMessage({ code: "42501" }, "x"), "Sem permissão para esta ação.");
});

teste("mensagem crua desconhecida nao vaza", () => {
  const msg = safeErrorMessage({ message: 'relation "profiles" does not exist' }, "Erro.");
  assert.strictEqual(msg, "Erro.");
});

teste("erro nulo devolve o fallback", () => {
  assert.strictEqual(safeErrorMessage(null, "Meu fallback"), "Meu fallback");
});

if (!process.exitCode) console.log(`safeErrorMessage: ${passou} testes OK`);
