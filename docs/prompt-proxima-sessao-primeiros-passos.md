# Prompt — próxima sessão: publicar e fechar "Primeiros passos"

> Colar numa sessão nova, aberta em `apps/dashboard`. Escrito em 17/09/2026, na pausa depois da Fase 2.
> Plano aprovado: `~/.claude/plans/buzzing-jumping-mango.md` · telas e prints: https://claude.ai/artifact/65jtduM3GZ59dk6WMm8UrK (página "Prints do app") · detalhes técnicos: CLAUDE.md do dashboard, seção "Primeiros passos (onboarding)".

---

Continue o "Primeiros passos" (onboarding novo do franqueado). Fases 0 e 1 estão no ar desde 16/09. A Fase 2 está pronta, commitada **e ainda não publicada** (commits `d37c41b` e `e45bc02`, à frente do `origin/main`). Eu já aprovei publicar.

## 1. Publicar a Fase 2 (primeiro)
1. `git status` e `git log origin/main..HEAD`: devem aparecer só os 2 commits da Fase 2. Se o remoto andou, `git fetch` e confira que não há conflito.
2. Rodar `npm run lint`, `lint:undef`, `icons:check`, `test:unit` e `build`.
3. Refazer os prints da trilha com as **tarefas compactas** (resumo + "Como fazer"). Os prints 02, 03, 05, 06 e 07 da página "Prints do app" são da versão anterior, com os textos longos.
   - Prévia: `npx vite --config .tmp/harness-onboarding/vite.config.mjs` → `:5197/Onboarding?cenario=novo|passo2|pedido|quase|concluido|fiscal|admin`.
   - Tirar com o Playwright MCP a 390 px e salvar em `.playwright-mcp/` (é a pasta permitida). Depois atualizar a página "Prints do app" do canvas, relendo antes o `project/canvas.json`.
4. Push com token e conferir com `git ls-remote`; depois `node .tmp/deploy.mjs`.
5. Conferir **pelo conteúdo** no ar:
   - o chunk `Onboarding-*.js` tem "Como fazer" e "Primeiros passos";
   - o `index` tem "Sua unidade" (login novo) e "Esse link já foi usado".
6. Smoke no ar, só leitura: abrir `/login`, e `/login` com o hash de `otp_expired`.

## 2. O que depende de mim (Nelson)
- **Link de MODELO do Canva** (Compartilhar → "Link de modelo"). Trocar em `src/components/onboarding/materiais.js` (`CANVA_CARDAPIO`, que já alimenta a trilha e o `CatalogUpload`).
- **Pedido modelo:** ficou com as 225 unidades que foram para Uberaba. Se eu mudar, é UPDATE em `catalog_products.qtd_pedido_modelo`.
- **Vídeo de boas-vindas:** o Short `EH-zq8NzvjQ` não é o certo. `VIDEO_BOAS_VINDAS` está `null` e o link fica escondido até gravarmos um novo. O roteiro dele é a Fase 3.
- **Concluir as unidades que já rodam** pelo botão "Concluir primeiros passos": SP17, Guarulhos, Campinas1, S. Parnaíba1, Leme, Cotia, Itapevi, Araraquara e Rio Grande (esta é teste). Antes, o Celso fala com Itapevi sobre o robô.

## 3. Fase 3 (depois de publicar)
- **Guia ilustrado "Primeiros passos" em Tutoriais**:
  - `?abrir=primeiros-passos`; trocar o link "Ver o guia" da trilha, que hoje vai para `/Tutoriais`;
  - tirar da lista o vídeo "Completando seu Onboarding" (`nnPNlIF26Ic`, ensina os 28 checkboxes);
  - atualizar `docs/roteiro-tutoriais.md`.
- **Roteiro do vídeo novo de boas-vindas** (2 min, a trilha de 5 passos).
- **Cartões 1080×1350** (skill `frontend-design`, a partir de `.tmp/harness-clientes/tutorial/cartoes.html`), com guard de acento. Destino: o privado da unidade nova e o Celso. No grupo, só um recado curto e **com a minha aprovação**.
- **`supabase/onboarding-metricas.sql`** (leitura) para medir em 30 e 60 dias: coorte por ID sem teste; % que vendeu até o dia 14 e o dia 30; % com robô até o dia 7; uso do pedido modelo; tempo até concluir.
- **Toast "Pronto! Próximo"** nas outras telas: hoje o aviso só aparece quando ela volta para a trilha.

## 4. Riscos que ficaram abertos (fora do escopo)
- **Webhook n8n `a9c45ef7…`** ("CRIAR USUARIO ZUCK ZAP GO", conectar WhatsApp) **sem autenticação**: dá para pedir o QR Code de qualquer unidade desconectada. Aplicar o mesmo padrão dos convites (workflows `nbLDyd1KoFIeeJEF`/`jeGBs3eCHxc2EwfG`).
- **Pasta "02. Meta Business Suite" do Drive** está na conta pessoal do Celso (`celsofdf@gmail.com`). Passar para a `fabrica@`.
- **A porcentagem que o admin vê** só se atualiza quando a franqueada abre a trilha (os sinais automáticos não gravam sozinhos).

## Regras que não mudam
- Rota de trabalho pesado: Codex e subagentes. Revisão adversarial do diff antes de publicar.
- Arquivos CRLF (`FranchiseSettings.jsx`, `Layout.jsx`, `PurchaseOrderForm.jsx`, `CLAUDE.md`): editar por âncora de uma linha ou por script Node que preserve o EOL. Nunca colocar crase em comando `node -e` do bash.
- Unidade fictícia em todo print ou arte que vai para franqueado.
