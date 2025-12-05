import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Buscar dados para relatório
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30); // Últimos 30 dias
        const startDateStr = startDate.toISOString().split('T')[0];

        // Buscar summaries e franchises
        // Usando service role se necessário para pegar dados globais para admin, ou filtrados via lógica normal
        // Como é função backend chamada pelo front, o contexto do usuário normal deve bastar se RLS estiver ok
        // Mas para relatórios agregados, as vezes precisamos de tudo se o user for admin.
        
        const summaries = await base44.entities.DailySummary.filter({ date: { $gte: startDateStr } });
        const franchises = await base44.entities.Franchise.list();

        // Agrupar dados para o LLM
        // Não enviar tudo, apenas dados agregados para economizar tokens
        const aggregatedData = franchises.map(f => {
            const fSummaries = summaries.filter(s => s.franchise_id === f.evolution_instance_id);
            return {
                city: f.city,
                total_contacts: fSummaries.reduce((acc, s) => acc + (s.unique_contacts || 0), 0),
                total_sales: fSummaries.reduce((acc, s) => acc + (s.sales_count || 0), 0),
                total_revenue: fSummaries.reduce((acc, s) => acc + (s.sales_value || 0), 0),
                avg_conversion: fSummaries.length ? (fSummaries.reduce((acc, s) => acc + (s.sales_count || 0), 0) / fSummaries.reduce((acc, s) => acc + (s.unique_contacts || 0), 0) * 100 || 0) : 0
            };
        });

        const prompt = `
        Analise os dados de vendas dos últimos 30 dias das franquias Maxi Massas.
        Identifique tendências de perda (baixa conversão) e gere resumos semanais.

        Dados Agregados:
        ${JSON.stringify(aggregatedData)}

        Retorne um JSON estrito:
        {
            "lost_sales_trends": [
                { "trend": "Descrição da tendência (ex: Franquia X tem muitos contatos mas pouca venda)", "countermeasure": "Sugestão de contramedida" }
            ],
            "weekly_performance_summary": [
                { "franchise_city": "Cidade", "summary": "Resumo curto de 1 frase sobre a performance geral." }
            ]
        }
        `;

        const llmResponse = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    lost_sales_trends: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                trend: { type: "string" },
                                countermeasure: { type: "string" }
                            }
                        }
                    },
                    weekly_performance_summary: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                franchise_city: { type: "string" },
                                summary: { type: "string" }
                            }
                        }
                    }
                },
                required: ["lost_sales_trends", "weekly_performance_summary"]
            }
        });

        return Response.json(llmResponse);

    } catch (error) {
        console.error("Error generating sales report insights:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});