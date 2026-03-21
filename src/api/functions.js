const N8N_WEBHOOK_BASE = import.meta.env.VITE_N8N_WEBHOOK_BASE || 'https://webhook.dynamicagents.tech/webhook';

// WhatsApp - chamadas diretas ao n8n
export async function connectWhatsappRobot({ instanceName, action }) {
  const response = await fetch(`${N8N_WEBHOOK_BASE}/a9c45ef7-36f7-4a64-ad9e-edadb69a31af`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instanceName, action: action || 'smart_connect' })
  });
  if (!response.ok) throw new Error('Webhook error: ' + response.status);
  return response.json();
}

export async function checkWhatsappStatus({ instanceName }) {
  const response = await fetch(`${N8N_WEBHOOK_BASE}/a9c45ef7-36f7-4a64-ad9e-edadb69a31af`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instanceName, action: 'check_status' })
  });
  if (!response.ok) throw new Error('Webhook error: ' + response.status);
  return response.json();
}

// Otimização de config - chamada direta ao n8n
export async function optimizeConfig(configData) {
  const response = await fetch(`${N8N_WEBHOOK_BASE}/adc276df-8162-46ca-bec6-5aedb9cb2b14`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(configData)
  });
  if (!response.ok) throw new Error('Webhook error: ' + response.status);
  return response.json();
}

// Análise de Lead - funcionalidade em migração (antigo Base44 LLM)
export async function analyzeLead(leadData) {
  throw new Error('Análise de leads temporariamente indisponível. Funcionalidade em migração.');
}

// Relatórios de vendas via IA - funcionalidade em migração (antigo Base44 LLM)
export async function generateSalesReportsAI(reportData) {
  throw new Error('Relatórios IA temporariamente indisponíveis. Funcionalidade em migração.');
}