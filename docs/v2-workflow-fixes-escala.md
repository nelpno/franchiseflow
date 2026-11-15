# Fixes V2 Workflow — Preparação para Escala

> Todas as mudanças necessárias para migrar TODAS as franquias do V1 (Google Sheets + Base44) para V2 (Supabase).

## Pré-requisito: Aplicar SQL da view

Executar `supabase/fix-vw-dadosunidade-v2-scale.sql` no Supabase Management API.

Isso resolve (já aplicado no banco):
- `accepted_payment_methods` gerado automaticamente de `payment_delivery` + `payment_pickup` TEXT[]
- `shipping_rules_costs` gerado automaticamente de `delivery_fee_rules` JSONB
- `payment_delivery`/`payment_pickup` com tipo TEXT[] correto (era jsonb errado)
- Novo campo `personal_phone_wa` (com 55) para ZuckZapGo API

---

## FIX 1: Telefone com 55 — EnviaPedidoFechado1

**Nó**: `EnviaPedidoFechado1` (Execute Workflow tool)

**Problema**: `telefonelead` e `telefone_franqueado` chegam sem código de país (11 dígitos). Sub-workflow precisa do 55 para enviar via ZuckZapGo.

**Mudanças nos Workflow Inputs**:

| Campo | ANTES | DEPOIS |
|---|---|---|
| `telefonelead` | `{{ $('Normaliza1').item.json.message.chat_id }}` | `{{ '55' + $('Normaliza1').item.json.message.chat_id }}` |
| `telefone_franqueado` | `{{ $('dadosunidade').item.json.personal_phone_for_summary }}` | `{{ $('dadosunidade').item.json.personal_phone_wa }}` |

> **Nota**: `personal_phone_wa` é o novo campo computed da view que já inclui 55 de forma segura (detecta se já tem 55 para não duplicar).

---

## FIX 2: Telefone com 55 — avisa_franqueado

**Nó**: `avisa_franqueado` (HTTP Request tool)

**Problema**: Envia WhatsApp direto para o franqueado via `/chat/send/text`, mas phone sem 55.

**Mudança no Body Parameter `phone`**:

| ANTES | DEPOIS |
|---|---|
| `{{ $('dadosunidade').item.json.personal_phone_for_summary }}` | `{{ $('dadosunidade').item.json.personal_phone_wa }}` |

---

## FIX 3: Telefone com 55 — Enviar Mensagem WhatsApp Lead7

**Nó**: `Enviar Mensagem WhatsApp Lead7` (HTTP Request)

**Problema**: Envia resposta ao lead via ZuckZapGo, phone sem 55.

**Mudança no Body Parameter `phone`**:

| ANTES | DEPOIS |
|---|---|
| `{{ $('Edit Fields3').item.json.telefone }}` | `{{ '55' + $('Edit Fields3').item.json.telefone }}` |

> **Alternativa mais limpa (para quando fizer refactor geral)**: Adicionar campo `telefone_wa` no `Edit Fields3` = `{{ '55' + $json.telefone }}` e usar em todos os nós de envio.

---

## FIX 4: planilha_estoque1 — Migrar de Google Sheets para Supabase

**Nó**: `planilha_estoque1` (Google Sheets tool → Supabase tool)

**Problema**: Ainda usa Google Sheets OAuth. Precisa consultar `inventory_items` no Supabase.

**Como reconfigurar**:

1. **Deletar** o nó `planilha_estoque1` atual (Google Sheets)
2. **Criar** novo nó `planilha_estoque1` do tipo **Supabase Tool**
3. Configurar:

```
Tipo: Supabase Tool
Credencial: franchiseflow_supabase (ID: mIVPcJBNcDCx21LR)
Operação: Get Many
Tabela (tableId): inventory_items
Filtros:
  - franchise_id = {{ $('Normaliza1').item.json.instance.Name }}
```

**O que muda para o prompt do Consulte_Estoque1**:

Os campos retornados do Supabase são DIFERENTES do Google Sheets:

| Google Sheets (antigo) | Supabase inventory_items (novo) |
|---|---|
| Nome do produto | `name` |
| Preço | `sale_price` |
| Estoque | `current_stock` |
| Categoria | `category` |
| Unidade | `unit` |
| Preço de custo | `cost_price` |
| Estoque mínimo | `min_stock` |

O prompt do **Consulte_Estoque1** (Estoque1) pode precisar de ajuste mínimo se referencia nomes de colunas do Google Sheets. Mas como o prompt diz "Consulte planilha_estoque1 e retorne dados precisos", e o Supabase retorna JSON com nomes claros, o LLM deve adaptar automaticamente.

**Atenção**: O Supabase retorna `sale_price` (preço de venda ao cliente) — usar este campo como "Preço" no retorno ao cliente. `cost_price` é preço de custo da fábrica e NÃO deve ser revelado.

---

## FIX 5: shipping_rules_costs — Verificação

**Nada a mudar no n8n.** A view `vw_dadosunidade` agora gera `shipping_rules_costs` automaticamente de `delivery_fee_rules` JSONB.

Formato gerado: `"Até 5km: R$10,00 | Até 10km: R$18,00"`

Os prompts do **GerenteGeral1** e **Pedido_Checkout1** que lêem `shipping_rules_costs` receberão o texto correto automaticamente.

---

## Migração RabbitMQ (futuro)

Quando migrar do Webhook HTTP para RabbitMQ trigger:

### Referências a mudar:
1. `$('Webhook1')` → `$('RabbitMQ Trigger')` (ou nome do nó)
2. Path dos dados: `$json.body.data.event` → `$json.data.event` (sem wrapper `.body.`)
3. **23+ referências** afetadas no workflow (mapeado na sessão anterior)

### Campos que NÃO mudam:
- `$('Normaliza1').*` — mesma saída
- `$('dadosunidade').*` — mesma view
- `$('Edit Fields3').*` — mesma saída

### Checklist RabbitMQ:
- [ ] Substituir Webhook1 por RabbitMQ Trigger
- [ ] Remover wrapper `.body.` de 23+ referências
- [ ] Atualizar `nomecliente` em EnviaPedidoFechado1: `$json.data.event.Info.PushName` (sem `.body.`)
- [ ] Testar com fila dedicada antes de desativar V1
- [ ] Manter V1 ativo em paralelo durante migração gradual
- [ ] blockedNumbers deve estar sincronizado entre V1 e V2

---

## Ordem de Execução

1. ✅ Aplicar SQL da view (`fix-vw-dadosunidade-v2-scale.sql`)
2. ✅ Fix telefones (EnviaPedidoFechado1, avisa_franqueado, WhatsApp Lead7)
3. ✅ Migrar planilha_estoque1 para Supabase
4. ✅ Testar pedido completo end-to-end
5. ✅ Migrar franquias uma a uma (webhook por instance)
6. 🔜 Migrar para RabbitMQ quando todas estiverem no V2
