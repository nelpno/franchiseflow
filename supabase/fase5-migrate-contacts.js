/**
 * Migration script: clientes_franquias (OLD Supabase) → contacts (NEW Supabase)
 *
 * Usage:
 *   OLD_SUPABASE_SERVICE_KEY=... \
 *   VITE_SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node supabase/fase5-migrate-contacts.js
 *
 * Idempotent — uses upsert with (franchise_id, telefone) merge-duplicates.
 * Requires Node 18+ (native fetch).
 */

const OLD_SUPABASE_URL = 'https://kypcxjlinqdonfljefxu.supabase.co';
const OLD_SUPABASE_SERVICE_KEY = process.env.OLD_SUPABASE_SERVICE_KEY;
const NEW_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const NEW_SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OLD_SUPABASE_SERVICE_KEY || !NEW_SUPABASE_URL || !NEW_SUPABASE_SERVICE_KEY) {
  console.error(
    'Missing env vars. Required:\n' +
    '  OLD_SUPABASE_SERVICE_KEY  — service_role key for kypcxjlinqdonfljefxu\n' +
    '  VITE_SUPABASE_URL         — URL of the new FranchiseFlow Supabase\n' +
    '  SUPABASE_SERVICE_ROLE_KEY — service_role key for the new Supabase'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// City tables to migrate
// ---------------------------------------------------------------------------
const CITY_TABLES = [
  'americana', 'araraquara', 'araras', 'assis', 'barretos', 'bauru',
  'cajamar', 'campinas', 'campobelo', 'cataguases', 'cordeiroiracemapolis',
  'cotia', 'embu', 'guarapiranga', 'guaruja', 'hortolandia', 'indaiatuba',
  'itapetininga', 'itapolis', 'itatiba', 'jdmarajoara', 'limeira', 'maua',
  'mogi', 'novaodessa', 'osasco', 'paranapanema', 'piratininga',
  'praiagrande', 'ribeiraopreto', 'rioclaro', 'riopreto',
  'santanadeparnaiba', 'santoandre', 'santos', 'saocarlos',
  'saomiguelpaulista', 'sorocabamariaaprado', 'sorocabavilajardini',
  'suzano', 'ubatuba', 'uberlandia', 'viladosremedios', 'vilamaria',
  'vilasocorro',
];

// Skipped tables (duplicates / non-contact):
// maua_x, piratininga_2, saocarlos_2, documentssecretaria

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all rows from an OLD Supabase table, handling pagination (1000-row pages).
 */
async function fetchAllFromOld(tableName) {
  const rows = [];
  let offset = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const url =
      `${OLD_SUPABASE_URL}/rest/v1/${tableName}?select=*&offset=${offset}&limit=${PAGE_SIZE}`;
    const res = await fetch(url, {
      headers: {
        apikey: OLD_SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${OLD_SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GET ${tableName} failed (${res.status}): ${body}`);
    }

    const page = await res.json();
    rows.push(...page);

    if (page.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
  }

  return rows;
}

/**
 * Upsert a batch of contact rows into the NEW Supabase contacts table.
 * Uses Prefer: resolution=merge-duplicates so re-runs are safe.
 * Batches in groups of 500 to avoid payload limits.
 */
async function upsertToNew(contacts) {
  const BATCH_SIZE = 500;

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${NEW_SUPABASE_URL}/rest/v1/contacts`, {
      method: 'POST',
      headers: {
        apikey: NEW_SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${NEW_SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`UPSERT contacts failed (${res.status}): ${body}`);
    }
  }
}

/**
 * Determine contact status based on old "pedido" field.
 */
function deriveStatus(pedido) {
  if (pedido && String(pedido).trim() !== '') return 'cliente';
  return 'novo_lead';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Migrate clientes_franquias → contacts ===\n');
  console.log(`OLD Supabase: ${OLD_SUPABASE_URL}`);
  console.log(`NEW Supabase: ${NEW_SUPABASE_URL}\n`);

  let totalRead = 0;
  let totalWritten = 0;
  let totalSkipped = 0;
  const errors = [];

  for (const table of CITY_TABLES) {
    const franchiseId = `franquia${table}`;

    try {
      const rows = await fetchAllFromOld(table);
      console.log(`[${table}] Read ${rows.length} rows → franchise_id="${franchiseId}"`);
      totalRead += rows.length;

      if (rows.length === 0) {
        console.log(`[${table}] Empty table, skipping.`);
        continue;
      }

      // Map old fields → new contacts schema
      const contacts = [];
      for (const row of rows) {
        const telefone = row.telefone ? String(row.telefone).trim() : null;
        if (!telefone) {
          totalSkipped++;
          continue; // skip rows without phone number
        }

        contacts.push({
          franchise_id: franchiseId,
          telefone,
          nome: row.nome ? String(row.nome).trim() : null,
          status: deriveStatus(row.pedido),
          created_at: row.created_at || new Date().toISOString(),
        });
      }

      if (contacts.length === 0) {
        console.log(`[${table}] No valid contacts (all missing telefone), skipping.`);
        continue;
      }

      await upsertToNew(contacts);
      totalWritten += contacts.length;
      console.log(`[${table}] Upserted ${contacts.length} contacts.`);
    } catch (err) {
      console.error(`[${table}] ERROR: ${err.message}`);
      errors.push({ table, error: err.message });
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Tables processed: ${CITY_TABLES.length}`);
  console.log(`Total rows read:    ${totalRead}`);
  console.log(`Total upserted:     ${totalWritten}`);
  console.log(`Skipped (no phone): ${totalSkipped}`);

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors) {
      console.log(`  - ${e.table}: ${e.error}`);
    }
    process.exit(1);
  }

  console.log('\nDone! Migration completed successfully.');
}

main();
