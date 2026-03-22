# FASE 5 Etapa 2 — Vendedor Genérico n8n (Base44→Supabase)

## Objetivo
Migrar os 7 nós de leitura/escrita do workflow vendedor genérico de Base44 para Supabase (FranchiseFlow), mantendo funcionalidade do bot de vendas WhatsApp.

## Workflow
- **ID:** PALRV1RqD3opHMzk (teste.dynamicagents.tech)
- **Total:** 91 nós, 7 afetados pela migração

## Nós a Migrar

| Nó | Tipo | Hoje (Base44) | Depois (Supabase) |
|---|---|---|---|
| `dadosunidade` | Config | HTTP GET Base44 | SELECT franchise_configurations WHERE franchise_id=X |
| `GET_USER1` | Leitura | SELECT [cidade] WHERE telefone=X | SELECT contacts WHERE franchise_id=X AND telefone=Y |
| `CREATE_USER1` | Inserção | INSERT [cidade] (telefone, nome) | INSERT contacts (franchise_id, telefone, nome, status, source) |
| `Supabase (update)` | Atualiz. | UPDATE [cidade] SET created_at | UPDATE contacts SET last_contact_at, updated_at |
| `AtualizaNome` | Atualiz. | UPDATE [cidade] SET nome | UPDATE contacts SET nome WHERE id=X |
| `consulta_nome` | Leitura | SELECT [cidade] | SELECT contacts |
| `deleta_lead1` | Delete | DELETE [cidade] | DELETE contacts |

## Mapeamento de Campos (franchise_configurations)

### Campos que mudaram de nome
| Base44 (dadosunidade) | Supabase (franchise_configurations) | Tipo |
|---|---|---|
| `horarios_funcionamento` | `opening_hours` | text |
| `metodos_pagamento` | `accepted_payment_methods` | text[] (ARRAY) |
| `taxa_entrega` | `delivery_fee_rules` | jsonb |
| `nome_unidade` | `franchise_name` | text |
| `endereco` | `unit_address` | text |
| `telefone` | `unit_phone` | text |

### Solução: View SQL de compatibilidade
Criar view `vw_dadosunidade` que mapeia campos novos para nomes antigos, evitando alterar o prompt do Agent IA.

## Fases de Execução

### Fase A: Preparação
- A1: Criar credencial Supabase no n8n (Service Role Key)
- A2: Clonar workflow como "v2 - Supabase" (PAUSED)
- A3: Criar view `vw_dadosunidade` no Supabase

### Fase B: Migração dos 7 Nós
- Substituir cada nó Base44 por equivalente Supabase
- Testar cada nó isoladamente

### Fase C: Adaptações
- C1: GetDistance com cache de endereço do contato
- C2: Validar compatibilidade JSON com Agent IA
- C3: Opcional — RPC consolidada para performance

### Fase D: Testes
- T1: Unitário (cada nó)
- T2: Integração (fluxo completo em franquiasaojoao)
- T3: Agent IA (respostas corretas)

### Fase E: Cutover
1. Ativar v2 em paralelo (dual-write 24h)
2. Migrar franquias gradualmente
3. Desativar v1 após 7 dias estável

## Riscos
| Risco | Severidade | Mitigação |
|---|---|---|
| Campos com nomes diferentes quebram Agent IA | 🔴 ALTO | View de compatibilidade |
| Agent IA quebra se campos NULL | 🔴 ALTO | COALESCE na view |
| Arrays vs strings | 🟡 MÉDIO | array_to_string() na view |

## Dependências Completas
✅ Tabela contacts + RLS + índices (Etapa 1)
✅ Trigger on_sale_created
✅ Entity Contact em all.js
