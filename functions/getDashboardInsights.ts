import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Coletar dados recentes para análise
        // Pegamos os últimos 7 dias de resumos para ter contexto recente
        const recentSummaries = await base44.entities.DailySummary.list('-date', 100);
        const franchises = await base44.entities.Franchise.list();

        // Preparar dados para o LLM
        const dataContext = {
            franchises: franchises.map(f => ({ id: f.evolution_instance_id, city: f.city, owner: f.owner_name })),
            summaries: recentSummaries.slice(0, 50) // Limitar para não estourar contexto
        };

        const prompt = `
        Você é um consultor de negócios especialista em franquias de delivery (Maxi Massas).
        Analise os dados JSON fornecidos abaixo e gere insights estratégicos curtos e diretos.

        Dados: ${JSON.stringify(dataContext)}

        Gere um JSON de resposta com o seguinte formato estrito:
        {
            "low_performance_franchises": [
                { "city": "Nome da Cidade", "reason": "Motivo curto (ex: Baixa conversão ontem)", "suggestion": "Ação sugerida curta" }
            ],
            "action_items": [
                "Ação 1 para o gestor fazer hoje",
                "Ação 2 para o gestor fazer hoje"
            ],
            "sales_forecast_comment": "Um comentário curto de 1 frase sobre a tendência geral de vendas baseada nos últimos dias."
        }

        Regras para análise:
        1. Identifique franquias com conversão (sales/contacts) abaixo de 5% ou com muitos contatos e zero vendas nos últimos 2 dias.
        2. Sugira ações como "Verificar atendimento no WhatsApp", "Treinar atendente", "Ofertar promoção".
        3. Se tudo estiver bem, a lista de 'low_performance' pode estar vazia.
        4. Action items devem ser práticos, como "Contatar franquia X", "Revisar meta de vendas".
        `;

        // 2. Chamar LLM
        const llmResponse = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    low_performance_franchises: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                city: { type: "string" },
                                reason: { type: "string" },
                                suggestion: { type: "string" }
                            },
                            required: ["city", "reason", "suggestion"]
                        }
                    },
                    action_items: {
                        type: "array",
                        items: { type: "string" }
                    },
                    sales_forecast_comment: { type: "string" }
                },
                required: ["low_performance_franchises", "action_items", "sales_forecast_comment"]
            }
        });

        return Response.json(llmResponse);

    } catch (error) {
        console.error("Error generating insights:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});