import { supabase } from './supabaseClient';

const N8N_WEBHOOK_BASE = import.meta.env.VITE_N8N_WEBHOOK_BASE || 'https://webhook.dynamicagents.tech/webhook';

// WhatsApp - chamadas diretas ao n8n (antes eram proxied via Base44 cloud functions)
export async function connectWhatsappRobot({ instanceName, action }) {
  const response = await fetch(`${N8N_WEBHOOK_BASE}/a9c45ef7-36f7-4a64-ad9e-edadb69a31af`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instanceName, action: action || 'smart_connect' })
  });
  return response.json();
}

export async function checkWhatsappStatus({ instanceName }) {
  const response = await fetch(`${N8N_WEBHOOK_BASE}/a9c45ef7-36f7-4a64-ad9e-edadb69a31af`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instanceName, action: 'check_status' })
  });
  return response.json();
}

// Otimização de config - chamada direta ao n8n
export async function optimizeConfig(configData) {
  const response = await fetch(`${N8N_WEBHOOK_BASE}/adc276df-8162-46ca-bec6-5aedb9cb2b14`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(configData)
  });
  return response.json();
}

// Supabase Edge Functions (serão criadas posteriormente)
export async function analyzeLead(leadData) {
  const { data, error } = await supabase.functions.invoke('analyze-lead', {
    body: leadData
  });
  if (error) throw error;
  return data;
}

export async function generateSalesReportsAI(reportData) {
  const { data, error } = await supabase.functions.invoke('generate-sales-reports', {
    body: reportData
  });
  if (error) throw error;
  return data;
}
