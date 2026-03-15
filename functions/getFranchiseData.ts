import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    // Validate shared secret to ensure request comes from n8n
    const url = new URL(req.url);
    const secret = req.headers.get("api_key") || url.searchParams.get("api_key");
    const expectedSecret = Deno.env.get("N8N_SECRET_KEY");

    if (expectedSecret && secret !== expectedSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Accept instanceId from body (POST) or query params (GET)
    let instanceId;
    if (req.method === "POST") {
      const text = await req.text();
      if (text) {
        const body = JSON.parse(text);
        instanceId = body.franchise_evolution_instance_id;
      }
    }
    if (!instanceId) {
      instanceId = url.searchParams.get("franchise_evolution_instance_id");
    }

    if (!instanceId) {
      return Response.json({ error: "Missing franchise_evolution_instance_id" }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Fetch franchise config and franchise info in parallel
    const [configs, franchises] = await Promise.all([
      base44.asServiceRole.entities.FranchiseConfiguration.filter({
        franchise_evolution_instance_id: instanceId,
      }),
      base44.asServiceRole.entities.Franchise.filter({
        evolution_instance_id: instanceId,
      }),
    ]);

    const config = configs[0] || null;
    const franchise = franchises[0] || null;

    return Response.json({
      franchise,
      config,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});