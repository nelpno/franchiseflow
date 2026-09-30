import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") || "https://api.asaas.com";
const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Auth helpers ---

type UserRole = "admin" | "manager" | "franchisee";

async function getUserFromRequest(req: Request): Promise<{ id: string; role: UserRole; managed: string[] } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  // Create a client with anon key but use the user's JWT for auth
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;

  // Get profile with role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, managed_franchise_ids")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    role: (profile?.role || "franchisee") as UserRole,
    managed: profile?.managed_franchise_ids || [],
  };
}

function isAdminOrManager(user: { role: UserRole }): boolean {
  return user.role === "admin" || user.role === "manager";
}

function canAccessFranchise(user: { role: UserRole; managed: string[] }, franchiseId: string): boolean {
  if (isAdminOrManager(user)) return true;
  return user.managed.includes(franchiseId);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- ASAAS API helpers ---

const ASAAS_TIMEOUT_MS = 15000;
const ASAAS_ESPERAS_MS = [800, 2000];
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Os lotes rodam em paralelo (30/09/2026), então cada chamada tem prazo próprio e repete
// quando o ASAAS NÃO processou: 429 (limite de requisições) em qualquer método; erro de rede
// ou 5xx só em leitura (GET). Escrita que falhou no meio não se repete: poderia duplicar.
async function asaasRequest(path: string, options: RequestInit = {}) {
  const leitura = !options.method || options.method === "GET";
  for (let tentativa = 0; ; tentativa++) {
    const podeRepetir = tentativa < ASAAS_ESPERAS_MS.length;
    let res: Response;
    try {
      res = await fetch(`${ASAAS_BASE_URL}${path}`, {
        ...options,
        signal: AbortSignal.timeout(ASAAS_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          access_token: ASAAS_API_KEY,
          ...((options.headers as Record<string, string>) || {}),
        },
      });
    } catch (err) {
      if (leitura && podeRepetir) {
        await pausa(ASAAS_ESPERAS_MS[tentativa]);
        continue;
      }
      throw new Error(`ASAAS sem resposta (${(err as Error).name})`);
    }
    if (podeRepetir && (res.status === 429 || (leitura && res.status >= 500))) {
      await res.text().catch(() => "");
      await pausa(ASAAS_ESPERAS_MS[tentativa]);
      continue;
    }
    // DELETE costuma retornar 204 sem body; text() seguido de JSON.parse tolera body vazio
    if (res.status === 204) return {};
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`ASAAS error ${res.status}`);
    }
    if (!res.ok) {
      throw new Error(data?.errors?.[0]?.description || `ASAAS error ${res.status}`);
    }
    return data;
  }
}

/** Roda `fn` em cada item com no máximo `limite` ao mesmo tempo; o resultado sai na ordem da entrada. */
async function emParalelo<T, R>(itens: T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      saida[i] = await fn(itens[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador));
  return saida;
}

/**
 * Agrupa as franquias pelo CPF/CNPJ do cadastro. Dono com mais de uma unidade divide o MESMO
 * cliente no ASAAS: cadastrar as unidades dele ao mesmo tempo criaria dois clientes. Cada grupo
 * roda em sequência; grupos diferentes, em paralelo.
 */
async function gruposPorDocumento(franchiseIds: string[]): Promise<string[][]> {
  if (franchiseIds.length === 0) return [];
  const { data } = await supabase
    .from("franchises")
    .select("evolution_instance_id, cpf_cnpj")
    .in("evolution_instance_id", franchiseIds);
  const docDe = new Map<string, string>();
  for (const f of data || []) {
    docDe.set(f.evolution_instance_id as string, String(f.cpf_cnpj ?? "").replace(/\D/g, ""));
  }
  const grupos = new Map<string, string[]>();
  for (const fid of franchiseIds) {
    const chave = docDe.get(fid) || `sem-documento:${fid}`;
    grupos.set(chave, [...(grupos.get(chave) || []), fid]);
  }
  return [...grupos.values()];
}

/**
 * Valida CPF (11) / CNPJ (14) pelos dígitos verificadores.
 * Espelha src/lib/documentUtils.js (front) — runtimes diferentes, mesma regra.
 * Sem isso, doc com um dígito trocado só falha lá na frente, dentro do ASAAS, com o
 * erro engolido por um catch não-fatal (caso Americana, 19/08/2026).
 */
function isValidCpfCnpj(value: string | null | undefined): boolean {
  const d = String(value ?? "").replace(/\D/g, "");
  if (d.length === 11) {
    if (/^(\d)\1{10}$/.test(d)) return false;
    const base = d.slice(0, 9).split("").map(Number);
    let s = base.reduce((a, n, i) => a + n * (10 - i), 0);
    const d1 = s % 11 < 2 ? 0 : 11 - (s % 11);
    s = [...base, d1].reduce((a, n, i) => a + n * (11 - i), 0);
    const d2 = s % 11 < 2 ? 0 : 11 - (s % 11);
    return `${d1}${d2}` === d.slice(9);
  }
  if (d.length === 14) {
    if (/^(\d)\1{13}$/.test(d)) return false;
    const W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const base = d.slice(0, 12).split("").map(Number);
    let s = base.reduce((a, n, i) => a + n * W1[i], 0);
    const d1 = s % 11 < 2 ? 0 : 11 - (s % 11);
    s = [...base, d1].reduce((a, n, i) => a + n * W2[i], 0);
    const d2 = s % 11 < 2 ? 0 : 11 - (s % 11);
    return `${d1}${d2}` === d.slice(12);
  }
  return false;
}

// --- Actions ---

async function registerCustomer(franchiseId: string) {
  // Get franchise data (inclui billing_email — fonte primária do email de cobrança)
  // Franquia e endereço em paralelo (leituras independentes).
  const [{ data: franchise, error: fErr }, { data: config }] = await Promise.all([
    supabase
      .from("franchises")
      .select("id, name, owner_name, cpf_cnpj, city, phone_number, state_uf, address_number, address_complement, neighborhood, evolution_instance_id, billing_email")
      .eq("evolution_instance_id", franchiseId)
      .single(),
    supabase
      .from("franchise_configurations")
      .select("street_address, cep, franchise_name")
      .eq("franchise_evolution_instance_id", franchiseId)
      .single(),
  ]);
  if (fErr || !franchise) throw new Error("Franquia não encontrada");
  if (!franchise.cpf_cnpj) throw new Error("CPF/CNPJ não preenchido");
  if (!isValidCpfCnpj(franchise.cpf_cnpj)) {
    throw new Error(
      `CPF/CNPJ inválido no cadastro (${franchise.cpf_cnpj}) — confira os dígitos em Franquias → Editar dados`
    );
  }

  // Email de cobrança: billing_email é fonte primária; fallback para último invite válido
  let billingEmail: string | null = franchise.billing_email || null;
  if (!billingEmail) {
    const { data: invite } = await supabase
      .from("franchise_invites")
      .select("email")
      .eq("franchise_id", franchiseId)
      .order("invited_at", { ascending: false })
      .limit(1)
      .single();
    billingEmail = invite?.email || null;
    if (billingEmail) {
      console.warn(`[asaas-billing] Usando email de franchise_invites (fallback) para ${franchiseId} — billing_email vazio`);
    }
  }
  if (!billingEmail) {
    throw new Error("MISSING_BILLING_EMAIL: email de cobrança não preenchido");
  }

  // Check if customer already exists in ASAAS
  const existing = await asaasRequest(`/v3/customers?cpfCnpj=${franchise.cpf_cnpj}`);
  let customerId: string;

  if (existing.data?.length > 0) {
    customerId = existing.data[0].id;
    // Sincroniza email em ASAAS se divergir (garante NFe com email atualizado)
    const current = existing.data[0];
    if (current.email !== billingEmail) {
      try {
        await asaasRequest(`/v3/customers/${customerId}`, {
          method: "POST",
          body: JSON.stringify({ email: billingEmail }),
        });
      } catch (syncErr) {
        console.warn(`[asaas-billing] Falha ao sincronizar email ASAAS: ${(syncErr as Error).message}`);
      }
    }
  } else {
    // Create new customer
    const customer = await asaasRequest("/v3/customers", {
      method: "POST",
      body: JSON.stringify({
        name: franchise.owner_name || franchise.name,
        cpfCnpj: franchise.cpf_cnpj,
        email: billingEmail,
        phone: franchise.phone_number || null,
        address: config?.street_address || null,
        addressNumber: franchise.address_number || null,
        complement: franchise.address_complement || null,
        province: franchise.neighborhood || null,
        postalCode: config?.cep || null,
        city: franchise.city?.replace(/\s*-\s*[A-Z]{2}$/, "") || null,
        state: franchise.state_uf || null,
        externalReference: franchiseId,
      }),
    });
    customerId = customer.id;
  }

  // Upsert system_subscriptions
  await supabase.from("system_subscriptions").upsert(
    {
      franchise_id: franchiseId,
      asaas_customer_id: customerId,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "franchise_id" }
  );

  return { customerId, franchise: franchise.name };
}

/**
 * Atualiza no ASAAS o documento do cliente JA VINCULADO a esta franquia.
 *
 * Por que existe uma action so para isso: trocar o CPF/CNPJ no painel significa DUAS
 * coisas opostas, e nenhum codigo distingue as duas sozinho.
 *   - a mesma empresa virou PJ  -> tem de ATUALIZAR o cliente (assinatura intacta)
 *   - a franquia trocou de dono -> tem de CRIAR cliente novo, senao a cobranca sai no
 *     nome do dono anterior (foi o conserto do caso Araras)
 * `registerCustomer` faz o segundo: busca por cpfCnpj e, nao achando, cria. Esta funcao
 * faz o primeiro, e quem escolhe e a pessoa, no dialogo do painel.
 *
 * Medido em 09/09/2026: Braganca (CNPJ no painel, CPF 06398291808 no ASAAS) e Cajamar
 * (CNPJ no painel, CPF 27109189864) estavam assim ha semanas — cobranca certa, NFe no
 * documento errado. Salvar o cadastro nunca propagou para o ASAAS.
 */
async function syncCustomerDocument(franchiseId: string) {
  const { data: franchise, error: fErr } = await supabase
    .from("franchises")
    .select("name, cpf_cnpj, billing_email")
    .eq("evolution_instance_id", franchiseId)
    .single();
  if (fErr || !franchise) throw new Error("Franquia não encontrada");
  if (!franchise.cpf_cnpj) throw new Error("CPF/CNPJ não preenchido");
  if (!isValidCpfCnpj(franchise.cpf_cnpj)) {
    throw new Error(`CPF/CNPJ inválido no cadastro (${franchise.cpf_cnpj}) — confira os dígitos`);
  }

  const { data: sub } = await supabase
    .from("system_subscriptions")
    .select("asaas_customer_id, asaas_subscription_id")
    .eq("franchise_id", franchiseId)
    .single();
  if (!sub?.asaas_customer_id) {
    throw new Error("NO_CUSTOMER: esta franquia ainda não tem cliente no ASAAS — use Criar em Mensalidades");
  }

  const antes = await asaasRequest(`/v3/customers/${sub.asaas_customer_id}`);
  const doAsaas = (antes.cpfCnpj || "").replace(/\D/g, "");
  const doPainel = franchise.cpf_cnpj.replace(/\D/g, "");
  if (doAsaas === doPainel) {
    return { changed: false, customerId: sub.asaas_customer_id, cpfCnpj: doPainel, name: antes.name };
  }

  const patch: Record<string, string> = { cpfCnpj: doPainel };
  if (franchise.billing_email && franchise.billing_email !== antes.email) {
    patch.email = franchise.billing_email;
  }
  await asaasRequest(`/v3/customers/${sub.asaas_customer_id}`, {
    method: "POST",
    body: JSON.stringify(patch),
  });

  // Conferir por LEITURA, nunca pelo status do POST.
  const depois = await asaasRequest(`/v3/customers/${sub.asaas_customer_id}`);
  const agora = (depois.cpfCnpj || "").replace(/\D/g, "");
  if (agora !== doPainel) {
    throw new Error(`O ASAAS aceitou a chamada mas o documento continua ${agora}`);
  }

  await supabase
    .from("system_subscriptions")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("franchise_id", franchiseId);

  return {
    changed: true,
    customerId: sub.asaas_customer_id,
    subscriptionId: sub.asaas_subscription_id,
    de: doAsaas,
    para: agora,
    name: depois.name,
    franchise: franchise.name,
  };
}

async function createSubscription(franchiseId: string, value: number = 150) {
  if (!Number.isFinite(value) || value < 5 || value > 5000) {
    throw new Error("Valor inválido (deve estar entre R$ 5 e R$ 5.000)");
  }

  // Garante que o cliente ASAAS reflete os dados fiscais ATUAIS da franquia antes de cobrar.
  // Essencial quando a franquia troca de dono (novo CPF/CNPJ): registerCustomer busca pelo
  // cpf_cnpj atual e cria um cliente novo se o documento não existir, então a assinatura cobra
  // o novo dono — não o cliente antigo. Não-fatal: se falhar, segue com o cliente já gravado.
  let registerErro = "";
  try {
    await registerCustomer(franchiseId);
  } catch (regErr) {
    registerErro = (regErr as Error).message;
    console.warn(`[asaas-billing] register-before-create falhou p/ ${franchiseId}: ${registerErro}`);
  }

  // Get subscription record (asaas_customer_id já reflete o dono atual após o register acima)
  const { data: sub, error } = await supabase
    .from("system_subscriptions")
    .select("*")
    .eq("franchise_id", franchiseId)
    .single();
  if (error || !sub) throw new Error("Franquia não cadastrada no ASAAS ainda");
  if (!sub.asaas_customer_id) {
    throw new Error(`Cliente ASAAS não encontrado${registerErro ? ` — ${registerErro}` : ""}`);
  }
  if (sub.asaas_subscription_id) throw new Error("Assinatura já existe");

  // O cliente gravado pode ter sido REMOVIDO no painel do ASAAS — acontece em troca de dono.
  // Criar assinatura nele falha em TODA tentativa, e antes disso o erro sumia num catch
  // não-fatal: a franquia ficava "Cancelada" para sempre sem ninguém saber por quê.
  let customerAtivo = false;
  try {
    const customer = await asaasRequest(`/v3/customers/${sub.asaas_customer_id}`);
    customerAtivo = !customer?.deleted;
  } catch {
    customerAtivo = false;
  }
  if (!customerAtivo) {
    throw new Error(
      `Cliente ${sub.asaas_customer_id} não existe mais no ASAAS (removido)` +
        (registerErro
          ? ` e o recadastro automático falhou: ${registerErro}`
          : " — corrija os dados fiscais e clique em Criar para recadastrar")
    );
  }

  // Primeiro vencimento: dia 5 do MÊS CORRENTE se ainda não passou do dia 5 (criar em 01/06
  // → vence 05/06); a partir do dia 6, dia 5 do mês seguinte. Padrão da rede: vencimento dia 5.
  const now = new Date();
  const dueMonthOffset = now.getDate() <= 5 ? 0 : 1;
  const nextDue = new Date(now.getFullYear(), now.getMonth() + dueMonthOffset, 5);
  const nextDueStr = nextDue.toISOString().split("T")[0];

  // Create subscription in ASAAS
  const subscription = await asaasRequest("/v3/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: sub.asaas_customer_id,
      billingType: "UNDEFINED",
      value: value,
      nextDueDate: nextDueStr,
      cycle: "MONTHLY",
      description: "Mensalidade Equipe Digital Maxi",
      externalReference: franchiseId,
    }),
  });

  // Get first payment generated
  let paymentData: Record<string, unknown> = {};
  try {
    const payments = await asaasRequest(`/v3/subscriptions/${subscription.id}/payments`);
    if (payments.data?.length > 0) {
      const pay = payments.data[0];
      paymentData = {
        current_payment_id: pay.id,
        current_payment_status: mapPaymentStatus(pay.status),
        current_payment_due_date: pay.dueDate,
        current_payment_value: pay.value,
        current_payment_url: pay.bankSlipUrl || pay.invoiceUrl || null,
      };

      // PIX da primeira fatura (mesma regra dos demais pontos — ver attachPixFields)
      await attachPixFields(
        paymentData,
        pay.id,
        paymentData.current_payment_status as string,
      );
    }
  } catch {
    // Payments not generated yet, ok
  }

  // Update subscription record
  await supabase
    .from("system_subscriptions")
    .update({
      asaas_subscription_id: subscription.id,
      subscription_status: "ACTIVE",
      ...paymentData,
      last_synced_at: new Date().toISOString(),
    })
    .eq("franchise_id", franchiseId);

  return { subscriptionId: subscription.id };
}

/**
 * Preenche pix_payload/pix_qr_code_url para a fatura que o card vai mostrar.
 *
 * 🔴 SEMPRE escreve os dois campos — inclusive com null. Deixar o valor anterior
 * intacto é o que fez a rede inteira exibir um QR MORTO em 01/09/2026: o ASAAS
 * responde HTTP 400 em `/pixQrCode` de cobrança já liquidada, então o payload que
 * ficou guardado do ciclo passado continua sendo servido e o app do banco recusa
 * ("Não foi possível ler o QR Code / O QR Code não é válido"). Fatura paga não tem
 * QR: melhor nenhum QR do que o do mês anterior.
 */
async function attachPixFields(
  updateData: Record<string, unknown>,
  paymentId: string,
  status: string,
) {
  if (status !== "PENDING" && status !== "OVERDUE") {
    updateData.pix_payload = null;
    updateData.pix_qr_code_url = null;
    return;
  }
  try {
    const pix = await asaasRequest(`/v3/payments/${paymentId}/pixQrCode`);
    updateData.pix_payload = pix.payload || null;
    updateData.pix_qr_code_url = pix.encodedImage
      ? `data:image/png;base64,${pix.encodedImage}`
      : null;
  } catch (err) {
    // Falha ao gerar o QR não pode ser silenciosa nem herdar o QR anterior.
    console.error(`pixQrCode falhou para ${paymentId}:`, (err as Error).message);
    updateData.pix_payload = null;
    updateData.pix_qr_code_url = null;
  }
}

// `subJaLida`: o lote lê todas as assinaturas numa consulta só e passa a linha pronta.
async function checkPayment(franchiseId: string, subJaLida?: { asaas_subscription_id?: string | null }) {
  const sub = subJaLida ?? (await supabase
    .from("system_subscriptions")
    .select("asaas_subscription_id")
    .eq("franchise_id", franchiseId)
    .single()).data;
  if (!sub?.asaas_subscription_id) throw new Error("Sem assinatura ativa");

  // Get the payments (most recent dueDate first). ASAAS auto-creates next-cycle
  // invoices ahead of time, so picking limit=1 desc returns the FUTURE pending invoice
  // and masks the current period's paid status.
  // S11 (28/09/2026): a janela era de 6 faturas — um atraso mais velho que isso sumia da
  // regra de "arrears" e a unidade aparecia em dia. 100 é o teto do ASAAS numa página.
  const payments = await asaasRequest(
    `/v3/subscriptions/${sub.asaas_subscription_id}/payments?sort=dueDate&order=desc&limit=100`
  );
  if (!Array.isArray(payments.data)) throw new Error("Resposta do ASAAS sem a lista de faturas");
  if (payments.data.length === 0) {
    // S11 P3: lista COMPROVADAMENTE vazia (assinatura sem fatura nenhuma) — limpa a fatura
    // guardada; um atraso que deixou de existir no ASAAS não pode segurar o paywall para sempre.
    const { error: upErr } = await supabase
      .from("system_subscriptions")
      .update({
        current_payment_id: null,
        current_payment_status: null,
        current_payment_due_date: null,
        current_payment_value: null,
        current_payment_url: null,
        pix_payload: null,
        pix_qr_code_url: null,
        last_synced_at: new Date().toISOString(),
      })
      .eq("franchise_id", franchiseId);
    if (upErr) throw new Error(`Falha ao gravar a situação da mensalidade: ${upErr.message}`);
    return { status: "NO_PAYMENTS" };
  }

  // deno-lint-ignore no-explicit-any
  const list: any[] = payments.data; // sorted by dueDate DESC
  const PAID_SET = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
  const nowMs = Date.now();
  const graceMs = nowMs + 7 * 86400000;

  // Selection priority — the card must reflect the CURRENT billing period and roll
  // forward each month instead of freezing on the last paid invoice:
  //   1. Arrears: oldest UNPAID invoice already past its due date → keep it visible
  //      so the paywall still blocks a delinquent franchise (never hide an overdue bill).
  //   2. Current period: most recent invoice due-or-within-7d-grace, with its real
  //      status (PENDING/PAID/OVERDUE). This is what rolls the card to the new month.
  //   3. Fallbacks: most recent paid invoice, else oldest of the window.
  // S11 P3: só fatura COBRÁVEL conta como atraso — estornada/removida antiga (REFUNDED, DELETED,
  // chargeback...) não pode esconder a dívida de verdade de um mês mais novo.
  const COBRAVEL = new Set(["PENDING", "OVERDUE"]);
  const arrears = [...list]
    .reverse()
    .find(p => COBRAVEL.has(p.status) && new Date(p.dueDate).getTime() < nowMs);
  const current = list.find(p => new Date(p.dueDate).getTime() <= graceMs);
  const paid = list.find(p => PAID_SET.has(p.status));
  const pay = arrears || current || paid || list[list.length - 1];
  const status = mapPaymentStatus(pay.status);

  const updateData: Record<string, unknown> = {
    current_payment_id: pay.id,
    current_payment_status: status,
    current_payment_due_date: pay.dueDate,
    current_payment_value: pay.value,
    current_payment_url: pay.bankSlipUrl || pay.invoiceUrl || null,
    last_synced_at: new Date().toISOString(),
  };

  // PIX da fatura selecionada (null quando ela não é pagável — ver attachPixFields)
  await attachPixFields(updateData, pay.id, status);

  const { error: upErr } = await supabase
    .from("system_subscriptions")
    .update(updateData)
    .eq("franchise_id", franchiseId);
  if (upErr) throw new Error(`Falha ao gravar a situação da mensalidade: ${upErr.message}`);

  return { status, paymentId: pay.id, dueDate: pay.dueDate };
}

async function checkPaymentBatch() {
  const { data: subs, error } = await supabase
    .from("system_subscriptions")
    .select("franchise_id, asaas_subscription_id")
    .not("asaas_subscription_id", "is", null)
    .neq("subscription_status", "CANCELLED");
  if (error) throw error;

  // 30/09/2026: era uma unidade por vez com pausa de 250 ms (44 s para 64 unidades). Agora
  // 6 por vez; cada unidade só toca a própria linha, então a ordem não importa.
  const errors: { franchise_id: string; error: string }[] = [];
  let updated = 0;
  await emParalelo(subs || [], LOTE_LEITURA, async (s) => {
    const fid = s.franchise_id as string;
    try {
      await checkPayment(fid, s);
      updated++;
    } catch (err) {
      errors.push({ franchise_id: fid, error: (err as Error).message });
    }
  });

  return { total: (subs || []).length, updated, errors };
}

async function handleWebhook(body: Record<string, unknown>) {
  const event = body.event as string;
  const payment = body.payment as Record<string, unknown>;
  if (!payment?.subscription) return { ignored: true };

  // S11 (28/09/2026): o evento NÃO decide mais qual fatura é a atual. Antes ele gravava a
  // fatura do evento como current_payment_*: pagar setembro com agosto em aberto trocava o
  // card para "setembro · pago" e liberava o paywall. Agora o evento só dispara a MESMA
  // regra do checkPayment (atraso mais antigo primeiro, depois a do período, depois a paga),
  // relida no ASAAS. Evento de fatura futura (PAYMENT_CREATED do próximo ciclo) cai na
  // mesma regra e não mexe no card.
  // Falha ao falar com o ASAAS NÃO vira 500 e a resposta sai em até 8 s (o ASAAS desiste em
  // ~10 s e interrompe a fila depois de falhas seguidas). O prazo conta desde o início — busca
  // da assinatura inclusive; se estourar, o trabalho segue em segundo plano (waitUntil) e o
  // sync diário (cron 08:05) cobre.
  const trabalho = (async () => {
    const { data: sub } = await supabase
      .from("system_subscriptions")
      .select("franchise_id")
      .eq("asaas_subscription_id", payment.subscription)
      .single();
    if (!sub) return { ignored: true, reason: "subscription not found" };
    try {
      const result = await checkPayment(sub.franchise_id as string);
      return { updated: sub.franchise_id, event, ...result };
    } catch (err) {
      console.error(`[asaas-billing] webhook ${event} p/ ${sub.franchise_id}: ${(err as Error).message}`);
      return { updated: false, franchise_id: sub.franchise_id, event, error: "check-payment falhou" };
    }
  })().catch((err) => {
    console.error(`[asaas-billing] webhook ${event}: ${(err as Error).message}`);
    return { updated: false, event, error: "webhook falhou" };
  });
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil?.(trabalho);
  const result = await Promise.race([
    trabalho,
    new Promise<null>((r) => setTimeout(() => r(null), 8000)),
  ]);
  return result ?? { updated: "pending", event };
}

// Quantas unidades ao mesmo tempo: leitura aguenta mais; escrita (criar, reajustar) vai mais devagar.
const LOTE_LEITURA = 6;
const LOTE_ESCRITA = 4;

async function registerBatch(franchiseIds: string[]) {
  const ids = Array.isArray(franchiseIds) ? franchiseIds : [];
  const grupos = await gruposPorDocumento(ids);
  // deno-lint-ignore no-explicit-any
  const porId = new Map<string, any>();
  await emParalelo(grupos, LOTE_ESCRITA, async (grupo) => {
    for (const fid of grupo) {
      try {
        const res = await registerCustomer(fid);
        porId.set(fid, { franchise_id: fid, success: true, ...res });
      } catch (err) {
        porId.set(fid, { franchise_id: fid, success: false, error: (err as Error).message });
      }
    }
  });
  return ids.map((fid) => porId.get(fid));
}

async function subscribeBatch(value: number = 150, franchiseIds?: string[]) {
  // Find all with customer but no subscription. Optionally restrict to a specific subset
  // (UI "Criar Assinaturas" lets the admin remove rows — e.g. franquias de teste — before
  // confirming, sending only the kept franchise_ids).
  let query = supabase
    .from("system_subscriptions")
    .select("franchise_id, subscription_status")
    .not("asaas_customer_id", "is", null)
    .is("asaas_subscription_id", null);
  if (Array.isArray(franchiseIds) && franchiseIds.length > 0) {
    query = query.in("franchise_id", franchiseIds);
  }
  const { data: subs } = await query;

  const ids = (subs || []).map((s) => s.franchise_id as string);
  const grupos = await gruposPorDocumento(ids);
  // deno-lint-ignore no-explicit-any
  const porId = new Map<string, any>();
  await emParalelo(grupos, LOTE_ESCRITA, async (grupo) => {
    for (const fid of grupo) {
      try {
        const res = await createSubscription(fid, value);
        porId.set(fid, { franchise_id: fid, success: true, ...res });
      } catch (err) {
        porId.set(fid, { franchise_id: fid, success: false, error: (err as Error).message });
      }
    }
  });
  return ids.map((fid) => porId.get(fid));
}

async function cancelSubscription(franchiseId: string) {
  const { data: sub } = await supabase
    .from("system_subscriptions")
    .select("asaas_subscription_id")
    .eq("franchise_id", franchiseId)
    .single();
  if (!sub?.asaas_subscription_id) throw new Error("Franquia não tem assinatura ativa");
  const subId = sub.asaas_subscription_id;

  // DELETE subscription no ASAAS — 404 tolerado (pode ter sido cancelada manualmente)
  try {
    await asaasRequest(`/v3/subscriptions/${subId}`, { method: "DELETE" });
  } catch (err) {
    const msg = String((err as Error).message || "");
    if (!/404|not\s*found|não\s*encontrad/i.test(msg)) throw err;
  }

  // Cancela faturas PENDING restantes (ASAAS não faz automático)
  try {
    const payments = await asaasRequest(`/v3/subscriptions/${subId}/payments?status=PENDING`);
    await emParalelo((payments as { data?: Array<{ id: string }> }).data || [], LOTE_ESCRITA, async (pay) => {
      try {
        await asaasRequest(`/v3/payments/${pay.id}`, { method: "DELETE" });
      } catch { /* segue cancelando os próximos */ }
    });
  } catch { /* sub já removida — não conseguimos listar payments */ }

  // Atualiza banco: limpa subscription e payment, MANTÉM customer para facilitar recriar
  await supabase
    .from("system_subscriptions")
    .update({
      asaas_subscription_id: null,
      subscription_status: "CANCELLED",
      current_payment_id: null,
      current_payment_status: "CANCELLED",
      current_payment_due_date: null,
      current_payment_value: null,
      current_payment_url: null,
      pix_payload: null,
      pix_qr_code_url: null,
      last_synced_at: new Date().toISOString(),
    })
    .eq("franchise_id", franchiseId);

  return { cancelled: true, subscription_id: subId };
}

async function updateSubscriptionValue({
  franchiseIds,
  allActive,
  newValue,
  applyToCurrent,
}: {
  franchiseIds?: string[];
  allActive?: boolean;
  newValue: number;
  applyToCurrent: boolean;
}) {
  if (!Number.isFinite(newValue) || newValue < 5 || newValue > 5000) {
    throw new Error("Valor inválido (deve estar entre R$ 5 e R$ 5.000)");
  }

  let targets: string[] = [];
  if (allActive) {
    const { data } = await supabase
      .from("system_subscriptions")
      .select("franchise_id")
      .not("asaas_subscription_id", "is", null)
      .neq("subscription_status", "CANCELLED");
    targets = (data || []).map((r) => r.franchise_id);
  } else if (franchiseIds?.length) {
    targets = franchiseIds;
  } else {
    throw new Error("Informe franchise_ids ou all_active=true");
  }

  // Uma consulta para todas as assinaturas; depois LOTE_ESCRITA unidades por vez (cada uma
  // mexe só na própria assinatura e na própria linha).
  const { data: linhas, error: subsErr } = await supabase
    .from("system_subscriptions")
    .select("franchise_id, asaas_subscription_id, current_payment_id, current_payment_status")
    .in("franchise_id", targets);
  if (subsErr) throw new Error(`Falha ao ler as assinaturas: ${subsErr.message}`);
  const subDe = new Map((linhas || []).map((l) => [l.franchise_id as string, l]));

  type Resultado = { franchise_id: string; success: boolean; error?: string; warning?: string };
  const results = await emParalelo(targets, LOTE_ESCRITA, async (fid): Promise<Resultado> => {
    try {
      const sub = subDe.get(fid);
      if (!sub?.asaas_subscription_id) {
        return { franchise_id: fid, success: false, error: "Sem assinatura ativa" };
      }
      let warning: string | undefined;

      // Atualiza subscription ASAAS (vale para próximos ciclos)
      await asaasRequest(`/v3/subscriptions/${sub.asaas_subscription_id}`, {
        method: "POST",
        body: JSON.stringify({ value: newValue }),
      });

      const patch: Record<string, unknown> = { last_synced_at: new Date().toISOString() };

      // Opcionalmente aplica ao payment do ciclo atual (refaz fatura + PIX). Fatura já paga
      // ou cancelada não se altera no ASAAS: só tenta nas que ainda dá para pagar.
      const faturaAberta = sub.current_payment_status === "PENDING" || sub.current_payment_status === "OVERDUE";
      if (applyToCurrent && sub.current_payment_id && faturaAberta) {
        try {
          const updated = await asaasRequest(`/v3/payments/${sub.current_payment_id}`, {
            method: "POST",
            body: JSON.stringify({ value: newValue }),
          }) as { value?: number; bankSlipUrl?: string; invoiceUrl?: string };
          patch.current_payment_value = updated.value ?? newValue;
          patch.current_payment_url = updated.bankSlipUrl || updated.invoiceUrl || null;

          // Recarrega PIX porque o valor mudou = QR novo. Se falhar, attachPixFields
          // zera os campos: manter o QR antigo aqui cobraria o valor ERRADO.
          await attachPixFields(
            patch,
            sub.current_payment_id as string,
            sub.current_payment_status as string,
          );
        } catch (payErr) {
          // A assinatura mudou, a fatura do mês não: antes isso só ia para o log e a tela
          // dizia "atualizada". Agora volta como aviso.
          warning = `fatura deste mês não mudou: ${(payErr as Error).message}`;
          console.warn(`[asaas-billing] Falha ao atualizar payment de ${fid}: ${(payErr as Error).message}`);
        }
      }

      const { error: upErr } = await supabase
        .from("system_subscriptions")
        .update(patch)
        .eq("franchise_id", fid);
      if (upErr) warning = `${warning ? `${warning}; ` : ""}painel não gravou: ${upErr.message}`;

      return { franchise_id: fid, success: true, ...(warning ? { warning } : {}) };
    } catch (err) {
      return { franchise_id: fid, success: false, error: (err as Error).message };
    }
  });

  return {
    total: targets.length,
    updated: results.filter((r) => r.success).length,
    warnings: results.filter((r) => r.warning).length,
    results,
  };
}

// --- Status mapping (same as fiscal bot) ---

function mapPaymentStatus(asaasStatus: string): string {
  switch (asaasStatus) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "PAID";
    case "OVERDUE":
      return "OVERDUE";
    case "REFUNDED":
    case "DELETED":
      return "CANCELLED";
    case "PENDING":
    default:
      return "PENDING";
  }
}

// --- Handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  // Admin precisa VER o motivo real da falha (é ele quem conserta o cadastro);
  // franqueado continua recebendo mensagem genérica.
  let requesterIsAdmin = false;

  try {
    const body = await req.json();
    const { action } = body;

    // --- Webhook: detect ASAAS format (has "event" + "payment" fields) or explicit action ---
    const isAsaasWebhook = !action && body.event && body.payment;
    if (action === "webhook" || isAsaasWebhook) {
      if (!ASAAS_WEBHOOK_TOKEN) {
        // Fail-closed: reject if token not configured
        console.error("ASAAS_WEBHOOK_TOKEN not configured — rejecting webhook");
        return new Response(JSON.stringify({ error: "Webhook not configured" }), {
          status: 503, headers: jsonHeaders,
        });
      }
      const urlToken = new URL(req.url).searchParams.get("asaas_token") || "";
      const incomingToken = body.access_token || req.headers.get("asaas-access-token") || urlToken || "";
      if (incomingToken !== ASAAS_WEBHOOK_TOKEN) {
        return new Response(JSON.stringify({ error: "Unauthorized webhook" }), {
          status: 401, headers: jsonHeaders,
        });
      }
      const result = await handleWebhook(body);
      return new Response(JSON.stringify(result), { headers: jsonHeaders });
    }

    // --- All other actions: require authenticated user ---
    // Service-role bypass: accept ONLY the real service-role key (constant-time compare).
    // NEVER trust a decoded `role` claim — a JWT payload is unsigned data and can be forged
    // (anyone could send `{"role":"service_role"}` and become admin). Only a caller holding
    // the actual secret key is treated as service role.
    let isServiceRole = false;
    const bearer = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (bearer && SUPABASE_SERVICE_ROLE_KEY && bearer.length === SUPABASE_SERVICE_ROLE_KEY.length) {
      let diff = 0;
      for (let i = 0; i < bearer.length; i++) {
        diff |= bearer.charCodeAt(i) ^ SUPABASE_SERVICE_ROLE_KEY.charCodeAt(i);
      }
      isServiceRole = diff === 0;
    }

    const user = isServiceRole
      ? { id: "service_role", role: "admin" as UserRole, managed: [] }
      : await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Autenticação necessária" }), {
        status: 401, headers: jsonHeaders,
      });
    }

    requesterIsAdmin = isAdminOrManager(user);

    // Admin-only actions
    const adminActions = [
      "register",
      "register-batch",
      "subscribe-batch",
      "register-webhook",
      "cancel-subscription",
      "update-subscription-value",
      "check-payment-batch",
      "sync-customer-document",
    ];
    if (adminActions.includes(action) && !isAdminOrManager(user)) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem executar esta ação" }), {
        status: 403, headers: jsonHeaders,
      });
    }

    // check-payment: user must own the franchise
    if (action === "check-payment" && body.franchise_id) {
      if (!canAccessFranchise(user, body.franchise_id)) {
        return new Response(JSON.stringify({ error: "Sem permissão para esta franquia" }), {
          status: 403, headers: jsonHeaders,
        });
      }
    }

    let result;
    switch (action) {
      case "register":
        result = await registerCustomer(body.franchise_id);
        break;
      case "register-batch":
        result = await registerBatch(body.franchise_ids);
        break;
      case "subscribe-batch":
        result = await subscribeBatch(body.value, body.franchise_ids);
        break;
      case "cancel-subscription":
        result = await cancelSubscription(body.franchise_id);
        break;
      case "sync-customer-document":
        result = await syncCustomerDocument(body.franchise_id);
        break;
      case "update-subscription-value":
        result = await updateSubscriptionValue({
          franchiseIds: body.franchise_ids,
          allActive: body.all_active,
          newValue: body.new_value,
          applyToCurrent: !!body.apply_to_current,
        });
        break;
      case "check-payment":
        result = await checkPayment(body.franchise_id);
        break;
      case "check-payment-batch":
        result = await checkPaymentBatch();
        break;
      case "register-webhook": {
        // Register webhook in ASAAS pointing to this Edge Function
        const webhookUrl = `${SUPABASE_URL}/functions/v1/asaas-billing`;
        // Check existing webhooks
        const existing = await asaasRequest("/v3/webhooks");
        const alreadyRegistered = (existing.data || []).find(
          (w: Record<string, unknown>) => (w.url as string)?.includes("asaas-billing")
        );
        if (alreadyRegistered) {
          result = { message: "Webhook já registrado", webhook: alreadyRegistered };
          break;
        }
        // Create new webhook
        const webhook = await asaasRequest("/v3/webhooks", {
          method: "POST",
          body: JSON.stringify({
            name: "FranchiseFlow Billing",
            url: webhookUrl,
            email: "nelpno@gmail.com",
            apiVersion: 3,
            enabled: true,
            interrupted: false,
            authToken: ASAAS_WEBHOOK_TOKEN,
            sendType: "NON_SEQUENTIALLY",
            events: [
              "PAYMENT_CONFIRMED",
              "PAYMENT_RECEIVED",
              "PAYMENT_OVERDUE",
              "PAYMENT_REFUNDED",
              "PAYMENT_DELETED",
              "PAYMENT_UPDATED",
              "PAYMENT_CREATED",
            ],
          }),
        });
        result = { message: "Webhook registrado com sucesso", webhook };
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: jsonHeaders,
        });
    }

    return new Response(JSON.stringify(result), { headers: jsonHeaders });
  } catch (err) {
    const message = (err as Error).message;
    // Never expose internal ASAAS error details to non-admin callers
    const safeMessage = requesterIsAdmin
      ? message
      : message.includes("ASAAS") ? "Erro no sistema de cobrança" : message;
    return new Response(JSON.stringify({ error: safeMessage }), {
      status: 500, headers: jsonHeaders,
    });
  }
});
