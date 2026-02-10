import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const N8N_WEBHOOK_URL = 'https://webhook.dynamicagents.tech/webhook/a9c45ef7-36f7-4a64-ad9e-edadb69a31af';

Deno.serve(async (req) => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
    }

    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { franchise_evolution_instance_id } = await req.json();
        
        if (!franchise_evolution_instance_id) {
            return Response.json({ error: 'franchise_evolution_instance_id é obrigatório' }, { status: 400 });
        }

        console.log(`Verificando status da instância: ${franchise_evolution_instance_id}`);
        console.log(`URL do webhook: ${N8N_WEBHOOK_URL}`);

        // Envia dados para o n8n para verificar status
        const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                instanceName: franchise_evolution_instance_id,
                action: 'check_status'
            }),
        });

        console.log(`Status da resposta do n8n: ${n8nResponse.status}`);

        if (!n8nResponse.ok) {
            const errorText = await n8nResponse.text();
            console.error('Erro detalhado do webhook n8n:', errorText);
            return Response.json({ 
                error: `Erro ao verificar status: ${n8nResponse.statusText}`,
                details: errorText,
                status_code: n8nResponse.status,
                webhook_url: N8N_WEBHOOK_URL // Para debug
            }, { status: n8nResponse.status });
        }

        const result = await n8nResponse.json();
        console.log('Resposta do status do n8n:', JSON.stringify(result, null, 2));
        
        // Atualiza a configuração da franquia com o status atual
        const configurations = await base44.entities.FranchiseConfiguration.filter({
            franchise_evolution_instance_id: franchise_evolution_instance_id
        });

        if (configurations.length > 0) {
            let newStatus = 'disconnected';
            if (result.status === 'open' || result.connected === true) {
                newStatus = 'connected';
            } else if (result.status === 'connecting' || result.status === 'pending') {
                newStatus = 'pending_qr';
            }

            await base44.entities.FranchiseConfiguration.update(configurations[0].id, {
                whatsapp_status: newStatus
            });
        }

        return Response.json(result, { status: 200 });

    } catch (error) {
        console.error('Erro na função checkWhatsappStatus:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});