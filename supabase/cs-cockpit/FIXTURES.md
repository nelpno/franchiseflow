# CS Cockpit — Fixtures de teste (auditoria 2026-06-19)

Franquias-referência pra validar `get_franchise_health_signals` (uma por tier).

| Tier esperado | Franquia | evolution_instance_id (confirmar) | Sinal-chave |
|---|---|---|---|
| 🟢 Saudável | Jd. Marajoara | (lookup por nome) | rev30 ~10k, delta +3%, compra/venda recentes |
| 🏆 Destaque | Santos | (lookup) | rev30 R$19,4k = topo da rede |
| 🔴 Queda faturamento | São José do Rio Preto | (lookup) | delta −44% (base ≥ R$2k) |
| 🔴 Parou de comprar | Jardim Ipê | (lookup) | 61 dias sem compra |
| 🔴 Sem vender | Piratininga | (lookup) | 23 dias sem venda |
| ⚪ Dormente | Bragança Paulista | (lookup) | rev=0, sem venda/compra/assinatura |

## Alertas pra a RPC (achados na auditoria)
1. **Sem OVERDUE vivo:** nenhuma `system_subscriptions.current_payment_status='OVERDUE'` hoje (só PAID/CANCELLED/null). Validar `subscription_overdue` por caso construído (setar 1 row temporária OVERDUE num branch/teste, nunca em prod).
2. **Vendas com data futura:** algumas franquias têm `sale_date` no futuro (ex: Vila Maria, last_sale 30/06 vs hoje 19/06 → `days_since_last_sale` negativo). A RPC DEVE usar `greatest(0, CURRENT_DATE - max(sale_date))` pra não tratar venda futura como "parou de vender" nem quebrar a régua de 7d.
3. **`sub=null`** em franquias sem assinatura criada (dormentes/novas) → tratar null como "não overdue".

## Mapeamento usuário→franquia (pro sinal de login)
`profiles` (role `franchisee`, 58 perfis) tem `managed_franchise_ids` contendo o **evolution_instance_id** (ex: `["<uuid>", "franquiabaurusp"]`). Join: `franchises.evolution_instance_id = ANY(profiles.managed_franchise_ids)`. → `engagement_low` é viável (Chunk 4 NÃO adiado).

## Índices
Todos os índices-alvo já existem (`idx_sales_franchise_date`, `idx_sale_items_sale`, `idx_poi_order`, `idx_purchase_orders_franchise`, `system_subscriptions_franchise_id_key`, etc). **Task 1.3 = no-op.**
