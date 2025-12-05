import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { phone, name, value, source, franchise_id } = await req.json();

        // Buscar histórico de mensagens recente deste telefone (simulação de "contexto")
        // Na prática, buscaria na entidade Message filtrando por sender_phone ou contact_phone
        // Como sender_phone pode variar o formato, vamos tentar uma busca simples se phone for fornecido
        let messagesContext = [];
        if (phone) {
             const messages = await base44.entities.Message.filter({ sender_phone: phone }, '-timestamp', 10);
             messagesContext = messages.map(m => ({
                 role: m.is_incoming ? 'user' : 'agent',
                 content: m.content,
                 time: m.timestamp
             }));
        }

        const prompt = `
        Você é um especialista em vendas da Maxi Massas. Analise este lead/cliente e estime o potencial de venda ou upsell.
        
        Dados do Cliente:
        - Nome: ${name || 'Não informado'}
        - Telefone: ${phone || 'Não informado'}
        - Valor Proposta/Venda: ${value || 0}
        - Origem: ${source}
        
        Histórico de interações recentes (se houver):
        ${JSON.stringify(messagesContext)}
        
        Retorne um JSON estrito:
        {
            "score": (número 0-100 indicando potencial de fechamento ou retenção),
            "analysis": "Análise curta de 1-2 frases sobre o perfil do cliente baseada nas mensagens e dados.",
            "suggestion": "Uma ação prática recomendada (ex: Oferecer borda recheada, ligar amanhã).",
            "sentiment": "positive" | "neutral" | "negative"
        }
        `;

        const llmResponse = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    score: { type: "integer" },
                    analysis: { type: "string" },
                    suggestion: { type: "string" },
                    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] }
                },
                required: ["score", "analysis", "suggestion", "sentiment"]
            }
        });

        return Response.json(llmResponse);

    } catch (error) {
        console.error("Error analyzing lead:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});