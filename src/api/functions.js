import { supabase } from '@/api/supabaseClient';

const N8N_WEBHOOK_BASE = import.meta.env.VITE_N8N_WEBHOOK_BASE || 'https://webhook.dynamicagents.tech/webhook';
const WEBHOOK_TIMEOUT = 15000;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

function fetchWithTimeout(url, options, timeout = WEBHOOK_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// WhatsApp - chamadas diretas ao n8n
// Timeout maior (30s) porque workflow n8n tem Wait 3s entre connect e QR
export async function connectWhatsappRobot({ instanceName, action }) {
  const headers = await getAuthHeaders();
  const response = await fetchWithTimeout(`${N8N_WEBHOOK_BASE}/a9c45ef7-36f7-4a64-ad9e-edadb69a31af`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ instanceName, action: action || 'smart_connect' })
  }, 30000);
  if (!response.ok) throw new Error('Erro ao conectar WhatsApp: ' + response.status);
  return response.json();
}

export async function checkWhatsappStatus({ instanceName }) {
  const headers = await getAuthHeaders();
  const response = await fetchWithTimeout(`${N8N_WEBHOOK_BASE}/a9c45ef7-36f7-4a64-ad9e-edadb69a31af`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ instanceName, action: 'check_status' })
  });
  if (!response.ok) throw new Error('Erro ao verificar status WhatsApp: ' + response.status);
  return response.json();
}

// Otimização de config - chamada direta ao n8n
export async function optimizeConfig(configData) {
  const headers = await getAuthHeaders();
  const response = await fetchWithTimeout(`${N8N_WEBHOOK_BASE}/adc276df-8162-46ca-bec6-5aedb9cb2b14`, {
    method: 'POST',
    headers,
    body: JSON.stringify(configData)
  });
  if (!response.ok) throw new Error('Erro ao otimizar configuracao: ' + response.status);
  return response.json();
}

// Convite de franqueado — envia email via Supabase Auth (n8n com service role)
// Timeout maior (30s) porque n8n + Supabase Auth + SMTP pode demorar
export async function inviteFranchisee(email) {
  const headers = await getAuthHeaders();
  const response = await fetchWithTimeout(`${N8N_WEBHOOK_BASE}/franchise-invite`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, redirectTo: window.location.origin + '/set-password?type=invite' })
  }, 30000);
  if (!response.ok) throw new Error('Erro ao enviar convite: ' + response.status);
  const data = await response.json();
  // n8n retorna erro do Supabase como JSON com HTTP 200 (neverError: true)
  if (data.code && data.code >= 400) {
    throw new Error(data.msg || data.message || 'Erro no servidor ao criar convite');
  }
  return data;
}

// Convite de staff (admin/gerente) — cria conta + define role via n8n
export async function staffInvite(email, role) {
  const headers = await getAuthHeaders();
  const response = await fetchWithTimeout(`${N8N_WEBHOOK_BASE}/staff-invite`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      role,
      redirectTo: window.location.origin + '/set-password?type=invite'
    })
  }, 30000);
  if (!response.ok) throw new Error('Erro ao enviar convite: ' + response.status);
  const data = await response.json();
  if (data.code && data.code >= 400) {
    throw new Error(data.msg || data.message || 'Erro no servidor ao criar convite');
  }
  return data;
}

// WhatsApp History — busca mensagens do ZuckZapGo
const ZUCKZAPGO_URL = import.meta.env.VITE_ZUCKZAPGO_URL || '';

export async function getWhatsAppMessages(instanceName, phone, limit = 20) {
  if (!ZUCKZAPGO_URL || !instanceName || !phone) return [];
  try {
    // Normalize phone: remove non-digits
    const cleanPhone = phone.replace(/\D/g, '');
    // ZuckZapGo API endpoint for fetching messages
    const url = `${ZUCKZAPGO_URL}/api/${instanceName}/messages/${cleanPhone}?limit=${limit}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) return [];
    const data = await response.json();
    // Return array of messages (handle different response shapes)
    return Array.isArray(data) ? data : (data.messages || data.data || []);
  } catch (error) {
    console.error('WhatsApp messages fetch error:', error);
    return [];
  }
}

// Análise de Lead - funcionalidade em migração (antigo Base44 LLM)
export async function analyzeLead(leadData) {
  throw new Error('Análise de leads temporariamente indisponível. Funcionalidade em migração.');
}

// Relatórios de vendas via IA - funcionalidade em migração (antigo Base44 LLM)
export async function generateSalesReportsAI(reportData) {
  throw new Error('Relatórios IA temporariamente indisponíveis. Funcionalidade em migração.');
}