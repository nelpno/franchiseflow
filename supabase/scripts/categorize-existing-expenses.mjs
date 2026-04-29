#!/usr/bin/env node
/**
 * categorize-existing-expenses.mjs
 *
 * Heurística regex pra atribuir `category` em despesas existentes (137 despesas).
 * Padrão dry-run: gera CSV em backups/ e relatório por franquia. Não toca no DB.
 * Use --apply pra executar UPDATEs em batch (transação).
 *
 * Uso:
 *   node supabase/scripts/categorize-existing-expenses.mjs           # dry-run
 *   node supabase/scripts/categorize-existing-expenses.mjs --apply   # executa
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const ENV_PATH = path.join(ROOT, '.env');
const env = fs.readFileSync(ENV_PATH, 'utf-8');
const TOKEN = (env.match(/^SUPABASE_MANAGEMENT_TOKEN=(.*)$/m) || [])[1]?.trim();
const REF = 'sulgicnqqopyhulglakd';
if (!TOKEN) { console.error('SUPABASE_MANAGEMENT_TOKEN não encontrado'); process.exit(1); }

const APPLY = process.argv.includes('--apply');

// Heurística refinada: ORDEM = mais específico → mais geral.
// Transporte e embalagem ANTES de compra_produto (palavras ambíguas como "maxi" e "queijo").
// Baseada nas 137 descrições reais da Fase 0.
const HEURISTICA = [
  // Transporte primeiro (pode ter "queijo" no nome do uber/frete)
  { pattern: /\b(frete|uber|99\s*food|99food|moto(boy|queiro|uber)?|combust[íi]vel|gasolina|transporte)\b/i, category: 'transporte' },
  // Embalagem antes de produto (sacolas com "maxi" no nome)
  { pattern: /\b(sacola|embala|filme|lacre|adesivo|saco|cx\s*termica|caixa\s*termica|bag\s*tra[ns]p)\b/i, category: 'compra_embalagem' },
  // Energia (mais específica)
  { pattern: /\b(energia|conta de luz|cpfl|enel|elektro|^luz\b)\b/i, category: 'energia' },
  // Aluguel
  { pattern: /\b(aluguel|aluguer|condom)\b/i, category: 'aluguel' },
  // Pessoal
  { pattern: /\b(funcion|salar|folha|ajudante|colaborador|comiss[ãa]o|encarg|uniforme|camisa\s*polo)\b/i, category: 'pessoal' },
  // Impostos
  { pattern: /\b(imposto|^das$|simples|inss|iss|nfse|nfe|tribut)\b/i, category: 'impostos' },
  // Insumo (gás, óleo, etc)
  { pattern: /\b(g[áa]s|botij|tempero|^sal\b|a[çc][uú]car|[óo]leo|insumo|[áa]gua)\b/i, category: 'compra_insumo' },
  // Pacote sistema (mensalidade R$ 150 — bot, robô, dashboard) — ANTES de marketing
  // \bbot\b captura "Bot/IA", "Bot Whatsapp", "Bot + Dash", "BOT" — sempre que "bot" for palavra isolada
  // \brob[ôo]\b captura "Robô", "robo", "Marketing e Robô"
  { pattern: /\b(bot|rob[ôo]|dashboard|pacote\s*tec(nologia)?|mensalidade\s*sistema)\b/i, category: 'pacote_sistema' },
  // Marketing (tráfego pago, leads, panfletos, anúncios, cardápio)
  { pattern: /\b(panfleto|wind\s*banner|tr[áa]fego|leads|marketing|an[uú]ncio|outdoor|publici|propaganda|cardap[ií]o?)\b/i, category: 'marketing' },
  // Compra de produto (último — produtos genuínos: massa, molho, queijo isolado, etc)
  // ATENÇÃO: "queijo" e "maxi" só passam se NÃO foram pegos pelos padrões anteriores
  { pattern: /\b(massa|molho|nhoque|lasanha|rondelli|capeletti|talharim|fettuc|requeij[ãa]o|presunto|frango|brocolis|panqueca|pasta|p[ãa]o\s+de\s+queijo|queijo\s+ralado)\b/i, category: 'compra_produto' },
];

// Normaliza acentos antes de testar (\b em JS não trata Unicode)
// "Robô" → "Robo", "Água" → "Agua", "Energia Elétrica" → "Energia Eletrica"
function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function categorize(description) {
  if (!description) return 'outros';
  const norm = normalize(description);
  for (const { pattern, category } of HEURISTICA) {
    if (pattern.test(norm)) return category;
  }
  return 'outros';
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text.slice(0, 400)}`);
  try { return JSON.parse(text); } catch { return null; }
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

  // Lê apenas despesas que ainda estão como 'outros' (default da migration)
  const rows = await sql(`
    SELECT id, franchise_id, description, amount, expense_date, category
    FROM expenses
    WHERE category = 'outros'
    ORDER BY expense_date DESC, franchise_id;
  `);

  console.log(`Despesas encontradas: ${rows.length}`);

  // Aplica heurística
  const proposed = rows.map(r => ({
    ...r,
    suggested_category: categorize(r.description),
  }));

  // Distribuição
  const dist = {};
  for (const r of proposed) {
    dist[r.suggested_category] = (dist[r.suggested_category] || 0) + 1;
  }
  console.log('\nDistribuição sugerida:');
  for (const [cat, n] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
    const pct = ((n / proposed.length) * 100).toFixed(1);
    console.log(`  ${cat.padEnd(20)} ${String(n).padStart(4)}  (${pct}%)`);
  }

  // Por franquia
  const byFranchise = {};
  for (const r of proposed) {
    if (!byFranchise[r.franchise_id]) byFranchise[r.franchise_id] = { total: 0, byCat: {} };
    byFranchise[r.franchise_id].total++;
    byFranchise[r.franchise_id].byCat[r.suggested_category] =
      (byFranchise[r.franchise_id].byCat[r.suggested_category] || 0) + 1;
  }
  console.log(`\nFranquias afetadas: ${Object.keys(byFranchise).length}`);

  // Salva CSV
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupsDir = path.join(ROOT, 'supabase', 'backups');
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const csvPath = path.join(backupsDir, `categorize-${ts}.csv`);

  const csvLines = ['expense_id,franchise_id,date,description,amount,suggested_category'];
  for (const r of proposed) {
    csvLines.push([
      r.id,
      r.franchise_id,
      r.expense_date,
      csvEscape(r.description),
      r.amount,
      r.suggested_category,
    ].join(','));
  }
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
  console.log(`\nCSV salvo: ${csvPath}`);

  if (!APPLY) {
    console.log('\nDRY-RUN. Para aplicar, rode com --apply.');
    return;
  }

  // Apply via batch UPDATEs (uma transação)
  console.log('\nAplicando UPDATEs...');
  const updates = proposed
    .filter(r => r.suggested_category !== 'outros')  // só atualiza o que mudou
    .map(r => `UPDATE expenses SET category = '${r.suggested_category}' WHERE id = '${r.id}';`)
    .join('\n');

  if (!updates) {
    console.log('Nenhum UPDATE necessário (tudo já está em "outros").');
    return;
  }

  await sql(`BEGIN;\n${updates}\nCOMMIT;`);

  // Verifica resultado
  const finalDist = await sql(`SELECT category, COUNT(*) AS n FROM expenses GROUP BY 1 ORDER BY 2 DESC;`);
  console.log('\nDistribuição final:');
  for (const d of finalDist) console.log(`  ${d.category.padEnd(20)} ${String(d.n).padStart(4)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
