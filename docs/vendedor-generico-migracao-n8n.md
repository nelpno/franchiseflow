# Vendedor Genérico — Plano de Migração n8n

## Status atual do workflow
- **Workflow ID**: PALRV1RqD3opHMzk (teste.dynamicagents.tech)
- **91 nós**, sendo 7 que precisam migrar
- **Credencial atual**: `vendedor_bauru` (aponta para clientes_franquias Supabase)
- **JSON salvo**: docs/vendedor-generico-workflow.json

## Nós para alterar (7 nós + 1 credencial)

### 1. `dadosunidade` (httpRequest → Supabase)
**Hoje:**
```
GET https://app.base44.com/api/apps/68b1c2cdfacfb092d3924c38/entities/FranchiseConfiguration
Query: franchise_evolution_instance_id = {{ instance.Name }}
Auth: api_key = c124b2fd70da4bc0b2aecf7db4e7918e
```
**Depois:**
```
Supabase SELECT franchise_configurations
WHERE franchise_id = {{ $json.instance.Name }}
Credencial: FranchiseFlow Supabase
```

### 2. `GET_USER1` (Supabase SELECT)
**Hoje:** `SELECT * FROM [cidade] WHERE telefone = {{ chat_id }}`
- Tabela dinâmica: `instance.Name.replace("franquia", "")`

**Depois:** `SELECT * FROM contacts WHERE franchise_id = {{ instance.Name }} AND telefone = {{ chat_id }}`
- Tabela fixa: `contacts`

### 3. `CREATE_USER1` (Supabase INSERT)
**Hoje:** `INSERT INTO [cidade] (telefone, nome)`
**Depois:** `INSERT INTO contacts (franchise_id, telefone, nome, status, source)`
- Adicionar: `franchise_id = instance.Name`, `status = 'novo_lead'`, `source = 'whatsapp'`

### 4. `Supabase` — update contact (Supabase UPDATE)
**Hoje:** `UPDATE [cidade] SET created_at = NOW() WHERE telefone = X`
**Depois:** `UPDATE contacts SET last_contact_at = NOW() WHERE franchise_id = X AND telefone = Y`

### 5. `AtualizaNome` (Supabase Tool UPDATE)
**Hoje:** `UPDATE [cidade] SET nome = $fromAI() WHERE telefone = X`
**Depois:** `UPDATE contacts SET nome = $fromAI(), updated_at = NOW() WHERE franchise_id = X AND telefone = Y`

### 6. `consulta_nome` (Supabase Tool SELECT)
**Hoje:** `SELECT * FROM [cidade] WHERE telefone = X`
**Depois:** `SELECT * FROM contacts WHERE franchise_id = X AND telefone = Y`

### 7. `deleta_lead1` (Supabase Tool DELETE)
**Hoje:** `DELETE FROM [cidade] WHERE telefone = X`
**Depois:** `DELETE FROM contacts WHERE franchise_id = X AND telefone = Y`

## Nova credencial necessária
- **Tipo**: Supabase
- **URL**: https://sulgicnqqopyhulglakd.supabase.co (FranchiseFlow)
- **Service Role Key**: (usar a existente do .env SUPABASE_SERVICE_ROLE_KEY)
- **Nome sugerido**: `franchiseflow_supabase`

## Estratégia de migração (dual-write)

### Fase A: Dual-write
1. Clonar workflow como "Vendedor Genérico v2"
2. Alterar os 7 nós para usar tabela `contacts` + nova credencial
3. MANTER os nós antigos em paralelo (Error Handling → se novo falhar, antigo funciona)
4. Testar com 1 franquia piloto (ex: franquiasaojoao)

### Fase B: Validação
1. Comparar dados: contatos no antigo vs novo
2. Verificar se pipeline view funciona no dashboard
3. Confirmar que vendas estão vinculando corretamente

### Fase C: Cutover
1. Remover nós antigos do workflow
2. Remover credencial `vendedor_bauru`
3. Pausar projeto clientes_franquias no Supabase

## Campos que o Agent IA usa do dadosunidade
O prompt do GerenteGeral1 (LangChain Agent) usa:
- `horarios_funcionamento` — para informar horários
- `metodos_pagamento` — para informar formas de pagamento
- `opcoes_entrega` — para informar se entrega/retirada
- `taxa_entrega` — para calcular frete
- `configuracoes_modo_preparo` — FAQ de preparo
- `limite_pedido` — pedido mínimo/máximo

Esses campos já existem em `franchise_configurations` no FranchiseFlow Supabase.
Alguns foram expandidos na FASE 5 (has_delivery, payment_methods array, delivery_fee_rules JSONB).
O prompt do Agent IA precisará ser ajustado para usar os novos nomes de campo.

## Fluxo completo após migração
```
WhatsApp msg → RabbitMQ → Webhook1
  → Normaliza1 (extrai instance.Name, chat_id, PushName, text)
  → dadosunidade (Supabase SELECT franchise_configurations)
  → GET_USER (SELECT contacts WHERE franchise_id + telefone)
  → IF exists?
    YES → UPDATE contacts SET last_contact_at
    NO  → INSERT contacts (franchise_id, telefone, nome, status='novo_lead')
  → Filtra tipo msg (texto/áudio/imagem/doc)
  → GerenteGeral1 (Agent IA Gemini + Tools)
  → Enviar resposta WhatsApp
```
