# Prompt — próxima sessão: onboarding e telas iniciais do franqueado

> Colar numa sessão nova, aberta em `apps/dashboard`. Escrito em 16/09/2026, logo depois do "Quem chamar hoje".

---

Quero um plano de melhoria para o **onboarding** e as **telas iniciais** do franqueado no FranchiseFlow (app.maximassas.tech): o primeiro acesso, a jornada até a unidade começar a vender e as artes/visual dessas telas. Entre em **plan mode** e só implemente depois que eu aprovar.

**Público:** franqueado leigo (persona 55+), quase sempre no celular. Regra de ouro: menos é mais, nada de coisa "da NASA". Tem de ser prático, operacional e fácil de ver.

## O que olhar (código)
- `src/pages/OnboardingWelcome.jsx` (boas-vindas) e `src/pages/Onboarding.jsx` (9 blocos: 8 numerados + a trava de liberação).
- `src/components/onboarding/`: `ONBOARDING_BLOCKS.jsx`, `ITEM_DETAILS.jsx`, `OnboardingBlock.jsx`, `GateBlock.jsx`, `ProgressRing.jsx`, `FiscalDataGate.jsx`.
- Quem manda para lá: `src/Layout.jsx` (`needsOnboardingWelcome`, `isOnboardingPage`) e `src/App.jsx`.
- Telas de entrada: `src/pages/Login.jsx`, `src/pages/SetPassword.jsx`, e a primeira visão da Início (`src/components/dashboard/FranchiseeDashboard.jsx`) para quem ainda não vendeu.
- Itens automáticos: `detectAutoItems` em `Onboarding.jsx` precisa espelhar o `completedSteps` de `FranchiseSettings.jsx` (ver o CLAUDE.md, seção UX). O desencontro entre os dois já travou Campinas.
- Material de apoio: `src/pages/Tutoriais.jsx` (tutoriais em vídeo + guia ilustrado) e `docs/roteiro-tutoriais.md`.

## Meça antes de desenhar (dados reais, não suposição)
1. **`onboarding_checklists`:** quantas unidades estão em onboarding hoje, quanto tempo levam do convite à liberação (`approved_at`), e em qual item cada uma para. Um ranking dos itens que mais travam.
2. **Unidades novas (últimos 90 dias):**
   - dias até a 1ª venda, o 1º pedido à fábrica e o robô ligado;
   - quantas ficaram sem endereço/fiscal completo (lembrar o caso de Leme e Itapevi);
   - Itapevi apareceu com a lista "Quem chamar hoje" vazia.
3. **Clarity** (projeto `w6o3hwtbya`, token em `.env` como `CLARITY_DATA_EXPORT_TOKEN`; a API dá 10 chamadas por dia e cobre só os últimos 1 a 3 dias):
   - sessões, cliques mortos, rage clicks e voltas rápidas em `/Onboarding`, `/OnboardingWelcome`, `/login` e `/SetPassword`;
   - separar por dispositivo;
   - referência de 16/09: `/Onboarding` teve 24 sessões no PC e 2 no celular em 3 dias.
4. **Login:** reclamações de acesso (e-mail de convite ou senha que "não chegou"). A prova está em `auth_logs`; ver a memória `project_diagnostico_email_auth_supabase`.

## Regras que não mudam
- **Onboarding é obrigatório para franqueado NOVO**, sem "pular". Só quem já operava antes do sistema pode cancelar (memória `feedback_onboarding_regra`).
- **Visual:** tokens do `tailwind.config.js` (`brand`, `ink`, `surface`, `ok`, `warn`), fontes Inter e Plus Jakarta Sans, ícones `MaterialIcon`. Ícone novo exige `npm run icons:build` e depois `icons:check`. Verde de texto é `text-ok-ink`.
- **Artes:** use a skill `frontend-design`.
  - Imagem ou print que vai para o franqueado usa **unidade fictícia**.
  - O texto da imagem passa por um **guard de acentos no HTML** antes de renderizar.
  - Modelo pronto: `.tmp/harness-clientes/tutorial/cartoes.html` (cartões 1080×1350).
- **Prints sem login:** harness `.tmp/harness-clientes/` (mocks por alias). Para as telas de onboarding, crie um parecido. Use o Playwright MCP a 390 px, com `deviceScaleFactor: 3` para arte. O app rola por dentro: estique a janela em vez de usar `fullPage`.
- **Rota de trabalho pesado:** leitura em volume, rascunho e revisão vão para o **Codex** (ver o CLAUDE.md global). Antes do deploy, revisão adversarial do diff.
- **Deploy:** processo do CLAUDE.md do dashboard.
  - Rodar `lint`, `lint:undef`, `icons:check`, `test:unit` e `build`.
  - Push com token; conferir com `git ls-remote`.
  - `node .tmp/deploy.mjs`; conferir **por conteúdo** no ar.
- **Anúncio ao grupo** "Franquia Maxi Massas":
  - só com a minha aprovação;
  - scripts `bots/vendedor/scripts/enviar-grupo-franquias.mjs` (texto) e `enviar-grupo-franquias-imagens.mjs` (imagens);
  - balões curtos, na minha voz, sem emoji.

## O que quero no plano
1. **Pontos cegos** que os dados mostrarem, inclusive os que eu não pedi.
2. **Jornada ideal do primeiro acesso ao primeiro pedido vendido**, com o menor número de passos, e o que sai, junta ou muda de lugar.
3. **Redesenho** das telas de boas-vindas, onboarding e primeira Início: com mock/ASCII para eu escolher e uma direção visual.
4. **Artes/tutorial** para o onboarding (e se o guia em Tutoriais deve ganhar um item novo).
5. **Fases** (a 1ª pequena e entregável) e **como medir** se melhorou (tempo até liberar, até a 1ª venda, travas por item).

Me faça perguntas só quando a resposta mudar o plano, e use o Clarity e o banco para decidir o que der.
