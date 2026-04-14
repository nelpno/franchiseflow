import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") || "https://api.asaas.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.description || `ASAAS error ${res.status}`);
  }
  return data;
}

// --- Actions ---

async function registerCustomer(franchiseId: string) {
  // Get franchise data
  const { data: franchise, error: fErr } = await supabase
    .from("franchises")
    .select("id, name, owner_name, cpf_cnpj, city, phone_number, state_uf, address_number, neighborhood, evolution_instance_id")
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

  // Get email from profiles via franchise_invites
  const { data: invite } = await supabase
    .from("franchise_invites")
    .select("email")
    .eq("franchise_id", franchiseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Check if customer already exists in ASAAS
  const existing = await asaasRequest(`/v3/customers?cpfCnpj=${franchise.cpf_cnpj}`);
  let customerId: string;

  if (existing.data?.length > 0) {
    customerId = existing.data[0].id;
  } else {
    // Create new customer
    const customer = await asaasRequest("/v3/customers", {
      method: "POST",
      body: JSON.stringify({
        name: franchise.owner_name || franchise.name,
        cpfCnpj: franchise.cpf_cnpj,
        email: invite?.email || null,
        phone: franchise.phone_number || null,
        address: config?.street_address || null,
        addressNumber: franchise.address_number || null,
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

async function createSubscription(franchiseId: string) {
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
  const nextMonth = now.getDate() >= 5 ? now.getMonth() + 2 : now.getMonth() + 1;
  const nextDue = new Date(now.getFullYear(), nextMonth, 5);
  const nextDueStr = nextDue.toISOString().split("T")[0];

  // Create subscription in ASAAS
  const subscription = await asaasRequest("/v3/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: sub.asaas_customer_id,
      billingType: "UNDEFINED",
      value: 150.0,
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

async function subscribeBatch() {
  // Find all with customer but no subscription
  const { data: subs } = await supabase
    .from("system_subscriptions")
    .select("franchise_id")
    .not("asaas_customer_id", "is", null)
    .is("asaas_subscription_id", null);

  const results = [];
  for (const sub of subs || []) {
    try {
      const res = await createSubscription(sub.franchise_id);
      results.push({ franchise_id: sub.franchise_id, success: true, ...res });
    } catch (err) {
      results.push({ franchise_id: sub.franchise_id, success: false, error: (err as Error).message });
    }
  }
  return results;
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

  try {
    const body = await req.json();
    const { action } = body;

    let result;
    switch (action) {
      case "register":
        result = await registerCustomer(body.franchise_id);
        break;
      case "register-batch":
        result = await registerBatch(body.franchise_ids);
        break;
      case "subscribe":
        result = await createSubscription(body.franchise_id);
        break;
      case "subscribe-batch":
        result = await subscribeBatch();
        break;
      case "check-payment":
        result = await checkPayment(body.franchise_id);
        break;
      case "webhook":
        result = await handleWebhook(body);
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
