# Fixes V2 — Pré-teste com Rafael

## Fix 1: View `vw_dadosunidade` — JSONB sem cast

**Arquivo SQL**: `supabase/fix-vw-dadosunidade-jsonb.sql`

**Executar no Supabase Management API** (ou SQL Editor):
- Rodar o SQL inteiro do arquivo acima
- Isso recria a view com `social_media_links`, `payment_delivery`, `payment_pickup` e `delivery_fee_rules` retornando JSONB nativo em vez de TEXT

**Verificação**: Após executar, rodar:
```sql
SELECT social_media_links->'instagram' FROM vw_dadosunidade LIMIT 1;
```
Se retornar o valor (ou null), está OK. Se der erro de tipo, o fix não aplicou.

---

## Fix 2: Normalização de telefone — Nó `Code in JavaScript`

**Problema**: ZuckZapGo envia `chat_id` como `5518999999999` (13 dígitos com código país 55).
A tabela `contacts` salva como `18999999999` (11 dígitos, sem código país).
Se não normalizar, GET_USER1 não encontra → cria duplicata.

**Onde aplicar**: No nó `Code in JavaScript` (que já processa `_processado`), adicionar a normalização do `chatIdFinal`.

**Código para adicionar** no final do `Code in JavaScript`, ANTES do return:

```javascript
// === NORMALIZAÇÃO DE TELEFONE ===
// ZuckZapGo envia chat_id com código país 55 (ex: 5518999999999)
// Tabela contacts salva sem código país (ex: 18999999999)
let chatId = item.json._processado.chatIdFinal || '';
// Remove tudo que não é dígito
chatId = chatId.replace(/\D/g, '');
// Strip código país 55 se tem 13 dígitos (55 + DDD + 9 dígitos)
if (chatId.length === 13 && chatId.startsWith('55')) {
  chatId = chatId.substring(2);
}
// Strip código país 55 se tem 12 dígitos (55 + DDD + 8 dígitos, fixo)
if (chatId.length === 12 && chatId.startsWith('55')) {
  chatId = chatId.substring(2);
}
item.json._processado.chatIdFinal = chatId;
```

**IMPORTANTE**: O `Normaliza1` monta `message.chat_id` a partir de `$json._processado.chatIdFinal`. Então o fix no `Code in JavaScript` propaga automaticamente para todos os nós downstream (GET_USER1, CREATE_USER1, Supabase update, etc.).

**Verificação**: Testar com número real. O `chat_id` que chega no GET_USER1 deve ter 10-11 dígitos (sem o 55 na frente).

---

## Fix 3: Prompt do GerenteGeral1 — Pedido mínimo dinâmico

**Onde**: Nó `GerenteGeral1` → campo `systemMessage`

**Trocar** a regra 7 do prompt de:
```
7. Sem pedido minimo. Sem descontos alem das promocoes ativas. Sem amostra gratis.
```

**Para**:
```
7. {{ $('dadosunidade').item.json.min_order_value ? 'Pedido minimo: R$ ' + Number($('dadosunidade').item.json.min_order_value).toFixed(2).replace('.', ',') + '.' : 'Sem pedido minimo.' }} Sem descontos alem das promocoes ativas. Sem amostra gratis.
```

**Verificação**: Se a franquia do Rafael tem `min_order_value = null` ou `0`, o prompt mostrará "Sem pedido mínimo". Se tiver um valor, mostrará "Pedido mínimo: R$ XX,XX".

---

## Fix 4: CREATE_USER1 — Campo `source`

**Onde**: Nó `CREATE_USER1` → `fieldsUi.fieldValues`

**Verificar** que o campo `source` está configurado. Deve ter:

| Field | Value |
|-------|-------|
| `franchise_id` | `={{ $('dadosunidade').first().json.franchise_evolution_instance_id }}` |
| `telefone` | `={{ $('Normaliza1').item.json.message.chat_id }}` |
| `nome` | `={{ $('Webhook1')...PushName... }}` |
| `status` | `novo_lead` |
| `source` | `bot` |

**Se `source` estiver como `whatsapp`**, trocar para `bot` (regra 38 do CLAUDE.md — bot n8n deve setar `source='bot'`).

---

## Fix 5: Nó `dadosunidade` — Confirmar tabela

**Onde**: Nó `dadosunidade` → campo `tableId`

**Deve ser**: `vw_dadosunidade`

**NÃO deve ser**: `franchise_configurations` (que não tem os COALESCEs de fallback)

**Filter**: `instance_name` = `{{ $('Normaliza1').item.json.instance.Name }}`

---

## Fix 6: `planilha_estoque1` — Verificar fonte

Este nó usa `price_table_url` do dadosunidade para acessar uma **planilha Google Sheets** com estoque/preços. Confirmar:
1. Que a franquia do Rafael tem `price_table_url` preenchido
2. Que a planilha tem os 28 produtos com preços atualizados
3. Se migrou para ler de `inventory_items` do Supabase em vez de Sheets, o filtro DEVE incluir `franchise_id = evolution_instance_id`

---

## Verificações Pré-Teste

- [ ] SQL da view executado no Supabase
- [ ] Normalização de telefone adicionada no `Code in JavaScript`
- [ ] Prompt com pedido mínimo dinâmico
- [ ] CREATE_USER1 com `source = 'bot'`
- [ ] dadosunidade consultando `vw_dadosunidade`
- [ ] Workflow `memoria_lead` (xJocFaDvztxeBHvQ) ativo no n8n
- [ ] `catalog_image_url` preenchido na franquia do Rafael
- [ ] `price_table_url` preenchido na franquia do Rafael
- [ ] Credencial Supabase usa `service_role` key (não anon)
- [ ] Redis acessível do n8n de teste
