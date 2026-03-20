import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

// URL do seu webhook no n8n
const N8N_WEBHOOK_URL = 'https://webhook.dynamicagents.tech/webhook/adc276df-8162-46ca-bec6-5aedb9cb2b14';

Deno.serve(async (req) => {
    // Garante que a requisição seja um POST
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        // Valida se há um usuário autenticado para segurança
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Não autorizado. Por favor, faça login.' }, { status: 401 });
        }

        // Pega os dados da configuração enviados pelo frontend
        const configData = await req.json();

        // Envia os dados para o webhook do n8n
        const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(configData),
        });

        // Verifica se o n8n respondeu com erro
        if (!n8nResponse.ok) {
            const errorText = await n8nResponse.text();
            console.error('Erro do webhook n8n:', errorText);
            return Response.json({ error: `Erro do n8n: ${n8nResponse.statusText}`, details: errorText }, { status: n8nResponse.status });
        }

        // Pega os dados otimizados da resposta do n8n
        const optimizedData = await n8nResponse.json();

        // Retorna os dados otimizados para o frontend
        return Response.json(optimizedData, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });

    } catch (error) {
        console.error('Erro na função optimizeConfig:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});