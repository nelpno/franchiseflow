/**
 * node src/lib/franchiseTeardown.test.mjs
 *
 * Os números do caso real (Cataguases, 09/09/2026) estão aqui de propósito: é o
 * resumo que a RPC devolveu na prova em transação abortada.
 */
import assert from "node:assert";
import {
  resumirExclusao,
  totalDeLinhas,
  separarUsuarios,
  limparStorageDaFranquia,
  BUCKETS_DA_FRANQUIA,
} from "./franchiseTeardown.js";

let passou = 0;
const testes = [];
function teste(nome, fn) {
  testes.push([nome, fn]);
}

const RESUMO_CATAGUASES = {
  sales: 93, contacts: 343, cs_tasks: 3, expenses: 9, audit_logs: 120, franchises: 1,
  sale_items: 155, cs_worklist: 1, cs_agreements: 1, daily_summaries: 191,
  inventory_items: 28, purchase_orders: 2, bot_conversations: 492, franchise_invites: 2,
  marketing_payments: 2, purchase_order_items: 28, system_subscriptions: 1,
  conversation_messages: 3806, daily_unique_contacts: 28, franchise_configurations: 1,
};

teste("ordena da maior quantidade para a menor", () => {
  const linhas = resumirExclusao(RESUMO_CATAGUASES);
  assert.strictEqual(linhas[0].tabela, "conversation_messages");
  assert.strictEqual(linhas[0].quantidade, 3806);
  assert.strictEqual(linhas[1].tabela, "bot_conversations");
});

teste("a propria franquia NAO entra na lista de itens", () => {
  assert.ok(!resumirExclusao(RESUMO_CATAGUASES).some((l) => l.tabela === "franchises"));
});

teste("traduz nome de tabela para linguagem de gente", () => {
  const porTabela = Object.fromEntries(resumirExclusao(RESUMO_CATAGUASES).map((l) => [l.tabela, l.rotulo]));
  assert.strictEqual(porTabela.sales, "vendas");
  assert.strictEqual(porTabela.cs_tasks, "cartões do Customer Success");
  assert.strictEqual(porTabela.system_subscriptions, "assinatura do sistema");
});

teste("tabela sem rotulo aparece com o nome cru, nao some", () => {
  const linhas = resumirExclusao({ tabela_futura_qualquer: 7 });
  assert.strictEqual(linhas.length, 1);
  assert.strictEqual(linhas[0].rotulo, "tabela_futura_qualquer");
});

teste("zero nao vira linha na tela", () => {
  assert.deepStrictEqual(resumirExclusao({ sales: 0, contacts: 5 }).map((l) => l.tabela), ["contacts"]);
});

teste("resumo ausente ou invalido devolve lista vazia", () => {
  assert.deepStrictEqual(resumirExclusao(null), []);
  assert.deepStrictEqual(resumirExclusao(undefined), []);
  assert.deepStrictEqual(resumirExclusao("nada"), []);
});

teste("total nao conta a franquia em si", () => {
  const semFranquia = { ...RESUMO_CATAGUASES };
  delete semFranquia.franchises;
  const esperado = Object.values(semFranquia).reduce((a, b) => a + b, 0);
  assert.strictEqual(totalDeLinhas(RESUMO_CATAGUASES), esperado);
  assert.strictEqual(totalDeLinhas(RESUMO_CATAGUASES), 5306);
});

teste("separa conta apagada de conta so desvinculada", () => {
  const { apagados, desvinculados } = separarUsuarios([
    { acao: "conta_apagada", nome: "Anderson" },
    { acao: "desvinculado", nome: "Celso", franquias_restantes: 4 },
    { acao: "conta_apagada", nome: "Anderson" },
  ]);
  assert.strictEqual(apagados.length, 2);
  assert.strictEqual(desvinculados.length, 1);
  assert.strictEqual(desvinculados[0].nome, "Celso");
});

teste("lista de usuarios ausente nao quebra", () => {
  assert.deepStrictEqual(separarUsuarios(undefined), { apagados: [], desvinculados: [] });
});

// --- Storage ---------------------------------------------------------------

function supabaseFalso({ porBucket = {}, erroList = null, erroRemove = null } = {}) {
  const removidos = [];
  return {
    removidos,
    storage: {
      from(bucket) {
        return {
          async list(prefixo) {
            if (erroList) return { data: null, error: new Error(erroList) };
            return { data: (porBucket[bucket] || []).map((name, i) => ({ name, id: `id${i}` })), error: null };
          },
          async remove(caminhos) {
            if (erroRemove) return { error: new Error(erroRemove) };
            removidos.push({ bucket, caminhos });
            return { error: null };
          },
        };
      },
    },
  };
}

teste("apaga os arquivos da pasta da unidade em todos os buckets", async () => {
  const sb = supabaseFalso({
    porBucket: { "catalog-images": ["catalogo.jpg"], "marketing-comprovantes": ["2026-04_1.jpg", "2026-05_2.jpg"] },
  });
  const { apagados, falhas } = await limparStorageDaFranquia(sb, "franquiacataguasesmg");
  assert.deepStrictEqual(falhas, []);
  assert.deepStrictEqual(apagados, [
    "catalog-images/franquiacataguasesmg/catalogo.jpg",
    "marketing-comprovantes/franquiacataguasesmg/2026-04_1.jpg",
    "marketing-comprovantes/franquiacataguasesmg/2026-05_2.jpg",
  ]);
});

teste("bucket vazio nao chama remove", async () => {
  const sb = supabaseFalso({ porBucket: {} });
  const { apagados } = await limparStorageDaFranquia(sb, "franquiax");
  assert.deepStrictEqual(apagados, []);
  assert.deepStrictEqual(sb.removidos, []);
});

teste("falha no Storage NAO lanca — devolve o que falhou", async () => {
  const sb = supabaseFalso({ porBucket: { "catalog-images": ["catalogo.jpg"] }, erroRemove: "row-level security" });
  const { apagados, falhas } = await limparStorageDaFranquia(sb, "franquiax");
  assert.deepStrictEqual(apagados, []);
  // so o bucket que TINHA arquivo falha; os vazios nem chamam remove
  assert.strictEqual(falhas.length, 1);
  assert.strictEqual(falhas[0].bucket, "catalog-images");
  assert.match(falhas[0].motivo, /row-level security/);
  assert.strictEqual(BUCKETS_DA_FRANQUIA.length, 3);
});

teste("placeholder de pasta vazia (id null) nao entra na lista", async () => {
  const sb = {
    storage: {
      from: () => ({
        async list() {
          return { data: [{ name: ".emptyFolderPlaceholder", id: null }], error: null };
        },
        async remove() {
          throw new Error("nao deveria chamar remove");
        },
      }),
    },
  };
  const { apagados, falhas } = await limparStorageDaFranquia(sb, "franquiax");
  assert.deepStrictEqual(apagados, []);
  assert.deepStrictEqual(falhas, []);
});

for (const [nome, fn] of testes) {
  try {
    await fn();
    passou++;
  } catch (e) {
    console.error(`FALHOU: ${nome}\n  ${e.message}`);
    process.exitCode = 1;
  }
}
if (!process.exitCode) console.log(`franchiseTeardown: ${passou} testes OK`);
