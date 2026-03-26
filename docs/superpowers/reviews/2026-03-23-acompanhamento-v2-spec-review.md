# Review: Spec Acompanhamento v2 - Saude das Franquias

**Revisor**: Claude Code (Senior Reviewer)
**Data**: 2026-03-23
**Spec revisada**: `docs/superpowers/specs/2026-03-23-acompanhamento-v2-saude-franquias.md`

---

## Resumo

Spec bem estruturada com escopo claro. Identifiquei 3 problemas criticos, 4 importantes e 3 sugestoes.

---

## CRITICOS (deve corrigir antes de implementar)

### C1. franchise_id misto: UUID vs evolution_instance_id

A spec ignora que `franchise_id` em diferentes tabelas usa tipos diferentes:
- `sales.franchise_id` e `purchase_orders.franchise_id` = **UUID** da franquia
- `inventory_items.franchise_id` e `daily_checklists.franchise_id` = **evolution_instance_id** (texto)
- `onboarding_checklists.franchise_id` = evolution_instance_id (texto)
- `contacts.franchise_id` = evolution_instance_id (texto)

O calculo do score agrupa dados "por franchise_id", mas precisa de um mapa UUID <-> evolution_instance_id para cada franquia. Sem isso, vendas (UUID) e estoque (evoId) nunca se juntam.

**Fix**: Adicionar secao explicita na spec: "Para cada franquia, resolver `franchise.id` (UUID) e `franchise.evolution_instance_id` (texto). Usar UUID para filtrar sales/purchase_orders e evoId para inventory_items/daily_checklists/onboarding_checklists." Documentar a funcao de mapeamento como requisito.

### C2. Setup dimension: `total_items` NAO existe na tabela real

A spec diz: `onboarding_checklists.completed_items / total_items`. CLAUDE.md regra 101 avisa explicitamente: "onboarding_checklists tabela real NAO tem `total_items` nem `started_at`". O campo real e `completed_items` (JSONB/array de keys completadas).

Alem disso, `whatsapp_connected` NAO existe em `franchise_configurations` (grep retornou zero resultados). O status do WhatsApp vem do ZuckZapGo via API externa, nao de uma coluna local.

**Fix**:
- Onboarding: usar `completed_items` (array de keys) e comparar com total de items do ONBOARDING_BLOCKS (27 items). Formula: `(completed_items.length / 27) * 70`.
- WhatsApp: ou (a) adicionar coluna `whatsapp_connected` em franchise_configurations com trigger/webhook que atualiza, ou (b) remover WhatsApp do score Setup e mover para "fora de escopo" ate ter dado persistido. Opção (b) e mais simples e confiavel.

### C3. Escalabilidade do data fetching: 7 queries com limites insuficientes

Com 46 franquias (escalando para 100+), a spec propoe:
- `Sale.list('-created_at', 500)`: 500 vendas nao cobrem "ultima venda" de todas as franquias se houver franquias inativas ha semanas
- `InventoryItem.list('franchise_id', 2000)`: 28 itens x 100 franquias = 2800 rows, estoura o limite
- `FranchiseNote.list('-created_at', 1000)`: pode crescer indefinidamente

Alem disso, `Sale.list('-created_at', 500)` ordena por created_at mas o score usa "dias desde ultima venda" — uma franquia sem venda ha 30 dias nao apareceria nas 500 mais recentes.

**Fix**: Trocar a estrategia de fetch. Em vez de `.list()` com limite, criar uma **Supabase RPC** (`get_franchise_health_data`) que retorna dados agregados por franquia em uma unica query SQL:
```sql
SELECT franchise_id,
  MAX(sale_date) as last_sale,
  COUNT(*) FILTER (WHERE quantity = 0) as zero_stock_count,
  ...
```
Isso resolve escalabilidade e corretude de uma vez. Se RPC nao for viavel agora, no minimo usar `.filter()` com data range (ex: vendas dos ultimos 7 dias) em vez de limite numerico.

---

## IMPORTANTES (deve corrigir)

### I1. Franchise.filter({ status: 'active' }) viola regra 74

CLAUDE.md regra 74: "Franchise.list() no Onboarding — NAO usar `.filter({status:'active'})` que pode excluir franquias validas". A spec usa `Franchise.filter({ status: 'active' })`. Franquias recem-criadas ou em onboarding podem nao ter status 'active' ainda.

**Fix**: Usar `Franchise.list()` e filtrar client-side, ou documentar que franquias sem status 'active' devem receber score 0 e aparecer com label "Em configuracao".

### I2. RLS da franchise_notes: risco de recursao em profiles

A policy faz `SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN (...)`. CLAUDE.md regra 6 avisa: "NUNCA usar is_admin() dentro de RLS policy do profiles". Embora a policy nao use `is_admin()`, ela faz query em `profiles` — se `profiles` tiver RLS com `USING(true)` para SELECT, funciona. Mas se alguem mudar a RLS de profiles, quebra.

**Fix**: Adicionar comentario no SQL: `-- NOTA: depende de profiles ter USING(true) para SELECT. Ver CLAUDE.md regra 6.`

### I3. Cores amber (#d97706) e red-50/amber-50/green-50 violam regra 99

CLAUDE.md regra 99: "NUNCA usar cores Tailwind genericas (text-amber-*)". A spec usa `#d97706` (amber) para Atencao e fundos `#fef2f2`, `#fffbeb`, `#f0fdf4` que sao Tailwind red-50/amber-50/green-50.

**Fix**: Manter os hex values explicitos (ja estao na spec como hex, nao como classes Tailwind). Adicionar `#d97706` ao design system como token semantico `warning`. Documentar que essas cores sao excecoes semanticas (similar a regra 125 para emerald).

### I4. Drill-down "Ver Gestao" sem contexto de franquia

A spec diz: navega para `/Gestao` com contexto da franquia. Mas Gestao.jsx e uma pagina de franqueado que usa `ctxFranchise` do AuthContext — admin nao tem franchise context. NAo existe mecanismo atual para admin visualizar dados de uma franquia especifica em /Gestao.

**Fix**: Ou (a) adicionar query param `?franchise_id=X` em Gestao que admin pode usar, ou (b) remover esse botao e manter apenas o drill-down inline como fonte de informacao. Opcao (b) e mais simples e coerente com o escopo.

---

## SUGESTOES (nice to have)

### S1. Penalty de -10 pontos e arbitraria e nao documentada

A regra "if alguma dimensao == 0, score -= 10" pode criar situacoes confusas: uma franquia com scores (100, 100, 100, 100, 0) teria score 80 com penalty = 70, enquanto (80, 80, 80, 80, 0) = 64 com penalty = 54. A penalty afeta mais quem ja esta mal.

**Sugestao**: Considerar penalty proporcional ao peso da dimensao zerada, ou simplesmente remover a penalty (o zero ja puxa a media pra baixo naturalmente).

### S2. Polling 180s pode ser lento para pagina de monitoramento

AdminDashboard usa 180s porque mostra muitos dados. Acompanhamento e pagina de acao rapida — 120s seria mais adequado.

### S3. Falta tratamento para franquia sem nenhum dado

Franquia recem-criada (sem vendas, sem estoque, sem pedidos, sem checklist, sem onboarding) teria score 0 em tudo + penalty = -10 (clampado a 0). Apareceria como "Critica" quando na verdade e apenas nova.

**Sugestao**: Adicionar estado "Nova" (franquia < 7 dias) que mostra badge diferenciado em vez de semaforo vermelho. Ou usar o peso "Franquia Nova" que ja existe na spec mas so para < 30 dias.

---

## O que esta bem feito

- Separacao clara AlertsPanel (urgencia) vs Acompanhamento (gestao proativa)
- Pesos diferenciados para franquias novas vs estabelecidas
- Timeline de anotacoes como alternativa ao "Contactado" binario
- Drill-down inline em vez de modal (melhor UX mobile)
- Secao "Fora de Escopo" bem definida
- Componentes novos bem organizados em pasta propria
