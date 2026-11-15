# Spec: FASE 5 — Refatoração Arquitetural + Vendedor Genérico

**Data:** 2026-03-21
**Status:** Em elaboração
**Princípio:** Menos é mais — simplificar fluxos, eliminar redundâncias, facilitar para o franqueado leigo

---

## 1. Visão Geral

Refatorar o FranchiseFlow para:
- Padronizar FKs (UUID em vez de evolution_instance_id)
- Unificar Franqueados + Usuários em uma página só
- Reescrever "Meu Vendedor" como wizard guiado
- Estruturar campos de pagamento/entrega para o vendedor genérico
- Eliminar dependência de Google Sheets (usar inventory_items direto)

---

## 2. Simplificação de Navegação (Admin)

### Antes: 12 itens
Painel Geral, Vendas, Estoque, Catálogo, Marketing, Checklist, Relatórios, Configurações, Onboarding, Acompanhamento, Franqueados, Usuários

### Depois: 9 itens
Painel Geral, Vendas, Estoque, Catálogo, Marketing, Checklist, Relatórios, **Franqueados** (unificado), Onboarding

- **Franqueados** absorve: criar franquia + convidar email + ver configs + editar vendedor
- **Usuários** removido (permissões gerenciadas dentro de Franqueados)
- **Acompanhamento** pode ser aba dentro de Painel Geral ou Relatórios
- **Configurações** (Meu Vendedor) continua para franqueado, mas admin acessa via Franqueados

---

## 3. Campos de Pagamento e Entrega (Novos)

### Problema atual:
- `accepted_payment_methods` é TEXT livre: "Entregas: Pix, Link de Cartão | Retirada: Pix, Dinheiro"
- `shipping_rules_costs` é TEXT livre: sem estrutura
- Não distingue delivery vs pickup
- Não sabe se entrega é motoboy próprio ou Uber/Flash (que não leva máquina)

### Cenários reais das franquias:
| Cenário | Entrega | Retirada | Pag. entrega | Pag. retirada |
|---------|---------|----------|-------------|---------------|
| Loja + motoboy próprio | Sim | Sim | Máquina, PIX, dinheiro | Máquina, PIX, dinheiro |
| Loja + Uber/Flash | Sim | Sim | Só PIX/link | Máquina, PIX, dinheiro |
| Delivery only | Sim | Não | Só PIX/link | N/A |
| Loja sem entrega | Não | Sim | N/A | Máquina, PIX, dinheiro |

### Novos campos em `franchise_configurations`:
```sql
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS has_delivery BOOLEAN DEFAULT true;
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS has_pickup BOOLEAN DEFAULT true;
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'own_fleet' CHECK (delivery_method IN ('own_fleet', 'third_party', 'both'));
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS payment_delivery TEXT[] DEFAULT '{}';
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS payment_pickup TEXT[] DEFAULT '{}';
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS delivery_fee_rules JSONB DEFAULT '[]';
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS pix_key_type TEXT DEFAULT 'cpf' CHECK (pix_key_type IN ('cpf', 'phone', 'email', 'random'));
ALTER TABLE franchise_configurations ADD COLUMN IF NOT EXISTS order_cutoff_time TEXT;
```

### Campos existentes que continuam:
- `max_delivery_radius_km` — raio máximo
- `min_order_value` — pedido mínimo
- `avg_prep_time_minutes` — tempo preparo
- `pix_key_data` — chave PIX
- `payment_link` — link pagamento

### Campo deprecated:
- `accepted_payment_methods` (TEXT) → substituído por `payment_delivery` + `payment_pickup` (TEXT[])
- `shipping_rules_costs` (TEXT) → substituído por `delivery_fee_rules` (JSONB)

---

## 4. Wizard "Meu Vendedor" (Redesign)

### Filosofia:
- Franqueado leigo (Dona Maria, 55+) precisa preencher sem pensar
- Cada passo mostra APENAS o que é relevante (conditional rendering)
- Tooltips com linguagem simples explicando o que o vendedor faz com cada campo

### Passos:
1. **Sua Unidade** — nome, endereço, telefone, referência (obrigatórios)
2. **Horários** — dias (chips toggle), horário abertura/fechamento
3. **Como Opera** — toggles: faz entrega? aceita retirada? → condiciona passos seguintes
4. **Pagamento Entrega** — chips: PIX, Link (se Uber/Flash: máquina/dinheiro desabilitados com tooltip)
5. **Pagamento Retirada** — chips: PIX, Máquina, Dinheiro, Link
6. **Entrega** — raio, faixas de frete (adicionar/remover), pedido mínimo, horário limite
7. **Seu Vendedor** — nome do bot, tom de voz, boas-vindas, promoções
8. **Revisão** — resumo de tudo antes de salvar

### Regras de negócio no wizard:
- Se `delivery_method = "third_party"` (Uber/Flash): NÃO permitir `card_machine` nem `cash` em `payment_delivery`
- Se `has_delivery = false`: pular passos 4 e 6
- Se `has_pickup = false`: pular passo 5
- Validar que pelo menos 1 forma de pagamento está selecionada

---

## 5. Template de Prompt para Vendedor n8n

O vendedor genérico lê `franchise_configurations` e monta o prompt. Com os novos campos estruturados:

```
## Modalidades de atendimento

{{#if has_delivery}}
ENTREGA: Disponível
- Método: {{delivery_method_label}} (próprio / terceirizado / ambos)
- Raio máximo: {{max_delivery_radius_km}}km
- Pedido mínimo: R$ {{min_order_value}}
- Tempo de preparo: ~{{avg_prep_time_minutes}} minutos
{{#if order_cutoff_time}}- Horário limite: {{order_cutoff_time}}{{/if}}
- Taxas:
{{#each delivery_fee_rules}}
  • Até {{max_km}}km: R$ {{fee}}
{{/each}}
- Pagamento na ENTREGA: {{payment_delivery_joined}}
{{#if delivery_method == "third_party"}}
  ⚠️ IMPORTANTE: Entrega por motoboy terceirizado — NÃO aceitamos cartão/dinheiro na entrega. Pagamento ANTES do envio via PIX ou link.
{{/if}}
{{else}}
ENTREGA: Não disponível
{{/if}}

{{#if has_pickup}}
RETIRADA NO LOCAL: Disponível
- Endereço: {{unit_address}} ({{address_reference}})
- Pagamento na RETIRADA: {{payment_pickup_joined}}
{{else}}
RETIRADA: Não disponível
{{/if}}
```

---

## 6. Padronização de FKs (P0 — Mais arriscado)

### Estado atual:
- 13 tabelas usam `evolution_instance_id` (TEXT) como FK
- `profiles.managed_franchise_ids` armazena UUIDs
- 28 RLS policies dependem da função `managed_franchise_ids()`

### Decisão: NÃO migrar FKs agora
O risco é alto (28 policies, 13 tabelas, triggers, n8n). Em vez disso:
1. Padronizar `managed_franchise_ids` para conter UUIDs (já é assim)
2. No código frontend, SEMPRE fazer dual check: `f.id || f.evolution_instance_id`
3. Criar helper `getFranchiseFilter()` que encapsula essa lógica
4. Na FASE 6 futura, migrar FKs com script controlado

---

## 7. Tabelas para DROP

| Tabela | Dados | Uso | Ação |
|--------|-------|-----|------|
| `franchise_orders` | 0 | Zero imports | DROP |
| `messages` | 0 | Zero imports | DROP |
| `activity_log` | 0 | Zero imports, sem FK | DROP |
| `catalog_distributions` | ? | Pouco uso | Avaliar |

---

## 8. Prioridades de Implementação

| Ordem | O quê | Risco | Esforço |
|-------|-------|-------|---------|
| 1 | SQL: adicionar novos campos | Baixo | 30min |
| 2 | Wizard "Meu Vendedor" | Médio | 4h |
| 3 | Unificar Franqueados + Usuários | Médio | 3h |
| 4 | Template de prompt n8n | Baixo | 1h |
| 5 | Helper `getFranchiseFilter()` | Baixo | 30min |
| 6 | DROP tabelas órfãs | Baixo | 15min |
| 7 | Deploy Docker | Baixo | 30min |
