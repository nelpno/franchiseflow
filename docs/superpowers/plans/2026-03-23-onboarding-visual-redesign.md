# Onboarding Visual Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the onboarding from generic accordion/checkbox into mission cards with progress rings, themed icons, micro-celebrations, and contextual subtitles.

**Architecture:** Evolve existing OnboardingBlock.jsx with new visual layer. Create ProgressRing.jsx (pure SVG component). Update Onboarding.jsx header and celebration. Adjust GateBlock.jsx for visual consistency. No logic changes — same props interface, same state management.

**Tech Stack:** React 18, Tailwind CSS 3, Material Symbols (via MaterialIcon), CSS transitions/animations, SVG stroke-dasharray

**Spec:** `docs/superpowers/specs/2026-03-23-onboarding-visual-redesign.md`

---

## Chunk 1: Data + ProgressRing Component

### Task 1: Add `icon` field to ONBOARDING_BLOCKS.jsx

**Files:**
- Modify: `src/components/onboarding/ONBOARDING_BLOCKS.jsx`

- [ ] **Step 1: Add icon field to each block**

Add `icon` property to each block object in the BLOCKS array. The `color` field already exists — only add `icon`:

```jsx
// Block 1
{ id: 1, title: "Primeiros Passos", color: "#D32F2F", icon: "handshake", items: [...] }
// Block 2
{ id: 2, title: "Conheça Seus Produtos", color: "#C49A2A", icon: "restaurant", items: [...] }
// Block 3
{ id: 3, title: "Prepare Seu Espaço", color: "#0288D1", icon: "kitchen", items: [...] }
// Block 4
{ id: 4, title: "Configure o WhatsApp", color: "#43A047", icon: "chat", items: [...] }
// Block 5
{ id: 5, title: "Configure Seu Vendedor", color: "#F57C00", icon: "smart_toy", items: [...] }
// Block 6
{ id: 6, title: "Faça Seu Primeiro Pedido", color: "#5C6BC0", icon: "shopping_cart", items: [...] }
// Block 7
{ id: 7, title: "Treinamento", color: "#8E24AA", icon: "school", items: [...] }
// Block 8
{ id: 8, title: "Redes Sociais", color: "#E91E63", icon: "share", items: [...] }
```

Also add `icon` to GATE_BLOCK:
```jsx
export const GATE_BLOCK = { id: 9, title: "Gate de Liberação", icon: "verified", color: "#C49A2A", items: [...] };
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/ONBOARDING_BLOCKS.jsx
git commit -m "feat(onboarding): add icon field to mission blocks"
```

---

### Task 2: Create ProgressRing.jsx

**Files:**
- Create: `src/components/onboarding/ProgressRing.jsx`

- [ ] **Step 1: Create the ProgressRing SVG component**

Pure component, no internal state. Props: `size` (default 48), `progress` (0-100), `color`, `isComplete`, `icon`.

SVG implementation details:
- viewBox = `0 0 {size} {size}`
- Circle center = `size/2`, radius = `(size - trackWidth*2) / 2` where trackWidth = 4
- Circumference = `2 * π * radius`
- Background circle: `stroke={color}` with 15% opacity, `stroke-width={trackWidth}`
- Progress arc: `stroke={color}` solid (or `#10b981` when complete), `stroke-dasharray={circumference}`, `stroke-dashoffset={circumference - (clampedProgress/100 * circumference)}`, `stroke-linecap="round"`, CSS transition 400ms ease-out
- Transform: `rotate(-90deg)` on the SVG to start arc from top
- Center content: `<foreignObject>` containing `<MaterialIcon>` — shows mission icon in mission color, or `check` in `#10b981` when complete
- Complete state: pulse animation via CSS class (scale 1→1.15→1 in 400ms)
- Defensive: clamp progress 0-100, fallback icon to block number text if undefined
- At 0%: arc invisible (dashoffset = circumference), only background track visible

CSS animations (inline `<style>` or Tailwind `animate-` class):
```css
@keyframes ring-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/ProgressRing.jsx
git commit -m "feat(onboarding): create ProgressRing SVG component"
```

---

## Chunk 2: OnboardingBlock Redesign

### Task 3: Rewrite OnboardingBlock.jsx visual layer

**Files:**
- Modify: `src/components/onboarding/OnboardingBlock.jsx`

**Important:** Keep the same props interface (`block, items, onToggle, isAdmin, disabled, isExpanded, onToggleExpand, blockRef`). Keep the same internal logic (`canMark`, `renderItem`, `expandedKeys`, role separation). Only change the JSX structure and classes.

- [ ] **Step 1: Import ProgressRing and add celebration state**

Add import for ProgressRing. Add `useState` for `celebrating` (boolean) and a `useRef` for celebration timer. Add `useEffect` cleanup for the timer.

- [ ] **Step 2: Rewrite the card header (collapsed state)**

Replace the current button header with the new layout:

```
border-left: 4px solid {block.color}  (or #10b981 when complete, or 5px when active)
[ProgressRing 48px / 40px mobile]  [Title + Subtitle]  [Chevron]
```

Subtitle logic (function `getSubtitle`):
- `checkedCount === 0 && isActive` → "Pronta para você" (color: block.color)
- `checkedCount === 0` → "Toque para começar" (color: block.color)
- `checkedCount === total - 1` → "Falta 1 item!" (color: block.color)
- `checkedCount === total` → "Missão completa!" (color: #059669)
- else → `${checkedCount} de ${total} itens` (color: #4a3d3d)

ProgressRing receives:
- `progress`: if `isActive && checkedCount === 0` → 5 (illusion), else → actual percentage
- `isComplete`: checkedCount === total
- `icon`: block.icon
- `color`: block.color
- `size`: responsive (use className for sizing, or pass 48 desktop / 40 mobile — can use a simple window check or just pass 48 and use CSS scale on sm:)

Card classes by state:
- **Normal collapsed:** `bg-white border border-[#291715]/5 hover:shadow-sm`
- **Active (expanded, not complete):** `shadow-md` + bg with `{color}08`
- **Complete:** `bg-[#ecfdf5]/30 border-emerald-200`

`isActive` prop: parent (Onboarding.jsx) already passes `isExpanded` which serves the same purpose. Use this to determine if this is the active block for progress illusion. Add a new prop `isNextActive` (boolean) to distinguish the "next up" block from the currently expanded one — OR simpler: pass `activeBlockId` from parent and compare. Actually simplest: just use `isExpanded` for the illusion — if it's expanded and 0 items, show 5%.

Wait — the illusion should show on the NEXT block that is collapsed but will be next. Let me reconsider. The spec says "Ring da próxima missão ativa (apenas ela, não todas as futuras) mostra 5%". This means we need to know if this block is the first incomplete one. Add a prop `isNextActive` (boolean) from Onboarding.jsx.

- [ ] **Step 3: Rewrite the expanded content area**

Keep the same item rendering logic (renderItem function stays mostly the same). Changes:
- Add dashed separator between header and items: `border-t border-dashed border-[#291715]/10`
- Keep franchisee/franchisor item separation
- Keep expandable details (ITEM_DETAILS)
- Keep role tags with mobile hiding

- [ ] **Step 4: Add micro-celebration logic**

In the component, detect when `isComplete` transitions from false to true (useEffect on `isComplete` or compare prev/current):

```jsx
const prevCompleteRef = useRef(isComplete);
useEffect(() => {
  if (isComplete && !prevCompleteRef.current) {
    setCelebrating(true);
    celebrationTimerRef.current = setTimeout(() => setCelebrating(false), 3000);
  }
  prevCompleteRef.current = isComplete;
}, [isComplete]);
```

When `celebrating` is true, render:
- Card gets extra classes: `scale-[1.02] sm:scale-[1.02]` (mobile: `scale-[1.01]`) via `transition-transform duration-300`
- Glow shadow: `box-shadow: 0 0 20px {block.color}40` via inline style
- Celebration banner between header and items (or at bottom of header):
  ```jsx
  {celebrating && (
    <div className="px-4 py-2 text-center text-white text-sm font-bold animate-fade-in"
         style={{ backgroundColor: block.color }}>
      🎉 Missão completa!
    </div>
  )}
  ```

User interaction override: if `onToggleExpand` is called while celebrating, clear the timer and setCelebrating(false).

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/OnboardingBlock.jsx
git commit -m "feat(onboarding): redesign mission card with ProgressRing and celebrations"
```

---

## Chunk 3: Onboarding Page + GateBlock + Deploy

### Task 4: Update Onboarding.jsx

**Files:**
- Modify: `src/pages/Onboarding.jsx`

- [ ] **Step 1: Add ProgressRing to the progress header card**

Import ProgressRing. In the "Franchise info + overall progress" card section, add a ProgressRing (56px desktop / 48px mobile) with `icon="rocket_launch"` and `color="#d4af37"` to the left of the progress info.

Layout change:
```jsx
<div className="flex items-center gap-4">
  <ProgressRing
    size={56}
    progress={progressPct}
    isComplete={progressPct === 100}
    icon="rocket_launch"
    color="#d4af37"
  />
  <div className="flex-1">
    {/* existing progress bar + counts */}
  </div>
</div>
```

Add responsive sizing: wrap ProgressRing size with a className approach or just use 48 on mobile via hidden/block patterns. Simplest: use size={56} and add `className="hidden sm:block"` for large + `className="sm:hidden"` for small (size=48).

- [ ] **Step 2: Add motivational message**

After the progress counts, add dynamic message:

```jsx
const motivationalMessage = useMemo(() => {
  if (progressPct === 0) return "Vamos começar! Sua primeira missão já está esperando.";
  if (progressPct <= 25) return "Ótimo começo! Continue assim.";
  if (progressPct <= 50) return "Quase na metade! Você está voando.";
  if (progressPct <= 75) return "Mais da metade! A reta final está perto.";
  if (progressPct < 100) return "Falta pouco! Você está quase lá!";
  return "Todas as missões completas! 🎉";
}, [progressPct]);
```

Render as `<p className="text-xs text-[#4a3d3d] mt-2 italic">{motivationalMessage}</p>`

- [ ] **Step 3: Pass `isNextActive` prop to OnboardingBlock**

Compute which block is the "next active" (first incomplete block):

```jsx
const nextActiveBlockId = useMemo(() => findActiveBlockId(items), [items]);
```

Pass to each OnboardingBlock:
```jsx
<OnboardingBlock
  ...existingProps
  isNextActive={block.id === nextActiveBlockId}
/>
```

- [ ] **Step 4: Enhance final celebration card (all 8 missions complete)**

Replace the current celebration card with the peak-end design:

```jsx
{!isAdmin && b18Complete && checklist.status !== "approved" && (
  <Card className="mb-4 overflow-hidden rounded-2xl border-2 border-emerald-200"
        style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #fef9e7 100%)" }}>
    <CardContent className="p-5 sm:p-8 text-center">
      <MaterialIcon icon="celebration" size={64} className="mx-auto mb-3 text-[#d4af37] animate-bounce" />
      <h3 className="text-xl font-bold text-emerald-700 font-plus-jakarta mb-2">
        Parabéns! Você está pronto para vender!
      </h3>
      <p className="text-emerald-600 text-sm mb-1">
        O CS foi notificado e vai validar suas configurações.
      </p>
      <p className="text-emerald-500 text-xs">
        Tráfego pago ativado em até 48h.
      </p>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 5: Update celebration timer to respect user clicks**

In `handleToggle`, when a block completes, store the auto-expand timer ref. In `onToggleExpand` handler, clear any pending celebration/auto-expand timers:

```jsx
const celebrationTimerRef = useRef(null);

// In the block completion handler (inside handleToggle):
celebrationTimerRef.current = setTimeout(() => {
  // auto-expand next block
}, 3400);

// When user manually clicks a block:
const handleManualToggle = (blockId) => {
  if (celebrationTimerRef.current) {
    clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = null;
  }
  setExpandedBlockId(expandedBlockId === blockId ? null : blockId);
};
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/Onboarding.jsx
git commit -m "feat(onboarding): header ProgressRing, motivational messages, peak-end celebration"
```

---

### Task 5: Update GateBlock.jsx for visual consistency

**Files:**
- Modify: `src/components/onboarding/GateBlock.jsx`

- [ ] **Step 1: Import ProgressRing and update header layout**

Import ProgressRing. Replace the current header (number badge + title) with:

```jsx
<ProgressRing
  size={48}
  progress={Math.round((checkedCount / total) * 100)}
  isComplete={checkedCount === total}
  icon="verified"
  color="#C49A2A"
/>
```

Add border-left with gradient:
```jsx
style={{ borderLeft: "4px solid", borderImage: "linear-gradient(to bottom, #D32F2F, #C49A2A) 1" }}
```

When complete: border-left changes to `#10b981` solid.

- [ ] **Step 2: Align checkboxes to 28px (w-7 h-7)**

Current GateBlock checkboxes are 20px (w-5 h-5). Change to w-7 h-7 to match OnboardingBlock. Update the check SVG inside from `w-3 h-3` to `w-4 h-4`.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/GateBlock.jsx
git commit -m "feat(onboarding): GateBlock visual consistency with ProgressRing and 28px checkboxes"
```

---

### Task 6: Build, verify, and deploy

- [ ] **Step 1: Run build**

```bash
npm run build
ls dist/index.html
```

Expected: build succeeds, `dist/index.html` exists.

- [ ] **Step 2: Final commit (if any remaining changes)**

```bash
git status
# If clean, skip. If changes, add and commit.
```

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 4: Deploy via Portainer force update**

Use Portainer API to force update the franchiseflow service.

- [ ] **Step 5: Verify deployment**

Wait ~1 min for rebuild, then verify app.maximassas.tech loads.
