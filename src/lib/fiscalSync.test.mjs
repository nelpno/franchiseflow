/** node src/lib/fiscalSync.test.mjs — casos reais de 09/09/2026 (Bragança e Cajamar). */
import assert from "node:assert";
import {
  apenasDigitos,
  precisaSincronizarDocumento,
  formatarDocumento,
  descreverTrocaDocumento,
} from "./fiscalSync.js";

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

const CPF_LUIS = "06398291808";
const CNPJ_BRAGANCA = "20101159000100";

teste("caso Bragança: CPF vira CNPJ com cliente no ASAAS -> pergunta", () => {
  assert.strictEqual(
    precisaSincronizarDocumento({ docAntigo: CPF_LUIS, docNovo: CNPJ_BRAGANCA, temClienteAsaas: true }),
    true,
  );
});

teste("sem cliente no ASAAS NAO pergunta — o Criar ja nasce certo", () => {
  assert.strictEqual(
    precisaSincronizarDocumento({ docAntigo: CPF_LUIS, docNovo: CNPJ_BRAGANCA, temClienteAsaas: false }),
    false,
  );
});

teste("documento igual (so mudou mascara) NAO pergunta", () => {
  assert.strictEqual(
    precisaSincronizarDocumento({
      docAntigo: "20.101.159/0001-00",
      docNovo: "20101159000100",
      temClienteAsaas: true,
    }),
    false,
  );
});

teste("preencher documento pela PRIMEIRA vez nao e troca", () => {
  assert.strictEqual(
    precisaSincronizarDocumento({ docAntigo: "", docNovo: CNPJ_BRAGANCA, temClienteAsaas: true }),
    false,
  );
  assert.strictEqual(
    precisaSincronizarDocumento({ docAntigo: null, docNovo: CNPJ_BRAGANCA, temClienteAsaas: true }),
    false,
  );
});

teste("apagar o documento nao dispara pergunta", () => {
  assert.strictEqual(
    precisaSincronizarDocumento({ docAntigo: CNPJ_BRAGANCA, docNovo: "", temClienteAsaas: true }),
    false,
  );
});

teste("formata CPF e CNPJ inteiros, para conferencia", () => {
  assert.strictEqual(formatarDocumento(CPF_LUIS), "CPF 063.982.918-08");
  assert.strictEqual(formatarDocumento(CNPJ_BRAGANCA), "CNPJ 20.101.159/0001-00");
  assert.strictEqual(formatarDocumento(""), "(vazio)");
  assert.strictEqual(formatarDocumento("123"), "123");
});

teste("descreve a troca no sentido certo", () => {
  const pj = descreverTrocaDocumento(CPF_LUIS, CNPJ_BRAGANCA);
  assert.strictEqual(pj.viraPj, true);
  assert.strictEqual(pj.viraPf, false);
  assert.strictEqual(pj.resumo, "de pessoa física para empresa");
  assert.strictEqual(pj.antigo, "CPF 063.982.918-08");

  const pf = descreverTrocaDocumento(CNPJ_BRAGANCA, CPF_LUIS);
  assert.strictEqual(pf.viraPf, true);
  assert.strictEqual(pf.resumo, "de empresa para pessoa física");

  const outro = descreverTrocaDocumento("66629539000112", CNPJ_BRAGANCA);
  assert.strictEqual(outro.viraPj, false);
  assert.strictEqual(outro.resumo, "documento diferente");
});

teste("apenasDigitos aguenta nulo e mascara", () => {
  assert.strictEqual(apenasDigitos(null), "");
  assert.strictEqual(apenasDigitos("063.982.918-08"), CPF_LUIS);
});

if (!process.exitCode) console.log(`fiscalSync: ${passou} testes OK`);
