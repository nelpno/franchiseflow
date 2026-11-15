/**
 * Smoke test da tabela "Retorno da verba" com os dados REAIS do banco, renderizada em Node.
 *
 * Por que existe: MarketingPaymentsAdmin so aparece para admin/manager e a tela nao pode ser
 * exercitada sem sessao. Em vez de deployar no escuro, este script busca a RPC
 * get_marketing_attribution de verdade (service_role), renderiza o componente PURO
 * (RetornoDaVerba) com react-dom/server e confere o HTML que sai.
 *
 *   node scripts/smoke-retorno-marketing.mjs [AAAA-MM]
 *
 * O que ele pega, que build e lint nao pegam: NaN/Infinity/undefined vazando para a tela,
 * numero de linhas errado, e o rotulo do mes parcial sumindo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const RAIZ = path.resolve(fileURLToPath(import.meta.url), "../..");
const mes = process.argv[2] || "2026-08";

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(RAIZ, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

// ── 1. dados reais, direto da RPC ────────────────────────────────────────────────────────
// Pelo service_role a RPC devolveria ZERO: auth.uid() e nulo, is_admin_or_manager() da false
// e o guard corta. Entao rodamos pela Management API assumindo o contexto de um admin real.
const admin = "6f1c0626-e21c-482b-af9d-191a4f102907";
const resp = await fetch(
  `https://api.supabase.com/v1/projects/sulgicnqqopyhulglakd/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_MANAGEMENT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // ATENCAO: a Management API devolve o ultimo resultset NAO-VAZIO, nao o ultimo statement.
      // Se a RPC nao devolver linha nenhuma, sem o json_agg voltaria a linha do set_config e o
      // teste renderizaria um objeto {c: "..."} achando que era uma unidade.
      query: `set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','${admin}','role','authenticated')::text, true) as c;
select coalesce(json_agg(t), '[]'::json) as linhas from get_marketing_attribution('${mes}') t;`,
    }),
  }
);
if (!resp.ok) {
  console.error("RPC falhou:", resp.status, (await resp.text()).slice(0, 400));
  process.exit(1);
}
const linhas = (await resp.json())[0].linhas;
console.log(`RPC get_marketing_attribution('${mes}') -> ${linhas.length} unidades`);

// ── 2. bundle do componente (entities fica de fora: puxaria o cliente do Supabase) ────────
// o bundle fica DENTRO do projeto: em os.tmpdir() o Node nao acha o pacote react
const tmp = fs.mkdtempSync(path.join(RAIZ, ".tmp", "smoke-retorno-"));
const stub = path.join(tmp, "entities-stub.js");
fs.writeFileSync(stub, "export const getMarketingAttribution = async () => [];\n");
const saida = path.join(tmp, "bundle.mjs");

await build({
  entryPoints: [path.join(RAIZ, "src/components/marketing/MarketingRetornoPanel.jsx")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: saida,
  jsx: "automatic",
  external: ["react", "react-dom", "react/jsx-runtime"],
  alias: { "@/entities/all": stub },
  plugins: [
    {
      name: "alias-arroba",
      setup(b) {
        b.onResolve({ filter: /^@\// }, (args) => {
          if (args.path === "@/entities/all") return { path: stub };
          const base = path.join(RAIZ, "src", args.path.slice(2));
          for (const ext of ["", ".jsx", ".js", ".tsx", ".ts"]) {
            if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) {
              return { path: base + ext };
            }
          }
          return { errors: [{ text: `nao resolvi ${args.path}` }] };
        });
      },
    },
  ],
  // algum modulo da cadeia de ui/ le window no topo (window.self !== window.top).
  // O banner da a ele um window minimo — nao precisamos de DOM, so de nao explodir no import.
  banner: {
    js: [
      "globalThis.self ??= globalThis;",
      "globalThis.top ??= globalThis;",
      "globalThis.window ??= globalThis;",
      "globalThis.navigator ??= { userAgent: 'node' };",
      "globalThis.document ??= { createElement: () => ({ style: {} }), documentElement: { style: {} }, addEventListener() {}, removeEventListener() {} };",
    ].join(" "),
  },
  logLevel: "silent",
});

const { RetornoDaVerba } = await import("file:///" + saida.replace(/\\/g, "/"));

// ── 3. render + conferencias ─────────────────────────────────────────────────────────────
const html = renderToStaticMarkup(React.createElement(RetornoDaVerba, { linhas, month: mes }));
const conta = (sub) => html.split(sub).length - 1;

const somaReceitaAnuncio = linhas.reduce((s, l) => s + (parseFloat(l.receita_anuncio) || 0), 0);
const somaLiquido = linhas.reduce((s, l) => s + (parseFloat(l.verba_bruta) || 0) * 0.86, 0);
const roasRede = somaLiquido > 0 ? somaReceitaAnuncio / somaLiquido : null;
const comVerba = linhas.filter((l) => (parseFloat(l.verba_bruta) || 0) > 0).length;

const vazio = linhas.length === 0;
const provas = vazio
  ? [
      // mes sem dado nenhum: a tela tem de dizer isso, nao desenhar uma tabela vazia
      ["estado vazio explicito", html.includes("Nenhuma venda nem verba registrada neste mês.")],
      ["sem tabela quando nao ha dado", conta("<tr class=\"border-t") === 0],
      ["nenhum NaN/undefined no estado vazio", !html.includes("NaN") && !html.includes("undefined")],
    ]
  : [
  ["renderizou uma linha por unidade", conta("<tr class=\"border-t") === linhas.length],
  ["nenhum NaN na tela", !html.includes("NaN")],
  ["nenhum Infinity na tela", !html.includes("Infinity")],
  ["nenhum undefined na tela", !html.includes("undefined")],
  ["nenhum [object Object]", !html.includes("[object Object]")],
  ["mostra o retorno da rede", roasRede == null || html.includes(`${roasRede.toFixed(1).replace(".", ",")}×`)],
  [
    "quem nao pagou verba aparece como 'sem verba', nao como 0×",
    conta(">sem verba<") === linhas.length - comVerba,
  ],
  ["diz que a atribuicao e por contato (recompra conta)", html.includes("inclusive a recompra")],
  ["avisa que nao da para saber a campanha", html.includes("não chega no contato")],
  [
    "rotula mes em andamento so quando e o mes corrente",
    html.includes("mês em andamento") === (mes === new Date().toISOString().slice(0, 7)),
  ],
  ["as 4 ordenacoes estao na tela", conta("Maior retorno") + conta("Pior retorno") + conta("Mais receita de anúncio") + conta("Maior verba") === 4],
];

let ok = 0;
for (const [nome, passou] of provas) {
  console.log(`${passou ? "OK  " : "FALHOU"}  ${nome}`);
  if (passou) ok++;
}
console.log(
  `\nreceita de anuncio somada: R$ ${somaReceitaAnuncio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` +
    ` | verba liquida: R$ ${somaLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` +
    ` | retorno: ${roasRede == null ? "—" : roasRede.toFixed(1)}x`
);
console.log(`${ok}/${provas.length} provas`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(ok === provas.length ? 0 : 1);
