# Análise UX Completa — FranchiseFlow

## Conclusão Principal

**O app foi feito para admin monitorar, não para franqueado operar e ser motivado a vender.**

70% da interface é ruído para o franqueado. Precisamos de **UX baseado em role**:
- **Franqueado**: tela simples, ações rápidas, motivação
- **Admin**: monitoramento, analytics, gestão

---

## NAVEGAÇÃO PROPOSTA (simplificada)

### Para FRANQUEADO (5 itens no menu):
```
🏠 Minha Loja (dashboard pessoal simplificado)
💰 Vendas (registrar + ver histórico)
📦 Estoque (ver/atualizar quantidades)
✅ Checklist (rotina diária)
⚙️ Minha Unidade (configurações IA/WhatsApp)
```

### Para ADMIN (itens extras):
```
📊 Painel Geral (dashboard de todas as franquias)
👥 Franqueados (gestão + convites)
📈 Relatórios (analytics avançado)
🛍️ Catálogo (produtos padrão)
📣 Marketing (repositório de materiais)
👀 Acompanhamento (semáforo de atividade)
👤 Usuários (permissões)
```

---

## DASHBOARD DO FRANQUEADO (redesign)

O dashboard atual mostra: contatos únicos, taxa de conversão, gráficos de 365 dias.
**O franqueado precisa ver:**

```
┌──────────────────────────────────────┐
│  🍝 MaxiMassas São João             │
│                                      │
│  HOJE                                │
│  ├─ 💰 5 vendas | R$ 285            │
│  ├─ 📊 Meta: ████████░░ 72%         │
│  └─ 📦 Estoque: ⚠️ 2 itens baixos   │
│                                      │
│  ✅ Checklist: 8/10 feito            │
│  🏆 Ranking: 3º de 12 franquias     │
│  🔥 Streak: 7 dias seguidos         │
│                                      │
│  [+ VENDA RÁPIDA]                    │
│  [📋 CHECKLIST]  [📦 ESTOQUE]        │
└──────────────────────────────────────┘
```

---

## PROBLEMAS POR PERSONA

### Dona Maria (55+, não tech-savvy)

| Problema | Severidade | Solução |
|----------|-----------|---------|
| 27 itens no checklist assusta | CRÍTICA | Separar em "Essenciais" (5-7) vs "Opcionais" |
| "Taxa de Conversão" não entende | ALTA | Remover ou trocar por "Vendas vs Contatos" |
| "Ticket Médio" é jargão | ALTA | Trocar por "Valor Médio de Venda" |
| "Inventário" é técnico | MÉDIA | Trocar por "Estoque" |
| Tabela de estoque quebra no celular | ALTA | Converter para cards no mobile |
| Filtros demais nas vendas | MÉDIA | Esconder filtros avançados em colapsável |
| Vermelho no bloco "Meio-Dia" confunde | MÉDIA | Trocar para azul/verde (vermelho = erro pra ela) |
| "FranchiseFlow" não comunica nada | BAIXA | Trocar para "Maxi Massas" no login |
| Gráficos sem contexto | MÉDIA | Adicionar frases: "Você vendeu 20% mais que ontem" |

### Lucas (28, tech-savvy, iPhone)

| Problema | Severidade | Solução |
|----------|-----------|---------|
| Não vê seu ranking | ALTA | Card "Seu Ranking" no dashboard |
| Sem notificações push | ALTA | Alertas estoque baixo, meta atingida |
| Venda Rápida precisa 3 campos | MÉDIA | Reduzir para 1 (só valor, auto-preenche resto) |
| Sem comparação semana vs semana anterior | ALTA | Widget no dashboard |
| Sem gamificação (badges, streaks) | MÉDIA | Badges: "Meta Master", "Vendedor de Ouro" |
| Sem compartilhar no Instagram | BAIXA | Gerar card shareable com resultado |
| Mobile: filtros de Reports inutilizáveis | ALTA | Redesenhar para mobile-first |
| Sem previsão "quando acaba estoque" | MÉDIA | Calcular velocidade média de venda |
| Sem "qual produto mais vende" | ALTA | Top 5 produtos no dashboard |

---

## PROBLEMAS TÉCNICOS (código morto + crashes)

### REMOVER AGORA:
- `src/api/base44Client.js` — arquivo morto
- 10 dependências não usadas no package.json (Stripe, Three.js, Leaflet, etc.) — ~500KB de bundle
- `src/pages/Home.jsx` — só redireciona, página morta
- `src/components/ui/use-toast.jsx` — shadcn legacy, sonner é o padrão

### CORRIGIR AGORA:
- 9 arquivos com crash risk (null access em `currentUser`, `managed_franchise_ids`)
- `UserManagement.jsx` ainda usa `alert()` em vez de `toast`
- Promise.race no AuthContext pode causar memory leak
- Dashboard carrega 365 dias sem paginação
- Reports carrega 2000 registros sem paginação

### OTIMIZAR:
- Adicionar `useMemo` em filtros de Sales e Reports
- Cleanup de setInterval no Dashboard (unmount)
- Substituir console.log por logger em produção

---

## CAMPOS QUE FALTAM NO VENDEDOR GENÉRICO

| Campo | Uso | Prioridade |
|-------|-----|-----------|
| raio_maximo_entrega | "Entregamos até Xkm" | Alta |
| pedido_minimo | "Pedido mínimo R$X" | Alta |
| tempo_preparo_medio | "Pronto em ~X minutos" | Média |
| dias_funcionamento | Separar de horários | Média |

---

## PLANO DE AÇÃO PRIORIZADO

### Sprint 1: Correções Técnicas (agora)
1. Remover código morto e deps não usadas
2. Corrigir null checks e crash risks
3. Substituir alert() por toast em UserManagement
4. Otimizar queries (pagination)

### Sprint 2: UX Baseado em Role (próxima sessão)
1. Dashboard do franqueado simplificado
2. Menu condicional por role (5 itens vs 12)
3. Renomear termos técnicos
4. Checklist essenciais vs opcionais

### Sprint 3: Features Motivacionais (depois)
1. Card ranking pessoal no dashboard
2. Streaks visuais
3. Meta com progresso visual
4. Alertas de estoque no dashboard

### Sprint 4: Design com Stitch (FASE 4)
1. Aplicar design system Maxi Massas
2. Mobile-first em todas as telas
3. Cards responsivos no estoque
4. Filtros mobile-friendly
