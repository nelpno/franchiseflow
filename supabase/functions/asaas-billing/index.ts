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

async function asaasRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
      ...((options.headers as Record<string, string>) || {}),
    },
  });
  // DELETE costuma retornar 204 sem body; text() seguido de JSON.parse tolera body vazio
  if (res.status === 204) return {};
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.description || `ASAAS error ${res.status}`);
  }
  return data;
}

// --- Actions ---

async function registerCustomer(franchiseId: string) {
  // Get franchise data (inclui billing_email — fonte primária do email de cobrança)
  const { data: franchise, error: fErr } = await supabase
    .from("franchises")
    .select("id, name, owner_name, cpf_cnpj, city, phone_number, state_uf, address_number, address_complement, neighborhood, evolution_instance_id, billing_email")
    .eq("evolution_instance_id", franchiseId)
    .single();
  if (fErr || !franchise) throw new Error("Franquia não encontrada");
  if (!franchise.cpf_cnpj) throw new Error("CPF/CNPJ não preenchido");

  // Get config for address
  const { data: config } = await supabase
    .from("franchise_configurations")
    .select("street_address, cep, franchise_name")
    .eq("franchise_evolution_instance_id", franchiseId)
    .single();

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

async function createSubscription(franchiseId: string, value: number = 150) {
  if (!Number.isFinite(value) || value < 5 || value > 5000) {
    throw new Error("Valor inválido (deve estar entre R$ 5 e R$ 5.000)");
  }

  // Get subscription record
  const { data: sub, error } = await supabase
    .from("system_subscriptions")
    .select("*")
    .eq("franchise_id", franchiseId)
    .single();
  if (error || !sub) throw new Error("Franquia não cadastrada no ASAAS ainda");
  if (!sub.asaas_customer_id) throw new Error("Cliente ASAAS não encontrado");
  if (sub.asaas_subscription_id) throw new Error("Assinatura já existe");

  // Calculate next due date (day 5 of next month)
  const now = new Date();
  const nextDue = new Date(now.getFullYear(), now.getMonth() + 1, 5);
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
      description: "Mensalidade Maxi Massas",
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

      // Try to get PIX
      try {
        const pix = await asaasRequest(`/v3/payments/${pay.id}/pixQrCode`);
        paymentData.pix_payload = pix.payload || null;
        paymentData.pix_qr_code_url = pix.encodedImage
          ? `data:image/png;base64,${pix.encodedImage}`
          : null;
      } catch {
        // PIX not available yet, ok
      }
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

async function checkPayment(franchiseId: string) {
  const { data: sub } = await supabase
    .from("system_subscriptions")
    .select("*")
    .eq("franchise_id", franchiseId)
    .single();
  if (!sub?.asaas_subscription_id) throw new Error("Sem assinatura ativa");

  // Get latest payment from ASAAS
  const payments = await asaasRequest(
    `/v3/subscriptions/${sub.asaas_subscription_id}/payments?sort=dueDate&order=desc&limit=1`
  );
  if (!payments.data?.length) return { status: "NO_PAYMENTS" };

  const pay = payments.data[0];
  const status = mapPaymentStatus(pay.status);

  const updateData: Record<string, unknown> = {
    current_payment_id: pay.id,
    current_payment_status: status,
    current_payment_due_date: pay.dueDate,
    current_payment_value: pay.value,
    current_payment_url: pay.bankSlipUrl || pay.invoiceUrl || null,
    last_synced_at: new Date().toISOString(),
  };

  // Fetch PIX if overdue or pending (so paywall can show it)
  if (status === "OVERDUE" || status === "PENDING") {
    try {
      const pix = await asaasRequest(`/v3/payments/${pay.id}/pixQrCode`);
      updateData.pix_payload = pix.payload || null;
      updateData.pix_qr_code_url = pix.encodedImage
        ? `data:image/png;base64,${pix.encodedImage}`
        : null;
    } catch {
      // PIX not available
    }
  }

  await supabase
    .from("system_subscriptions")
    .update(updateData)
    .eq("franchise_id", franchiseId);

  return { status, paymentId: pay.id };
}

async function checkPaymentBatch() {
  const { data: subs, error } = await supabase
    .from("system_subscriptions")
    .select("franchise_id")
    .not("asaas_subscription_id", "is", null)
    .neq("subscription_status", "CANCELLED");
  if (error) throw error;

  const ids = (subs || []).map(s => s.franchise_id as string);
  const errors: { franchise_id: string; error: string }[] = [];
  let updated = 0;

  for (const fid of ids) {
    try {
      await checkPayment(fid);
      updated++;
    } catch (err) {
      errors.push({ franchise_id: fid, error: (err as Error).message });
    }
    await new Promise(r => setTimeout(r, 250));
  }

  return { total: ids.length, updated, errors };
}

async function handleWebhook(body: Record<string, unknown>) {
  const event = body.event as string;
  const payment = body.payment as Record<string, unknown>;
  if (!payment?.subscription) return { ignored: true };

  // Find subscription in our table
  const { data: sub } = await supabase
    .from("system_subscriptions")
    .select("franchise_id")
    .eq("asaas_subscription_id", payment.subscription)
    .single();
  if (!sub) return { ignored: true, reason: "subscription not found" };

  const status = mapPaymentStatus(payment.status as string);

  const updateData: Record<string, unknown> = {
    current_payment_id: payment.id,
    current_payment_status: status,
    current_payment_due_date: payment.dueDate,
    current_payment_value: payment.value,
    current_payment_url: (payment.bankSlipUrl || payment.invoiceUrl || null) as string | null,
    last_synced_at: new Date().toISOString(),
  };

  // Fetch PIX for overdue payments
  if (status === "OVERDUE") {
    try {
      const pix = await asaasRequest(`/v3/payments/${payment.id}/pixQrCode`);
      updateData.pix_payload = pix.payload || null;
      updateData.pix_qr_code_url = pix.encodedImage
        ? `data:image/png;base64,${pix.encodedImage}`
        : null;
    } catch {
      // ok
    }
  }

  await supabase
    .from("system_subscriptions")
    .update(updateData)
    .eq("franchise_id", sub.franchise_id);

  return { updated: sub.franchise_id, status, event };
}

async function registerBatch(franchiseIds: string[]) {
  const results = [];
  for (const fid of franchiseIds) {
    try {
      const res = await registerCustomer(fid);
      results.push({ franchise_id: fid, success: true, ...res });
    } catch (err) {
      results.push({ franchise_id: fid, success: false, error: (err as Error).message });
    }
  }
  return results;
}

async function subscribeBatch(value: number = 150) {
  // Find all with customer but no subscription (ignora já-canceladas que não serão recriadas em lote)
  const { data: subs } = await supabase
    .from("system_subscriptions")
    .select("franchise_id, subscription_status")
    .not("asaas_customer_id", "is", null)
    .is("asaas_subscription_id", null);

  const results = [];
  for (const sub of subs || []) {
    try {
      const res = await createSubscription(sub.franchise_id, value);
      results.push({ franchise_id: sub.franchise_id, success: true, ...res });
    } catch (err) {
      results.push({ franchise_id: sub.franchise_id, success: false, error: (err as Error).message });
    }
  }
  return results;
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
    for (const pay of (payments as { data?: Array<{ id: string }> }).data || []) {
      try {
        await asaasRequest(`/v3/payments/${pay.id}`, { method: "DELETE" });
      } catch { /* segue cancelando os próximos */ }
    }
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

  const results: Array<{ franchise_id: string; success: boolean; error?: string }> = [];

  for (const fid of targets) {
    try {
      const { data: sub } = await supabase
        .from("system_subscriptions")
        .select("asaas_subscription_id, current_payment_id")
        .eq("franchise_id", fid)
        .single();

      if (!sub?.asaas_subscription_id) {
        results.push({ franchise_id: fid, success: false, error: "Sem assinatura ativa" });
        continue;
      }

      // Atualiza subscription ASAAS (vale para próximos ciclos)
      await asaasRequest(`/v3/subscriptions/${sub.asaas_subscription_id}`, {
        method: "POST",
        body: JSON.stringify({ value: newValue }),
      });

      const patch: Record<string, unknown> = { last_synced_at: new Date().toISOString() };

      // Opcionalmente aplica ao payment do ciclo atual (refaz fatura + PIX)
      if (applyToCurrent && sub.current_payment_id) {
        try {
          const updated = await asaasRequest(`/v3/payments/${sub.current_payment_id}`, {
            method: "POST",
            body: JSON.stringify({ value: newValue }),
          }) as { value?: number; bankSlipUrl?: string; invoiceUrl?: string };
          patch.current_payment_value = updated.value ?? newValue;
          patch.current_payment_url = updated.bankSlipUrl || updated.invoiceUrl || null;

          // Recarrega PIX porque o valor mudou = QR novo
          try {
            const pix = await asaasRequest(`/v3/payments/${sub.current_payment_id}/pixQrCode`) as {
              payload?: string; encodedImage?: string;
            };
            patch.pix_payload = pix.payload || null;
            patch.pix_qr_code_url = pix.encodedImage
              ? `data:image/png;base64,${pix.encodedImage}`
              : null;
          } catch { /* PIX pode demorar alguns segundos */ }
        } catch (payErr) {
          console.warn(`[asaas-billing] Falha ao atualizar payment de ${fid}: ${(payErr as Error).message}`);
        }
      }

      await supabase
        .from("system_subscriptions")
        .update(patch)
        .eq("franchise_id", fid);

      results.push({ franchise_id: fid, success: true });
    } catch (err) {
      results.push({ franchise_id: fid, success: false, error: (err as Error).message });
    }
  }

  return {
    total: targets.length,
    updated: results.filter((r) => r.success).length,
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
    // Service role key bypass: decode JWT and check role claim
    let isServiceRole = false;
    try {
      const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        isServiceRole = payload.role === "service_role";
      }
    } catch { /* not a valid JWT */ }

    const user = isServiceRole
      ? { id: "service_role", role: "admin" as UserRole, managed: [] }
      : await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Autenticação necessária" }), {
        status: 401, headers: jsonHeaders,
      });
    }

    // Admin-only actions
    const adminActions = [
      "register",
      "register-batch",
      "subscribe-batch",
      "register-webhook",
      "cancel-subscription",
      "update-subscription-value",
      "check-payment-batch",
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
        result = await subscribeBatch(body.value);
        break;
      case "cancel-subscription":
        result = await cancelSubscription(body.franchise_id);
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
    const safeMessage = message.includes("ASAAS") ? "Erro no sistema de cobrança" : message;
    return new Response(JSON.stringify({ error: safeMessage }), {
      status: 500, headers: jsonHeaders,
    });
  }
});
