# Auditoria Completa: dadosunidade no Workflow V2

**Arquivo**: `docs/vendedor-generico-workflow-v2.json`
**Data**: 2026-03-23

---

## 1. Fonte de Dados

O node `dadosunidade` (tipo `n8n-nodes-base.supabase`) faz GET na view `vw_dadosunidade` filtrando por `instance_name` = nome da instancia ZuckZapGo.

```json
{
  "operation": "get",
  "tableId": "vw_dadosunidade",
  "filters": {
    "conditions": [
      {
        "keyName": "instance_name",
        "keyValue": "={{ $('Normaliza1').item.json.instance.Name }}"
      }
    ]
  }
}
```

---

## 2. Inventario de Campos (25 campos unicos, 52 referencias)

| # | Campo | Nodes que usam | Contexto |
|---|-------|----------------|----------|
| 1 | `accepted_payment_methods` | GerenteGeral1, Pedido_Checkout1 | systemMessage |
| 2 | `address_reference` | GerenteGeral1 | systemMessage (condicional) |
| 3 | `agent_name` | GerenteGeral1 | systemMessage |
| 4 | `avg_prep_time_minutes` | GerenteGeral1 | systemMessage (condicional) |
| 5 | `bot_personality` | GerenteGeral1 | systemMessage |
| 6 | `city` | GerenteGeral1 | systemMessage (condicional) |
| 7 | `franchise_evolution_instance_id` | EnviarCatalogo1, EnviaPedidoFechado1, Redis Chat Memory | jsonBody, workflowInputs, sessionKey |
| 8 | `franchise_name` | GerenteGeral1 | systemMessage |
| 9 | `has_delivery` | GerenteGeral1 | systemMessage (ternario) |
| 10 | `has_pickup` | GerenteGeral1 | systemMessage (ternario) |
| 11 | `max_delivery_radius_km` | GerenteGeral1 | systemMessage (condicional) |
| 12 | `min_order_value` | GerenteGeral1 | systemMessage (condicional) |
| 13 | `opening_hours` | GerenteGeral1 | systemMessage |
| 14 | `order_cutoff_time` | GerenteGeral1 | systemMessage (condicional) |
| 15 | `payment_link` | GerenteGeral1, Pedido_Checkout1 | systemMessage (condicional) |
| 16 | `personal_phone_for_summary` | EnviaPedidoFechado1, avisa_franqueado | workflowInputs, bodyParameters |
| 17 | `pix_holder_name` | GerenteGeral1 | systemMessage (condicional) |
| 18 | `pix_key_data` | GerenteGeral1, Pedido_Checkout1 | systemMessage (condicional) |
| 19 | `pix_key_type` | GerenteGeral1 | systemMessage (condicional) |
| 20 | `price_table_url` | planilha_estoque1 | expression (extrai spreadsheet ID) |
| 21 | `promotions_combo` | GerenteGeral1, Pedido_Checkout1, Estoque1 | systemMessage |
| 22 | `shipping_rules_costs` | GerenteGeral1, Pedido_Checkout1 | systemMessage (condicional) |
| 23 | `social_media_links` | GerenteGeral1 | systemMessage (condicional, checa != '{}') |
| 24 | `unit_address` | GerenteGeral1, GetDistance1 | systemMessage, workflowInputs |
| 25 | `working_days` | GerenteGeral1 | systemMessage |

---

## 3. Campos por Node

### GerenteGeral1 (21 campos)
`accepted_payment_methods`, `address_reference`, `agent_name`, `avg_prep_time_minutes`, `bot_personality`, `city`, `franchise_name`, `has_delivery`, `has_pickup`, `max_delivery_radius_km`, `min_order_value`, `opening_hours`, `order_cutoff_time`, `payment_link`, `pix_holder_name`, `pix_key_data`, `pix_key_type`, `promotions_combo`, `shipping_rules_costs`, `social_media_links`, `unit_address`, `working_days`

### Pedido_Checkout1 (5 campos)
`accepted_payment_methods`, `payment_link`, `pix_key_data`, `promotions_combo`, `shipping_rules_costs`

### Estoque1 (1 campo)
`promotions_combo`

### EnviarCatalogo1 (1 campo)
`franchise_evolution_instance_id`

### EnviaPedidoFechado1 (2 campos)
`franchise_evolution_instance_id`, `personal_phone_for_summary`

### avisa_franqueado (1 campo)
`personal_phone_for_summary`

### GetDistance1 (1 campo)
`unit_address`

### planilha_estoque1 (1 campo)
`price_table_url`

### Redis Chat Memory (1 campo)
`franchise_evolution_instance_id`

---

## 4. systemMessages Completos

### GerenteGeral1 (@n8n/n8n-nodes-langchain.agent)

**TEXT**: `={{ $('Edit Fields3').item.json.messages }}`

**SYSTEM MESSAGE**:
```
=Hoje: {{ new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) }}
Voce: *{{ $('dadosunidade').item.json.agent_name }}* | Maxi Massas *{{ $('dadosunidade').item.json.franchise_name }}*

UNIDADE: {{ $('dadosunidade').item.json.unit_address }}{{ $('dadosunidade').item.json.address_reference ? ' (Ref: ' + $('dadosunidade').item.json.address_reference + ')' : '' }}{{ $('dadosunidade').item.json.city ? ', ' + $('dadosunidade').item.json.city : '' }}
HORARIO: {{ $('dadosunidade').item.json.working_days }} {{ $('dadosunidade').item.json.opening_hours }}{{ $('dadosunidade').item.json.order_cutoff_time ? ' | Corte: ' + $('dadosunidade').item.json.order_cutoff_time : '' }}
PAGAMENTO: {{ $('dadosunidade').item.json.accepted_payment_methods || 'nao configurado' }}{{ $('dadosunidade').item.json.pix_key_data ? ' | PIX ' + $('dadosunidade').item.json.pix_key_type + ': ' + $('dadosunidade').item.json.pix_key_data + ($('dadosunidade').item.json.pix_holder_name ? ' (' + $('dadosunidade').item.json.pix_holder_name + ')' : '') : '' }}{{ $('dadosunidade').item.json.payment_link ? ' | Link: ' + $('dadosunidade').item.json.payment_link : '' }}
ENTREGA: {{ $('dadosunidade').item.json.has_delivery ? 'Sim' : 'Nao' }} | Retirada: {{ $('dadosunidade').item.json.has_pickup ? 'Sim' : 'Nao' }}{{ $('dadosunidade').item.json.shipping_rules_costs ? ' | Frete: ' + $('dadosunidade').item.json.shipping_rules_costs : '' }}{{ $('dadosunidade').item.json.max_delivery_radius_km ? ' | Raio: ' + $('dadosunidade').item.json.max_delivery_radius_km + 'km' : '' }}{{ $('dadosunidade').item.json.min_order_value ? ' | Min: R$' + $('dadosunidade').item.json.min_order_value : '' }}{{ $('dadosunidade').item.json.avg_prep_time_minutes ? ' | Preparo: ~' + $('dadosunidade').item.json.avg_prep_time_minutes + 'min' : '' }}
{{ $('dadosunidade').item.json.promotions_combo ? 'PROMOS: ' + $('dadosunidade').item.json.promotions_combo : '' }}
{{ $('dadosunidade').item.json.social_media_links && $('dadosunidade').item.json.social_media_links !== '{}' ? 'REDES: ' + $('dadosunidade').item.json.social_media_links : '' }}

REGRAS:
1. Tom {{ $('dadosunidade').item.json.bot_personality === 'friendly' ? 'amigavel' : $('dadosunidade').item.json.bot_personality === 'formal' ? 'formal' : 'profissional' }}. Cordial e objetivo.
2. SEMPRE consulte estoque antes de confirmar disponibilidade. Nunca invente.
3. Se nao souber, escale para franqueado.
4. Endereco do cliente: salve via ferramenta. Se ja tem, use sem perguntar.
5. Fora do horario: informe e ofereça agendamento.
6. Confirme pedido completo antes de finalizar: itens, qtd, pagamento, endereco.
7. Acima do raio maximo: so retirada.
8. Abaixo do pedido minimo: sugira mais itens.
```

---

### Pedido_Checkout1 (@n8n/n8n-nodes-langchain.agentTool)

**TEXT**: `={{ $fromAI('Prompt__User_Message_', 'Faca sua requisicao. Mande os dados que tem para fechamento e calculo do pedido.', 'string') }}`

**SYSTEM MESSAGE**:
```
=Voce e o **Finalizador de Pedidos** da Maxi Massas.
Fecha pedidos e dispara checkout.

## Dados da Unidade

Pagamento: {{ $('dadosunidade').item.json.accepted_payment_methods }}
Chave Pix: {{ $('dadosunidade').item.json.pix_key_data }}
{{ $('dadosunidade').item.json.payment_link ? 'Link pagamento: ' + $('dadosunidade').item.json.payment_link : '' }}
Frete: {{ $('dadosunidade').item.json.shipping_rules_costs }}
Promocoes: {{ $('dadosunidade').item.json.promotions_combo || 'Nenhuma.' }}

## Pre-requisitos OBRIGATORIOS para fechar

- Nome do cliente
- Itens (produto, quantidade, preco unitario)
- Tipo: entrega ou retirada
- Endereco completo (se entrega)
- Forma de pagamento (valide contra os metodos aceitos acima)
- Taxa de entrega calculada (se aplicavel, conforme tabela de frete acima)

## Calculo do Total

1. Some: (preco unitario x quantidade) para cada item
2. Aplique desconto de promocao se houver e se aplicavel
3. Some taxa de entrega (se entrega)
4. Use a Calculadora para confirmar o valor

## Ferramentas

- **Calculadora**: calcule o total final
- **EnviaPedidoFechado1**: dispara o checkout apos tudo confirmado
- **avisa_franqueado**: notifica o franqueado

## Regras

- Faltou item critico (nome, itens, pagamento) = NAO enviar checkout. Informe o que falta.
- Pagamento invalido = informe os metodos aceitos.
- Pix = informe a chave Pix ao Gerente.
- Nunca enviar o mesmo checkout duas vezes.
- Nao use emojis.

## Retorno ao Gerente

Resumo: itens, subtotal, desconto, taxa entrega, **total final**, status.
```

---

### Estoque1 (@n8n/n8n-nodes-langchain.agentTool)

**TEXT**: `={{ $fromAI('Prompt__User_Message_', 'Informe o nome EXATO do produto que o cliente pediu...', 'string') }}`

**SYSTEM MESSAGE**:
```
=Voce e o **Consultor de Estoque** interno da Maxi Massas.
Consulte planilha_estoque1 e retorne dados precisos para o Gerente Geral.

---

## Regras de Consulta

1. **Sempre retorne:**
   - Nome EXATO do produto (como esta na planilha)
   - Preco (formato R$ 0,00)
   - Quantidade em estoque
   - Peso/porcoes (se disponivel)

2. **Classificacao:**
   - Disponivel: estoque > 3
   - Ultimas unidades: estoque 1-3 (DESTACAR para o Gerente usar como argumento de venda)
   - Indisponivel: estoque = 0

3. **Promocoes ativas:**
{{ $('dadosunidade').item.json.promotions_combo ? $('dadosunidade').item.json.promotions_combo : 'Nenhuma promocao ativa.' }}

---

## Busca Inteligente

1. **Busca exata:** nome exato do produto.
2. **Busca por palavra-chave:** se nao encontrar, busque produtos que CONTENHAM qualquer palavra do pedido.
   - Ex: 'nhoque de mussarela' -> buscar 'nhoque' E/OU 'mussarela'
   - Se encontrar, retorne diretamente sem declarar 'nao encontrado'.
3. **Nao encontrado:** SOMENTE se nenhuma palavra corresponder.

---

## Formato de Resposta

**[Categoria]**
- [Nome] | R$ [Preco] | [Peso/Porcoes] | [Qtd] un. | [Status]

Se produto tem estoque 1-3, adicione: "(ULTIMAS UNIDADES)"

---

## Sugestao de Cross-sell

Apos retornar o produto solicitado, sugira ATE 2 complementos da mesma planilha:
- Produtos de categoria diferente que combinam (ex: massa + molho)
- Formato: "Sugestao: clientes que levam [X] costumam combinar com [Y] (R$ [preco])"
- So sugira produtos DISPONIVEIS (estoque > 0)

---

## Produto Nao Encontrado

1. "PRODUTO NAO ENCONTRADO: [nome] nao existe no catalogo."
2. Liste ate 3 disponiveis da mesma categoria/tipo.
3. Se nao identificar categoria, liste categorias disponiveis.

---

## Proibicoes

- NAO invente produtos ou precos
- NAO use emojis
- NAO faca analise de vendas
- NAO crie nomes que nao existam na planilha
```

---

### Memoria_Lead1 (@n8n/n8n-nodes-langchain.agentTool)

**TEXT**: `={{ $fromAI('Prompt__User_Message_', 'Faca sua requisicao de forma direta e clara.', 'string') }}`

**TOOL DESCRIPTION**: Registra dados do cliente no CRM para personalizar atendimentos futuros. Acione quando: 1) Cliente informa nome, 2) Cliente informa endereco ou referencia, 3) Cliente cita preferencia alimentar (ex: 'gosto de molho branco', 'nao como carne'), 4) Pedido confirmado com itens e valor, 5) Cliente menciona restricao ou alergia, 6) Qualquer info util para vendas futuras. Agrupe dados relacionados em uma unica chamada. NAO espere o pedido fechar -- registre DURANTE a conversa.

**SYSTEM MESSAGE**:
```
=Voce e o **Arquivista de CRM** da Maxi Massas.
Extraia e salve dados da conversa para atendimentos futuros.

## Como Enviar para memoriaLead

Envie os dados de forma CLARA e DIRETA, usando este formato:

CLIENTE: [nome]
ENDERECO: [endereco completo]
RESTRICOES: [restricoes alimentares]
PREFERENCIAS: [sabores, observacoes]
PEDIDO: [itens] | [pagamento] | [valor]
OBS: [qualquer info util]

Envie APENAS os campos que tem informacao nova. Nao repita o que ja foi salvo.

## Gatilhos de Acao

1. **memoriaLead**: QUALQUER dado relevante do cliente (principal ferramenta)
   - Nome, endereco, preferencia, restricao, pedido confirmado
   - NAO espere acumular tudo -- registre assim que o cliente informar
   - Agrupe dados relacionados em UMA chamada (ex: endereco + referencia juntos)
2. **AtualizaNome**: APENAS se o nome no cadastro esta errado
3. **consulta_nome**: verificar nome cadastrado
4. **deleta_lead1**: SOMENTE se cliente pedir explicitamente para ser removido

## Retorno ao Gerente

Nota curta do que foi registrado. Nao use emojis.
```

**Nota**: Memoria_Lead1 NAO referencia dadosunidade diretamente. Usa sub-workflows (memoriaLead, AtualizaNome, consulta_nome, deleta_lead1) que podem ter suas proprias referencias.

---

### EnviarCatalogo1 (n8n-nodes-base.httpRequestTool)

**URL**: `={{ $('Normaliza1').item.json.instance.Server_url }}/chat/send/image`
**METHOD**: POST

**JSON BODY**:
```json
={
  "Phone": "{{ $('Switch').item.json.telefone }}",
  "mimetype": "image/jpeg",
  "fileName": "{{ String($('dadosunidade').item.json.franchise_evolution_instance_id).replace(/franquia/g, '').trim() }}.jpg",
  "Caption": "Catalogo de produtos e precos da Maxi Massas.",
  "Image": "http://catalogo.dynamicagents.tech:8080/catalogos/{{ String($('dadosunidade').item.json.franchise_evolution_instance_id).replace(/franquia/g, '').trim() }}.jpg"
}
```

**Campos dadosunidade**: `franchise_evolution_instance_id` (strip "franquia", usado como nome do arquivo e URL do catalogo)

---

### EnviaPedidoFechado1 (@n8n/n8n-nodes-langchain.toolWorkflow)

**DESCRIPTION**: Usa esta ferramenta quando o lead fechou pedido.
**SUB-WORKFLOW**: `ORNRLkFLnMcIQ9Ke` (EnviaPedidoFechado)

**workflowInputs**:
```
memoria       = {{ $('Normaliza1').item.json.message.chat_id }}_mem
api           = {{ $('Normaliza1').item.json.instance.Apikey }}
instance      = {{ $('Normaliza1').item.json.instance.Name }}
server_url    = {{ $('Normaliza1').item.json.instance.Server_url }}
telefone_franqueado = {{ $('dadosunidade').item.json.personal_phone_for_summary }}
telefonelead  = {{ $('Normaliza1').item.json.message.chat_id }}
nometabela    = {{ String($('dadosunidade').item.json.franchise_evolution_instance_id).replace(/franquia/g, '').trim() }}
nomecliente   = {{ $('Webhook1').item.json.data.event.Info.PushName }}
```

**Campos dadosunidade**: `personal_phone_for_summary`, `franchise_evolution_instance_id`

---

### avisa_franqueado (n8n-nodes-base.httpRequestTool)

**TOOL DESCRIPTION**: Escala a conversa para o franqueado humano enviando um resumo por WhatsApp. Use quando: cliente reclama, esta insatisfeito, tem problema de entrega, pede para falar com humano, ou a situacao esta fora do seu conhecimento.

**URL**: `={{ $('Normaliza1').item.json.instance.Server_url }}/chat/send/text`
**METHOD**: POST

**Headers**:
- `token`: `={{ $('Normaliza1').item.json.instance.Apikey }}`
- `Content-Type`: `application/json`

**Body Parameters**:
- `phone`: `={{ $('dadosunidade').item.json.personal_phone_for_summary }}`
- `Body`: `={{ $fromAI('parameters1_Value', 'Resumo da requisicao do cliente/problema', 'string') }} wa.me/{{ $('Edit Fields3').item.json.telefone }}`

**Campos dadosunidade**: `personal_phone_for_summary`

---

### GetDistance1 (@n8n/n8n-nodes-langchain.toolWorkflow)

**DESCRIPTION**: Chame essa ferramenta para calculo de distancia da entrega.
**SUB-WORKFLOW**: `q4ACGWuR3WFQjBfg` (DistanceService)

**workflowInputs**:
```
origin      = {{ $('dadosunidade').item.json.unit_address }}
destination = {{ $fromAI('destination', 'Endereco do lead para entrega do pedido...', 'string') }}
mode        = straight
```

**Campos dadosunidade**: `unit_address`

---

### planilha_estoque1 (n8n-nodes-base.googleSheetsTool)

**Google Sheets**: extrai spreadsheet ID de `price_table_url`
```
documentId = {{ $('dadosunidade').item.json.price_table_url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)[1] }}
sheetName  = PEDIDO
```

**Campos dadosunidade**: `price_table_url`

---

### Redis Chat Memory (@n8n/n8n-nodes-langchain.memoryRedisChat)

**SESSION KEY**: `={{ $('Normaliza1').item.json.message.chat_id }}_mem{{ $('dadosunidade').item.json.franchise_evolution_instance_id }}`

**Campos dadosunidade**: `franchise_evolution_instance_id`

---

## 5. Campos LEGADOS (V2 usa campos texto antigos)

Os seguintes campos no V2 ainda usam formato TEXT antigo, incompativel com os novos campos estruturados do wizard:

| Campo V2 (texto) | Campo wizard (estruturado) | Tipo wizard |
|---|---|---|
| `accepted_payment_methods` | `payment_delivery[]` + `payment_pickup[]` | TEXT[] |
| `shipping_rules_costs` | `delivery_fee_rules` | JSONB |
| `opening_hours` | `operating_hours` | JSONB |
| `working_days` | (derivado de `operating_hours`) | JSONB |

**IMPORTANTE**: A view `vw_dadosunidade` DEVE mapear os campos estruturados do wizard para os nomes antigos esperados pelo workflow, OU o workflow deve ser atualizado para consumir JSONB nativo.

---

## 6. Campos NAO referenciados no V2 (existem na view mas nao sao usados)

Verificar se estes campos da `vw_dadosunidade` realmente nao sao necessarios:
- `instance_name` (usado apenas como filtro, nao no prompt)
- `welcome_message` (removido do wizard)
- `bot_personality` default mantido no banco, UI removida
- Campos novos do wizard que podem nao estar na view ainda

---

## 7. Nodes que NAO referenciam dadosunidade

Estes nodes criticos nao usam dadosunidade diretamente:
- **Memoria_Lead1**: agentTool sem refs (delega para sub-workflows)
- **Consulte_Estoque1**: nao existe no V2 (o node se chama `Estoque1`)
