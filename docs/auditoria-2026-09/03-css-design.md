# 03 — CSS, design system e consistência visual

> Auditoria FranchiseFlow 2026-09-07 · frente 03. Tudo abaixo foi medido lendo `src/` e o build
> de 01/09 (`dist/assets/index-Bjwd3gzD.css`). Scripts de medição no apêndice. Nada foi editado em `src/`.
> Onde eu não rodei o app, está marcado `⚠️ NÃO VERIFICADO`.

## TL;DR — os 5 que mais pagam (impacto × alcance ÷ esforço)

| # | Achado | Alcance (Clarity 3d) | Esforço |
|---|---|---|---|
| 1 | **Alvos de toque abaixo de 48 px no caminho diário do franqueado**: itens do bottom nav sem altura mínima (área útil ~40 px), 4 ações da venda a 32 px e só-ícone no celular, 3 ícones de 28 px lado a lado no card de estoque mobile | `/Vendas` Mobile 296 sessões, `/Gestao` Mobile 191 | P |
| 2 | **12 px é o tamanho de fonte mais usado do app** (`text-xs` 464× > `text-sm` 428×) e há 123 textos abaixo disso (`text-[10px]` 80, `text-[11px]` 43). O DRE do franqueado imprime as linhas de receita em 11 px; os badges de estoque em 10 px | todas as telas de operação | M |
| 3 | **O design system existe no papel e está morto no código**: `--primary`, `--muted`, `--border`… (index.css:21-55 / tailwind.config.js:12-63) têm **0 usos** fora de `ui/`; 1.647 de 3.674 `className` (45%) carregam hex literal; 114 hex distintos, ~50 são variação acidental de 12 tons; 22% do CSS final são regras geradas por hex arbitrário | manutenção de tudo | M (codemod P + revisão) |
| 4 | **Os defaults de `ui/` são o contrário do que o app faz**: `<Card>` tem borda/sombra sobrescritas em 44/58 (76%), raio em 33/58; `<Button>` raio em 53/196 e cor em 55/196; `<Badge>` raio em 15/26 e fonte em 16/26. Resultado: **62 cards feitos à mão > 58 `<Card>`**, 148 `<button>` cru vs 196 `<Button>` | consistência visual inteira | P–M |
| 5 | **Estados faltando onde o Clarity aponta abandono**: `FranchiseeDashboard` não tem estado vazio (Dashboard Mobile: quickback em 75% das sessões); `TabResultado` usa spinner e não tem UI de erro; `Onboarding`/`MyChecklist` carregam com "Carregando…" fora de paleta; `MyContacts`/`Financeiro` têm skeleton feito à mão em cor diferente do `<Skeleton>` | Dashboard 138M/135PC, Gestao 191M/167PC | P por tela |

Menores mas baratos: verde `#16a34a` como texto reprova AA (3,30:1) em 61 usos incluindo o chip "Pagamento recebido"; dourado `#d4af37` como texto (2,10:1) em 28 usos e como botão com texto branco em 4; `MaterialIcon` sem `aria-hidden` (leitor de tela lê "edit", "delete"); `hidden sm:inline` (20×) some da árvore de acessibilidade — no celular os 4 botões da venda ficam sem nome; `hover:` 371× contra `active:` 31× (zero `active:` em TabLancar/SaleForm/MyContacts → sem feedback de toque, e hover "gruda" no dedo).

---

## 0. Números-base (medidos)

| Métrica | Valor |
|---|---|
| Arquivos `.jsx/.js` em `src/` | 148 (91 contêm hex) |
| `className=` totais / com `#hex` | 3.674 / **1.647 (45%)** |
| Ocorrências de hex / distintos (normalizado) | **2.726 / 114** |
| Classes de paleta Tailwind (`text-red-600`, `bg-slate-50`…) | 429 (red 120, gray 98, amber 50, slate 44, emerald 44, green 40, yellow 10, orange 9, blue 7, purple 5, sky 2) |
| Tokens semânticos shadcn usados fora de `ui/` (`bg-primary`, `text-muted-foreground`, `border-border`, `bg-card`, `text-destructive`…) | **0** |
| `--chart-1..5` (index.css:41-45) referenciados | 0 (recharts recebe hex direto: `stroke="#b91c1c"` 3×, `#e9e8e9`, `#4a3d3d`, `#1b1c1d`, `#16a34a`) |
| `<Button>` / `<button>` cru | 196 / 148 |
| `<Card>` / card à mão (`bg-white`+`border`+`rounded-*`) | 58 / **62** |
| `<Input>` / `<input>` cru de texto | 75 / 41 (17 só em `FranchiseSettings.jsx`) |
| `<Select>` / `<select>` cru | 26 / 9 |
| `<Textarea>` / `<textarea>` cru | 5 / 7 |
| `<Badge>` / pill à mão (`rounded-full … text-xs`) | 26 / 13 |
| `<Skeleton>` (arquivos) / spinners `animate-spin` (arquivos) | 11 / 21 |
| `hover:` / `active:` | 371 / 31 |
| `aria-label=` | 33 |
| `env(safe-area-inset-*)` | 0 (com `viewport-fit=cover` declarado em `index.html:5`) |

---

## 1. Inventário de tokens

### 1.1 O que existe

Top 12 hex = **2.184 ocorrências = 80% de tudo**:

| hex | usos | papel de fato | equivalente shadcn já definido |
|---|---:|---|---|
| `#4a3d3d` | 467 | texto secundário / ícone | (nenhum) |
| `#b91c1c` | 424 | primary | `--primary` (index.css:28 = `hsl(0 72.2% 42%)` = **#b91c1c exato**) |
| `#1b1c1d` | 311 | texto principal | `--foreground` (index.css:23 = `hsl(210 5.6% 11%)` = **#1b1c1d exato**) |
| `#291715` | 173 | borda em `/5`, `/10` (ex. `border-[#291715]/5` 40× nos cards à mão) | — |
| `#e9e8e9` | 129 | borda/fundo neutro, skeleton à mão | `--input` (index.css:39 = `hsl(300 1.6% 91.4%)` ≈ **#e9e8e9**, ≤1 unidade) |
| `#d4af37` | 129 | gold | `--secondary` (index.css:30 = **#d4af37 exato**) |
| `#16a34a` | 112 | sucesso (= Tailwind `green-600`) | — |
| `#fbf9fa` | 105 | fundo da página | `--background` (index.css:22 = **#fbf9fa exato**) |
| `#7a6d6d` | 88 | texto terciário | `--muted-foreground` (index.css:33 = `hsl(0 4.5% 45.3%)` ≈ **#796e6e**, 1 unidade) |
| `#dc2626` | 77 | erro (= `red-600`) | **não** — `--destructive` (index.css:36 = `hsl(0 75.4% 41.6%)`) resolve para **#ba1a1a**, o primary de novo; o tema não tem o vermelho de erro que o app usa |
| `#775a19` | 76 | gold escuro (texto sobre amarelo) | — |
| `#3d4a42` | 73 | texto verde-acinzentado (só em Onboarding/Financeiro/Settings) | — |
| `#cac0c0` | 59 | borda/placeholder | `--border` (index.css:38 = `hsl(0 6.3% 77.3%)` ≈ **#c9c2c2**, 2 unidades) |

Ou seja: **7 dos 14 tons mais usados já estão definidos como CSS var** (4 byte-iguais, 3 a ≤2 unidades de RGB) — o app só não os chama. O buraco real do tema são os cinzas de texto (`#4a3d3d`, `#291715`), o verde de sucesso e o gold-texto.

### 1.2 Quantos são variação acidental

Agrupando os 114 hex por distância perceptual (CIE ΔE < 10, script `hex_cluster.py`): **57 clusters; 24 têm mais de um membro; 57 hex são variação de outro**. Descontando os que são tints semanticamente diferentes (red-50 vs green-50, ambos "quase branco"), ficam **~45 variações acidentais**. As que doem:

| tom canônico | variações | usos das variações |
|---|---|---:|
| `#b91c1c` primary | `#a80012` (33), `#ba1a1a` (3), `#d32f2f` (3), `#a01818` (1) | 40 |
| `#dc2626` erro | `#e31818` (29) | 29 |
| `#1b1c1d` texto | `#1d1b1b` (22), `#201a1a` (1) | 23 |
| `#7a6d6d` terciário | `#8a7e7e` (30), `#666` (6), `#7a6868` (2) | 38 |
| `#4a3d3d` secundário | `#444` (7), `#525252` (1) | 8 |
| `#d4af37` gold | `#c49a2a` (5), `#b8860b` (5), `#b8941f` (3), `#ca8a04` (1) | 14 |
| `#16a34a` sucesso | `#43a047` (5), `#15803d` (8), `#2e7d32` (3), `#22c55e` (1), `#10b981` (6), `#059669` (2) | 25 |
| `#775a19` gold-texto | `#705d00` (7), `#5a4012` (1), `#5a4312` (1) | 9 |

E há **duas escalas de cinza convivendo**: a própria (`#1b1c1d/#4a3d3d/#7a6d6d/#cac0c0/#e9e8e9`) e a do Tailwind (`gray-*` 98×, `slate-*` 44× — ex. `MyChecklist.jsx:262` `text-slate-600`, `PageNotFound.jsx:29` `text-slate-300`, `Franchises.jsx:718` `text-red-400`). E dois verdes: hex `#16a34a` (112) e classes `green-*`/`emerald-*` (84).

### 1.3 Lista mínima de tokens (cabe no `tailwind.config.js` que já existe)

12 tokens de marca + 4 semânticos. Valores = **os hex que já dominam**, para a migração ser sem mudança visual:

```js
// tailwind.config.js → theme.extend.colors (adicionar, não substituir)
brand: {
  DEFAULT: '#b91c1c',   // primary — substitui #b91c1c, #a80012, #ba1a1a, #d32f2f, #a01818
  dark:    '#991b1b',   // hover do primary (já usado 67×)
  gold:    '#d4af37',   // gold — só em fundo/borda/ícone decorativo, NUNCA texto (2,10:1)
  'gold-ink': '#775a19',// gold como TEXTO (6,44:1) — substitui #705d00, #5a4012
},
ink: {
  DEFAULT: '#1b1c1d',   // texto principal — substitui #1d1b1b, #201a1a
  2: '#4a3d3d',         // secundário — substitui #444, #525252, #3d4a42
  3: '#7a6d6d',         // terciário — substitui #8a7e7e (reprova AA!), #666, #7a6868
  4: '#cac0c0',         // desabilitado/placeholder — NUNCA para ícone clicável (1,78:1)
},
surface: {
  DEFAULT: '#fbf9fa',   // fundo da página
  card:    '#ffffff',
  2:       '#f5f3f0',   // display read-only (padrão já validado no SaleForm)
  line:    '#e9e8e9',   // borda neutra — absorve border-[#291715]/10 (≈#eae8e8 sobre branco); /5 fica 1 tom mais claro, aceitável
},
ok:   { DEFAULT: '#15803d', soft: '#f0fdf4' },  // green-700 (5,02:1) — NÃO #16a34a (3,30:1)
warn: { DEFAULT: '#92400e', soft: '#fef3c7' },  // amber-800 sobre amber-100 (6,37:1) — já é o chip "pendente"
err:  { DEFAULT: '#dc2626', soft: '#fef2f2' },  // absorve #e31818
```

Regra de uso: cor de **texto** só de `ink.*`, `brand.DEFAULT`, `brand.gold-ink`, `ok/warn/err.DEFAULT`. Cor de **fundo** de destaque só `*.soft` ou `brand/10`. Isso fecha o contraste por construção (ver §7).

### 1.4 Como migrar sem big bang

1. **Passo 0 (P, zero mudança visual):** adicionar os tokens acima em `tailwind.config.js`. Nada muda — nenhuma classe usa ainda.
2. **Passo 1 (P por arquivo, zero mudança visual):** codemod de string pura, arquivo a arquivo, começando pelos 5 maiores (`TabResultado` 170 hex, `PurchaseOrders` 125, `TabEstoque` 117, `Franchises` 97, `TabLancar` 83 = 592 = 22% do total):
   `text-[#4a3d3d]` → `text-ink-2`, `text-[#4a3d3d]/70` → `text-ink-2/70`, `border-[#291715]/5` → `border-surface-line`, `bg-[#b91c1c]` → `bg-brand`, etc. O CSS gerado é **byte-igual** para os tons canônicos (mesmo hex), e nas variações acidentais a diferença é ΔE < 10 (invisível no contexto). Prova de zero regressão: diff do `dist/*.css` antes/depois deve mostrar apenas renome de seletor.
   - **Proteção contra tela branca (regra 7 do contexto):** o codemod só toca strings dentro de `className` — não adiciona nem remove `import`. Risco de `no-undef` = zero por construção. Verificar com `npm run build` + `grep -c "#4a3d3d" dist/assets/*.css` (cai a cada arquivo migrado).
3. **Passo 2 (M):** trocar as 429 classes de paleta Tailwind (`text-gray-500`, `bg-slate-50`, `text-red-400`) pelos tokens — aqui há mudança visual pequena e desejada (unifica o cinza). Rever tela a tela.
4. **Passo 3 (opcional):** só depois de 1–2, apagar o bloco `.dark` morto (index.css:56-89, 34 linhas — já não vai para o bundle, ver §3) e as vars `--chart-*` (0 usos).

Não fazer: não trocar `--primary` etc. por `brand.*` — deixa os dois (o `ui/` usa os semânticos; o app passa a usar `brand/ink/surface`). Uma fonte de verdade por camada, sem reescrever `ui/`.

---

## 2. Escala tipográfica e de espaçamento

### 2.1 Tamanhos de fonte — antes/depois

**Hoje: 15 tamanhos distintos em UI** (excluindo cupom/PDF):

| classe | px | usos | comentário |
|---|---:|---:|---|
| `text-[9px]` | 9 | 3 | |
| `text-[10px]` | 10 | 80 | badges (TabEstoque 14, TabResultado 10, CsCard 6, Franchises 5) |
| `text-[11px]` | 11 | 43 | **linhas do DRE** (`TabResultado.jsx:257-269` "└ Vendas", "└ Frete cobrado") |
| `text-xs` | 12 | **464** | **o mais usado do app** |
| `text-[13px]` | 13 | 4 | |
| `text-sm` | 14 | 428 | |
| `text-base` | 16 | 24 | |
| `text-lg` | 18 | 60 | |
| `text-xl` | 20 | 15 | |
| `text-2xl` | 24 | 27 | |
| `text-[24px]` | 24 | 1 | duplicata de `text-2xl` |
| `text-3xl` | 30 | 11 | |
| `text-4xl` | 36 | 3 | |
| `text-5xl` | 48 | 9 | |
| `text-7xl` | 72 | 1 | PageNotFound |

Variantes responsivas de fonte (`sm:text-*`, `md:text-*`): **31 no app inteiro** — a tipografia é praticamente a mesma no celular e no desktop, e ela foi desenhada para desktop (12 px dominante).

Pesos: `font-bold` 332, `font-medium` 253, `font-semibold` 125, `font-extrabold` 11, `font-black` 1, `font-light` 1. **`font-black` (900) e `font-light` (300) não são carregados** (`index.html:24` carrega Inter 400–700 e Jakarta 500–800) → o browser sintetiza/substitui: `DailyRevenueChart.jsx:35` e `PageNotFound.jsx:29`. Os 11 `font-extrabold` estão todos **sem** `font-plus-jakarta` (0/11) — pedem 800 da Inter, que não é carregada (só até 700) → renderiza 700 sintetizado. Títulos: `h1` 11/16 com Jakarta, `h2` 7/19, `h3` 25/54 — a fonte de heading é aplicada em menos da metade dos headings.

**Proposta (7 tamanhos + 2 display):**

| papel | classe | px | substitui |
|---|---|---:|---|
| micro (só badge/uppercase-label) | `text-[11px]` → alias `text-2xs` | 11 | `[9px]`, `[10px]`, `[11px]` (126 usos) |
| caption | `text-xs` | 12 | `[13px]` |
| **corpo operação** | `text-sm` | 14 | **vira o padrão de linha de lista/valor no celular** |
| corpo destaque / input | `text-base` | 16 | |
| título de card | `text-lg` | 18 | `text-xl` (15) |
| título de tela | `text-2xl` | 24 | `[24px]`, `text-3xl` parte |
| KPI | `text-3xl` | 30 | |
| display | `text-5xl` | 48 | `text-4xl`, `text-7xl` |

Pesos: 3 (500 label, 600 ênfase, 700 título/valor) — remover `extrabold`/`black`/`light` ou carregar os pesos. Heading = sempre `font-plus-jakarta font-bold`.

Regra que resolve o item 2 do TL;DR sem redesenhar: **em tela de operação do franqueado (TabLancar, TabEstoque mobile, TabResultado, MyContacts, PurchaseOrderForm) nenhum dado (nome, valor, quantidade) abaixo de 14 px; nenhum texto lido abaixo de 12 px; 10–11 px só em badge com fundo.** Hoje `TabEstoque` mobile tem 14 `text-[10px]` e `TabResultado` 10.

### 2.2 Raio, sombra, altura, padding

| dimensão | hoje (distintos) | usos | proposta |
|---|---|---|---|
| **raio** | 9: `rounded` 4px (27), `sm` (4), `md` 6px (34), `lg` 8px (111), `xl` 12px (**314**), `2xl` 16px (93), `3xl` (2), `full` (134), `none` (4) | | **4**: `md` (input/select), `xl` (botão, chip, card compacto), `2xl` (card, sheet, dialog), `full` (pill/avatar) |
| **sombra** | 7: `sm` (95), default (35), `md` (17), `lg` (23), `xl` (3), `none` (4), arbitrária (nav) | | **3**: `sm` (card em repouso), `md` (hover/elevado), `lg` (overlay) |
| **altura de botão** | 6: 28 (`h-7`), 32 (`h-8`/`size="sm"`), 36 (`h-9` default), 40 (`min-h-[40px]` 17×), 44 (3×), 48 (2×) | | **3**: 40 padrão (`h-10`), **48 em ação primária mobile**, 32 só em ação secundária de tabela desktop |
| **padding de card** | `CardContent`: `p-3` 5, `p-4` 20, `p-5` 18, `p-6` 9, `p-8` 5, `p-0` 9 | | **2**: `p-4` mobile / `p-5` desktop (`p-4 sm:p-5`) |
| **gap** | 11 valores; `gap-2` 252, `gap-3` 155, `gap-1` 138, `gap-1.5` 87 | | 4: `1.5` (ícone+texto), `2` (inline), `3` (grupo), `4/6` (seção) |

Observação: `--radius: 0.5rem` (index.css:46) faz `rounded-lg`=8, `md`=6, `sm`=4. O app vive em `xl`/`2xl`/`full` — o token `--radius` do shadcn não governa nada do que se vê.

---

## 3. `index.css` com 102 KB: é legítimo, mas 40% é "arbitrário"

O `src/index.css` tem **3.162 bytes** (115 linhas). Os 102.120 B (16.901 B gzip) são o **`dist/assets/index-Bjwd3gzD.css` gerado pelo Tailwind JIT** e minificado pelo lightningcss (`vite.config.js:19`). Composição medida (`css_analysis.py`):

| bloco | bytes | % | regras |
|---|---:|---:|---:|
| **regras com hex arbitrário no seletor** (`.text-\[\#4a3d3d\]`, `.bg-\[\#b91c1c\]\/10`…) | **22.769** | **22%** | 290 (155 delas são variantes de opacidade `/5`, `/10`, `/20`…; 65 hex distintos) |
| todas as regras com valor arbitrário `[...]` (inclui as de hex) | 41.141 | 40% | 482 |
| `.hover\:*` | 9.104 | 9% | 97 |
| preflight + `:root` + base | 6.824 | 7% | 57 |
| `@media` (só 3 blocos: `sm`, `md`, `lg`) | 6.149 | 6% | 3 |
| `.data-[state=*]` (Radix) | 6.600 | 6% | 54 |
| keyframes + animate (tailwindcss-animate) | 1.583 | 2% | 11 |
| `.dark` | **0** | — | purgado (classe não aparece no `content`) |
| `@font-face` / `data:` URIs | 0 | — | fontes vêm do Google Fonts (`index.html:24-27`) |

Veredito:

- **Não é Tailwind "não podado"**: `content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"]` (tailwind.config.js:4) está correto; o CSS tem 1.205 classes distintas para ~35k LOC de JSX, todas usadas. Não há CSS morto de biblioteca (nenhum framework CSS além do Tailwind; `App.css` está vazio e não é importado).
- **Não é um alvo de performance**: 17 KB gzip é a mesma ordem de grandeza do que qualquer app Tailwind desse tamanho gera. Tokenizar (§1) colapsaria as 290 regras de hex em ~40 (uma por token × opacidades que sobrarem) — ganho estimado **~15–18 KB bruto / ~2–3 KB gzip**. Vale pela manutenção, não pelo carregamento.
- **O que o número denuncia é o §1**: cada hex + opacidade em `className` é uma regra nova. `#291715` sozinho gera `border-[#291715]/5`, `/10`, `/20`… e `#4a3d3d` gera `text-[#4a3d3d]`, `/70`, `/60`, `bg-[#4a3d3d]`, `bg-[#4a3d3d]/10`, `border-[#4a3d3d]/20`. Com token, `text-ink-2/70` continua sendo 1 regra — mas deixa de existir a versão `#444`, `#525252`, `#3d4a42` ao lado.
- Ponto morto real, mas em **fonte** (não no bundle): `.dark {}` (index.css:56-89, 34 linhas) nunca é ativado (0 ocorrências de `dark` no build; nenhum `classList.add('dark')`), `--chart-1..5` (0 usos), `keyframes accordion-*` (tailwind.config.js:64-85; Accordion foi removido em 02/07).

---

## 4. shadcn parcial: onde a tela refaz o que `ui/` já faz — e diverge

### 4.1 Uso real dos 21 componentes

| componente | arquivos que importam | contraparte "à mão" | divergência |
|---|---:|---|---|
| `button` | 36 | **148 `<button>` crus** (FranchiseDrawer 13, SaleForm 10, FranchiseSettings 8, Marketing 7, AsaasSetupPanel 7…), 8 deles com `bg-[#b91c1c]` = botão primário reimplementado | variant default = `rounded-md h-9 font-medium shadow bg-primary`; o app quer `rounded-xl font-bold` → 53 overrides de raio, 55 de cor, 28 de peso, 26 de altura |
| `card` | 21 | **62 cards à mão** (`bg-white border border-[#291715]/5 rounded-2xl shadow-sm`) | default `rounded-xl border bg-card shadow` → 44/58 sobrescrevem borda, 43 sombra, 33 raio, 27 repetem `bg-white`. **Só 2 `<Card>` usam o default puro** |
| `badge` | 11 | 13 pills à mão | default `rounded-md text-xs font-semibold` → 15/26 `rounded-full`, 16/26 `text-[10px]`/`[11px]`, 13 `bg-*` custom. O badge do app é outro componente |
| `skeleton` | 11 | skeleton à mão em `MyContacts.jsx:409-428` e `Financeiro.jsx:276-292` (`bg-[#e9e8e9] animate-pulse`) e `Franchises.jsx:742-744` (`<Card className="animate-pulse">`) | `<Skeleton>` é `bg-primary/10` (vermelho 10%) — os à mão são cinza. Dois skeletons diferentes no mesmo app |
| `input` | 18 | 41 `<input>` crus (17 em `FranchiseSettings.jsx`) | `<Input>` tem `text-base md:text-sm` (evita zoom iOS) — os crus têm `text-sm` (1 caso confirmado com fonte <16 px) |
| `select` | 12 | 9 `<select>` crus (DeliveryScheduleEditor 3, QuickAddCard 2, FranchiseSelector, CsCard, Financeiro, FranchiseSettings) | `FranchiseSelector.jsx:41` e `Financeiro.jsx:355`: `outline-none` **sem** `focus:ring` → foco invisível |
| `textarea` | 4 | 7 crus | |
| `dialog` | 15 | 3 overlays à mão: `FranchiseForm.jsx:147-152` (modo create), `FranchiseSettings.jsx:1268-1272` (descartar alterações), `Layout.jsx:493` (menu do avatar) | os à mão não têm foco preso, `Esc`, `aria-modal`, nem as classes `min-w-0 [&>*]:min-w-0 max-w-[calc(100vw-1rem)]` que o CLAUDE.md manda manter — o de `FranchiseSettings` é o único dialog do app que pode estourar 430 px por não herdar isso (`max-w-sm mx-4` protege na prática; `⚠️ NÃO VERIFICADO` em device) |
| `sheet` | 5 | — | ok |
| `tabs` | 2 (Gestao, Marketing) | grupos de pill à mão em TabLancar:531-580 e FranchiseeDashboard:432-490 | é o padrão "filtro híbrido" documentado — ok, mas é o terceiro visual de tab |
| `table` | 3 | 2 `<table>` cruas: `AsaasSetupPanel.jsx:627-637` (7 colunas, só `overflow-x-auto`), `NetworkFunnelPanel.jsx:98` (`min-w-[640px]`) | admin/desktop — aceitável |
| `alert-dialog` 3 · `label` 13 · `checkbox` 3 · `switch` 1 · `separator` 1 · `collapsible` 2 · `tooltip` 2 | | | ok |
| `sidebar` (21 KB) | 1 (Layout) | | usa 12 dos ~25 exports; o resto é peso morto em fonte (não no bundle, tree-shake) |
| `MaterialIcon` | 77 | `lucide-react` só dentro de `ui/` (dialog/sheet `X`, select `Check/ChevronDown/ChevronUp`) | regra "só MaterialIcon" cumprida no app; o `X` de fechar dialog é o único ícone de outra família na tela |

### 4.2 O achado

**Título:** os defaults de `ui/*.jsx` são o oposto do padrão visual do app; por isso 43% dos botões e 52% dos cards não usam o componente.
**Evidência:** contagens acima (`overrides.py`); `ui/button.jsx:7-31`, `ui/card.jsx:8`, `ui/badge.jsx:7`.
**Quem sofre:** os dois — cada tela nova reinventa card/botão e sai diferente da anterior (raio 8 vs 12 vs 16, sombra `sm` vs default, `#291715/5` vs `#cac0c0` vs `slate-200` na borda: 40/10/2 cards à mão respectivamente).
**Impacto:** o "parece uma coisa só?" da missão responde-se aqui: não, e o custo é em cada PR (o CLAUDE.md já carrega 3 gotchas de dialog/tailwind-merge que nasceram disso).
**Correção:** (1) `ui/card.jsx`: default → `rounded-2xl border border-surface-line bg-white shadow-sm`; `CardContent` → `p-4 sm:p-5`. (2) `ui/button.jsx`: default → `rounded-xl font-bold`, `size.default` → `h-10`, adicionar `size="touch"` = `h-12 min-w-[48px]`; `variant.default` → `bg-brand hover:bg-brand-dark active:bg-brand-dark`. (3) `ui/badge.jsx`: default → `rounded-full px-2 py-0.5 text-[11px] font-bold`, variants `ok/warn/err/neutral` com os pares `*.soft`. (4) Só depois, trocar os 62 cards à mão por `<Card>` e os 8 `<button bg-[#b91c1c]>` por `<Button>` — cada troca **adiciona um import** → rodar a varredura `\b(Card|Button)\b` × `import` do CLAUDE.md antes do build (regra 7).
**Esforço:** (1)-(3) P; (4) M.
**Risco de regressão:** os ~2 `<Card>` e ~75 `<Button>` sem `className` mudam de aparência (para o padrão que o resto já tem). Verificar: screenshot Playwright das 6 telas do franqueado + Financeiro/Franchises antes/depois; `npm run build` + `.tmp/verify-content.mjs`.

---

## 5. Matriz tela × estado

Legenda: ✅ existe · ⚠️ existe mas diverge do padrão (spinner, à mão, fora de paleta) · ❌ não existe · — não se aplica. "Sem permissão" = estado **visual**; toast conta como ⚠️.

| tela / componente | loading | vazio | erro (com retry) | sem permissão | evidência |
|---|---|---|---|---|---|
| **FranchiseeDashboard** | ✅ `<Skeleton>` ×9 (370-383) | **❌** (0 strings; StatsCard mostra R$ 0, `MiniRevenueChart` desenha 7 dias zerados, `DailyGoalProgress` some) | ✅ `loadError` + Tentar novamente | — (rota) | `FranchiseeDashboard.jsx`, `StatsCard.jsx:5-27` |
| Vendas → TabLancar | ✅ Skeleton na página (Vendas.jsx:159-168) | ✅ "Nenhuma venda registrada" (TabLancar:706) | ✅ Vendas.jsx:79 + retry | ⚠️ toast | |
| Gestão → TabEstoque | ✅ Skeleton na página (Gestao.jsx:190-193) | ✅ 709-713 (com variante "filtros aplicados") | ✅ Gestao.jsx:121 + retry | ⚠️ toast (378, 410) | |
| Gestão → TabReposicao | ✅ herda | ✅ "Nenhum pedido anterior" (263) | ❌ próprio (herda o da página) | — | |
| Gestão → **TabResultado** | **⚠️ spinner** 32 px (1022-1025) | ✅ "Sem vendas neste mês." (318), "Nenhuma despesa" (399, 1097) | **❌** (0 UI; 3 `toast.error`) | — | carrega o histórico inteiro — é a tela que mais demora e a única do franqueado com spinner |
| MyContacts | ⚠️ skeleton à mão cinza (409-428) | ✅ 672 | ✅ 430 + retry | ⚠️ toast | |
| Marketing / MarketingPaymentSection | ✅ 1 Skeleton + 2 spinners (envio) | ✅ 4 | ✅ 2 | — | |
| FranchiseSettings (wizard) | ✅ 5 Skeleton + 5 spinners (save) | ✅ 6 | ⚠️ 1 | — | |
| Onboarding | **⚠️ ícone pulsando + "Carregando onboarding…"** (508-516) | ✅ "Nenhuma franquia associada" (538) | ✅ 519 + retry | ⚠️ toast 330 | |
| MyChecklist | **⚠️ ícone `text-red-500` + `text-slate-600`** (256-264, fora de paleta) | ✅ 292 | ✅ 267 + retry | — | |
| Tutoriais | — estático | — | — | — | |
| FinancialObligationsCard | ❌ (`subLoading` é lido em :19 e nunca renderizado; `return null` em :53 enquanto carrega → o card **some e reaparece**) | — | ❌ | — | `⚠️ NÃO VERIFICADO` em runtime o "pulo" de layout |
| ConversionDetailSheet | ❌ benchmark carrega sem estado (25-30, aparece em 143) | — | ❌ | — | |
| **AdminDashboard** | ✅ 12 Skeleton | ✅ por card (BotSummary, FinanceiroSummary, Alerts, Ranking, NetworkFunnel, LastPurchaseOrder: 1 cada) | ✅ 12 + 4 retry | — | |
| Franchises | ⚠️ `<Card className="animate-pulse">` (742-744) | ✅ 889 | ✅ 4 | ⚠️ toast | |
| PurchaseOrders | ✅ 7 Skeleton | ✅ 2 | ✅ 3 + retry | — | |
| Financeiro | ⚠️ skeleton à mão cinza (276-292) | ❌ na página (FranchiseFinanceTable tem 1) | ✅ 294 | — | |
| AsaasSetupPanel | ✅ 3 Skeleton + 8 spinners (ações) | ✅ 3 | **❌** (15 `toast.error`, 0 UI) | — | |
| CustomerSuccess / CsBoard / Radar | ✅ 2 Skeleton | ✅ 1 + 1 | ✅ 5 + 2 retry | ✅ `CsRoute` | |
| NotificationBell | — | ✅ | ⚠️ toast | — | |

**Não existe componente `EmptyState` nem `ErrorState` compartilhado** (`components/shared/` tem só ExportButtons, FilterBar, FranchisePicker, FranchiseSelector, SubscriptionPaymentSheet, SubscriptionPaywall). Cada tela escreve o seu — daí 3 estilos de loading (Skeleton vermelho-10%, pulse cinza, ícone pulsando) e 2 paletas no erro.

### Achado 5a — Dashboard do franqueado sem estado vazio

**Evidência:** `FranchiseeDashboard.jsx` 0 strings de vazio; `StatsCard.jsx:5-27` renderiza qualquer valor (R$ 0,00 com `percentageChange=null`); Clarity: `/Dashboard` Mobile **QuickbackClick 75,2%**, tempo ativo 11%.
**Quem sofre:** franqueado, sobretudo nos primeiros dias do mês e na primeira semana de operação.
**Impacto:** 4 cards "R$ 0,00", gráfico de 7 dias vazio, sem instrução — a tela inicial não diz o que fazer. Não dá para afirmar que é a causa única do quickback (a frente 04 cruza com o fluxo), mas é o único estado da home que hoje não fala com o usuário.
**Correção:** um `EmptyState` compartilhado (`components/shared/EmptyState.jsx`: ícone Material 48 px `text-ink-4`, título `text-base font-bold text-ink`, texto `text-sm text-ink-2`, ação opcional `<Button size="touch">`). No dashboard: se `sales.length === 0` no período → substituir o grid de StatsCards por "Nenhuma venda em {mês} ainda — lance a primeira" com botão para `/Vendas`. Reusar em TabResultado, Financeiro, ConversionDetailSheet.
**Esforço:** P (componente) + P (dashboard).
**Risco:** baixo — adiciona 1 import por tela (varredura `\bEmptyState\b` × import antes do build).

### Achado 5b — TabResultado: spinner e sem erro na tela mais pesada

**Evidência:** `TabResultado.jsx:1022-1025` (spinner 32 px), 0 UI de erro, 4× `fetchAll` do histórico inteiro (contexto §"Padrões de dados").
**Quem sofre:** franqueado (Gestão Mobile 191 sessões, quickback 25,7%).
**Impacto:** é a única tela do franqueado que mostra spinner (as outras Skeleton) e, se uma das 4 queries falhar, fica em branco silencioso com um toast que some.
**Correção:** trocar o spinner pelo mesmo bloco de `<Skeleton>` do `FranchiseeDashboard.jsx:370-383` (KPIs + card); `catch` → `setLoadError` + bloco "Não foi possível carregar o resultado" com botão Tentar novamente (copiar de `MyContacts.jsx:430-437`).
**Esforço:** P. **Risco:** nenhum funcional; verificar que `loading=false` continua sendo setado no `finally` (830).

### Achado 5c — Três loadings diferentes

**Evidência:** `Onboarding.jsx:508-516`, `MyChecklist.jsx:256-264` (usa `text-red-500`/`text-slate-600` — cores de fora da paleta), `MyContacts.jsx:409-428` e `Financeiro.jsx:276-292` (`bg-[#e9e8e9]` vs `<Skeleton>` = `bg-primary/10`).
**Correção:** `Skeleton` em todos; mudar `ui/skeleton.jsx` de `bg-primary/10` (vermelho lavado) para `bg-surface-line` (cinza — o que 3 telas já fazem à mão) para o skeleton parar de "piscar vermelho".
**Esforço:** P. **Risco:** zero funcional.

---

## 6. Responsividade (≈50% celular)

### Achado 6a — Alvos de toque no caminho diário abaixo de 48 px

**Evidência:**
- **Bottom nav** (`Layout.jsx:548-563`): cada `<Link>` é `flex flex-col items-center gap-1` com ícone 20 px + `text-xs` — sem `min-h`, sem `flex-1`, sem `py`. Área clicável ≈ 40 px de altura × largura do rótulo, dentro de uma `nav` de 64 px. O FAB (533-541) tem `w-12 h-12` = 48 px ✅.
- **Ações da venda** (`TabLancar.jsx:1000-1070`): Compartilhar / Imprimir / Editar / **Excluir** são `<Button variant="outline" size="sm">` = **`h-8` = 32 px**, e no celular o rótulo some (`hidden sm:inline`) → 4 botões só-ícone de 32 px, `gap-1.5` (6 px), em cada linha da lista de vendas.
- **Card de estoque mobile** (`TabEstoque.jsx:762-786`, dentro do bloco `md:hidden` que começa em 729): editar / ocultar / excluir são `<Button size="icon" className="h-7 w-7">` = **28 px**, ícone 14 px, `gap-1` (4 px). A versão desktop (1129-1149) usa 32 px.
- Avatar do header mobile (`Layout.jsx:486-488`): `w-9 h-9` = 36 px.
- Já certos e servem de modelo: chip de confirmação `min-h-[40px]` (TabLancar:799), grid de pagamento `p-3 min-h-[48px]` (SaleForm:1183), pill-tabs `min-h-[40px]` (TabLancar:541, FranchiseeDashboard:443), `SidebarTrigger` `min-h/w-[40px]` (Layout:470).
**Quem sofre:** franqueado no celular (`/Vendas` M 296 sessões, `/Gestao` M 191, `/` M 211 — os 3 maiores volumes do app).
**Impacto:** toque errado entre "editar" e "excluir" (o delete abre confirmação, então não destrói, mas custa 2 toques + susto); o bottom nav — o controle mais tocado do app — tem metade da altura útil disponível. O CLAUDE.md já registra o gotcha "tap target mínimo 48px" (aplicado só no SaleForm).
**Correção:** (1) `Layout.jsx:551-553`: `className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] py-1"`. (2) `TabLancar.jsx` 4 botões: `size="touch"` (novo, §4.2) ou `className="h-10 min-w-[44px]"`, e trocar `hidden sm:inline` por `sr-only sm:not-sr-only` (ver §7). (3) `TabEstoque.jsx:762-786`: `h-10 w-10` e `gap-2`; ícone 18. Alternativa melhor para o card mobile: 1 botão "⋮" que abre `Sheet` com as 3 ações (uma tela, um alvo).
**Esforço:** P (1 e 2), P (3 simples) / M (3 com Sheet).
**Risco:** a linha da venda cresce ~8 px; conferir em 430 px que os 4 botões + chip ainda cabem numa linha (hoje `flex-wrap gap-1.5`, então quebram sozinhos). Verificar por screenshot Playwright 430×932.

### Achado 6b — Tipografia de operação em 10–12 px (ver §2.1)

**Evidência:** `TabEstoque.jsx` mobile: 14 `text-[10px]` (badges de status 496-634) + 19 `text-xs`; `TabResultado.jsx:257-269` DRE em `text-[11px]`; `TabLancar.jsx` 14 `text-xs` + 3 `[10px]`; `PurchaseOrderForm.jsx:480/494` labels 10 px.
**Quem sofre:** franqueado (a persona lê "no meio do atendimento", muitas vezes com o cliente esperando).
**Correção:** aplicar a regra do §2.1 nas 5 telas de operação; badge mínimo 11 px com `font-bold` e fundo `*.soft`.
**Esforço:** M (é revisão linha a linha; ~120 ocorrências). **Risco:** reflow em cards apertados — screenshot 430 px por tela.

### Achado 6c — `hover:` sem `active:` nas telas de toque

**Evidência:** `TabLancar.jsx` hover 17 / active 0; `SaleForm.jsx` 14 / 0; `MyContacts.jsx` 13 / 0; `Marketing.jsx` 19 / 0; app inteiro 371 / 31. O CLAUDE.md manda "`active:` (NÃO `hover:`)" no inline-edit mobile.
**Impacto:** em touch o `hover:` só dispara depois do toque e **fica preso** (o botão parece "selecionado" até tocar em outro lugar); e não há feedback de pressionar.
**Correção:** onde há `hover:bg-X`, adicionar `active:bg-X` (ou `active:scale-[0.98]` no padrão dos cards clicáveis); em Tailwind 3 é possível ligar `hover` só a `@media (hover:hover)` com o plugin/`future.hoverOnlyWhenSupported: true` no `tailwind.config.js` — **1 linha, corrige as 371 de uma vez** (o hover deixa de grudar em touch).
**Esforço:** P. **Risco:** `hoverOnlyWhenSupported` muda o CSS gerado (`@media (hover:hover){...}`) — desktop igual; em tablet híbrido o hover some (desejável). Testar num Android + iPhone.

### Achado 6d — `viewport-fit=cover` sem `safe-area-inset` `⚠️ NÃO VERIFICADO em aparelho`

**Evidência:** `index.html:5` `viewport-fit=cover` + `:9` `apple-mobile-web-app-status-bar-style=black-translucent`; `grep env(safe-area` em `src/` = 0; bottom nav `fixed bottom-0 h-16` (Layout:526); header `sticky top-0` (Layout:468).
**Impacto se confirmado:** em iPhone com barra gestual, o bottom nav fica ~34 px encostado/atrás da barra home; se aberto como PWA (manifest existe, `index.html:14`), o header fica sob a barra de status.
**Correção:** `nav` → `pb-[env(safe-area-inset-bottom)]` e `h-16` → `min-h-16`; `main` `pb-20` (Layout:517) → `pb-[calc(5rem+env(safe-area-inset-bottom))]`; header → `pt-[env(safe-area-inset-top)]`.
**Esforço:** P. **Como verificar:** abrir `app.maximassas.tech` num iPhone (Safari e "Adicionar à Tela de Início") e olhar se o FAB/labels cortam.

### Achado 6e — Grades e larguras fixas (menor)

- `grid-cols-3` sem prefixo responsivo em 7 lugares: `SaleForm.jsx:1177` (grid de pagamento — com 6 métodos vira 2 linhas de 3 a ~125 px cada em 430 px; "Dinheiro"/"Crédito" cabem, `⚠️ NÃO VERIFICADO` "VR/Sodexo"), `LancarCompraSheet.jsx:149`, `Onboarding.jsx:565`, `FinanceiroSummaryCard.jsx:70`, `FranchiseFinanceTable.jsx:204` e `FranchiseFinanceDrilldown.jsx:124` (3 stats dentro do card mobile — intencional).
- `DialogContent className="max-w-2xl"` **sem `sm:`** em `Franchises.jsx:930` e `:1155` — o gotcha de tailwind-merge do CLAUDE.md (30/04) voltou: renderiza 512 px no desktop em vez de 672. `Tutoriais.jsx:376` `max-w-lg` = mesmo que o default, sem efeito. Admin/desktop, P.
- `NetworkFunnelPanel.jsx:98` `min-w-[640px]` com `overflow-x-auto` e `AsaasSetupPanel.jsx:627-637` tabela crua de 7 colunas só com scroll — admin; `/Financeiro` Mobile teve 9 sessões em 3 dias, não prioriza.
- Quem seguiu o padrão card-no-mobile: `TabEstoque` (729/937), `PurchaseOrderForm` (331/434), `PurchaseOrders` (923/1020), `FranchiseFinanceTable` (153/189), `MarketingPaymentsAdmin` (356 `hidden md:grid`). Quem não: `AsaasSetupPanel`, `NetworkFunnelPanel` — ambos admin.

---

## 7. Acessibilidade prática

### 7.1 Contraste (WCAG, calculado — `contrast.py`)

| par | ratio | AA texto 4,5 | AA UI/grande 3,0 | onde |
|---|---:|:-:|:-:|---|
| `#b91c1c` sobre branco / `#fbf9fa` / `#fef2f2` | 6,47 / 6,17 / 5,91 | ✅ | ✅ | primary está seguro em todos os fundos claros do app |
| branco sobre `#b91c1c` | 6,47 | ✅ | ✅ | botão primário |
| `#1b1c1d`, `#4a3d3d` sobre branco | 17,07 / 10,36 | ✅ | ✅ | |
| `#7a6d6d` sobre branco / `#fbf9fa` | 4,96 / 4,73 | ✅ (no limite) | ✅ | texto terciário |
| **`#8a7e7e` sobre branco** | **3,91** | **❌** | ✅ | 30 usos em 4 arquivos — texto auxiliar |
| **`#cac0c0` sobre branco** | **1,78** | ❌ | **❌** | 59 usos; **14 como `text-[#cac0c0]`** — inclui o ícone de excluir em `TabEstoque.jsx:782/1149` (ícone clicável a 1,78:1) |
| **`#16a34a` (green-600) sobre branco** | **3,30** | **❌** | ✅ | **61 usos como texto** em 23 arquivos: chip "Pagamento recebido" (TabLancar 8), DRE positivo (TabResultado 11); branco sobre `#16a34a` em botão (PurchaseOrders, TabLancar) também 3,30 |
| `#15803d` (green-700) sobre branco | 5,02 | ✅ | ✅ | já usado 8× — é o substituto |
| **`#d4af37` gold sobre branco** | **2,10** | ❌ | ❌ | **28 usos como texto**; botão dourado com `text-white` em `Franchises.jsx:672` (+2) e `Marketing.jsx` |
| `#775a19` sobre branco / amber-50 | 6,44 / 6,21 | ✅ | ✅ | já é o "gold-texto" do app (76×) — é o substituto |
| `#92400e` sobre `#fef3c7` | 6,37 | ✅ | ✅ | chip "pendente" — correto |
| `#f59e0b` amber-500 sobre branco | 2,15 | ❌ | ❌ | 5 usos (1 como texto) |
| `#6d7a72` sobre branco | 4,49 | ❌ (por 0,01) | ✅ | 6 usos |

Resumo: **o vermelho da marca está certo em todos os fundos**; o que reprova é o **verde de sucesso (61 textos)**, o **dourado como texto (28)**, `#8a7e7e` (30) e `#cac0c0` em ícone (14). Todos têm substituto que o app já usa (`#15803d`, `#775a19`, `#7a6d6d`, `#7a6d6d`) — é find/replace, e a tokenização do §1 fecha a porta (`ok.DEFAULT = #15803d`, `brand.gold` proibido em texto).

### 7.2 Foco visível

- 148 `<button>` crus, **148 sem nenhuma classe `focus*`** — mas o preflight do shadcn (`index.css:95-97`: `* { @apply outline-ring/50 }`) mantém o outline nativo em vermelho 50%: foco **visível**, só não é o anel do design. OK.
- `outline-none` sem `focus:ring`/`focus:border` substituto: **2** — `FranchiseSelector.jsx:41` (o seletor de unidade do franqueado com 2 lojas) e `Financeiro.jsx:355`. Foco invisível no teclado. P.
- `ui/*`: todos com `focus-visible:ring` ✅.

### 7.3 Nome acessível

- **`MaterialIcon.jsx` renderiza a ligadura como texto** (`<span class="material-symbols-outlined">edit</span>`) **sem `aria-hidden`** → leitor de tela lê "edit", "delete", "visibility_off", "progress_activity" — em 77 arquivos. Correção: `aria-hidden="true"` no `<span>` (1 linha; botões só-ícone precisam então de `aria-label`, que 7/11 já têm). P, zero risco visual.
- Botões só-ícone (`MaterialIcon` único filho): 11 no app; 4 sem `aria-label` (`Layout.jsx`, `CatalogUpload.jsx:225`, `Marketing.jsx`, `Onboarding.jsx`); 1 sem `aria-label` nem `title` (`CatalogUpload.jsx:225`).
- **`hidden sm:inline` (20×)** para esconder o rótulo no celular = `display:none` = **sai da árvore de acessibilidade**. No celular, os 4 botões da venda (TabLancar 1000-1070), "Novo Cliente"/"+ Venda" (MyContacts 477/801), "Fichas de Separação" (PurchaseOrders 888) ficam sem nome. Correção: `sr-only sm:not-sr-only` (mesma aparência, nome preservado). `sr-only` é usado hoje só 5×.

### 7.4 Texto abaixo de 14 px em tela de operação — ver §2.1 e §6b.

---

## 8. Impressão

### 8.1 Cupom térmico — `SaleReceipt.jsx` + `shareUtils.printReceipt`

Estado em 07/09 (último commit `aabf8e1` 31/08, telefone no cupom): **íntegro em relação às regras do CLAUDE.md**:

| regra documentada | onde está | ok? |
|---|---|---|
| `@page { size: auto; margin: 0 }` — nunca fixar 80 mm | `shareUtils.js:158` | ✅ (o comentário em :136 ainda diz "Uses @page { size: 80mm auto }" — **comentário desatualizado**, o código está certo) |
| nunca `width` em px | `shareUtils.js:144-146` força `100%` no clone; `SaleReceipt.jsx:71-72` `width:100%; maxWidth:400` (preview) e `:82-83` `100% !important` no print | ✅ |
| `Courier New` + `font-weight:700` + preto puro no print | `SaleReceipt.jsx:85-89` (`font-family`, `font-weight:700`, `font-size:11pt`, `color:#000`) + `:96-101` (`.receipt * { color:#000; background:transparent; border-color:#000 }`) | ✅ |
| `print-color-adjust: exact` | `SaleReceipt.jsx:92-93` e `shareUtils.js:161` | ✅ |

Fragilidades que **não** estão documentadas e valem registro:

1. **O `<style>` do print vive DENTRO do componente** (`SaleReceipt.jsx:79-108`) e só funciona porque `printReceipt` faz `cloneNode(true)` (shareUtils:141) e o `<style>` viaja junto para o iframe — o iframe **não tem o CSS do app**. Se alguém "limpar" movendo o bloco para `index.css`, o cupom passa a imprimir em Inter fina e cinza, sem erro nenhum.
2. **Os tamanhos de fonte inline dos filhos vencem o `11pt`** do container: `fontSize: 12` (5×), `13` (2), `14` (2), `11` (2), `10`, `16`, `20` são `style` inline em spans/divs; a regra `.receipt { font-size: 11pt !important }` só atinge o elemento `.receipt`. Não é bug (os px são adequados), mas o "11pt" é um fallback, não o tamanho real. Quem for mexer no tamanho de impressão tem de mexer nos inline, não no `<style>`.
3. `fontWeight: 600` inline (6×) no print cai em Courier New Bold (700) por casamento de peso ✅; `color: "#666"`/`"#444"` inline (7×) são anulados pelo `.receipt * { color:#000 !important }` ✅.
4. `printReceipt` **carrega Google Fonts no iframe e espera `fonts.ready` até 3 s** (shareUtils:151-153, 166) — mas o print força Courier New; a espera só atrasa o botão "Imprimir" em rede lenta. `⚠️ NÃO VERIFICADO` quanto ela custa na prática.
5. `shareUtils.js:50` e `:92` têm outro `@media print { @page { margin:10mm } }` (fluxo de imagem rasterizada). `printImage` **não é importado por ninguém** (só `generateReceiptImage`, `shareImage`, `printReceipt` em TabLancar:30) — provável código morto; `⚠️ NÃO VERIFICADO` se algum caminho dinâmico o usa.

**O que testar antes de mexer no cupom** (nesta ordem, barato → caro):
- `node .tmp/smoke-cupom-telefone.mjs` e com `--baseline` (renderiza o `SaleReceipt` em Node e compara com o do `git HEAD`). ⚠️ `.tmp/` é **gitignored** — o smoke existe só na máquina do Nelson; mover para `src/lib/__smoke__/` ou `scripts/` antes de qualquer refactor.
- `grep -nE "size: *80mm|width: *(58|80)mm|width: *[0-9]+px" src/lib/shareUtils.js src/components/minha-loja/SaleReceipt.jsx` → deve continuar 0 (fora do `maxWidth: 400` do preview).
- Confirmar que o `<style>` continua dentro do `return` de `SaleReceipt`.
- Impressão real numa 58 mm **e** numa 80 mm (regra do Nelson: sem config na franquia; "apagado" = driver/bobina, não CSS).

### 8.2 Ficha do motorista — `pickingSheetPdf.js`

Último commit `b1f2ee7` 26/08 (endereço/responsável, Leme e Itapevi). Regras próprias, sem CSS (é jsPDF + autoTable, `pickingSheetPdf.js:223`):

- Cores por tripla RGB: `185,28,28` = `#b91c1c` ✅ (título :88, régua :103, rótulo :150, endereço faltante :155, linha :269); cinzas `40/30/90/115/70/80/100` (7 tons distintos de cinza — mesma dispersão do app, mas em PDF isolado).
- **10 tamanhos de fonte** (`setFontSize`: 6.8, 7, 8, 8.5, 9, 10, 11, 12, 16, 18) — o rótulo "ENDERECO DE ENTREGA" e o de contato são **6,8 pt** (:149, :170); notas em 7 pt (:287, :297). Para papel A4 do motorista está no limite de legibilidade; qualquer redução quebra.
- Texto propositalmente **sem acento** ("FICHA DE SEPARACAO" :100, "ENDERECO NAO CADASTRADO" :131, "ENDERECO DE ENTREGA" :151) — fontes core do jsPDF (`helvetica`) e o guard de acento do CLAUDE.md global (imagem/PDF não passa pelo guard de texto). Não "corrigir" para acento sem embutir fonte TTF.
- Endereço resolvido na hora por `resolveDeliveryAddress` (não lê `unit_address` gravado); nunca sai em branco calado (:131 vermelho); `RECEBER COM: <owner>` (:163).

**O que testar antes de mexer:** `node src/lib/addressUtils.test.mjs` (12 casos com dado real das 66 unidades); `node .tmp/smoke-ficha-endereco.mjs` (renderiza e extrai texto com `fitz`; o `--baseline` contra `git show HEAD:` reproduz o defeito de 23/08 — é o controle positivo). Mesmo aviso: **está em `.tmp/`, gitignored**.

---

## 9. Mini design system em uma página

> Cabe no que existe: `tailwind.config.js` (extend) + 4 arquivos de `ui/`. Sem rebrand — os valores são os que já dominam o código.

### Tokens (`tailwind.config.js → theme.extend.colors`)
```
brand        #b91c1c   ação primária, link, ícone ativo, borda de foco     hover/active → brand-dark #991b1b
brand-gold   #d4af37   SÓ fundo/borda/ícone decorativo (2,10:1 como texto)
brand-gold-ink #775a19 gold como TEXTO e ícone com significado
ink          #1b1c1d   texto principal, valor, título
ink-2        #4a3d3d   texto secundário, ícone padrão
ink-3        #7a6d6d   caption, metadado (4,96:1 — não ir mais claro)
ink-4        #cac0c0   placeholder, desabilitado, divisor — NUNCA ícone clicável
surface      #fbf9fa   fundo da página        surface-card #ffffff    surface-2 #f5f3f0 (display read-only)
surface-line #e9e8e9   borda de card/input, skeleton
ok  #15803d / ok-soft   #f0fdf4      warn #92400e / warn-soft #fef3c7      err #dc2626 / err-soft #fef2f2
```
Fundos de destaque: `brand/10`, `*-soft`. Texto sobre `*-soft`: sempre o `DEFAULT` da mesma família.

### Escala
```
fonte   11 (badge)  12 (caption)  14 (corpo operação)  16 (input/destaque)  18 (título card)  24 (título tela)  30 (KPI)  48 (display)
peso    500 label · 600 ênfase · 700 título/valor      heading = font-plus-jakarta font-bold
raio    md 6 (input/select)  xl 12 (botão, chip, card compacto)  2xl 16 (card, sheet, dialog)  full (pill, avatar, FAB)
sombra  sm (card)  md (hover/elevado)  lg (overlay)
espaço  gap 1.5 (ícone+texto)  2 (inline)  3 (grupo)  4/6 (seção)     card p-4 sm:p-5     página p-4 md:p-8
toque   40 px mínimo em qualquer controle · 48 px em ação primária mobile e no bottom nav · ícone 18–20 em botão só-ícone
```

### Componentes canônicos (o que muda em `ui/`)
```
Button   default: rounded-xl font-bold h-10 bg-brand text-white hover:bg-brand-dark active:bg-brand-dark
         size touch: h-12 min-w-[48px]   size sm (desktop only): h-8   icon: h-10 w-10
         variants: outline (border-surface-line text-ink-2 hover:bg-surface)  ghost  gold (bg-brand-gold text-ink)  danger (err)
Card     rounded-2xl border border-surface-line bg-white shadow-sm    CardContent p-4 sm:p-5
Badge    rounded-full px-2 py-0.5 text-[11px] font-bold   variants ok/warn/err/neutral/brand = (*-soft fundo, * texto)
Skeleton bg-surface-line rounded-xl
Input    (já certo) text-base md:text-sm h-10 rounded-md — usar sempre <Input>, nunca <input> cru (zoom iOS)
EmptyState (novo, shared/) ícone 48 ink-4 · título text-base font-bold ink · texto text-sm ink-2 · ação Button size touch
ErrorState (novo, shared/) = EmptyState com ícone cloud_off, texto de safeErrorMessage e botão "Tentar novamente"
Dialog / Sheet  como estão (manter min-w-0 [&>*]:min-w-0 max-w-[calc(100vw-1rem)]; largura desktop só com sm:max-w-*)
Lista densa     desktop: <Table>   mobile (<md): card com 1 linha de dado principal 14px + ações em Sheet "⋮"
MaterialIcon    aria-hidden="true"; botão só-ícone exige aria-label; rótulo escondido no mobile = sr-only sm:not-sr-only
```

### Regras de uso (as 6 que evitam a próxima auditoria)
1. Nenhum `#hex` novo em `className` — só tokens (lint: `no-restricted-syntax` para `/\[#[0-9a-f]{3,6}\]/` em `className`).
2. Texto só de `ink-*`, `brand`, `brand-gold-ink`, `ok/warn/err`.
3. Dado em tela de operação ≥ 14 px; badge 11 px com fundo `*-soft`.
4. Todo componente de dado renderiza `Skeleton` → `EmptyState`/dados → `ErrorState`. Toast não substitui estado.
5. Controle tocável ≥ 40 px; ação primária mobile 48 px; `active:` sempre que houver `hover:`.
6. Rótulo escondido no mobile: `sr-only sm:not-sr-only`, nunca `hidden sm:inline`.

---

## 10. Ordem de execução sem big bang (e sem tela branca)

| passo | o quê | mexe em | risco | verificação |
|---|---|---|---|---|
| 1 (P) | tokens no `tailwind.config.js`; `aria-hidden` no MaterialIcon; `hoverOnlyWhenSupported`; `Skeleton` → `bg-surface-line` | 3 arquivos | zero visual (tokens) / hover em touch (desejado) | build + `verify-content` |
| 2 (P) | tap targets: bottom nav `min-h-[48px] flex-1`, TabLancar 4 botões `h-10`, TabEstoque mobile `h-10 w-10`; `hidden sm:inline` → `sr-only sm:not-sr-only` (20×) | Layout, TabLancar, TabEstoque, MyContacts, PurchaseOrders | reflow em 430 px | screenshot Playwright 430×932 por tela |
| 3 (P) | contraste: `text-[#16a34a]` → `text-ok` (61), `text-[#d4af37]` → `text-brand-gold-ink` (28), `text-[#8a7e7e]` → `text-ink-3` (30), `text-[#cac0c0]` em ícone → `text-ink-3` (14); `outline-none` em 2 selects → `focus:ring-2 focus:ring-brand` | ~30 arquivos, só strings | visual mínimo (verde e dourado ficam mais escuros) | contrast.py + screenshots |
| 4 (P) | `EmptyState`/`ErrorState` em `shared/`; aplicar em FranchiseeDashboard (vazio), TabResultado (skeleton + erro), Onboarding/MyChecklist/MyContacts/Financeiro (skeleton) | 7 arquivos, **+1 import cada** | `no-undef` → varredura `\b(EmptyState\|ErrorState\|Skeleton)\b` × `import` antes do build | build + smoke runtime |
| 5 (M) | codemod hex → token, 5 maiores arquivos primeiro | strings em className | zero por construção | `grep -c '#4a3d3d' dist/assets/*.css` cai; diff do CSS só renomeia seletor |
| 6 (P→M) | defaults de `ui/button|card|badge` = padrão real; depois cards à mão → `<Card>`, `<button>` cru primário → `<Button>` | `ui/` + call-sites | os poucos que usavam o default antigo | screenshots das 8 telas principais |
| 7 (M) | tipografia de operação ≥ 14 px nas 5 telas do franqueado | TabLancar, TabEstoque, TabResultado, MyContacts, PurchaseOrderForm | reflow | screenshot 430 px |
| 8 (P, `⚠️`) | safe-area no nav/header | Layout | nenhum | iPhone real |

Nada disso toca `entities/`, `financialCalcs` ou RLS; a única porta de tela branca é o passo 4/6 (import novo) — coberta pela varredura do CLAUDE.md.

---

## Apêndice — como foi medido

Scripts no scratchpad da sessão (`css_analysis.py`, `hex_cluster.py`, `contrast.py`, `jsx_audit.py`, `overrides.py`, `state_matrix.py`); comandos reproduzíveis:

```bash
# hex por valor / por arquivo
grep -rohE "#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b" src/ --include=*.jsx --include=*.js | tr A-F a-f | sort | uniq -c | sort -rn
grep -rocE "#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b" src/ --include=*.jsx | awk -F: '$2>0' | sort -t: -k2 -rn
# tamanhos de fonte / raios / sombras
grep -rohE "\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|\[[0-9.]+px\])\b" src/ --include=*.jsx | sort | uniq -c | sort -rn
grep -rohE "\brounded(-[a-z]+)?(-(sm|md|lg|xl|2xl|3xl|full|none))?\b" src/ --include=*.jsx | sort | uniq -c | sort -rn
# tokens semânticos shadcn fora de ui/ (esperado 0 hoje)
grep -roE "(^|[\"' ])(bg-primary|text-muted-foreground|border-border|bg-card)\b" src/ --include=*.jsx | grep -v components/ui | wc -l
# CSS buildado: regras com hex arbitrário
python3 css_analysis.py dist/assets/index-*.css
# estados por tela
python3 state_matrix.py .
```
