import { base44 } from './base44Client';

const N8N_WEBHOOK_BASE = 'https://webhook.dynamicagents.tech/webhook';

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

// Análise de Lead via LLM do Base44
export async function analyzeLead(leadData) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Analise este lead de vendas e forneça: score de potencial (0-100), sentimento (positive/neutral/negative), análise do perfil e sugestão de ação.
    
Dados do lead:
- Nome: ${leadData.name || 'Não informado'}
- Telefone: ${leadData.phone}
- Valor da venda: R$ ${leadData.value}
- Origem: ${leadData.source}
- Franquia: ${leadData.franchise_id}`,
    response_json_schema: {
      type: "object",
      properties: {
        score: { type: "number" },
        sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
        analysis: { type: "string" },
        suggestion: { type: "string" }
      }
    }
  });
  return result;
}

// Relatórios de vendas via LLM
export async function generateSalesReportsAI(reportData) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Gere um relatório resumido de vendas com insights e recomendações baseado nos dados: ${JSON.stringify(reportData)}`,
    response_json_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        insights: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "string" } }
      }
    }
  });
  return result;
}