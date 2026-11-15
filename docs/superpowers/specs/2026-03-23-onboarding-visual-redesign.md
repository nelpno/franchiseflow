# Spec: Redesign Visual do Onboarding — Missões com Identidade

**Data:** 2026-03-23
**Status:** Aprovado pelo usuário
**Abordagem:** Evolução do OnboardingBlock existente (Abordagem 1)

## Contexto

O onboarding funcional está pronto: 8 missões (27 itens), gate admin-only, celebração franqueado, keys consistentes, checkbox no checkbox (não na linha). O visual atual é um accordion genérico com barras de progresso finas — funciona mas não encanta.

O objetivo é transformar a experiência visual em algo que o franqueado goste de usar e conte pra todo mundo, aplicando neurociência (dopamina, chunking, progress illusion, peak-end rule).

## Decisões de Design

| Decisão | Escolha |
|---------|---------|
| Layout | Cards em lista vertical com expansão inline |
| Identidade visual | Ícone temático Material Symbol + cor de acento por missão |
| Progress ring | 48px com ícone dentro, check animado ao completar |
| Celebração | Micro-celebração no card (scale + glow + faixa temporária) |
| Card colapsado | Ring + título + subtítulo contextual dinâmico |
| Abordagem técnica | Reescrever OnboardingBlock.jsx + criar ProgressRing.jsx |

## 1. Estrutura de Dados (ONBOARDING_BLOCKS.jsx)

Adicionar campo `icon` a cada bloco (campo `color` já existe e permanece inalterado):

| Bloco | Título | Cor (existente) | Ícone (novo) |
|-------|--------|-----|-------|
| 1 | Primeiros Passos | `#D32F2F` | `handshake` |
| 2 | Conheça Seus Produtos | `#C49A2A` | `restaurant` |
| 3 | Prepare Seu Espaço | `#0288D1` | `kitchen` |
| 4 | Configure o WhatsApp | `#43A047` | `chat` |
| 5 | Configure Seu Vendedor | `#F57C00` | `smart_toy` |
| 6 | Faça Seu Primeiro Pedido | `#5C6BC0` | `shopping_cart` |
| 7 | Treinamento | `#8E24AA` | `school` |
| 8 | Redes Sociais | `#E91E63` | `share` |

Nenhuma outra mudança nesse arquivo. Items, keys e roles ficam iguais.

## 2. ProgressRing (componente novo)

**Arquivo:** `src/components/onboarding/ProgressRing.jsx`

**Props:**
- `size` (default 48)
- `progress` (0-100)
- `color` (cor da missão)
- `isComplete` (boolean)
- `icon` (nome do Material Symbol)

**Comportamento:**
- SVG circular com arco de progresso via `stroke-dasharray`/`stroke-dashoffset`
- Fundo do arco: cor da missão com 15% opacidade
- Arco preenchido: cor da missão sólida, `stroke-linecap: round`
- Track width: 4px
- Centro: `<MaterialIcon>` com o ícone da missão, na cor da missão
- Quando `isComplete`: arco 100%, ícone troca para `check` em emerald, pulse animation uma vez (scale `1 → 1.15 → 1` em 400ms)
- Transição suave do arco via CSS transition (400ms ease-out)
- A 0% de progresso: arco invisível (dashoffset = circunferência total), apenas o track de fundo (15% opacidade) visível
- Componente puro — sem estado interno
- Defensivo: clamp progress a 0-100, fallback do icon para número do bloco se undefined

## 3. Card da Missão (OnboardingBlock.jsx reescrito)

### 3.1 Estado Colapsado

- `border-left: 4px solid {cor da missão}` — identidade visual imediata
- Fundo branco, border sutil `border-[#291715]/5`
- Hover: `shadow-sm` + border-left mais intensa
- Layout flex: ProgressRing à esquerda, título + subtítulo ao centro, chevron à direita
- **Subtítulo contextual dinâmico:**
  - `0/N` (bloco ativo, com progress illusion 5%): "Pronta para você" (cor da missão)
  - `0/N` (blocos futuros, sem illusion): "Toque para começar" (cor da missão)
  - `X/N` parcial: "X de N itens" (`#4a3d3d`)
  - `N-1/N`: "Falta 1 item!" (cor da missão, urgência)
  - `N/N`: "Missão completa!" (`#059669`)

### 3.2 Estado Expandido

- Card ganha `shadow-md` e background sutil `{cor}08`
- Border-left mantém cor da missão
- Separador tracejado entre header e itens
- Checkboxes mantêm 28px (w-7 h-7) — touch target otimizado
- Items mantêm lógica de roles, locks e detalhes expandíveis (ITEM_DETAILS)
- Seção "Aguardando franqueador" mantém separação para itens franchisor
- Card ativo (em progresso): borda esquerda 5px + sombra sutil — destaque visual

### 3.3 Estado Completo (colapsado)

- Border-left muda para `#10b981` (emerald-500)
- Fundo `#ecfdf5` com 30% opacidade (emerald-50/30)
- Ring mostra check verde (`#10b981`), arco completo
- Subtítulo "Missão completa!" em `#059669` (emerald-600)

### 3.4 GateBlock (admin-only)

O GateBlock mantém sua identidade visual distinta (gradiente dourado/vermelho) mas ganha consistência com os mission cards:

- **ProgressRing:** sim, 48px com ícone `verified` e cor `#C49A2A` (dourado)
- **Border-left:** 4px gradiente `#D32F2F → #C49A2A` (CSS `border-image`)
- **Checkboxes:** alinhar para 28px (w-7 h-7) como os demais blocos (hoje é 20px)
- **Layout header:** mesmo flex layout (ring + título + subtítulo + badge)
- **Background:** mantém gradiente dourado sutil existente
- **Quando completo:** border-left `#10b981`, ring com check, fundo `#ecfdf5/30`
- **Não muda:** lógica de canMark, bloqueio quando blocos 1-8 incompletos, badge "PRÉ-REQUISITO"

## 4. Micro-celebração

### Ao completar uma missão (sequência 800ms)

1. **0ms** — Último checkbox marcado, ring preenche até 100% (transição 400ms)
2. **200ms** — Card faz scale `1 → 1.02` + glow shadow na cor da missão
3. **400ms** — Ícone do ring troca para check com pulse (`1 → 1.15 → 1`)
4. **400ms** — Faixa "🎉 Missão completa!" aparece no card com fade-in (fundo cor da missão, texto branco)
5. **600ms** — Toast sonner com mensagem personalizada (já existente no BLOCK_CELEBRATION)
6. **3000ms** — Faixa some com fade-out, card colapsa suavemente
7. **3400ms** — Próxima missão incompleta auto-expande com scroll suave

**Princípios:**
- Não interrompe — celebração acontece no próprio card
- Gratificação imediata — glow + pulse sem popup
- Progressão natural — colapsar + abrir próxima
- Faixa temporária — ao revisitar, card completo mostra apenas estado verde limpo
- **Interação do usuário cancela timers:** se o franqueado clicar em qualquer bloco durante a celebração (3s da faixa), cancelar o timer de auto-expand e honrar o clique imediatamente. A UI nunca deve parecer travada

### Ao completar TODAS as 8 missões (peak-end rule)

- Card celebração final com gradiente emerald → dourado
- Ícone `celebration` (64px) com animação de bounce
- Título: "Parabéns! Você está pronto para vender!"
- Subtítulo: "O CS foi notificado e vai validar suas configurações. Tráfego pago ativado em até 48h."

## 5. Header de Progresso (Onboarding.jsx)

- ProgressRing maior (56px) com ícone `rocket_launch` à esquerda do card de progresso
- Barra de progresso mantém gradiente atual (vermelho → dourado → verde)
- Texto: "X de 8 missões completas" + "Y de 27 itens"
- **Mensagem motivacional dinâmica:**
  - 0%: "Vamos começar! Sua primeira missão já está esperando."
  - 1-25%: "Ótimo começo! Continue assim."
  - 26-50%: "Quase na metade! Você está voando."
  - 51-75%: "Mais da metade! A reta final está perto."
  - 76-99%: "Falta pouco! Você está quase lá!"
  - 100%: "Todas as missões completas! 🎉"
- Admin summary, franchise list, seletores — sem mudanças

## 6. Toques de UX (neurociência)

- **Progress illusion:** Ring da próxima missão ativa (apenas ela, não todas as futuras) mostra 5% preenchido mesmo que vazio — sensação de já ter começado. Subtítulo correspondente: "Pronta para você" (não "Toque para começar")
- **Subtítulo de urgência:** "Falta 1 item!" quando está `N-1/N`
- **Card ativo em destaque:** borda 5px + sombra — olho vai direto

## 7. Responsividade Mobile (375px+)

### Card colapsado
- Ring: 40px (mobile) / 48px (desktop)
- Padding: `p-3` (mobile) / `p-4` (desktop)
- Border-left: 4px em ambos
- Título `text-sm`, subtítulo `text-xs`

### Card expandido
- Checkboxes: 28px (w-7 h-7) em ambos — mínimo touch target
- Role tags franchisee: `hidden` no mobile (já implementado)
- Detalhes expandíveis: `px-3 py-2` mobile
- Links nos detalhes: `min-h-[40px]` para touch target

### Header progresso
- Ring geral: 48px (mobile) / 56px (desktop)
- Mensagem motivacional: `text-xs`
- Barra de progresso: `h-3` mantida

### Celebração mobile
- Scale da micro-celebração: `1.01` (menor que desktop 1.02, evita scroll horizontal)
- Card final 8 missões: padding `p-5` em vez de `p-8`

## 8. Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/components/onboarding/ONBOARDING_BLOCKS.jsx` | Adicionar campo `icon` a cada bloco |
| `src/components/onboarding/ProgressRing.jsx` | **CRIAR** — componente SVG ring |
| `src/components/onboarding/OnboardingBlock.jsx` | **REESCREVER** — novo visual com ProgressRing |
| `src/pages/Onboarding.jsx` | Ajustar header com ProgressRing maior + mensagem motivacional + celebração final |
| `src/components/onboarding/GateBlock.jsx` | Ajustes menores de consistência visual (border-left, ring) |
| `src/components/onboarding/ITEM_DETAILS.jsx` | **SEM MUDANÇAS** |

## 9. Convenção de Cores

Cores do design system Atelier (`#b91c1c`, `#d4af37`, `#1b1c1d`, `#4a3d3d`, etc.) seguem regra 99 do CLAUDE.md. As cores emerald usadas neste redesign são **semânticas de sucesso**, não cores de marca, e são exceção documentada:

| Uso | Classe Tailwind | Hex |
|-----|----------------|-----|
| Sucesso/completo | emerald-500 | `#10b981` |
| Texto sucesso | emerald-600 | `#059669` |
| Fundo sucesso | emerald-50 | `#ecfdf5` |

No código, preferir classes Tailwind para esses 3 valores (são semânticos padronizados), mas usar hex para cores de missão (`#D32F2F`, `#C49A2A`, etc.) via `style={}`.

## 10. O que NÃO muda

- Lógica de estado (items, checklist, saveItems, handleToggle)
- Estrutura de dados (BLOCKS, GATE_BLOCK, ITEM_DETAILS)
- Lógica de roles (canMark, role tags, admin vs franchisee)
- Lógica de auto-expand e auto-scroll (apenas refinamento de timing)
- Admin summary, franchise list, seletores
