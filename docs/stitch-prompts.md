# Prompts para Google Stitch — FranchiseFlow Maxi Massas

## Design System Base

**Configurar no Stitch ANTES de gerar:**
- Model: Thinking with 3.1 Pro
- Device: Desktop (1280px)
- Font: Inter ou Plus Jakarta Sans
- Color Mode: Light
- Custom Color: #059669 (emerald-600)
- Roundness: Round (rounded-xl, not full)
- Spacing: 2

---

## Tela 1: LOGIN

```
Design a login page for "Maxi Massas", a franchise management dashboard for artisanal frozen pasta brand.

Layout: Centered card on a subtle warm background.

Left side (60%): Large hero area with:
- Soft gradient background from emerald-50 (#ecfdf5) to white
- Large illustration or pattern of artisanal pasta shapes (abstract, geometric, not photo)
- Brand tagline: "Gestão inteligente para sua franquia de massas artesanais"
- 3 small floating stat cards showing example metrics: "R$ 4.850 faturamento", "32 vendas", "96% checklist"

Right side (40%): Clean white login form card with:
- Logo placeholder (circle 64px with pasta icon)
- Title "Maxi Massas" in emerald-700 (#047857), font-bold text-2xl
- Subtitle "Acesse sua franquia" in gray-500 text-sm
- Email input with label "E-mail" and placeholder "seu@email.com"
- Password input with label "Senha" and eye toggle icon
- "Esqueci minha senha" link in emerald-600, text-sm, right-aligned
- Primary button "Entrar" full-width, bg emerald-600, text white, rounded-xl, h-12
- Divider with "ou"
- Google OAuth button, outline style with Google icon

Colors: Primary emerald-600 (#059669), background white, text slate-800, accents emerald-50.
Typography: Inter or Plus Jakarta Sans. Headings semibold. Body regular.
No emojis. No gradients on buttons. Clean, premium, trustworthy.
Mobile: Stack vertically, hide left hero section on mobile (show only form card).
```

---

## Tela 2: DASHBOARD DO FRANQUEADO (Minha Loja)

```
Design a franchisee personal dashboard called "Minha Loja" for "Maxi Massas", a frozen pasta franchise management app.

This is the daily view for a single franchise owner. It must feel motivational and action-oriented, not analytical.

Header section:
- Greeting: "Bom dia, Maria!" in text-2xl font-bold slate-800
- Subtitle: "Unidade São João" in text-sm text-gray-500
- Small avatar circle (40px) on the right

Stats row (2 cards side by side):
- Card 1: "Vendas Hoje" showing "5" large bold + "+25% vs ontem" in emerald-500 small text + small up arrow icon
- Card 2: "Faturamento" showing "R$ 285" large bold + "+12%" in emerald-500

Daily Goal section (prominent, full width):
- Label "META DO DIA" in text-xs uppercase tracking-wide text-gray-400
- Progress bar: thick (h-3), rounded-full, emerald-500 fill on gray-100 track, showing 65%
- Below bar: "R$ 285 de R$ 440" on left, "Faltam R$ 155!" on right in font-medium
- Card background: white with subtle emerald-50 left border (border-l-4)

Quick Access cards (2 cards side by side):
- Card "Estoque": icon Package in amber-500, "2 itens baixos" with amber dot indicator, "Ver estoque" link
- Card "Checklist": icon CheckSquare in emerald-500, circular progress showing "8/10", "Abrir checklist" link
- Both cards: white bg, rounded-xl, subtle shadow-sm, hover:shadow-md transition

Mini Revenue Chart (full width):
- Small bar chart showing last 7 days revenue
- Bars in emerald-400, today's bar highlighted in emerald-600
- X-axis: "Seg Ter Qua Qui Sex Sab Dom" abbreviated days
- Y-axis: currency values
- Title: "Faturamento 7 dias" text-sm text-gray-500

Ranking & Streak row (2 items):
- Left: Trophy icon in amber-500 + "3o de 12 franquias" text-sm font-medium
- Right: Flame icon in orange-500 + "7 dias batendo meta" text-sm font-medium
- Background: subtle gray-50 rounded-xl card

Fixed bottom CTA:
- Large button "REGISTRAR VENDA" full-width, bg emerald-600, text white, rounded-xl, h-14, shadow-lg
- Plus icon on the left of text

Overall layout: Single column, max-w-lg centered (mobile-first).
Colors: Emerald-600 primary, amber-500 warnings, gray-50/100 backgrounds.
No emojis. Use Lucide-style line icons only. Clean spacing (gap-4 between sections).
Feels like a personal coach dashboard, not a corporate analytics tool.
```

---

## Tela 3: DASHBOARD DO ADMIN (Painel Geral)

```
Design an admin overview dashboard called "Painel Geral" for "Maxi Massas", a frozen pasta franchise management app with 12 franchise locations.

This is the central command view for the franchise administrator. Must feel professional and data-rich but scannable.

Top bar:
- Title "Painel Geral" text-2xl font-bold slate-800
- Subtitle "Maxi Massas" text-sm text-gray-400
- Right side: 3 toggle buttons "Hoje | 7 dias | 30 dias" with active state bg-emerald-600 text-white, inactive bg-gray-100

Stats row (4 cards in a grid):
- Card 1: "Vendas" icon ShoppingBag, value "32", trend "+18%" green, small sparkline
- Card 2: "Faturamento" icon DollarSign, value "R$ 4.850", trend "+22%" green
- Card 3: "Contatos" icon MessageSquare, value "89", trend "-5%" red
- Card 4: "Conversao" icon TrendingUp, value "36%", trend "+3%" green
- Each card: white bg, rounded-xl, p-5, subtle border gray-100, icon in colored circle (emerald, blue, purple, teal)

Alerts section (full width):
- Header: "ATENÇÃO" with red dot badge showing "(3)"
- Alert items stacked vertically:
  1. Red left border: "São João — sem vendas há 2 dias" with AlertTriangle icon
  2. Amber left border: "Centro — 4 itens estoque crítico" with Package icon
  3. Amber left border: "Moema — checklist não feito hoje" with ClipboardList icon
- Each alert: white card, rounded-lg, border-l-4 (red-500 or amber-500), py-3 px-4

Franchise Ranking table (left 60%):
- Title "RANKING DO DIA" text-xs uppercase tracking-wide
- Sorted list with position, franchise name, revenue, horizontal bar:
  1. "Moema" R$ 890 — full green bar
  2. "Pinheiros" R$ 720 — 80% bar
  3. "Centro" R$ 650 — 73% bar
  4. "São João" R$ 340 — 38% bar
- Bars: emerald-400 on gray-100, rounded-full, h-2
- Text: font-medium for name, font-mono for value

Charts section (2 charts side by side):
- Left: "Faturamento 7 dias" — area chart with emerald gradient fill
- Right: "Contatos 7 dias" — area chart with blue gradient fill
- Both: clean axis labels, grid lines gray-100, rounded-xl card container

Layout: max-w-7xl, responsive grid (1 col mobile, 2-3 cols desktop).
Colors: Emerald primary, red/amber for alerts, gray-50 page background.
Typography: Inter. Data values in tabular-nums font-variant.
No emojis. Professional, scannable at a glance. Like Linear.app or Vercel dashboard.
```

---

## Tela 4: SIDEBAR / NAVEGAÇÃO

```
Design a sidebar navigation for "Maxi Massas" franchise management dashboard.

This sidebar has TWO variants shown side by side:

VARIANT A — Franchisee (6 items):
- Logo: "Maxi Massas" with small pasta icon, emerald-700 text
- Divider
- Menu items with icon + label:
  1. LayoutDashboard "Minha Loja" (active state: bg-emerald-50, text-emerald-700, font-medium)
  2. ShoppingCart "Vendas"
  3. Package "Estoque"
  4. Megaphone "Marketing"
  5. CheckSquare "Checklist"
  6. Settings "Meu Vendedor"
- Spacer (flex-1)
- User footer: Avatar circle (32px) + "Maria Silva" name + "São João" subtitle + LogOut icon

VARIANT B — Admin (12 items with sections):
- Logo: same as above
- Divider
- Section label "PRINCIPAL" text-[10px] uppercase tracking-widest text-gray-400 px-3
  1. LayoutDashboard "Painel Geral" (active)
  2. ShoppingCart "Vendas"
  3. Package "Estoque"
  4. BookOpen "Catálogo"
  5. CheckSquare "Checklist"
  6. Megaphone "Marketing"
- Section label "GESTÃO"
  7. BarChart3 "Relatórios"
  8. Settings "Configurações"
  9. GraduationCap "Onboarding"
  10. Eye "Acompanhamento"
- Section label "ADMINISTRAÇÃO"
  11. Users "Franqueados"
  12. UserCog "Usuários"
- Spacer
- User footer: Avatar + "Admin" + "Nelson" + LogOut icon

Sidebar style:
- Width: 260px fixed
- Background: white (not gray)
- Border-right: 1px border-gray-100
- Menu items: h-10, rounded-lg, px-3, gap-3 icon-to-text
- Hover state: bg-gray-50
- Active state: bg-emerald-50, text-emerald-700, font-medium (NO red backgrounds)
- Icons: 20px, stroke-width 1.5, gray-500 default, emerald-600 active
- Logo area: h-16, px-4, flex items-center
- Collapsed mobile: hamburger menu, sheet overlay from left

Clean, minimal, like Notion or Linear sidebar. NOT corporate. No heavy borders or shadows.
Inter font, text-sm for items, text-xs for section labels.
```

---

## Tela 5: MEU VENDEDOR (Config WhatsApp Bot)

```
Design a settings page called "Meu Vendedor" for configuring a WhatsApp AI sales bot for a frozen pasta franchise.

Header:
- Title "Meu Vendedor" text-2xl font-bold
- Subtitle "Configure o assistente de vendas automático da sua unidade" text-sm text-gray-500
- Right side: Status badge showing "Conectado" in green or "Desconectado" in red, with circle dot indicator

WhatsApp Connection card (top, full width):
- QR Code area (200x200) on the left OR "Conectado" status with phone number
- Right side: instance name, connection status, "Reconectar" button outline
- Card: white, rounded-xl, border border-gray-100

Tabs navigation:
- 3 tabs: "Dados da Unidade" | "Cardápio e Preços" | "Entrega"
- Active tab: border-b-2 border-emerald-600, text-emerald-700, font-medium
- Inactive: text-gray-500

Tab 1 — Dados da Unidade (shown):
Form with organized sections:

Section "Informações Básicas":
- "Nome da unidade" text input
- "Endereço completo" text input
- "Telefone" text input with phone mask

Section "Horários":
- "Horário de funcionamento" text input (ex: "Seg-Sex 9h-18h, Sab 9h-13h")
- "Dias de funcionamento" multi-select chips

Section "Pagamento e Entrega":
- "Formas de pagamento" multi-select chips (Pix, Cartão, Dinheiro, etc)
- "Raio máximo de entrega (km)" number input
- "Pedido mínimo (R$)" number input
- "Tempo médio de preparo" number input with "minutos" suffix

Section "Personalidade do Vendedor":
- "Tom de voz" select dropdown (Formal, Amigável, Descontraído)
- "Mensagem de boas-vindas" textarea 3 rows
- "Promoções ativas" textarea 2 rows

Bottom actions:
- "Salvar alterações" primary button bg-emerald-600
- "Otimizar com IA" secondary button outline with Sparkles icon

Layout: max-w-3xl centered, single column, gap-6 between sections.
Section titles: text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3.
Inputs: h-10, rounded-lg, border-gray-200, focus:ring-emerald-500.
Clean, organized, not overwhelming. Group related fields visually.
No emojis. Lucide icons only.
```

---

## Instruções para criar no Stitch

1. Abra **stitch.withgoogle.com**
2. Crie um novo projeto: **"FranchiseFlow Maxi Massas"**
3. Configurações do projeto:
   - Model: **Thinking with 3.1 Pro**
   - Device: **Desktop** (1280px)
   - Font: **Inter**
   - Color: **Light mode**, Custom color **#059669**
   - Roundness: **Round** (rounded-xl)
4. Crie **5 telas**, uma para cada prompt acima
5. Copie cada prompt EXATAMENTE como está
6. Após gerar, me envie o código HTML de cada tela

### Dicas
- Se o resultado ficar "genérico demais", adicione ao prompt: "Avoid generic AI aesthetic. Make it look like a premium SaaS product like Linear.app or Vercel."
- Se as cores não ficarem emerald, force: "Primary color MUST be emerald-600 (#059669). Do NOT use blue or purple."
- Para mobile, crie uma versão extra: adicione "Mobile viewport 375px width" ao prompt
