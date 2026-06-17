<!-- Shardado de apps/dashboard/CLAUDE.md em 16/06/2026 para reduzir tokens de prompt.
     Conteúdo estável (refactor 21/04/2026, commit 53751dd). Ler ao mexer em SaleReceipt.jsx / impressão térmica.
     Ponteiro fica no CLAUDE.md, seção "Impressão Térmica". -->

### Impressão Térmica (Comprovantes) — refactor 21/04/2026 (commit `53751dd`)
- Arquivos: [SaleReceipt.jsx](src/components/minha-loja/SaleReceipt.jsx) (bloco `<style>` interno) + [shareUtils.js:158](src/lib/shareUtils.js#L158) (`@page`)
- **Auto-adapt 58/80mm** sem configuração: `@page { size: auto; margin: 0 }` + container com `width: "100%", maxWidth: 400`. Driver da impressora reporta largura; CSS adapta. NUNCA fixar width em px nem `size: 80mm` (quebra 58mm)
- **`margin: 0` no `@page`** — térmica tem margem física de 2-3mm por lado; margem CSS extra cortava lateral
- **Contraste obrigatório em `@media print`** (regras com `!important` no `.receipt *`):
  - `color: #000` em tudo (ZERO cinza — `#666`, `#444`, `#dc2626` somem em raster 1-bit 203dpi)
  - `font-family: 'Courier New'` monospace + `font-weight: 700` + `font-size: 11pt`
  - `-webkit-font-smoothing: none` (anti-aliasing vira dither)
  - `print-color-adjust: exact` + prefix `-webkit-`
  - `overflow-wrap: anywhere` + `word-break: break-word` para nomes longos
  - Logo `max-width: 40mm` (cabe em 58mm)
- Ao adicionar elementos ao SaleReceipt: NUNCA usar cor cinza, font-weight < 700, ou background colorido. O `!important` no `@media print` neutraliza inline styles — mas se vai imprimir, projetar pensando em "preto puro ou branco puro"
- **Uso prático (Nelson 21/04)**: franqueado imprime com **escala 80%** no dialog do browser e fica ótimo. Se reclamação de "ficou grande", orientar reduzir escala no print dialog — não é bug
- Se alguma franquia reclamar de impressão ainda apagada após este refactor, **não é CSS** — é densidade do driver (heating time) ou bobina velha. NÃO forçar config na franquia (Nelson: zero configuração)
