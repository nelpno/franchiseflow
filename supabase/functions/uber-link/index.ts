// Link "Chamar Uber" da venda com entrega (08/10/2026, piloto São Miguel).
// Monta o universal link da Uber (m.uber.com/ul) com a retirada na unidade e a entrega no
// endereço do cliente: abre o app da própria franqueada, na conta e no preço dela (sem API de
// empresa, que cobra mais). Aqui só porque o endereço do cliente precisa de lat/lng e a chave
// do Google não pode ir para o navegador.
// POST { sale_id } com o JWT do usuário → { url, precisao, endereco_google }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_MAPS_KEY = Deno.env.get("GOOGLE_MAPS_KEY") || "";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Endereço exato o bastante para o pino cair na porta (o resto cai no meio da rua ou do bairro).
const PRECISOS = new Set(["ROOFTOP", "RANGE_INTERPOLATED"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "não autenticado" }, 401);
  if (!GOOGLE_MAPS_KEY) return json({ error: "serviço indisponível" }, 503);

  let saleId = "";
  try { saleId = String((await req.json())?.sale_id || ""); } catch { /* corpo inválido */ }
  if (!/^[0-9a-f-]{36}$/i.test(saleId)) return json({ error: "venda inválida" }, 400);

  // A venda é lida com o JWT de quem pediu: o RLS de sales decide se essa pessoa pode vê-la.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "não autenticado" }, 401);
  const { data: sale } = await userClient
    .from("sales")
    .select("id, franchise_id, delivery_method, customer_address, customer_neighborhood")
    .eq("id", saleId)
    .maybeSingle();
  if (!sale) return json({ error: "venda não encontrada" }, 404);
  if (sale.delivery_method !== "delivery" || !sale.customer_address?.trim()) {
    return json({ error: "venda sem endereço de entrega" }, 422);
  }

  const [{ data: geo }, { data: cfg }] = await Promise.all([
    admin.from("unidade_geo").select("lat, lng, endereco_google").eq("id", sale.franchise_id).maybeSingle(),
    admin.from("franchise_configurations").select("city").eq("franchise_evolution_instance_id", sale.franchise_id).maybeSingle(),
  ]);
  if (!geo?.lat || !geo?.lng) return json({ error: "endereço da unidade sem localização" }, 422);

  // Texto livre do robô ("Rua X 8 casa 2"): completa com bairro e cidade da unidade, e
  // o viés de região pela própria unidade evita cair numa rua homônima de outra cidade.
  const busca = [sale.customer_address, sale.customer_neighborhood, cfg?.city, "SP"]
    .map((s) => (s || "").trim()).filter(Boolean).join(", ");
  const d = 0.25; // ~25 km em volta da unidade
  const params = new URLSearchParams({
    address: busca,
    region: "br",
    language: "pt-BR",
    bounds: `${geo.lat - d},${geo.lng - d}|${geo.lat + d},${geo.lng + d}`,
    key: GOOGLE_MAPS_KEY,
  });
  let r;
  try {
    const resp = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    r = (await resp.json())?.results?.[0];
  } catch { /* cai no 502 abaixo */ }
  if (!r?.geometry?.location) return json({ error: "não achei o endereço do cliente no mapa" }, 502);

  const q = new URLSearchParams({
    action: "setPickup",
    "pickup[latitude]": String(geo.lat),
    "pickup[longitude]": String(geo.lng),
    "pickup[nickname]": "Maxi Massas",
    "pickup[formatted_address]": geo.endereco_google || "",
    "dropoff[latitude]": String(r.geometry.location.lat),
    "dropoff[longitude]": String(r.geometry.location.lng),
    "dropoff[nickname]": "Cliente",
    "dropoff[formatted_address]": r.formatted_address || busca,
  });

  return json({
    url: `https://m.uber.com/ul/?${q}`,
    precisao: PRECISOS.has(r.geometry.location_type) ? "exato" : "aproximado",
    endereco_google: r.formatted_address || "",
  });
});
