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
