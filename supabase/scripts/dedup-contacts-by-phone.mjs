#!/usr/bin/env node
// =============================================================================
// dedup-contacts-by-phone.mjs - Fase 4 do plano de normalizacao
// =============================================================================
// Merge de contatos duplicados por (franchise_id, telefone_normalizado).
//
// Escolha do canonico (KEEP):
//   1. Mais vendas (sales.contact_id count)
//   2. Empate -> source='manual' > 'bot'
//   3. Empate -> maior total_spent
//   4. Empate -> created_at mais antigo
//   5. Empate -> UUID lexicografico menor
//
// Fluxo:
//   --dry-run (default): lista 38 grupos, decisoes, gera backup JSON
//   --apply: executa merge em TX por grupo
//   --include-ambiguous: processa grupos onde 2+ ids tem vendas (revisao humana)
//
// Uso:
//   SUPABASE_MANAGEMENT_TOKEN=sbp_... node dedup-contacts-by-phone.mjs [--apply] [--include-ambiguous]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_REF = 'sulgicnqqopyhulglakd';
const TOKEN = process.env.SUPABASE_MANAGEMENT_TOKEN;
if (!TOKEN) {
  console.error('ERRO: SUPABASE_MANAGEMENT_TOKEN nao definido no ambiente.');
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const INCLUDE_AMBIGUOUS = args.includes('--include-ambiguous');

async function sql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );
  const json = await res.json();
  if (!res.ok || json?.message) {
    throw new Error(`SQL error: ${JSON.stringify(json)}\nQuery: ${query.slice(0, 500)}`);
  }
  return json;
}

function sqlLit(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

// -----------------------------------------------------------------------------
// 1. Buscar grupos duplicados com info de vendas
// -----------------------------------------------------------------------------
async function fetchDuplicateGroups() {
  const rows = await sql(`
    WITH normalized AS (
      SELECT
        id, franchise_id, nome, telefone, endereco, bairro, notas,
        source, status, ctwa_clid,
        purchase_count, total_spent, last_purchase_at,
        created_at, updated_at,
        public.normalize_phone_br(telefone) AS norm
      FROM contacts
      WHERE telefone IS NOT NULL AND telefone <> ''
    ),
    sales_per_contact AS (
      SELECT contact_id, COUNT(*)::int AS n_sales
      FROM sales GROUP BY contact_id
    ),
    duplicates AS (
      SELECT franchise_id, norm
      FROM normalized
      WHERE norm IS NOT NULL AND norm <> ''
      GROUP BY franchise_id, norm
      HAVING COUNT(*) > 1
    )
    SELECT
      n.franchise_id, n.norm, n.id, n.nome, n.telefone, n.endereco, n.bairro,
      n.notas, n.source, n.status, n.ctwa_clid,
      n.purchase_count, n.total_spent, n.last_purchase_at,
      n.created_at, n.updated_at,
      COALESCE(sp.n_sales, 0) AS n_sales
    FROM normalized n
    JOIN duplicates d ON d.franchise_id = n.franchise_id AND d.norm = n.norm
    LEFT JOIN sales_per_contact sp ON sp.contact_id = n.id
    ORDER BY n.franchise_id, n.norm, COALESCE(sp.n_sales, 0) DESC, n.created_at;
  `);

  // Agrupar por (franchise_id, norm)
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.franchise_id}|${r.norm}`;
    if (!groups.has(key)) {
      groups.set(key, {
        franchise_id: r.franchise_id,
        norm: r.norm,
        contacts: [],
      });
    }
    groups.get(key).contacts.push(r);
  }
  return Array.from(groups.values());
}

// -----------------------------------------------------------------------------
// 2. Escolher KEEP por grupo
// -----------------------------------------------------------------------------
function chooseKeep(contacts) {
  const sorted = [...contacts].sort((a, b) => {
    if (b.n_sales !== a.n_sales) return b.n_sales - a.n_sales;
    const ao = a.source === 'manual' ? 0 : 1;
    const bo = b.source === 'manual' ? 0 : 1;
    if (ao !== bo) return ao - bo;
    const at = Number(a.total_spent || 0);
    const bt = Number(b.total_spent || 0);
    if (bt !== at) return bt - at;
    const ac = new Date(a.created_at).getTime();
    const bc = new Date(b.created_at).getTime();
    if (ac !== bc) return ac - bc;
    return a.id.localeCompare(b.id);
  });
  return { keep: sorted[0], drops: sorted.slice(1) };
}

// -----------------------------------------------------------------------------
// 3. Executar merge de um grupo em TX unica
// -----------------------------------------------------------------------------
async function applyGroup(group, keep, drop) {
  const mergedEndereco = keep.endereco && String(keep.endereco).trim() !== '' ? keep.endereco : drop.endereco;
  const mergedBairro   = keep.bairro   && String(keep.bairro).trim()   !== '' ? keep.bairro   : drop.bairro;
  const mergedNome     = keep.nome     && String(keep.nome).trim()     !== '' ? keep.nome     : drop.nome;
  const mergedNotas    = keep.notas    && String(keep.notas).trim()    !== '' ? keep.notas    : drop.notas;
  const mergedCtwa     = keep.ctwa_clid ?? drop.ctwa_clid;

  // Ordem importa: DELETE do DROP antes do UPDATE do KEEP,
  // senao o UPDATE tenta gravar o telefone normalizado que o DROP ainda tem -> UNIQUE violation.
  const query = `
    BEGIN;
    UPDATE sales SET contact_id = ${sqlLit(keep.id)} WHERE contact_id = ${sqlLit(drop.id)};
    DELETE FROM contacts WHERE id = ${sqlLit(drop.id)};
    UPDATE contacts SET
      telefone = ${sqlLit(group.norm)},
      endereco = ${sqlLit(mergedEndereco)},
      bairro   = ${sqlLit(mergedBairro)},
      nome     = ${sqlLit(mergedNome)},
      notas    = ${sqlLit(mergedNotas)},
      ctwa_clid= ${sqlLit(mergedCtwa)},
      purchase_count  = (SELECT COUNT(*)::int               FROM sales WHERE contact_id = ${sqlLit(keep.id)}),
      total_spent     = (SELECT COALESCE(SUM(value), 0)     FROM sales WHERE contact_id = ${sqlLit(keep.id)}),
      last_purchase_at= (SELECT MAX(sale_date)::timestamptz FROM sales WHERE contact_id = ${sqlLit(keep.id)}),
      updated_at = now()
    WHERE id = ${sqlLit(keep.id)};
    COMMIT;
  `;

  await sql(query);
}

// -----------------------------------------------------------------------------
// 4. Principal
// -----------------------------------------------------------------------------
async function main() {
  console.log(`[dedup-contacts-by-phone] mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}${INCLUDE_AMBIGUOUS ? ' +ambiguous' : ''}`);

  const groups = await fetchDuplicateGroups();
  console.log(`\nGrupos duplicados encontrados: ${groups.length}`);

  const trivial = [];
  const ambiguous = [];
  for (const g of groups) {
    const withSales = g.contacts.filter((c) => c.n_sales > 0).length;
    if (withSales >= 2) ambiguous.push(g);
    else trivial.push(g);
  }
  console.log(`  triviais (0 ou 1 lado com vendas): ${trivial.length}`);
  console.log(`  ambiguos (2+ lados com vendas):    ${ambiguous.length}`);

  // Backup
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const backupFile = path.join(backupDir, `dedup-contacts-${ts}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        mode: APPLY ? 'apply' : 'dry-run',
        include_ambiguous: INCLUDE_AMBIGUOUS,
        total_groups: groups.length,
        groups,
      },
      null,
      2
    )
  );
  console.log(`\nBackup JSON salvo em: ${backupFile}`);

  const toProcess = INCLUDE_AMBIGUOUS ? [...trivial, ...ambiguous] : trivial;

  console.log('\n===== Decisoes por grupo =====');
  for (const g of toProcess) {
    const { keep, drops } = chooseKeep(g.contacts);
    console.log(`\n[${g.franchise_id} / ${g.norm}]`);
    console.log(`  KEEP: ${keep.id}  nome="${keep.nome}"  tel="${keep.telefone}"  source=${keep.source}  vendas=${keep.n_sales}`);
    for (const d of drops) {
      console.log(`  DROP: ${d.id}  nome="${d.nome}"  tel="${d.telefone}"  source=${d.source}  vendas=${d.n_sales}`);
    }
  }

  if (ambiguous.length > 0 && !INCLUDE_AMBIGUOUS) {
    console.log(`\n===== Grupos AMBIGUOS (pulados) =====`);
    for (const g of ambiguous) {
      console.log(`\n[${g.franchise_id} / ${g.norm}] -- revisar manualmente:`);
      for (const c of g.contacts) {
        console.log(`  ${c.id}  nome="${c.nome}"  tel="${c.telefone}"  source=${c.source}  vendas=${c.n_sales}  total=R$${c.total_spent}`);
      }
    }
    console.log('\nPara processar os ambiguos, rode novamente com --include-ambiguous.');
  }

  if (!APPLY) {
    console.log('\nDRY-RUN concluido. Execute com --apply para aplicar as mudancas.');
    return;
  }

  console.log('\n===== Aplicando merges =====');
  let ok = 0;
  let fail = 0;
  for (const g of toProcess) {
    const { keep, drops } = chooseKeep(g.contacts);
    for (const drop of drops) {
      try {
        await applyGroup(g, keep, drop);
        console.log(`  OK  ${g.franchise_id}/${g.norm}  keep=${keep.id.slice(0, 8)}  drop=${drop.id.slice(0, 8)}`);
        ok++;
      } catch (err) {
        console.error(`  FAIL ${g.franchise_id}/${g.norm}  drop=${drop.id.slice(0, 8)}: ${err.message}`);
        fail++;
      }
    }
  }
  console.log(`\nResumo: ${ok} sucessos, ${fail} falhas.`);

  // Re-check
  const recheck = await sql(`
    WITH normalized AS (
      SELECT franchise_id, public.normalize_phone_br(telefone) AS norm
      FROM contacts WHERE telefone IS NOT NULL AND telefone <> ''
    )
    SELECT COUNT(*)::int AS restantes FROM (
      SELECT franchise_id, norm FROM normalized
      WHERE norm IS NOT NULL AND norm <> ''
      GROUP BY 1, 2 HAVING COUNT(*) > 1
    ) x;
  `);
  console.log(`\nGrupos duplicados restantes: ${recheck[0].restantes}`);
}

main().catch((err) => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
