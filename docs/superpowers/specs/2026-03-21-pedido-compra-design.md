# Pedido de Compra — Design Spec

**Data**: 2026-03-21
**Status**: Aprovado

## Visão

Digitalizar o pedido de compra que hoje é feito por planilha Excel via WhatsApp. O franqueado faz pedido direto no app com sugestão de quantidades baseada no giro de estoque. O admin recebe, confirma, define previsão de entrega, e ao marcar como entregue o estoque sobe automaticamente.

## Fluxo

```
Franqueado clica "Fazer Pedido" (aba Estoque)
→ Preenche quantidades (sugestão pré-calculada)
→ Envia pedido (status: pendente)

Admin vê pedido no painel
→ Confirma recebimento (status: confirmado)
→ Define previsão de entrega + valor do frete
→ Franqueado vê previsão

Motorista entrega
→ Admin marca "Entregue" (status: entregue)
→ Trigger incrementa estoque da franquia
→ Frete fica registrado no pedido
```

## Franqueado — Fazer Pedido

### Onde
Botão "Fazer Pedido" na aba Estoque de Minha Loja, ao lado do botão "+ Adicionar".

### Formulário (Dialog grande ou página)
Lista os 28 produtos padrão Maxi Massas com:

| Coluna | Descrição |
|--------|-----------|
| Produto | Nome do produto |
| Custo | `cost_price` do `inventory_items` (read-only) |
| Estoque atual | `quantity` atual do franqueado |
| Sugestão | Pré-calculada: `Math.ceil(giro_semanal * 2) - quantity`. Se ≤ 0, mostra 0 |
| QTD | Input editável, default 0. Integer only |
| Total | `QTD × custo` calculado ao vivo |

- Botão **"Usar sugestão"** preenche todos os QTDs com os valores sugeridos de uma vez
- Produtos com sugestão > 0 ficam destacados (borda dourada ou background amber)
- **Total do pedido** fixo no rodapé: soma de todos os totais
- Campo **comentário** (textarea opcional): "Entregar segunda", "Trocar Canelone por Rondelli", etc.
- Botão **"Enviar Pedido"** → cria `purchase_order` com status `pendente`
- Só salva itens com QTD > 0 (não cria purchase_order_items com quantidade 0)

### Histórico de pedidos
Abaixo do botão "Fazer Pedido" (ou como seção colapsável na aba Estoque):
- Lista dos últimos pedidos do franqueado
- Cada pedido mostra: data, quantidade de itens, total, status (badge colorido), previsão de entrega (se definida)
- Clique expande pra ver itens do pedido
- Status: Pendente (amarelo) · Confirmado (azul) · Em rota (laranja) · Entregue (verde) · Cancelado (cinza)

## Admin — Painel de Pedidos

### Onde
Nova página `PurchaseOrders.jsx` acessível pelo menu admin. Item no menu: "Pedidos" com ícone `local_shipping`.

### Lista de pedidos
Tabela/cards com todos os pedidos de todas as franquias:

| Coluna | Descrição |
|--------|-----------|
| Franquia | Nome da unidade |
| Data | Data do pedido |
| Itens | Quantidade de itens |
| Total | Valor total do pedido |
| Frete | Valor do frete (se definido) |
| Status | Badge colorido |
| Ações | Ver · Editar |

Filtros: por status (todos, pendente, confirmado, em rota), por franquia.
Ordenação: mais recentes primeiro. Pendentes destacados no topo.

### Detalhe do pedido (Dialog ou expandido)
Admin vê todos os itens do pedido e pode:
- **Editar quantidades** — se item faltou na separação, quebrou, etc.
- **Definir frete** (R$) — custo de entrega
- **Definir previsão de entrega** — date picker
- **Mudar status**:
  - `pendente` → `confirmado` (admin confirmou que recebeu o pedido)
  - `confirmado` → `em_rota` (saiu pra entrega)
  - `em_rota` → `entregue` (motorista entregou)
  - Qualquer → `cancelado`
- **Ao marcar "Entregue"**: trigger no banco incrementa `inventory_items.quantity` com as quantidades do pedido

### Alerta de inatividade
No AlertsPanel do admin dashboard:
- Se franqueado não faz pedido há 30+ dias → alerta amarelo
- "Franquia X não faz pedido há Y dias"
- Botão "Ver franquia" navega pro detalhe

## Banco de Dados

### Tabela `purchase_orders`
```sql
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT NOT NULL REFERENCES franchises(evolution_instance_id),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'confirmado', 'em_rota', 'entregue', 'cancelado')),
  total_amount NUMERIC(10,2) DEFAULT 0,
  freight_cost NUMERIC(10,2),
  notes TEXT,
  estimated_delivery DATE,
  ordered_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_purchase_orders_franchise ON purchase_orders(franchise_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
```

### Tabela `purchase_order_items`
```sql
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_poi_order ON purchase_order_items(order_id);
```

### Trigger: estoque sobe ao entregar
```sql
CREATE OR REPLACE FUNCTION public.on_purchase_order_delivered()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'entregue' AND OLD.status != 'entregue' THEN
    UPDATE inventory_items ii
    SET quantity = ii.quantity + poi.quantity
    FROM purchase_order_items poi
    WHERE poi.order_id = NEW.id
      AND poi.inventory_item_id = ii.id;
    NEW.delivered_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER purchase_order_status_change
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION on_purchase_order_delivered();
```

### RLS
```sql
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
-- Franqueado vê seus pedidos, admin vê todos
CREATE POLICY "po_select" ON purchase_orders FOR SELECT USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "po_insert" ON purchase_orders FOR INSERT WITH CHECK (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);
CREATE POLICY "po_update" ON purchase_orders FOR UPDATE USING (
  is_admin() OR franchise_id = ANY(managed_franchise_ids())
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poi_select" ON purchase_order_items FOR SELECT USING (
  is_admin() OR order_id IN (SELECT id FROM purchase_orders WHERE franchise_id = ANY(managed_franchise_ids()))
);
CREATE POLICY "poi_insert" ON purchase_order_items FOR INSERT WITH CHECK (
  is_admin() OR order_id IN (SELECT id FROM purchase_orders WHERE franchise_id = ANY(managed_franchise_ids()))
);
CREATE POLICY "poi_update" ON purchase_order_items FOR UPDATE USING (is_admin());
CREATE POLICY "poi_delete" ON purchase_order_items FOR DELETE USING (is_admin());
```

### Entities
```js
export const PurchaseOrder = createEntity('purchase_orders');
export const PurchaseOrderItem = createEntity('purchase_order_items');
```

## Páginas e Componentes

### Novos
| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/components/minha-loja/PurchaseOrderForm.jsx` | Formulário de pedido (lista 28 produtos, sugestão, QTD) |
| `src/components/minha-loja/PurchaseOrderHistory.jsx` | Histórico de pedidos do franqueado (na aba Estoque) |
| `src/pages/PurchaseOrders.jsx` | Página admin: lista + detalhe de pedidos |

### Modificados
| Arquivo | Mudança |
|---------|---------|
| `src/entities/all.js` | Adicionar PurchaseOrder, PurchaseOrderItem |
| `src/components/minha-loja/TabEstoque.jsx` | Adicionar botão "Fazer Pedido" + PurchaseOrderHistory |
| `src/Layout.jsx` | Adicionar "Pedidos" no menu admin |
| `src/pages.config.js` | Adicionar rota PurchaseOrders |
| `src/components/dashboard/AlertsPanel.jsx` | Adicionar alerta inatividade de pedido 30+ dias |

## UX Responsivo

| Componente | Mobile | Desktop |
|-----------|--------|---------|
| Formulário pedido | Cards empilhados por produto | Tabela |
| Histórico pedidos | Cards com badge status | Tabela compacta |
| Admin lista pedidos | Cards empilhados | Tabela com filtros |
| Admin detalhe pedido | Seções empilhadas | 2 colunas (itens + config) |

## Status visual

| Status | Cor | Ícone |
|--------|-----|-------|
| Pendente | Amarelo (#d97706) | `schedule` |
| Confirmado | Azul (#2563eb) | `check_circle` |
| Em rota | Laranja (#ea580c) | `local_shipping` |
| Entregue | Verde (#16a34a) | `inventory` |
| Cancelado | Cinza (#6b7280) | `cancel` |
