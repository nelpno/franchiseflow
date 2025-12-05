import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

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

        console.log(`Iniciando processo inteligente de conexão para: ${franchise_evolution_instance_id}`);

        // Envia dados para o n8n com a ação inteligente
        const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                instanceName: franchise_evolution_instance_id,
                action: 'smart_connect' // Ação que o n8n deve interpretar como: verificar primeiro, se não conectado então gerar QR
            }),
        });

        if (!n8nResponse.ok) {
            const errorText = await n8nResponse.text();
            console.error('Erro do webhook n8n:', errorText);
            return Response.json({ 
                error: `Erro ao conectar: ${n8nResponse.statusText}`,
                details: errorText
            }, { status: n8nResponse.status });
        }

        const result = await n8nResponse.json();
        console.log('Resposta do n8n:', JSON.stringify(result, null, 2));
        
        // Busca a configuração da franquia
        const configurations = await base44.entities.FranchiseConfiguration.filter({
            franchise_evolution_instance_id: franchise_evolution_instance_id
        });

        if (configurations.length > 0) {
            const config = configurations[0];
            let updateData = {};

            // CENÁRIO 1: JÁ ESTÁ CONECTADO
            if (result.status === 'connected' || result.status === 'open' || result.connected === true) {
                updateData = {
                    whatsapp_status: 'connected',
                    whatsapp_instance_id: result.instanceId || result.instance_id || config.whatsapp_instance_id,
                    whatsapp_qr_code: null // Limpa QR Code antigo
                };
                
                // Retorna resposta indicando que já está conectado
                await base44.entities.FranchiseConfiguration.update(config.id, updateData);
                
                return Response.json({
                    status: 'connected',
                    connected: true,
                    message: 'WhatsApp já está conectado e funcionando!',
                    instanceId: updateData.whatsapp_instance_id
                }, { status: 200 });
            }
            
            // CENÁRIO 2: NÃO ESTÁ CONECTADO, MAS RECEBEU QR CODE
            else if (result.qrCode || result.qr_code || result.qrcode) {
                updateData = {
                    whatsapp_status: 'pending_qr',
                    whatsapp_instance_id: result.instanceId || result.instance_id || config.whatsapp_instance_id,
                    whatsapp_qr_code: result.qrCode || result.qr_code || result.qrcode
                };
                
                await base44.entities.FranchiseConfiguration.update(config.id, updateData);
                
                return Response.json({
                    qrCode: updateData.whatsapp_qr_code,
                    instanceId: updateData.whatsapp_instance_id,
                    status: 'pending_qr',
                    message: 'QR Code gerado. Escaneie com seu WhatsApp.'
                }, { status: 200 });
            }
            
            // CENÁRIO 3: ERRO OU RESPOSTA INESPERADA
            else {
                console.error('Resposta inesperada do n8n:', result);
                return Response.json({
                    error: 'Resposta inesperada do sistema de WhatsApp',
                    details: result
                }, { status: 500 });
            }
        } else {
            return Response.json({ 
                error: 'Configuração da franquia não encontrada'
            }, { status: 404 });
        }

    } catch (error) {
        console.error('Erro na função connectWhatsappRobot:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});