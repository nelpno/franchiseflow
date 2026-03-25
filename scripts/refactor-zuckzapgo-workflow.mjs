/**
 * Refactor workflow "CRIAR USUARIO ZUCK ZAP GO" (brmZAsAykq6hSMpL)
 *
 * Changes:
 * 1. Add action routing: check_status returns status only, smart_connect does connect flow
 * 2. Unify disconnect+reconnect path: ALWAYS disconnect before reconnecting (fixes stale session bug)
 * 3. Remove redundant "connect direct" path (was output 2 of old Switch)
 * 4. Add error handling on Desconecta node (continueOnFail for stale sessions)
 * 5. Remove old Switch node (replaced by action_switch + is_connected IFs)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load env
const envContent = readFileSync(join(ROOT, '.env'), 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const N8N_URL = (env.N8N_API_URL || 'https://teste.dynamicagents.tech').replace(/\/$/, '');
const N8N_KEY = env.N8N_API_KEY;
const WORKFLOW_ID = 'brmZAsAykq6hSMpL';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

async function main() {
  // ── 1. Fetch current workflow ──
  console.log('Fetching workflow...');
  const res = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${await res.text()}`);
  const workflow = await res.json();
  console.log(`Current: ${workflow.nodes.length} nodes, active=${workflow.active}`);

  // ── 2. Remove old nodes ──
  const removeNames = [
    'Switch',              // replaced by action_switch + is_connected
    'Conectar WhatsApp1',  // redundant direct-connect path
    'Aguarda QR Ready',    // wait for redundant path
    'Obter QR Code1',      // QR for redundant path (the one that failed)
    'Respond to Webhook2'  // response for redundant path
  ];
  workflow.nodes = workflow.nodes.filter(n => !removeNames.includes(n.name));
  console.log(`After removal: ${workflow.nodes.length} nodes (removed ${removeNames.join(', ')})`);

  // ── 3. Add new nodes ──

  // 3a. action_switch — routes by webhook action param
  workflow.nodes.push({
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
        conditions: [{
          id: uuid(),
          leftValue: "={{ $node['Webhook'].json.body.action }}",
          rightValue: "check_status",
          operator: { type: "string", operation: "equals" }
        }],
        combinator: "and"
      },
      options: {}
    },
    type: "n8n-nodes-base.if",
    typeVersion: 2.2,
    position: [992, 576],
    id: uuid(),
    name: "action_switch"
  });

  // 3b. Respond Status — lightweight response for check_status (no connect attempt)
  workflow.nodes.push({
    parameters: {
      respondWith: "json",
      responseBody: [
        '={',
        '  "status": "{{ $json.status }}",',
        '  "connected": {{ $json.connected }},',
        '  "loggedIn": {{ $json.loggedIn }},',
        '  "instanceId": "{{ $json.name }}",',
        '  "jid": "{{ $json.jid }}",',
        '  "message": "Status verificado"',
        '}'
      ].join('\n'),
      options: {}
    },
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1.4,
    position: [1216, 400],
    id: uuid(),
    name: "Respond Status"
  });

  // 3c. is_connected — check if already connected before attempting reconnect
  workflow.nodes.push({
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
        conditions: [{
          id: uuid(),
          leftValue: "={{ $json.status }}",
          rightValue: "connected",
          operator: { type: "string", operation: "equals" }
        }],
        combinator: "and"
      },
      options: {}
    },
    type: "n8n-nodes-base.if",
    typeVersion: 2.2,
    position: [1216, 640],
    id: uuid(),
    name: "is_connected"
  });

  console.log(`After additions: ${workflow.nodes.length} nodes`);

  // ── 4. Update existing nodes ──

  // 4a. Respond to Webhook (already connected) — reposition
  const respondConnected = workflow.nodes.find(n => n.name === 'Respond to Webhook');
  respondConnected.position = [1440, 400];
  respondConnected.parameters.responseBody = [
    '={',
    '  "status": "open",',
    '  "connected": true,',
    '  "instanceId": "{{ $json.name }}",',
    '  "jid": "{{ $json.jid }}",',
    '  "message": "Instância já está conectada!"',
    '}'
  ].join('\n');

  // 4b. Desconecta Whatsapp — add error handling (stale session may fail on disconnect)
  const desconecta = workflow.nodes.find(n => n.name === 'Desconecta Whatsapp');
  desconecta.onError = 'continueRegularOutput';
  desconecta.position = [1440, 640];

  // 4c. Reposition reconnect path for visual clarity
  const conectar2 = workflow.nodes.find(n => n.name === 'Conectar WhatsApp2');
  conectar2.position = [1664, 640];

  const wait2 = workflow.nodes.find(n => n.name === 'Aguarda QR Ready2');
  wait2.position = [1888, 640];

  const qr2 = workflow.nodes.find(n => n.name === 'Obter QR Code2');
  qr2.position = [2112, 640];

  const respond3 = workflow.nodes.find(n => n.name === 'Respond to Webhook3');
  respond3.position = [2336, 640];

  // ── 5. Rebuild connections ──

  // Remove old connections from deleted nodes
  delete workflow.connections['Switch'];
  delete workflow.connections['Conectar WhatsApp1'];
  delete workflow.connections['Aguarda QR Ready'];
  delete workflow.connections['Obter QR Code1'];

  // pre_switch → action_switch (replaces pre_switch → Switch)
  workflow.connections['pre_switch'] = {
    main: [[{ node: 'action_switch', type: 'main', index: 0 }]]
  };

  // action_switch:
  //   output 0 (true = check_status) → Respond Status
  //   output 1 (false = smart_connect) → is_connected
  workflow.connections['action_switch'] = {
    main: [
      [{ node: 'Respond Status', type: 'main', index: 0 }],
      [{ node: 'is_connected', type: 'main', index: 0 }]
    ]
  };

  // is_connected:
  //   output 0 (true = connected) → Respond to Webhook (already connected)
  //   output 1 (false = not connected) → Desconecta Whatsapp (ALWAYS disconnect first)
  workflow.connections['is_connected'] = {
    main: [
      [{ node: 'Respond to Webhook', type: 'main', index: 0 }],
      [{ node: 'Desconecta Whatsapp', type: 'main', index: 0 }]
    ]
  };

  // Existing connections preserved:
  // Desconecta Whatsapp → Conectar WhatsApp2 (already exists)
  // Conectar WhatsApp2 → Aguarda QR Ready2 (already exists)
  // Aguarda QR Ready2 → Obter QR Code2 (already exists)
  // Obter QR Code2 → Respond to Webhook3 (already exists)

  // ── 6. Validate all connections ──
  const nodeNames = new Set(workflow.nodes.map(n => n.name));
  const errors = [];
  for (const [from, outs] of Object.entries(workflow.connections)) {
    if (!nodeNames.has(from)) {
      errors.push(`Connection from deleted node: "${from}"`);
    }
    for (const outputs of Object.values(outs)) {
      for (const targets of outputs) {
        for (const t of targets) {
          if (!nodeNames.has(t.node)) {
            errors.push(`Connection to deleted node: "${t.node}" (from "${from}")`);
          }
        }
      }
    }
  }
  if (errors.length > 0) {
    console.error('❌ Connection validation errors:');
    errors.forEach(e => console.error(`  - ${e}`));
    throw new Error('Invalid connections detected — aborting');
  }
  console.log('✓ All connections validated');

  // ── 7. Print new flow summary ──
  console.log('\n=== NEW FLOW ===');
  const sorted = Object.entries(workflow.connections).sort((a, b) => {
    const posA = workflow.nodes.find(n => n.name === a[0])?.position?.[0] ?? 0;
    const posB = workflow.nodes.find(n => n.name === b[0])?.position?.[0] ?? 0;
    return posA - posB;
  });
  for (const [from, outs] of sorted) {
    for (const outputs of Object.values(outs)) {
      outputs.forEach((targets, idx) => {
        targets.forEach(t => console.log(`  ${from} [${idx}] → ${t.node}`));
      });
    }
  }

  // ── 8. PUT updated workflow ──
  const safeSettings = {};
  if (workflow.settings) {
    const allowed = ['executionOrder', 'callerPolicy', 'saveManualExecutions', 'saveExecutionProgress'];
    for (const key of allowed) {
      if (workflow.settings[key] !== undefined) safeSettings[key] = workflow.settings[key];
    }
  }

  const putBody = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: safeSettings
  };

  console.log('\nPUT workflow...');
  const putRes = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(putBody)
  });

  const putText = await putRes.text();
  if (!putRes.ok) {
    console.error(`❌ PUT failed: ${putRes.status}`);
    console.error(putText.substring(0, 500));
    throw new Error(`PUT failed: ${putRes.status}`);
  }

  const result = JSON.parse(putText);
  console.log(`\n✅ Workflow updated!`);
  console.log(`   Nodes: ${result.nodes.length}`);
  console.log(`   Active: ${result.active}`);
  console.log(`   Names: ${result.nodes.map(n => n.name).join(', ')}`);
}

main().catch(err => {
  console.error('\n🔴 FAILED:', err.message);
  process.exit(1);
});
