# RASCUNHO — guia da Ajuda "Cardápio digital" (NÃO publicado)

> Escrito em 10/11/2026 contra a página `src/pages/CardapioDigital.jsx` e os componentes de `src/components/cardapio/` (v7, piloto Imirim). Nada em `src/` foi alterado.
> **Publicar só quando o cardápio abrir para toda a rede (decisão do Nelson).** Até lá o guia não entra no app, no `docs/guias-ajuda-v2.md` nem no manual.
> Slug: `cardapio-digital`. Entra como **guia 34**, no fim do documento (mesmo padrão dos guias 32 e 33), então nenhum "guia N" existente muda de número. Área: **Marketing**.

## Pontos a confirmar antes de publicar

1. **Kit**: o texto do passo 8 foi escrito para a chave `cardapio_kit` DESLIGADA (kit "em breve"). Se o Nelson ligar o kit antes da publicação, trocar o trecho marcado e conferir o passo contra a tela (o kit passa a aparecer no cardápio com o botão "Pôr o kit no pedido").
2. **"Pausar entrega"** não é um botão da página Cardápio digital: o rodapé dela manda para o Meu robô. O passo 7 usa o **Horário especial** (Meu robô › etapa de entrega, botão "Adicionar dia especial", "Como fica: Fechado", "Vale para: Só entrega"). Conferir o caminho exato dos rótulos na tela ao tirar o print (o card está em `src/components/vendedor/HorarioEspecialCard.jsx`).
3. **Nome do menu**: o item é "Cardápio digital" em **Mais** (celular) e no menu da esquerda (computador), só para a unidade com a chave ligada. Confirmar no print.
4. Não existe guia anterior sobre isso, mas `robo-cardapio` ("Trocar o cardápio do robô") trata da IMAGEM do catálogo. Os dois nomes se parecem: o passo 1 do novo guia diz a diferença, e vale uma frase de ligação no `robo-cardapio` (item do checklist, seção 4).
5. Travas de texto do teste respeitadas: sem "reserva/separar/guardar", "amanhã", "líquido", "margem", "loja", e "fábrica" só em "pedido à fábrica". Sem valor de pacote. Mensagem de WhatsApp com menos de 200 caracteres.

---

## 1. O guia no formato do `guiasAjuda.js`

Colar no array `GUIAS`, depois do guia `como-funciona-anuncio` (último de Marketing), antes de `ronda-manha`/equipe se a ordem do arquivo for por área.

```js
  {
    slug: "cardapio-digital",
    publico: PUBLICO.franqueado,
    titulo: "Usar o Cardápio digital",
    resumo: "Ligar o cardápio, pôr o link na bio do Instagram e no perfil do Google, ver o resultado e cuidar dos produtos e da promoção.",
    tempo: "10 minutos",
    icone: "restaurant_menu",
    area: "Marketing",
    sinonimos: ["cardápio digital", "link do cardápio", "pedido pelo link", "cardápio online", "link na bio", "qr code", "produto em falta", "esconder produto"],
    dica: "Divulgue o link onde o cliente já procura você: bio do Instagram, perfil do Google e status do WhatsApp. O robô já manda o link para quem conversa com ele.",
    erroComum: "Mandar o link de uma vez para toda a sua lista de clientes. Isso pode fazer o WhatsApp bloquear o seu número. Use a bio, o perfil do Google, o status e deixe o robô enviar a quem pedir.",
    passos: [
      { titulo: "Entenda para que serve", texto: "O Cardápio digital é uma página com as massas artesanais embaladas e congeladas da sua unidade. O cliente escolhe os produtos, monta o pedido sozinho e ele chega pronto no seu WhatsApp, para você confirmar. Preço e estoque vêm do seu Estoque. Não é o mesmo que a imagem do catálogo, que você troca no Meu robô.", imagem: "/tutoriais/cardapio-digital-1.webp" },
      { titulo: "Ligue o cardápio", texto: "Toque em Mais e em Cardápio digital. Na primeira vez, o app mostra uma lista para conferir antes: WhatsApp público da unidade, horários e pagamento, e estoque atualizado. Com tudo certo, toque em Ligar o cardápio. Depois disso, o interruptor no alto da página liga e desliga quando você quiser.", botao: "Ligar o cardápio", imagem: "/tutoriais/cardapio-digital-2.webp" },
      { titulo: "Copie o link e ponha na bio e no Google", texto: "Com o cardápio no ar, toque em Copiar link. Cole o link na bio do Instagram e no perfil da unidade no Google. Para ver como o cliente enxerga, toque em Ver como o cliente vê. Se preferir imprimir, toque em Baixar QR. Quando colocar o link na bio, toque em Já coloquei, na faixa Antes de divulgar.", botao: "Copiar link", imagem: "/tutoriais/cardapio-digital-3.webp" },
      { titulo: "Confira o quadro Antes de divulgar", texto: "Esse quadro mostra o que pode atrapalhar a venda agora. O principal é produto em falta: o cardápio mostra \"Acabou\" e o cliente não consegue pedir. Toque em Atualizar estoque, acerte as quantidades e volte. Se o quadro disser \"Tudo em dia para vender\", pode divulgar.", botao: "Atualizar estoque", imagem: "/tutoriais/cardapio-digital-4.webp" },
      { titulo: "Veja o resultado", texto: "No quadro Resultado, escolha 7 dias ou 30 dias. Viraram venda mostra os pedidos que viraram venda em até 3 dias. Chegaram no seu WhatsApp mostra quantos pedidos chegaram até você. Visitas mostra quantas pessoas abriram o cardápio e quantas vieram do Instagram. Abaixo, veja os produtos mais escolhidos.", botao: "30 dias", imagem: "/tutoriais/cardapio-digital-5.webp" },
      { titulo: "Esconda um produto", texto: "Em Produtos no cardápio, cada linha tem o interruptor Mostrar. Desligue para tirar um produto do cardápio (por exemplo, uma massa que você não vai ter por um tempo). Ligue para ele voltar. Os filtros Em falta, Todos e Escondidos ajudam a achar o produto. Para tirar de uma vez os produtos zerados há mais de 30 dias, toque em Esconder os zerados há mais de 30 dias.", botao: "Mostrar", imagem: "/tutoriais/cardapio-digital-6.webp" },
      { titulo: "Folga ou dia sem entrega", texto: "O dia, o horário de entrega e a folga não ficam nesta página: ficam no Meu robô e valem para o robô e para o cardápio ao mesmo tempo. Na página do cardápio, toque em Abrir o Meu robô, vá até Horário especial e toque em Adicionar dia especial. Escolha a data, deixe Fechado e, em Vale para, escolha Só entrega ou Entrega e retirada. Para parar o cardápio inteiro, desligue o interruptor no alto da página: o robô também para de mandar o link.", botao: "Abrir o Meu robô", imagem: "/tutoriais/cardapio-digital-7.webp" },
      { titulo: "Crie uma promoção", texto: "Em Promoção do cardápio, toque em Criar promoção e escolha o tipo: Leve N e ganhe % (desconto na quantidade) ou Kit com preço fechado. O Kit com preço fechado ainda vai chegar: por enquanto, uma promoção desse tipo aparece como texto no topo do cardápio e o robô oferece uma vez por conversa. Preencha o nome, os produtos e, se quiser, a data em Vale até, e toque em Salvar promoção. Para parar, toque em Encerrar promoção.", botao: "Salvar promoção", imagem: "/tutoriais/cardapio-digital-8.webp" },
    ],
    nota: "Horários, entrega, retirada e formas de pagamento ficam no Meu robô. Se o cardápio disser que a unidade está em pausa, confira o interruptor no alto da página.",
    whatsapp: "O Cardápio digital da sua unidade: o cliente monta o pedido pelo link e ele chega pronto no seu WhatsApp. Veja como ligar, divulgar e acompanhar.",
  },
```

Observações sobre o JS acima:
- Passo 8, frase do kit: **trecho a trocar se o kit for ligado** ("O Kit com preço fechado ainda vai chegar: por enquanto, uma promoção desse tipo aparece como texto no topo do cardápio e o robô oferece uma vez por conversa"). A tela de hoje diz "No cardápio, por enquanto, ela aparece como texto no topo" quando `kit_no_cardapio` é falso. O botão "Criar promoção" precisa ser conferido no print: se a tela mostrar outro rótulo para abrir o formulário, ajustar o `texto` (o `botao` do passo é "Salvar promoção", que existe na tela).
- Limites do teste conferidos: `dica` 155 caracteres (máx. 240), `erroComum` 185 (máx. 320), `whatsapp` 145 (máx. 200), 8 sinônimos de até 40 caracteres, 8 passos (mínimo 3).
- `area: "Marketing"` está em `AREAS_VALIDAS`. Nenhum `drive`.

---

## 2. Entrada para `docs/guias-ajuda-v2.md`

**a) Índice** (seção "Marketing", depois do item 33):

```md
34. Usar o Cardápio digital — `cardapio-digital`
```

**b) Corpo**: colar depois do guia 33 (termina na linha `**Se não resolver:** Falar com a Maxi (guia 30).` + `---`) e antes de `# (1) Fotos: o que existe e o que falta`:

```md
## 34. Usar o Cardápio digital
`slug: cardapio-digital` · **Onde começa:** Mais › Cardápio digital · **Tempo:** 10 minutos
> Fotos: `cardapio-digital-1.webp`..`cardapio-digital-8.webp`, uma por passo.

**Quando usar:** você quer que o cliente monte o pedido sozinho pelo link e que ele chegue pronto no seu WhatsApp.

**Passos**
1. O Cardápio digital é uma página com as massas artesanais embaladas e congeladas da sua unidade. O cliente escolhe os produtos e o pedido chega pronto no seu WhatsApp, para você confirmar. Preço e estoque vêm do seu Estoque. Não é a imagem do catálogo, que se troca no Meu robô.
   - Imagem: página do cardápio no celular, com o título e o quadro do link.
2. Toque em **Mais** e em **Cardápio digital**. Na primeira vez, confira a lista (WhatsApp público, horários e pagamento, estoque) e toque em **Ligar o cardápio**. Depois, o interruptor no alto liga e desliga.
   - Imagem: tela de primeiro uso. Seta em **Ligar o cardápio**.
3. Toque em **Copiar link** e cole na bio do Instagram e no perfil da unidade no Google. **Ver como o cliente vê** abre a página do cliente; **Baixar QR** gera o QR para imprimir. Colocou na bio? Toque em **Já coloquei**.
   - Imagem: quadro "Cardápio no ar". Seta em **Copiar link**.
4. No quadro **Antes de divulgar**, veja o que atrapalha a venda, principalmente produto em falta. Toque em **Atualizar estoque**, acerte as quantidades e volte. "Tudo em dia para vender" = pode divulgar.
   - Imagem: quadro Antes de divulgar com um produto em falta. Seta em **Atualizar estoque**.
5. No quadro **Resultado**, escolha **7 dias** ou **30 dias**: **Viraram venda**, **Chegaram no seu WhatsApp** e **Visitas**, com os produtos mais escolhidos.
   - Imagem: quadro Resultado. Círculo em **30 dias**.
6. Em **Produtos no cardápio**, desligue o interruptor **Mostrar** para esconder um produto e ligue para ele voltar. Filtros: **Em falta**, **Todos**, **Escondidos**. **Esconder os zerados há mais de 30 dias** tira de uma vez os que estão parados.
   - Imagem: lista de produtos. Seta no interruptor **Mostrar**.
7. Dia sem entrega: toque em **Abrir o Meu robô**, vá a **Horário especial**, **Adicionar dia especial**, deixe **Fechado** e escolha **Só entrega** ou **Entrega e retirada** em **Vale para**. Para parar o cardápio inteiro, desligue o interruptor do alto.
   - Imagem: card Horário especial com um dia fechado. Círculo em **Vale para**.
8. Em **Promoção do cardápio**, escolha **Leve N e ganhe %** (ou **Kit com preço fechado**, que por enquanto aparece só como texto no topo), preencha e toque em **Salvar promoção**. **Encerrar promoção** para.
   - Imagem: formulário da promoção. Seta em **Salvar promoção**.

**Deu certo quando:** o cardápio está "no ar", o link está na bio e no Google, e o quadro Antes de divulgar diz "Tudo em dia para vender".

**Dica:** divulgue o link onde o cliente já procura você: bio do Instagram, perfil do Google e status do WhatsApp. O robô já manda o link para quem conversa com ele.

**Erro comum:** mandar o link de uma vez para toda a sua lista de clientes. Isso pode fazer o WhatsApp bloquear o seu número. Use a bio, o perfil do Google, o status e deixe o robô enviar a quem pedir.

**Se não resolver:** a página não aparece no menu, ou diz que falta o WhatsApp público? Falar com a Maxi (guia 30).

---
```

Cuidados do parser do teste (`guiasDoDocumento`): o índice tem de casar `^\d+\. .+? — \`slug\``; o corpo é contado entre `# COMEÇAR` e `# (1)`, então o guia 34 precisa ficar ANTES de `# (1)`; passos = linhas `^\d+\. ` (8 no corpo = 8 no app). Atenção: nenhuma linha de texto fora dos passos pode começar com número e ponto (o "Dica", "Erro comum" etc. começam com `**`, ok).

Também atualizar o cabeçalho do documento: "Os 33 guias" → "Os 34 guias" (linha 4 do `guias-ajuda-v2.md`) e "Os 33 guias de `docs/guias-ajuda-v2.md`" no comentário do topo do `guiasAjuda.js` (linha 4).

### O que muda em `src/lib/guiasAjuda.test.mjs`

| Linha | Hoje | Passa a ser |
|---|---|---|
| 188 | `"documento × app: os 33 guias do índice..."` | `"... os 34 guias ..."` |
| 190 | `assert.equal(slugs.length, 33, "o índice do documento tem 33 guias")` | `34`, `"... tem 34 guias"` |
| 210 | `assert.equal(comGuiaFalso.slugs.length, 34)` (controle positivo: 33 + 1 inventado) | `35` |

A âncora `ultimo = "32. Ver as vendas por produto — \`vendas-por-produto\`"` (linha 207) continua existindo no documento: não muda. Nenhuma outra contagem depende do total (`guiasParaPapel`/`guiasPorArea` comparam com `GUIAS.length`; `COMECE_POR_AQUI` não inclui o novo). A trava de imagens (`/public/tutoriais`) só passa depois que os 8 `.webp` existirem: **o `imagem` não pode ir ao ar antes dos arquivos** (ou tirar os `imagem` dos passos e pôr depois). Rodar `node src/lib/guiasAjuda.test.mjs`.

---

## 3. Imagens (prints) necessárias

Padrão da casa: `public/tutoriais/<slug>-<n>.webp`, 390 px de largura (celular), contorno vermelho da marca no elemento, unidade e clientes fictícios, sem valor de pacote visível. Fonte: harness sem login `.tmp/harness-cardapio/` (dados em `mocks/dados.json`; `prints.mjs` já existe, rodar a partir da raiz do dashboard como os roteiros de `.tmp/harness-s242`). Converter para webp e passar pelo limpador de metadados.

| Arquivo | O que mostra |
|---|---|
| `cardapio-digital-1.webp` | Topo da página Cardápio digital no celular: título, subtítulo "Seu cliente monta o pedido sozinho..." e o quadro do link. Sem contorno (visão geral). |
| `cardapio-digital-2.webp` | Tela de primeiro uso: "Seu cardápio está pronto para ligar. Antes, confira:" com a lista e o botão **Ligar o cardápio** contornado. |
| `cardapio-digital-3.webp` | Quadro "Cardápio no ar" com o interruptor ligado, o link da unidade fictícia e os 3 botões; contorno em **Copiar link**. |
| `cardapio-digital-4.webp` | Quadro **Antes de divulgar** com "N de M produtos do cardápio estão em falta" e a faixa "Link na bio?"; contorno em **Atualizar estoque**. |
| `cardapio-digital-5.webp` | Quadro **Resultado** com os 3 indicadores com números fictícios e o seletor 7 dias / 30 dias; contorno em **30 dias**. |
| `cardapio-digital-6.webp` | **Produtos no cardápio** com os filtros e 3 linhas (uma "No cardápio", uma "Em falta", uma "Escondido"); contorno no interruptor **Mostrar** de uma linha. |
| `cardapio-digital-7.webp` | Card **Horário especial** do Meu robô com um dia "Fechado" e "Vale para: Só entrega"; contorno em **Vale para**. (O rodapé "Abrir o Meu robô" da página pode entrar como segundo recorte colado em cima.) |
| `cardapio-digital-8.webp` | Formulário de **Promoção do cardápio** (tipo "Leve N e ganhe %", produto de exemplo, "Vale até"); contorno em **Salvar promoção**. |

Prints que NÃO devem sair: a tela com `chave_ligada=false` e o QR aberto (não são usados). Se o kit for ligado, tirar também a prévia "Como o cliente vê" do kit.

---

## 4. Checklist dos 4 pontos para o dia da publicação

Ordem sugerida: 1 → 3 → 2 → 4 (texto e fotos primeiro, teste, e só então o manual).

**Ponto 1 — `src/lib/guiasAjuda.js`**
- [ ] Colar o bloco da seção 1 depois do guia `como-funciona-anuncio`.
- [ ] Conferir cada rótulo contra a tela do dia (kit ligado ou não, nomes de botões, "Criar promoção").
- [ ] Atualizar o comentário do topo ("Os 33 guias" → "Os 34 guias").
- [ ] Opcional: frase de ligação no guia `robo-cardapio` ("A imagem do catálogo é diferente do Cardápio digital, que é o link para o cliente montar o pedido") e vice-versa.
- [ ] Opcional: um "?" da página (`helpTips.js`) apontando para `cardapio-digital`, se a página usar HelpTip.

**Ponto 2 — `docs/guias-ajuda-v2.md`**
- [ ] Item 34 no índice, em Marketing, depois do 33.
- [ ] Corpo do guia 34 antes de `# (1) Fotos`.
- [ ] "Os 33 guias" → "Os 34 guias" no cabeçalho (linha 4).
- [ ] Na tabela de fotos da seção `# (1)`, acrescentar as 8 linhas `cardapio-digital-1..8` com "existe".
- [ ] Referências "guia N" cruzadas: o novo guia só aponta para o guia 30 (Falar com a Maxi). Nada existente renumera.

**Ponto 3 — `src/lib/guiasAjuda.test.mjs`**
- [ ] Linhas 188 e 190: 33 → 34 (texto do título e `assert.equal`).
- [ ] Linha 210 (controle positivo): 34 → 35.
- [ ] Rodar `node src/lib/guiasAjuda.test.mjs` (palavras proibidas, links, limites de dica/erro/WhatsApp, passos do app = passos do documento, imagens existentes).
- [ ] Rodar o lint do projeto (`npm run lint`).

**Ponto 4 — manual "Comece por aqui" (`.tmp/onda7b-manual/gera.mjs`)**
- [ ] O guia novo NÃO entra no `COMECE` (a lista é inicio, vendas, venda-recebida, pedido-fabrica, clientes, falar-com-maxi), então não precisa de entrada no `CURTO`.
- [ ] Ele entra sozinho no corpo do manual (o `gera.mjs` lê o `GUIAS` do JS e o md): rodar `node .tmp/onda7b-manual/gera.mjs` e conferir que o número de páginas mudou como esperado, que o índice do manual lista "Usar o Cardápio digital" em Marketing e que nenhuma página fixa estourou (a tabela perde linhas sem dar erro; olhar as páginas "Onde fica" e do índice).
- [ ] O `G("slug")` só é necessário se outro guia citar este pelo número: use `G("cardapio-digital")`, nunca "guia 34" escrito à mão.
- [ ] Copiar o PDF novo para `public/manual-maxi.pdf`.

**Fora dos 4 pontos, no dia**
- [ ] As 8 imagens em `public/tutoriais/` (seção 3) ANTES de rodar o teste.
- [ ] Menu "Cardápio digital" visível para a rede toda (chave `cardapio_digital` ligada por unidade, ou a mudança que o Nelson decidir). O guia não deve ser publicado antes disso.
- [ ] Texto da rede (opcional, só com OK do Nelson): se for avisar a franqueada pelo WhatsApp, o link do guia é `https://app.maximassas.tech/Tutoriais?abrir=cardapio-digital`. Aviso individual, nunca disparo igual para vários números.
- [ ] Se o Nelson ligar o kit (`cardapio_kit`): refazer passo 8 e print 8.
