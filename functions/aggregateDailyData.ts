import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';
import { format, subDays } from 'npm:date-fns';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Usar asServiceRole para ter acesso elevado sem necessidade de usuário logado
        const sdk = base44.asServiceRole;

        const body = await req.json().catch(() => ({}));
        // Se uma data não for fornecida no body, processa o dia de ontem por padrão.
        const targetDateStr = body.date || format(subDays(new Date(), 1), 'yyyy-MM-dd');

        const [franchises, salesForDate, contactsForDate] = await Promise.all([
            sdk.entities.Franchise.filter({ status: 'active' }),
            sdk.entities.Sale.filter({ sale_date: targetDateStr }),
            sdk.entities.DailyUniqueContact.filter({ date: targetDateStr })
        ]);

        let processedCount = 0;

        for (const franchise of franchises) {
            if (!franchise.evolution_instance_id) continue;

            const franchiseSales = salesForDate.filter(s => s.franchise_id === franchise.evolution_instance_id);
            const franchiseContacts = contactsForDate.filter(c => c.franchise_id === franchise.evolution_instance_id);

            const sales_count = franchiseSales.length;
            const unique_contacts = franchiseContacts.length;
            const sales_value = franchiseSales.reduce((sum, s) => sum + (s.value || 0), 0);
            const conversion_rate = unique_contacts > 0 ? (sales_count / unique_contacts) * 100 : 0;
            
            const summaryData = {
                date: targetDateStr,
                franchise_id: franchise.evolution_instance_id,
                unique_contacts,
                sales_count,
                sales_value,
                conversion_rate,
            };

            // Lógica de "Upsert": Atualiza se existir, cria se não.
            const existingSummary = await sdk.entities.DailySummary.filter({
                date: targetDateStr,
                franchise_id: franchise.evolution_instance_id
            }, '', 1);

            if (existingSummary && existingSummary.length > 0) {
                await sdk.entities.DailySummary.update(existingSummary[0].id, summaryData);
            } else {
                await sdk.entities.DailySummary.create(summaryData);
            }
            processedCount++;
        }

        return Response.json({
            message: `Agregação concluída para a data ${targetDateStr}.`,
            franchises_processed: processedCount
        }, { status: 200 });

    } catch (error) {
        console.error('Erro na função de agregação:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});