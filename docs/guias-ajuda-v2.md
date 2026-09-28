# Guia de Ajuda do franqueado (v2) — texto para revisão

> Rascunho de 28/09/2026 para o redesenho do lado do franqueado. Ainda NÃO está no app.
> Base: `src/lib/guiasAjuda.js` (formato `{titulo, texto, botao?, imagem?}` e travas do `guiasAjuda.test.mjs`), `src/components/onboarding/journeySteps.js`, `src/lib/helpTips.js`, plano `franqueado-redesign-backlog.md` (27/09) e a descrição das telas novas.
> Público: franqueada leiga, 55+, no celular. Cada passo = uma ação. **Negrito** = nome exato do botão na tela.
> Marcações para quem revisa (não vão para o app):
> - `[conferir]` = rótulo ou comportamento que depende da tela nova e precisa ser confirmado no código antes de publicar.
> - `[decisão Nelson]` = depende de algo que ainda não foi decidido.
>
> Slugs antigos mantidos (os links já enviados no WhatsApp continuam abrindo): `primeiros-passos`, `vendas`, `clientes`, `resultado`, `pedido-fabrica` (alias `estoque`), `verba-marketing`, `artes`, `reconectar-whatsapp`.
> `[conferir]` o alias `estoque` hoje abre "Fazer pedido à fábrica". Com a aba nova chamada "Estoque", talvez seja melhor apontar `estoque` para "Contar o estoque" (mudar o teste `deep-links antigos` junto).

## Mapa do app (para situar a franqueada)

**No celular**, a barra de baixo tem 5 botões: **Início** · **Vendas** · **+ Nova venda** (o redondo do meio) · **Estoque** · **Mais**.
- **Estoque** tem duas abas no topo: **Estoque** e **Pedir à fábrica**.
- **Mais** abre a lista: Meus clientes, Resultado do mês, Pagamentos, Marketing, Meu robô, Ajuda, Minha unidade, Falar com a Maxi, Sair.

**No computador**, a barra da esquerda tem **Nova venda** no topo e, abaixo, os mesmos itens.

Nos caminhos dos guias, "›" quer dizer "toque em". Exemplo: "Mais › Pagamentos" = toque em **Mais** e depois em **Pagamentos**.

---

## Índice

**Começar**
1. Seguir os Primeiros passos — `primeiros-passos`
2. Entrar quando esqueci a senha ou o link venceu — `esqueci-senha`
3. Trocar de unidade — `trocar-unidade`

**Vender**
4. Lançar uma venda — `vendas`
5. Marcar que recebi o dinheiro — `venda-recebida`
6. Corrigir ou excluir uma venda — `corrigir-venda`
7. Mandar e imprimir o comprovante — `comprovante`
8. Baixar a planilha de vendas — `planilha-vendas`

**Clientes**
9. Chamar clientes (Quem chamar hoje) — `clientes`
10. Cadastrar ou corrigir um cliente — `cadastrar-cliente`

**Estoque e pedido à fábrica**
11. Contar o estoque — `contar-estoque`
12. Mudar o preço de venda — `mudar-preco`
13. Cadastrar produto próprio ou ocultar um produto — `produto-proprio`
14. Fazer pedido à fábrica — `pedido-fabrica`
15. Imprimir o pedido — `imprimir-pedido`
16. Conferir o pedido quando chegar — `conferir-chegada`
17. Repetir um pedido — `repetir-pedido`

**Dinheiro**
18. Ver quanto sobrou no mês — `resultado`
19. Lançar um gasto — `lancar-gasto`
20. Baixar o relatório do mês — `relatorio-mes`
21. Pagar a Equipe Digital Maxi — `pagar-equipe-digital`
22. Registrar a verba do anúncio — `verba-marketing`

**Marketing**
23. Baixar as artes e a legenda do mês — `artes`
24. Agendar postagens no Meta Business Suite — `agendar-postagens`

**Meu robô**
25. Ajustar os horários do robô — `robo-horarios`
26. Ajustar entrega, frete e retirada — `robo-entrega`
27. Escolher as formas de pagamento — `robo-pagamento`
28. Trocar o cardápio do robô — `robo-cardapio`
29. Reconectar o WhatsApp do robô — `reconectar-whatsapp`
30. Testar o robô como um cliente — `testar-robo`

**Ajuda**
31. Falar com a Maxi — `falar-com-maxi`

---

# COMEÇAR

## 1. Seguir os Primeiros passos
`slug: primeiros-passos` · **Onde começa:** Início › cartão vermelho "Primeiros passos" (ou Mais › Primeiros passos) · **Tempo:** leitura de 3 minutos; a trilha inteira leva alguns dias

**Quando usar:** sua unidade está abrindo e você quer saber o que fazer primeiro.

**Passos**
1. Na tela Início, toque em **Continuar**, no cartão vermelho. Abre a trilha com os 5 passos.
   - Imagem: tela Início no celular. Recorte do cartão vermelho "Primeiros passos". Círculo vermelho no botão **Continuar**. (já existe: `primeiros-passos-6.webp`)
2. Leia o cartão "Agora". Ele mostra a próxima tarefa e um botão que leva à tela certa.
   - Imagem: topo da trilha. Recorte do cartão "Agora". Seta vermelha no botão vermelho do cartão. (já existe: `primeiros-passos-1.webp`)
3. Siga os 5 passos na ordem: seus dados, seu robô vendedor, seu espaço e seus preços, primeiro pedido, lançamento e primeira venda. Passo pronto fica verde.
   - Imagem: lista dos 5 passos. Círculo no passo que está verde. (já existe: `primeiros-passos-2.webp`)
4. Toque num passo para ver as tarefas. Em **Como fazer** está o passo a passo.
   - Imagem: passo aberto com as tarefas. Seta em **Como fazer**. (já existe: `primeiros-passos-3.webp`)
5. O que acontece fora do app, você confirma. Toque em **Marcar como feito**. A tarefa fica verde.
   - Imagem: tarefa de confirmação. Círculo vermelho em **Marcar como feito**. (já existe: `primeiros-passos-4.webp`)
6. Veja no bloco dourado o que a Maxi faz com você: contrato, reunião de início, redes sociais, grupo, teste do robô e anúncios.
   - Imagem: bloco dourado "A Maxi faz por você". Seta no título do bloco. (já existe: `primeiros-passos-5.webp`)

**O que o app marca sozinho:** seus dados, o cardápio, o Meu robô preenchido, o robô respondendo, o primeiro pedido, a entrega e a primeira venda.

**Deu certo quando:** os 5 passos ficam verdes. A equipe Maxi é avisada e confere tudo com você. Depois disso, "Primeiros passos" sai do menu.

**Dica:** quando a trilha leva você para outra tela, aparece uma faixa no topo. Toque em **Voltar aos Primeiros passos** para voltar.

**Erro comum:** tocou em **Marcar como feito** sem querer. Toque de novo no mesmo botão para desfazer.

**Se não resolver:** Falar com a Maxi (guia 31).

---

## 2. Entrar quando esqueci a senha ou o link venceu
`slug: esqueci-senha` · **Onde começa:** tela de entrada do app (app.maximassas.tech) · **Tempo:** 5 minutos

**Quando usar:** é seu primeiro acesso, você esqueceu a senha, ou o link do e-mail diz que venceu.

**Passos**
1. Na tela de entrada, toque em **Primeiro acesso ou esqueceu a senha?**. O título muda para "Receber link de acesso".
   - Imagem: tela de entrada no celular. Seta vermelha no link **Primeiro acesso ou esqueceu a senha?**, abaixo do botão Entrar.
2. Digite o seu e-mail, o mesmo que a Maxi cadastrou.
   - Imagem: mesma tela, modo "Receber link de acesso". Círculo no campo de e-mail.
3. Toque em **Enviar link**. Aparece a mensagem: "Se (seu e-mail) estiver cadastrado, o link chega em alguns minutos."
   - Imagem: aviso verde embaixo da tela. Seta no aviso, com o e-mail escrito nele.
4. Abra o seu e-mail e toque no link da Maxi Massas.
   - Imagem: e-mail recebido (exemplo com e-mail fictício). Círculo no botão do link.
5. Crie a senha nova e toque em **Criar senha e entrar**. O app abre na tela Início.
   - Imagem: tela de criar senha. Seta no botão **Criar senha e entrar**.

**Deu certo quando:** você entra e vê a tela Início com o nome da sua unidade.

**Dica:** o link vale por 24 horas e serve uma vez só. Se passar disso, peça outro pelo mesmo caminho.

**Erro comum:** o e-mail não chega. Olhe a caixa de spam e confira se digitou o e-mail certo: o app mostra o endereço que você digitou. Se apareceu "Esse link já foi usado ou venceu", peça um link novo (passo 1).

**Se não resolver:** na própria tela de entrada tem o botão do WhatsApp da Maxi. Diga o e-mail que você usa. Veja o guia 31.

---

## 3. Trocar de unidade
`slug: trocar-unidade` · **Onde começa:** topo de qualquer tela (nome da unidade) · **Tempo:** 1 minuto

**Quando usar:** você cuida de duas ou mais unidades e quer ver ou lançar na outra.

**Passos**
1. Toque no nome da unidade, no topo da tela. Abre a lista das suas unidades.
   - Imagem: topo da tela Início no celular. Seta vermelha no nome da unidade, no alto.
2. Toque na unidade que você quer.
   - Imagem: lista aberta com duas unidades de exemplo. Círculo na segunda unidade.
3. Confira o nome no topo. Agora tudo que você vê e lança é dessa unidade.
   - Imagem: topo com o nome novo. Círculo no nome.

**Deu certo quando:** o nome no topo mudou e as vendas mostradas são da outra unidade.

**Dica:** o app lembra a última unidade escolhida neste aparelho.

**Erro comum:** lançar uma venda na unidade errada. Antes de tocar em **+ Nova venda**, olhe o nome no topo. Se já lançou, veja o guia 6 para excluir e lance de novo na unidade certa.

**Se não resolver:** se o seletor não aparece e você tem duas unidades, a Maxi precisa ligar a segunda ao seu acesso. Guia 31.

---

# VENDER

## 4. Lançar uma venda
`slug: vendas` · **Onde começa:** botão **+ Nova venda** (no meio da barra de baixo; no computador, no topo da barra da esquerda) · **Tempo:** 2 a 4 minutos

**Quando usar:** você vendeu fora do robô (telefone, conhecido, balcão) e quer que a venda conte no mês e desconte do estoque.

**Passos**
1. Toque em **+ Nova venda**. Abre o formulário de venda.
   - Imagem: tela Início no celular, barra de baixo inteira. Seta vermelha no botão redondo **+ Nova venda**, no meio da barra.
2. Em **Cliente**, digite o nome e toque na pessoa. Cliente novo? Digite o nome e o telefone com DDD.
   - Imagem: formulário, parte de cima. Círculo no campo **Cliente** com uma sugestão aparecendo.
3. Em **Produtos**, busque cada produto e acerte a quantidade. O total aparece embaixo.
   - Imagem: lista de produtos da venda com dois itens. Seta no campo de quantidade de um item.
4. Escolha como o cliente pagou em **Pagamento** (Pix, Dinheiro, Crédito, Débito…).
   - Imagem: botões de pagamento. Círculo no botão **Pix** selecionado.
5. Se foi entrega, toque em **Delivery** e confira o endereço e o frete. O frete entra no valor da venda.
   - Imagem: bloco de entrega. Seta em **Delivery** e círculo no campo do frete.
6. Deixe **Já recebi o dinheiro** ligado se o cliente já pagou. Desligue se ele ainda vai pagar.
   - Imagem: chave **Já recebi o dinheiro** ligada (verde). Círculo na chave. `[tela nova]`
7. Toque em **Registrar Venda**. Abre o comprovante da venda.
   - Imagem: fim do formulário. Seta vermelha no botão **Registrar Venda**.

**Deu certo quando:** o comprovante aparece na tela e a venda está na lista de **Vendas**, com o valor certo.

**Dica:** sempre escolha o cliente. É assim que ele entra no "Quem chamar hoje" e você sabe quem voltou a comprar.

**Erro comum:** tocar duas vezes em **Registrar Venda** e ficar com a venda em dobro. Toque uma vez e espere o comprovante. Se duplicou, exclua a repetida (guia 6).

**Se não resolver:** produto não aparece na busca? Veja se ele está oculto no Estoque (guia 13). Senão, Falar com a Maxi (guia 31).

---

## 5. Marcar que recebi o dinheiro
`slug: venda-recebida` · **Onde começa:** Vendas › "A receber" · **Tempo:** 1 minuto

**Quando usar:** você lançou uma venda que ainda não estava paga e agora o dinheiro caiu.

**Passos**
1. Toque em **Vendas**, na barra de baixo. Abre a lista de vendas do mês.
   - Imagem: barra de baixo. Seta vermelha em **Vendas**.
2. Procure a venda com a etiqueta **A receber**.
   - Imagem: lista de vendas com uma venda marcada "A receber". Círculo na etiqueta. `[tela nova]`
3. Confira no banco, no Pix ou na maquininha se o dinheiro entrou mesmo.
   - Imagem: sem recorte do app (passo fora do app). Pode ser um ícone de banco.
4. Toque em **Recebi**. A etiqueta muda para "Recebido em" e a data do dia.
   - Imagem: mesma venda. Seta vermelha no botão **Recebi**, ao lado da etiqueta. `[tela nova]`

**Deu certo quando:** a venda mostra "Recebido em" com a data, e sai da lista "A receber".

**Dica:** a venda já conta no Resultado do mês desde que foi lançada. Marcar "Recebi" serve para conferir o caixa e ajuda o anúncio a achar clientes parecidos com quem comprou.

**Erro comum:** achar que "A receber" quer dizer que a venda não foi feita. A venda está lançada; só falta você confirmar que o dinheiro entrou. Tocou em **Recebi** na venda errada? É o mesmo botão: toque nele de novo e a venda volta para "A receber" (confirmado no código atual, `TabLancar.jsx`: o botão liga e desliga `payment_confirmed`).

**Se não resolver:** guia 6 (corrigir venda) ou Falar com a Maxi (guia 31).

---

## 6. Corrigir ou excluir uma venda
`slug: corrigir-venda` · **Onde começa:** Vendas › toque na venda · **Tempo:** 2 a 3 minutos

**Quando usar:** a venda saiu com produto, quantidade, cliente ou valor errado, ou foi lançada duas vezes.

**Passos**
1. Toque em **Vendas** e ache a venda. Use as setas ao lado do mês se ela for de outro mês.
   - Imagem: topo da tela Vendas. Seta nas setas ◀ ▶ ao lado do nome do mês.
2. Toque na venda para abrir as opções. São dois caminhos separados: siga só um, o que você precisa.
   - Imagem: lista de vendas. Círculo em uma venda.

**Caminho A — corrigir**
3. Toque em **Editar Venda**. Abre o formulário já preenchido.
   - Imagem: opções da venda. Seta vermelha em **Editar Venda**.
4. Mude o que estava errado e toque em **Atualizar Venda**. A venda aparece corrigida na lista. Pronto, não precisa mexer mais nela.
   - Imagem: formulário em modo edição. Seta no botão **Atualizar Venda**, no fim.

**Caminho B — apagar**
5. Toque em **Excluir**. Aparece a pergunta "Excluir venda?".
   - Imagem: opções da venda. Círculo vermelho no botão **Excluir**.
6. Confirme em **Excluir** só se a venda está mesmo errada (repetida ou por engano). Ela some da lista.
   - Imagem: janela "Excluir venda?". Seta no botão de confirmar.

**Deu certo quando:** a lista mostra a venda com os dados certos, ou a venda repetida sumiu, e o total do mês mudou.

**Dica:** para mudar só a forma de pagamento ou o cliente, use **Editar Venda**. Não precisa excluir e lançar de novo.

**Erro comum:** aparecer um aviso sobre o anúncio ao excluir. É porque essa venda já foi contada para o anúncio. Se ela for repetida ou lançada por engano, pode confirmar com **Excluir mesmo assim**.

**Se não resolver:** Falar com a Maxi (guia 31), dizendo a data e o valor da venda.

---

## 7. Mandar e imprimir o comprovante
`slug: comprovante` · **Onde começa:** aviso "Venda registrada!" depois de **Registrar Venda** (ou Vendas › toque na venda para abrir e usar os botões **Compartilhar**/**Imprimir**) · **Tempo:** 1 minuto

**Quando usar:** mandar o comprovante para o cliente ou imprimir para o entregador.

`[conferir]` Passos 1-2 descrevem o comportamento REAL de hoje (`TabLancar.jsx`): não existe uma tela fixa de comprovante com botões "Mandar no WhatsApp"/"Imprimir" — o app usa o compartilhamento do próprio celular. Isso pode mudar com a tela nova; reconferir antes de publicar as imagens.

**Passos**

**Para mandar no WhatsApp**
1. Registre a venda. Aparece o aviso "Venda registrada!" com o botão **Comprovante**. Numa venda antiga, ache-a em **Vendas** e toque nela para abrir os botões **Compartilhar** e **Imprimir**.
   - Imagem: aviso "Venda registrada!" com o botão **Comprovante**. Seta vermelha no botão.
2. Toque em **Comprovante** (venda nova) ou **Compartilhar** (venda antiga). Abre o menu de compartilhar do próprio celular, com o WhatsApp entre as opções.
   - Imagem: menu de compartilhar do celular (Android/iPhone) com o WhatsApp na lista. Círculo no ícone do WhatsApp.
3. Escolha o WhatsApp e o contato. A imagem do comprovante (cliente, telefone, endereço, produtos e total) já vai anexada. Toque em enviar, como manda qualquer foto no WhatsApp.
   - Imagem: WhatsApp com a imagem do comprovante pronta para enviar (cliente fictício). Seta no botão de enviar.

**Para imprimir (é outro caminho, não precisa ter mandado no WhatsApp antes)**
4. Na mesma venda, toque em **Imprimir**. Abre a janela de impressão do aparelho.
   - Imagem: rodapé da venda. Seta vermelha em **Imprimir**.
5. Escolha a sua impressora e toque em imprimir.
   - Imagem: janela de impressão do Android/computador. Círculo no nome da impressora.
6. Saiu fraco ou apagado na impressora térmica? Na janela de impressão, mude a **Escala** para **80%** e imprima de novo.
   - Imagem: janela de impressão com "Mais opções" aberto. Seta vermelha no campo **Escala**, com 80 escrito.

**Deu certo quando:** o cliente recebeu a imagem no WhatsApp, ou o papel saiu legível, com o endereço e o telefone.

**Dica:** o comprovante serve para bobina de 58 mm e de 80 mm sem ajuste. O entregador pode ligar para o telefone que sai no papel.

**Erro comum:** o comprovante sai sem endereço. Quase sempre o endereço não foi preenchido na venda ou no cliente. Edite a venda (guia 6) ou o cliente (guia 10). Papel ainda fraco com escala 80%? Troque a bobina (bobina velha apaga) ou aumente a "densidade" nas configurações da impressora.

**Se não resolver:** Falar com a Maxi (guia 31), com uma foto do papel impresso.

---

## 8. Baixar a planilha de vendas
`slug: planilha-vendas` · **Onde começa:** Mais › Resultado do mês · **Tempo:** 2 minutos

**Quando usar:** você quer a lista de vendas do mês numa planilha (para o contador ou para conferir).

**Passos**
1. Toque em **Mais** e depois em **Resultado do mês**.
   - Imagem: lista do Mais. Seta vermelha em **Resultado do mês**.
2. Escolha o mês com as setas ao lado do nome do mês.
   - Imagem: topo do Resultado. Círculo nas setas ◀ ▶.
3. Role até o fim e toque em **Baixar planilha**. O arquivo é baixado no aparelho.
   - Imagem: fim da tela do Resultado. Seta vermelha em **Baixar planilha**. `[tela nova]`
4. Abra o arquivo baixado. No celular, ele fica em "Downloads" ou nas notificações.
   - Imagem: aviso de download do celular. Círculo no nome do arquivo.

**Deu certo quando:** a planilha abre com uma linha por venda: data, hora, cliente, produtos, pagamento e valor.

**Dica:** para mandar ao contador, abra o arquivo e use o botão de compartilhar do celular.

**Erro comum:** a planilha sai vazia porque o mês escolhido é outro. Confira o mês no topo antes de baixar.

**Se não resolver:** Falar com a Maxi (guia 31).

---

# CLIENTES

## 9. Chamar clientes (Quem chamar hoje)
`slug: clientes` · **Onde começa:** Início › "Quem chamar hoje" (ou Mais › Meus clientes › **Chamar hoje**) · **Tempo:** 3 a 5 minutos por dia

**Quando usar:** todo dia, para chamar no WhatsApp quem tem mais chance de comprar.

**Passos**
1. Toque em **Mais**, depois em **Meus clientes**. Abre a aba **Chamar hoje**.
   - Imagem: tela Meus clientes com a aba **Chamar hoje** aberta. Seta na aba. (pode reusar `quem-chamar-hoje-1.webp` se a aba mantiver o visual)
2. Leia o motivo de cada cartão: quase comprou, hora de repetir, primeira compra, sumido ou voltou a falar.
   - Imagem: um cartão. Círculo na frase do motivo. (já existe: `quem-chamar-hoje-2.webp`)
3. Toque em **Chamar no WhatsApp**. O WhatsApp abre com a mensagem pronta, com o nome do cliente.
   - Imagem: cartão. Seta vermelha em **Chamar no WhatsApp**. (já existe: `quem-chamar-hoje-3.webp`)
4. Leia a mensagem, mude o que quiser e envie pelo WhatsApp da unidade (o mesmo número do robô). Depois de enviar, volte para o app com o botão de voltar do celular.
   - Imagem: conversa do WhatsApp com o texto pronto (cliente fictício). Seta no botão de enviar.
5. De volta ao app, o cartão já sumiu da lista. Não é hora de chamar alguém? Toque em **Pular** e escolha "Só hoje". Se a pessoa pediu para não receber, escolha "Não chamar mais".
   - Imagem: menu do Pular aberto. Círculo em "Só hoje". (já existe: `quem-chamar-hoje-4.webp`)

**Deu certo quando:** o cartão fica marcado como feito e desce na lista. No topo, o número de chamados do mês sobe.

**Dica:** são no máximo 8 por dia, de propósito: mandar mensagem pessoal para poucas pessoas por vez, em vez de uma só mensagem igual para todo mundo, vende mais e evita que o WhatsApp marque seu número como suspeito. Quando você escreve para o cliente, o robô pausa e deixa a conversa com você.

**Erro comum:** tocar em **Chamar no WhatsApp** e não enviar. O cartão já conta como feito. Use **Desfazer**, no aviso que aparece embaixo, e chame depois.

**Se não resolver:** cliente sem telefone não entra na lista. Complete o número (guia 10).

---

## 10. Cadastrar ou corrigir um cliente
`slug: cadastrar-cliente` · **Onde começa:** Mais › Meus clientes › **Todos** · **Tempo:** 2 minutos

**Quando usar:** cliente novo que ainda não comprou, ou telefone, nome ou endereço errado.

**Passos**
1. Toque em **Mais**, depois em **Meus clientes**, e na aba **Todos**.
   - Imagem: Meus clientes, aba **Todos**. Seta vermelha na aba **Todos**.
2. Para cliente novo, toque em **+ Cliente**. Abre o cadastro.
   - Imagem: topo da aba Todos. Círculo vermelho em **+ Cliente**. `[tela nova]`
3. Para corrigir, busque o nome e toque no cliente.
   - Imagem: busca com um nome digitado. Seta no cliente encontrado.
4. Preencha ou corrija nome, telefone com DDD e endereço.
   - Imagem: formulário do cliente. Círculo no campo do telefone.
5. Toque em **Salvar**. O cliente aparece na lista com os dados novos.
   - Imagem: fim do formulário. Seta vermelha em **Salvar**.

**Deu certo quando:** o cliente aparece em **Todos** com o telefone certo, e pode ser escolhido na próxima venda.

**Dica:** telefone só com DDD e número, sem o 55. Cliente de outro país: digite com o código do país.

**Erro comum:** cadastrar a mesma pessoa duas vezes. Antes de tocar em **+ Cliente**, busque o nome e o telefone. Se o app avisar que o telefone já existe, use o cadastro que já está lá.

**Se não resolver:** Falar com a Maxi (guia 31).

---

# ESTOQUE E PEDIDO À FÁBRICA

## 11. Contar o estoque
`slug: contar-estoque` · **Onde começa:** Estoque › aba **Estoque** · **Tempo:** 10 a 20 minutos (conforme o freezer)

**Quando usar:** uma vez por semana, ou quando o número do app não bate com o freezer.

**Passos**
1. Toque em **Estoque**, na barra de baixo. Abre a aba **Estoque** com os produtos.
   - Imagem: barra de baixo. Seta vermelha em **Estoque**.
2. Abra o freezer e conte um produto de cada vez.
   - Imagem: sem recorte do app (passo fora do app).
3. Toque no produto e mude a **Quantidade** para o que você contou.
   - Imagem: produto aberto. Círculo no campo **Quantidade**. `[conferir: contagem direto na lista, com − e +, na tela nova]`
4. Toque em **Salvar**. Aparece "Produto atualizado."
   - Imagem: fim do formulário. Seta vermelha em **Salvar**.
5. Repita para os outros produtos.
   - Imagem: lista do estoque com as quantidades novas. Círculo em uma quantidade.

**Deu certo quando:** os números da lista batem com o freezer.

**Dica:** conte com o freezer organizado por tipo (massas, molhos, outros). Venda lançada já desconta sozinha; pedido entregue já soma sozinho.

**Erro comum:** o número fica negativo ou errado porque uma venda não foi lançada. Lance a venda que faltou (guia 4) em vez de só mudar o número.

**Se não resolver:** Falar com a Maxi (guia 31).

---

## 12. Mudar o preço de venda
`slug: mudar-preco` · **Onde começa:** Estoque › aba **Estoque** › toque no produto · **Tempo:** 2 minutos por produto

**Quando usar:** você quer subir ou ajustar o preço que o cliente paga.

**Passos**
1. Toque em **Estoque** e depois no produto.
   - Imagem: lista do estoque. Seta vermelha em um produto.
2. Veja o custo (vem da Maxi) e o **Preço de venda**.
   - Imagem: produto aberto. Círculo no custo e no **Preço de venda**.
3. Digite o novo **Preço de venda**. Mexa só nesse campo — o custo é fixo, vem da tabela da Maxi. O app mostra o markup, um número que diz o quanto o preço está acima do custo.
   - Imagem: mesmo formulário. Seta no número do markup.
4. Toque em **Salvar**. Aparece "Preço de venda atualizado."
   - Imagem: fim do formulário. Seta vermelha em **Salvar**.

**Deu certo quando:** a lista mostra o preço novo. O robô passa a usar esse preço com os clientes.

**Dica:** o markup recomendado é de 100%: o preço de venda é o dobro do custo. Exemplo: produto que custa R$ 10, venda por R$ 20. Os preços já vêm assim.

**Erro comum:** mudar o custo em vez do preço de venda. O custo é o da tabela da Maxi; mexa só no **Preço de venda**.

**Se não resolver:** Falar com a Maxi (guia 31).

---

## 13. Cadastrar produto próprio ou ocultar um produto
`slug: produto-proprio` · **Onde começa:** Estoque › aba **Estoque** · **Tempo:** 3 minutos

**Quando usar:** você vende algo que não é da Maxi (queijo ralado, um molho seu), ou quer parar de vender um produto. São dois caminhos separados: siga só o que você precisa.

**Caminho A — cadastrar produto próprio**
1. Toque em **Estoque** e em **Adicionar Produto**.
   - Imagem: topo da aba Estoque. Seta vermelha em **Adicionar Produto**.
2. Preencha **Nome do Produto**, custo, preço de venda e quantidade.
   - Imagem: formulário de produto novo. Círculo em **Nome do Produto**.
3. Toque em **Salvar**. Aparece "Produto adicionado ao estoque." Pronto, não precisa fazer mais nada.
   - Imagem: fim do formulário. Seta em **Salvar**.

**Caminho B — ocultar um produto que já existe**
4. Toque no produto (próprio ou da Maxi) e em **Ocultar do catálogo**.
   - Imagem: produto aberto. Círculo vermelho em **Ocultar do catálogo**.
5. Confira: o produto oculto continua na lista do Estoque, mas com o nome apagado (cinza claro), para você lembrar que ele está oculto. Ele só some das ofertas do robô e da **+ Nova venda**.
   - Imagem: lista com um produto apagado. Seta nele. `[conferir visual exato do oculto na tela nova]`

**Deu certo quando:** o produto próprio aparece na lista e na **+ Nova venda**; o oculto continua na lista do Estoque (apagado), mas não aparece mais nas ofertas do robô.

**Dica:** oculto é diferente de zerado. Oculto: o robô não oferece, mesmo que tenha estoque. Zerado (quantidade 0): o robô continua oferecendo, mas avisa que está em falta no momento.

**Erro comum:** procurar o produto próprio em **Pedir à fábrica**. Ele não aparece lá: o pedido à fábrica só tem os produtos da Maxi.

**Se não resolver:** sumiu um produto da Maxi do seu pedido? Falar com a Maxi (guia 31) para recolocar.

---

## 14. Fazer pedido à fábrica
`slug: pedido-fabrica` (alias `estoque`) · **Onde começa:** Estoque › aba **Pedir à fábrica** · **Tempo:** 5 a 10 minutos

**Quando usar:** repor o freezer com os produtos da Maxi.

**Passos**
1. Toque em **Estoque** e na aba **Pedir à fábrica**. A lista já vem com uma sugestão pronta.
   - Imagem: aba **Pedir à fábrica**. Seta vermelha no nome da aba, no topo. `[tela nova]`
2. Ajuste cada produto com **−** e **+**.
   - Imagem: um produto da lista. Círculo nos botões **−** e **+**. `[tela nova]`
3. Confira o total, o peso e o **frete estimado**, no fim da lista.
   - Imagem: rodapé do pedido. Círculo no frete estimado. `[tela nova]`
4. Toque em **Enviar pedido à fábrica**. Aparece a confirmação de pedido enviado.
   - Imagem: rodapé. Seta vermelha em **Enviar pedido à fábrica**. `[tela nova]`
5. Acompanhe no cartão do pedido a caminho, no topo da aba.
   - Imagem: cartão do pedido a caminho. Círculo no cartão. `[tela nova]`

**Deu certo quando:** o cartão do pedido aparece no topo da aba **Pedir à fábrica**.

**Dica:** a sugestão olha o que você vendeu nas últimas semanas. No primeiro pedido, a lista vem com o pedido modelo da Maxi. Os pedidos fecham no domingo; a Maxi avisa a data de entrega.

**Erro comum:** enviar sem conferir as quantidades da sugestão. Ela é um ponto de partida: mude o que precisar antes de enviar. Enviou errado? Fale com a Maxi logo (guia 31).

**Se não resolver:** Falar com a Maxi (guia 31).

---

## 15. Imprimir o pedido
`slug: imprimir-pedido` · **Onde começa:** Estoque › **Pedir à fábrica** › cartão do pedido · **Tempo:** 2 minutos

**Quando usar:** ter o pedido no papel para controle ou para conferir a mercadoria quando chegar.

**Passos**
1. Em **Pedir à fábrica**, toque no cartão do pedido.
   - Imagem: cartão do pedido. Seta no cartão. `[tela nova]`
2. Toque em **Imprimir pedido**. Aparecem duas opções.
   - Imagem: cartão aberto. Círculo vermelho em **Imprimir pedido**. `[tela nova]`
3. Escolha **só quantidades** (para conferir a chegada) ou **com valores** (para seu controle).
   - Imagem: as duas opções. Seta em "só quantidades". `[tela nova]` `[conferir rótulos exatos]`
4. Na janela de impressão, escolha a impressora e imprima (ou salve em PDF).
   - Imagem: janela de impressão. Círculo no nome da impressora.

**Deu certo quando:** o papel sai com a lista de produtos e as quantidades, e uma coluna em branco para marcar o que chegou.

**Dica:** imprima "só quantidades" antes da entrega e deixe perto do freezer. Assim quem recebe confere sem ver valores.

**Erro comum:** o PDF abre mas não imprime no celular. Use o botão de compartilhar do celular e escolha a impressora, ou mande o PDF para o seu WhatsApp e imprima no computador.

**Se não resolver:** Falar com a Maxi (guia 31).

---

## 16. Conferir o pedido quando chegar
`slug: conferir-chegada` · **Onde começa:** Estoque › **Pedir à fábrica** › cartão do pedido a caminho · **Tempo:** 10 minutos

**Quando usar:** a mercadoria chegou e você precisa conferir antes de pôr no freezer.

**Passos**
1. Confira as caixas com o papel do pedido (guia 15): quantidades, embalagem e se está congelado.
   - Imagem: sem recorte do app. Pode ser foto do papel impresso com marcações.
2. Abra o cartão do pedido a caminho, em **Pedir à fábrica**.
   - Imagem: cartão do pedido a caminho. Seta no cartão. `[tela nova]`
3. Veio tudo? Toque em **Recebi tudo certo**. O estoque sobe sozinho.
   - Imagem: cartão aberto. Seta vermelha em **Recebi tudo certo**. `[tela nova]`
4. Faltou algo? Toque em **Faltou algo** e marque o que não veio.
   - Imagem: tela do "Faltou algo". Círculo em um produto marcado. `[tela nova]` `[decisão Nelson: o que acontece com o valor cobrado]`
5. Toque em enviar `[conferir rótulo]`. A Maxi é avisada.
   - Imagem: fim da tela. Seta no botão de enviar. `[tela nova]`

**Deu certo quando:** o pedido aparece como entregue e as quantidades do Estoque subiram.

**Dica:** você paga o pedido depois de conferir, pelo Pix. Produto amassado ou descongelado: tire foto na hora.

**Erro comum:** tocar em **Recebi tudo certo** antes de conferir. Confira primeiro; se já tocou e faltou algo, fale com a Maxi com a foto (guia 31).

**Se não resolver:** Falar com a Maxi (guia 31), com fotos do que veio errado.

---

## 17. Repetir um pedido
`slug: repetir-pedido` · **Onde começa:** Estoque › **Pedir à fábrica** · **Tempo:** 3 minutos

**Quando usar:** você quer pedir igual ao último pedido.

**Passos**
1. Em **Pedir à fábrica**, ache o último pedido.
   - Imagem: lista de pedidos anteriores. Seta no último pedido. `[tela nova]`
2. Toque em **Repetir**. A lista se enche com as mesmas quantidades.
   - Imagem: cartão do pedido. Círculo vermelho em **Repetir**. `[tela nova]`
3. Ajuste com **−** e **+** o que mudou.
   - Imagem: lista preenchida. Círculo em **−** e **+**.
4. Toque em **Enviar pedido à fábrica**. Aparece a confirmação.
   - Imagem: rodapé. Seta vermelha em **Enviar pedido à fábrica**.

**Deu certo quando:** o pedido novo aparece no cartão do pedido a caminho.

**Dica:** compare com a sugestão pronta. Ela olha o que você vendeu de verdade, o último pedido não.

**Erro comum:** repetir um pedido grande num mês fraco e ficar com o freezer cheio. Olhe o Estoque antes.

**Se não resolver:** Falar com a Maxi (guia 31).

---

# DINHEIRO

## 18. Ver quanto sobrou no mês
`slug: resultado` · **Onde começa:** Mais › Resultado do mês · **Tempo:** 3 a 5 minutos

**Quando usar:** saber se o mês deu resultado e para onde foi o dinheiro.

**Passos**
1. Toque em **Mais** e em **Resultado do mês**.
   - Imagem: lista do Mais. Seta vermelha em **Resultado do mês**.
2. Escolha o mês com as setas ao lado do nome do mês.
   - Imagem: topo da tela. Círculo nas setas ◀ ▶.
3. Leia o número grande **Sobrou no mês**.
   - Imagem: topo do Resultado. Seta vermelha no **Sobrou no mês**. `[tela nova]`
4. Veja **Entrou × Saiu**, logo abaixo.
   - Imagem: bloco Entrou × Saiu. Círculo no bloco. `[tela nova]`
5. Role para ver **De onde veio**, **Para onde foi**, **Mais vendidos** e **O que mudou**.
   - Imagem: meio da tela. Setas nos títulos **Para onde foi** e **O que mudou**. `[tela nova]`
6. No fim, veja **Quanto sobrou por mês**, para comparar com os meses anteriores.
   - Imagem: gráfico de barras. Círculo na barra do mês atual. `[tela nova]`

**Deu certo quando:** você sabe quanto entrou, quanto saiu e quanto sobrou no mês.

**Dica:** "Sobrou no mês" = o que entrou com as vendas (com frete, menos desconto) menos a taxa de cartão que a unidade pagou e os gastos lançados. Não é o dinheiro que está no seu banco agora: é a conta do app, que pode estar à frente ou atrás do banco (por exemplo, venda "A receber" já conta aqui mesmo sem o dinheiro ter caído ainda).

**Erro comum:** o número parece alto demais porque faltam gastos (gás, sacolas, aluguel). Lance os gastos (guia 19) para o número ficar mais próximo da realidade. Já o pedido à fábrica entregue, a verba de anúncio confirmada e a mensalidade paga entram como gasto sozinhos, sem você lançar — só os gastos do dia a dia (guia 19) dependem de você.

**Se não resolver:** Falar com a Maxi (guia 31).

---

## 19. Lançar um gasto
`slug: lancar-gasto` · **Onde começa:** Mais › Resultado do mês › **+ Registrar gasto** · **Tempo:** 1 a 2 minutos

**Quando usar:** você pagou algo da unidade: sacolas, gás, entregador, aluguel, embalagem.

**Passos**
1. Toque em **Mais** e em **Resultado do mês**.
   - Imagem: lista do Mais. Seta em **Resultado do mês**.
2. Toque em **+ Registrar gasto**. Abre o formulário.
   - Imagem: tela do Resultado. Seta vermelha em **+ Registrar gasto**. `[tela nova]`
3. Escolha o tipo do gasto (por exemplo, embalagem ou transporte).
   - Imagem: lista de tipos. Círculo em um tipo.
4. Digite o valor e confira a data.
   - Imagem: formulário. Círculo no valor.
5. Toque em **Salvar**. O gasto aparece em **Para onde foi** e o "Sobrou no mês" diminui.
   - Imagem: fim do formulário. Seta em **Salvar**.

**Deu certo quando:** o gasto aparece na lista do mês e o "Sobrou no mês" mudou.

**Dica:** lance o gasto no dia em que pagou. No fim do mês fica difícil lembrar.

**Erro comum:** lançar à mão o pedido à fábrica, a verba do anúncio ou a mensalidade. Esses entram sozinhos. Lançar de novo conta em dobro. Se já lançou, apague o repetido na lista **Para onde foi** `[conferir como excluir gasto na tela nova]`.

**Se não resolver:** Falar com a Maxi (guia 31).

---

## 20. Baixar o relatório do mês
`slug: relatorio-mes` · **Onde começa:** Mais › Resultado do mês · **Tempo:** 1 minuto

**Quando usar:** ter o resumo do mês numa folha, para consultar ou mostrar a alguém.

**Passos**
1. Toque em **Mais** e em **Resultado do mês**.
   - Imagem: lista do Mais. Seta em **Resultado do mês**.
2. Escolha o mês com as setas.
   - Imagem: topo da tela. Círculo nas setas ◀ ▶.
3. Toque em **Baixar relatório do mês (PDF)**. O arquivo é baixado.
   - Imagem: tela do Resultado. Seta vermelha em **Baixar relatório do mês (PDF)**.
4. Abra o PDF pelo aviso de download.
   - Imagem: página do PDF (unidade fictícia). Círculo nos três meses lado a lado.

**Deu certo quando:** abre um PDF de 1 página com 3 meses lado a lado, os mais vendidos e o anúncio.

**Dica:** para mandar a alguém, abra o PDF e use o botão de compartilhar do celular.

**Erro comum:** o relatório sai com o mês errado. Escolha o mês antes de tocar no botão. Se aparecer aviso de que o anúncio não carregou, o resto do relatório está certo; tente de novo mais tarde.

**Se não resolver:** Falar com a Maxi (guia 31).

---

## 21. Pagar a Equipe Digital Maxi
`slug: pagar-equipe-digital` · **Onde começa:** Mais › Pagamentos · **Tempo:** 3 minutos

**Quando usar:** pagar a mensalidade de R$ 150 (gestão dos anúncios, painel, robô e artes).

**Passos**
1. Toque em **Mais** e em **Pagamentos**.
   - Imagem: lista do Mais. Seta vermelha em **Pagamentos**. `[tela nova]`
2. No quadro **Equipe Digital Maxi**, confira o valor e o vencimento.
   - Imagem: quadro Equipe Digital Maxi. Círculo no valor R$ 150 e no vencimento. `[tela nova]`
3. Para Pix, toque em **Copiar código Pix**. Abra o app do seu banco, vá em "Pix Copia e Cola" (ou "Pagar com Pix") e cole o código lá. Se preferir, abra a câmera do banco em outro celular e aponte para o QR Code que aparece na tela.
   - Imagem: quadro com o QR. Seta vermelha em **Copiar código Pix**. `[tela nova]`
4. Prefere boleto? Toque em **Baixar boleto**. O PDF é baixado no celular; abra-o e pague pelo app do banco (ler o código de barras) ou impresso, no caixa.
   - Imagem: mesmo quadro. Círculo em **Baixar boleto**. `[tela nova]`
5. Depois de pagar, toque em **Já paguei**. O app confere se o pagamento chegou.
   - Imagem: mesmo quadro. Seta em **Já paguei**. `[tela nova]`

**Deu certo quando:** o quadro mostra a mensalidade como paga.

**Dica:** Pix costuma aparecer em poucos minutos. Boleto leva o tempo do banco. A verba do anúncio é à parte, no quadro de baixo (guia 22).

**Erro comum:** deixar vencer. No 1º e no 2º dia de atraso, o app avisa com uma faixa vermelha, mas você continua usando normalmente — dá para pagar, trocar de unidade e lançar venda sem travar em nada. A partir do 3º dia de atraso, o app trava numa tela só de pagamento; mesmo travada, você ainda consegue pagar, trocar de unidade pelo seletor da própria tela e ir em "Lançar uma venda agora" (a venda continua contando, só o resto do app é que fica bloqueado até o pagamento cair) (`subscriptionStatus.js`, decisão do Nelson, 27-28/09/2026).

**Se não resolver:** pagou e continua bloqueado? Toque em **Já paguei** de novo. Se seguir, Falar com a Maxi com o comprovante (guia 31).

---

## 22. Registrar a verba do anúncio
`slug: verba-marketing` · **Onde começa:** Mais › Pagamentos (quadro da verba do anúncio) · **Tempo:** 5 minutos

**Quando usar:** todo mês, quando você paga o dinheiro dos anúncios da sua unidade.

**Passos**
1. Toque em **Mais** e em **Pagamentos**. Role até o quadro da verba do anúncio.
   - Imagem: tela Pagamentos. Seta vermelha no quadro da verba. `[tela nova]`
2. Confira o mês no título do quadro. Nos últimos 5 dias do mês, ele já mostra o mês seguinte: mesmo assim dá para pagar o mês atual normalmente, o quadro só está adiantado.
   - Imagem: título do quadro. Círculo no nome do mês. `[tela nova]`
3. Faça o Pix no CNPJ da Maxi: **00.494.317/0001-21**. O mínimo é R$ 200.
   - Imagem: quadro com a chave Pix. Seta no CNPJ e no botão de copiar `[conferir se há botão de copiar]`. `[tela nova]`
4. Digite o valor que você pagou.
   - Imagem: campo do valor. Círculo no campo. `[tela nova]`
5. Toque em **Anexar** e escolha o comprovante do Pix na galeria do celular (foto da tela do banco) ou nos arquivos (se for PDF).
   - Imagem: botão de anexar aberto, com a galeria do celular. Seta no botão. `[tela nova]`
6. Toque em **Registrar verba**. O registro fica aguardando a conferência da Maxi.
   - Imagem: fim do quadro. Seta vermelha em **Registrar verba**. `[tela nova]`

**Deu certo quando:** o quadro mostra a verba do mês como registrada, aguardando conferência. Depois muda para confirmada.

**Dica:** do valor pago, 14% ficam em impostos e taxas: de R$ 200, R$ 172 vão para o anúncio. A verba é à parte da mensalidade (sem fundo de marketing). Confirmada quer dizer que a Maxi conferiu o pagamento; a campanha entra no ar depois.

**Erro comum:** achar que registrar no app faz o Pix. Não faz: o Pix é no seu banco. Sem o comprovante agora? Dá para registrar e anexar depois.

**Se não resolver:** Falar com a Maxi (guia 31), com o comprovante.

---

# MARKETING

## 23. Baixar as artes e a legenda do mês
`slug: artes` · **Onde começa:** Mais › Marketing · **Tempo:** 5 a 10 minutos

**Quando usar:** pegar as artes prontas do mês para postar no Instagram e no Facebook da unidade.

**Passos**
1. Toque em **Mais** e em **Marketing**.
   - Imagem: lista do Mais. Seta vermelha em **Marketing**.
2. Escolha o mês no filtro **Mês**. Os botões de cima filtram por tipo: Imagens, Vídeos, PDFs e Links.
   - Imagem: topo dos materiais. Círculo no filtro **Mês**.
3. Se a arte tem legenda, toque em **Copiar legenda** ANTES de baixar a imagem. O texto fica guardado no celular, pronto para colar depois.
   - Imagem: cartão da arte. Seta em **Copiar legenda**.
4. Toque em **Baixar** na mesma arte. Uma tela nova abre só com a imagem, maior.
   - Imagem: cartão de uma arte. Seta vermelha em **Baixar**.
5. Nessa tela, toque e segure o dedo em cima da imagem. Aparece um menu do próprio celular: escolha "Salvar imagem" (ou "Baixar imagem"). Depois, use o botão de voltar do celular para retornar ao Marketing e repetir para as próximas artes.
   - Imagem: imagem aberta com o menu do celular. Círculo em "Salvar imagem" (ou "Baixar imagem").

**Deu certo quando:** a arte está na galeria do celular e a legenda está copiada, pronta para colar.

**Dica:** baixe as artes do mês de uma vez e agende tudo no Meta Business Suite (guia 24). Poste também na aba Atualizações do WhatsApp.

**Erro comum:** achar que o app posta sozinho. Não posta: a postagem é feita por você, no Instagram ou no Facebook da unidade.

**Se não resolver:** não achou a arte do mês? Falar com a Maxi (guia 31).

---

## 24. Agendar postagens no Meta Business Suite
`slug: agendar-postagens` · **Onde começa:** app **Meta Business Suite** no celular (ou business.facebook.com no computador), fora do app da Maxi · **Tempo:** 20 a 30 minutos para o mês todo

**Quando usar:** deixar as postagens do mês programadas de uma vez, no Instagram e no Facebook da unidade.

> `[conferir]` Os rótulos do Meta mudam com frequência. Tirar os prints da versão atual antes de publicar e ajustar os nomes (Planejador × Planner, Criar publicação, Agendar).

**Passos**
1. Baixe as artes e copie as legendas (guia 23).
   - Imagem: sem recorte novo (reusar a imagem do guia 23).
2. Abra o **Meta Business Suite** e entre na página da unidade.
   - Imagem: tela inicial do Meta Business Suite. Círculo no nome da página da unidade.
3. Toque em **Planejador**. Abre o calendário do mês.
   - Imagem: menu do Meta Business Suite. Seta vermelha em **Planejador**.
4. Toque em **Criar publicação** e marque Facebook e Instagram.
   - Imagem: tela de criar publicação. Círculo nas duas marcações (Facebook e Instagram).
5. Adicione a foto e cole a legenda.
   - Imagem: mesma tela. Seta em "Adicionar foto" e no campo do texto.
6. Toque na setinha ao lado de **Publicar**, escolha **Agendar** e a data e hora.
   - Imagem: opções de publicação. Seta vermelha em **Agendar**.
7. Confirme em **Agendar**. A postagem aparece no calendário do Planejador.
   - Imagem: calendário com a postagem no dia. Círculo na postagem.

**Deu certo quando:** o calendário do Planejador mostra as postagens nos dias escolhidos.

**Dica:** poste em dias e horários variados, de 3 a 4 vezes por semana. Os vídeos "Planner" e "Planner Reforço" no Drive mostram o mesmo passo a passo.

**Erro comum:** o Instagram não aparece para marcar. Ele não está ligado à página da unidade. A Maxi faz essa ligação: fale com a equipe (guia 31).

**Se não resolver:** Falar com a Maxi (guia 31).

---

# MEU ROBÔ

## 25. Ajustar os horários do robô
`slug: robo-horarios` · **Onde começa:** Mais › Meu robô › **Horários** · **Tempo:** 5 minutos

**Quando usar:** mudou o dia ou o horário de atender e de entregar.

**Passos**
1. Toque em **Mais** e em **Meu robô**.
   - Imagem: lista do Mais. Seta vermelha em **Meu robô**.
2. Toque em **Horários**.
   - Imagem: lista do Meu robô. Círculo em **Horários**. `[tela nova]`
3. Marque os dias em que a unidade entrega e o horário de cada faixa.
   - Imagem: tela de horários. Círculo nos dias marcados.
4. Se quiser, escolha **Pedidos até**: o horário limite para sair no mesmo dia.
   - Imagem: mesma tela. Seta no campo **Pedidos até** (e no "?" ao lado).
5. Toque em **Salvar** `[conferir rótulo]`. Aparece a confirmação.
   - Imagem: fim da tela. Seta no botão de salvar.

**Deu certo quando:** a tela mostra os dias e horários novos. O robô passa a falar esses horários.

**Dica:** depois do horário de **Pedidos até**, o robô continua atendendo: anota o pedido e combina para o próximo horário de entrega.

**Erro comum:** apagar o horário para fechar um dia. Use **Remover estes dias**. Apagar o horário deixa a tela com erro e não salva.

**Se não resolver:** "Só funciona em outro celular"? Pode ser um rascunho antigo neste aparelho. Falar com a Maxi (guia 31).

---

## 26. Ajustar entrega, frete e retirada
`slug: robo-entrega` · **Onde começa:** Mais › Meu robô › **Entrega e frete** (e **Retirada**) · **Tempo:** 5 a 10 minutos

**Quando usar:** mudar o frete, o pedido mínimo, a distância de entrega ou o endereço de retirada.

**Passos**
1. Toque em **Mais**, **Meu robô** e **Entrega e frete**.
   - Imagem: lista do Meu robô. Seta vermelha em **Entrega e frete**. `[tela nova]`
2. Escolha o tipo de taxa: **Valor único**, **Por distância** ou **Grátis**.
   - Imagem: botões da taxa. Círculo em **Por distância**.
3. Preencha os valores. Em **Por distância**, cada faixa de km tem um preço.
   - Imagem: faixas de km. Círculo em uma faixa.
4. Se quiser, preencha o **Pedido mínimo**. Em branco = sem mínimo.
   - Imagem: campo **Pedido mínimo**. Seta no campo e no "?".
5. Toque em **Salvar** `[conferir rótulo]`. Aparece a confirmação.
   - Imagem: fim da tela. Seta no botão de salvar.
6. Para retirada, volte e toque em **Retirada**. Ligue a retirada e confira o endereço e o horário.
   - Imagem: tela de Retirada. Círculo na chave de retirada. `[tela nova]`

**Deu certo quando:** o robô cobra o frete novo. Confira com o **Testar como um cliente** (guia 30).

**Dica:** o robô calcula a distância até o endereço do cliente antes de falar o frete. Por isso o endereço da unidade precisa estar certo em **Minha unidade**.

**Erro comum:** tocar em outro tipo de taxa só para olhar e salvar sem querer. Antes de salvar, confira se o tipo escolhido é o que você quer.

**Se não resolver:** o robô fala um frete diferente do que está na tela? Falar com a Maxi (guia 31), com um print da conversa.

---

## 27. Escolher as formas de pagamento
`slug: robo-pagamento` · **Onde começa:** Mais › Meu robô › **Formas de pagamento** · **Tempo:** 3 minutos

**Quando usar:** passou a aceitar (ou deixou de aceitar) cartão, dinheiro, Pix ou vale-refeição.

**Passos**
1. Toque em **Mais**, **Meu robô** e **Formas de pagamento**.
   - Imagem: lista do Meu robô. Seta vermelha em **Formas de pagamento**. `[tela nova]`
2. Em **Entrega**, marque o que você aceita na entrega.
   - Imagem: bloco Entrega. Círculo nas opções marcadas.
3. Em **Retirada**, marque o que você aceita na retirada.
   - Imagem: bloco Retirada. Círculo nas opções marcadas.
4. Confira a chave Pix da unidade.
   - Imagem: campo da chave Pix. Seta no campo.
5. Toque em **Salvar** `[conferir rótulo]`. Aparece a confirmação.
   - Imagem: fim da tela. Seta no botão de salvar.

**Deu certo quando:** o robô oferece só as formas marcadas em cada caso.

**Dica:** Pix e link de pagamento (um link que abre a tela de pagamento por cartão) são formas de pagar ANTES da entrega: o robô pede o comprovante e só fecha o pedido depois de receber.

**Erro comum:** marcar dinheiro só em Retirada e estranhar que o robô recusa dinheiro na entrega. Marque nos dois blocos se aceita nos dois.

**Se não resolver:** o nome no Pix precisa bater com o titular da conta. Para trocar a chave ou o titular, Falar com a Maxi (guia 31).

---

## 28. Trocar o cardápio do robô
`slug: robo-cardapio` · **Onde começa:** Mais › Meu robô › **Cardápio** · **Tempo:** 3 minutos (com a foto pronta)

**Quando usar:** mudou preço ou produto e o cardápio que o robô manda precisa ser o novo.

**Passos**
1. Deixe a imagem nova do cardápio no celular (JPG, feita no Canva a partir do modelo da Maxi).
   - Imagem: sem recorte do app (passo fora do app).
2. Toque em **Mais**, **Meu robô** e **Cardápio**.
   - Imagem: lista do Meu robô. Seta vermelha em **Cardápio**. `[tela nova]`
3. Toque para enviar a foto nova e escolha a imagem na galeria `[conferir rótulo do botão]`.
   - Imagem: tela do cardápio com a foto atual. Seta no botão de trocar a foto.
4. Espere a foto nova aparecer na tela.
   - Imagem: tela com a foto nova. Círculo na foto.

**Deu certo quando:** a tela mostra o cardápio novo. Nas próximas conversas, o robô manda essa foto.

**Dica:** o robô manda o cardápio uma vez por conversa. Mude os preços no Estoque também (guia 12), para bater com a foto.

**Erro comum:** foto torta, cortada ou escura. Use o arquivo exportado do Canva, não um print da tela.

**Se não resolver:** o robô ainda manda o cardápio antigo depois de algumas horas? Falar com a Maxi (guia 31).

---

## 29. Reconectar o WhatsApp do robô
`slug: reconectar-whatsapp` · **Onde começa:** Mais › Meu robô › **Verificar** · **Tempo:** 3 a 5 minutos

**Quando usar:** o robô parou de responder os clientes.

**Passos**
1. Abra o app no computador ou em outro celular. O celular da unidade vai ler o código dessa tela.
   - Imagem: sem recorte (ilustração de dois aparelhos).
2. Toque em **Mais**, **Meu robô** e **Verificar**. O app mostra se o WhatsApp está conectado.
   - Imagem: topo do Meu robô. Seta vermelha em **Verificar**. `[tela nova]`
3. Desconectado? Toque em **Gerar QR Code** `[conferir rótulo na tela nova]`. Aparece o código.
   - Imagem: quadro da conexão com o QR Code. Seta no botão.
4. No celular da unidade, abra o WhatsApp: **Menu**, **Aparelhos conectados**, **Conectar um aparelho**.
   - Imagem: WhatsApp Business do celular, tela Aparelhos conectados. Círculo em **Conectar um aparelho**.
5. Aponte a câmera para o QR Code da tela.
   - Imagem: sem recorte do app (foto do celular lendo a tela).
6. Toque em **Verificar** de novo. Aparece a mensagem de conectado.
   - Imagem: quadro da conexão com o aviso verde. Círculo no aviso.

**Deu certo quando:** o app diz que está conectado e o robô responde uma mensagem de teste (guia 30).

**Dica:** a conexão cai quando o celular da unidade fica muito tempo sem internet ou sem bateria. Deixe-o carregando e no Wi-Fi.

**Erro comum:** tentar ler o QR com o próprio celular que mostra o código. Precisa de duas telas: uma mostra, a outra lê.

**Se não resolver:** conectou e o robô não responde? Falar com a Maxi (guia 31).

---

## 30. Testar o robô como um cliente
`slug: testar-robo` · **Onde começa:** Mais › Meu robô › **Testar como um cliente** · **Tempo:** 5 minutos

**Quando usar:** depois de mudar horário, frete, pagamento ou cardápio, ou quando um cliente reclamou. Este teste é dentro do app, uma conversa de mentira — não é o mesmo que mandar mensagem de verdade pelo WhatsApp (isso é a Dica, abaixo, e não cria pedido nenhum).

**Passos**
1. Toque em **Mais**, **Meu robô** e **Testar como um cliente**.
   - Imagem: lista do Meu robô. Seta vermelha em **Testar como um cliente**. `[tela nova]` `[conferir o que o botão abre]`
2. Escreva "oi", como um cliente faria.
   - Imagem: tela do teste com a primeira mensagem. Círculo no campo de escrever.
3. Peça um produto e diga um endereço de entrega. É só um teste: não vira pedido de verdade, não gera cobrança nem entrega.
   - Imagem: conversa de teste. Círculo na resposta com o frete.
4. Confira: horário, frete, formas de pagamento e cardápio estão certos?
   - Imagem: resposta do robô. Setas no valor do frete e nas formas de pagamento.

**Deu certo quando:** o robô responde com o que você configurou.

**Dica:** o teste acima é só dentro do app. Se quiser testar o WhatsApp de verdade, peça para outra pessoa (não pelo celular da unidade) mandar "oi" para o número da unidade.

**Erro comum:** testar o WhatsApp de verdade pelo próprio celular da unidade. O robô não conversa com o próprio número; use o teste dentro do app (acima) nesse caso.

**Se não resolver:** resposta errada? Ajuste no Meu robô (guias 25 a 28). Se continuar, Falar com a Maxi com um print (guia 31).

---

# AJUDA

## 31. Falar com a Maxi
`slug: falar-com-maxi` · **Onde começa:** Mais › Falar com a Maxi · **Tempo:** 1 minuto

**Quando usar:** um guia não resolveu, ou é algo que só a equipe faz (troca de titular, chave Pix, Instagram, cobrança).

**Passos**
1. Toque em **Mais** e em **Falar com a Maxi**.
   - Imagem: lista do Mais. Seta vermelha em **Falar com a Maxi**. `[tela nova]`
2. O WhatsApp da Maxi abre com uma mensagem inicial pronta. Você pode enviar ela do jeito que está, ou apagar e escrever o que aconteceu em poucas palavras, dizendo qual tela.
   - Imagem: conversa aberta no WhatsApp com o texto inicial. Círculo no texto. `[conferir o texto pronto]`
3. Se puder, anexe uma foto de tela do celular (aperte os dois botões do celular ao mesmo tempo — ligar e volume — para tirar a foto da tela, ela fica salva na galeria) ou uma foto comum. Depois, toque no botão de enviar.
   - Imagem: WhatsApp com a foto anexada. Seta no botão de enviar.

**Deu certo quando:** a mensagem foi enviada e aparece com os dois tiques.

**Dica:** diga o nome da unidade, a tela e o que você tocou. Print ajuda muito.

**Erro comum:** mandar no grupo das franquias. Dúvida da sua unidade vai no privado da Maxi.

**Se não resolver:** a equipe responde no horário comercial.

---

# (1) Lista de imagens a produzir

Padrão: `/public/tutoriais/<slug>-<n>.webp`, recorte no celular (390 px), seta ou círculo vermelho (#b91c1c), unidade e clientes fictícios (nunca número real de outra unidade).

## A. Já dá para tirar das telas ATUAIS (não mudam no redesenho)

| Arquivo | Tela | Recorte e marcação |
|---|---|---|
| `primeiros-passos-1..6.webp` | Trilha Primeiros passos | JÁ EXISTEM (reusar) |
| `quem-chamar-hoje-2..6.webp` | Meus clientes, cartões do dia | JÁ EXISTEM (reusar; o `-1` depende da aba nova "Chamar hoje") |
| `esqueci-senha-1.webp` | Entrada do app | seta no link "Primeiro acesso ou esqueceu a senha?" |
| `esqueci-senha-2.webp` | Entrada, modo "Receber link de acesso" | círculo no campo de e-mail |
| `esqueci-senha-3.webp` | Aviso após "Enviar link" | seta no aviso verde com o e-mail |
| `esqueci-senha-4.webp` | E-mail do link (caixa de entrada fictícia) | círculo no botão do link |
| `esqueci-senha-5.webp` | Tela de criar senha | seta no botão de salvar |
| `trocar-unidade-1..3.webp` | Seletor de unidade no topo | seta no nome; círculo na 2ª unidade; círculo no nome novo |
| `vendas-2..5.webp` | Formulário de venda (cliente, produtos, pagamento, Delivery) | círculo em Cliente; seta na quantidade; círculo em Pix; seta em Delivery e no frete |
| `vendas-7.webp` | Fim do formulário | seta em "Registrar Venda" |
| `corrigir-venda-3..6.webp` | Opções da venda, formulário em edição, janela "Excluir venda?" | seta em "Editar Venda"; seta no salvar; círculo em "Excluir"; seta no confirmar |
| `comprovante-1..5.webp` | Comprovante e janela de impressão | círculo em Telefone/Endereço; seta em "Mandar no WhatsApp"; seta em "Imprimir"; círculo na impressora; seta no campo Escala = 80% |
| `cadastrar-cliente-3..5.webp` | Busca de cliente e formulário | seta no cliente; círculo no telefone; seta em "Salvar" |
| `mudar-preco-2..4.webp` | Formulário do produto no Estoque | círculo no custo e no Preço de venda; seta no markup; seta em "Salvar" |
| `produto-proprio-2..4.webp` | Formulário "Adicionar Produto" e produto aberto | círculo em "Nome do Produto"; seta em "Salvar"; círculo em "Ocultar do catálogo" |
| `relatorio-mes-4.webp` | Página do PDF do relatório (unidade fictícia) | círculo nos 3 meses lado a lado |
| `artes-2..5.webp` | Marketing, materiais do mês | círculo no filtro Mês; seta em "Copiar legenda"; seta em "Baixar"; círculo em "Salvar imagem" |
| `agendar-postagens-2..7.webp` | Meta Business Suite (fora do app) | nome da página; seta em Planejador; marcações FB/IG; foto e legenda; seta em Agendar; postagem no calendário |
| `robo-horarios-3..5.webp` | Cartão de horários do wizard atual | dias marcados; seta em "Pedidos até"; seta no salvar |
| `robo-entrega-2..5.webp` | Cartão "Entrega" do wizard atual | círculo em "Por distância"; faixa de km; seta em Pedido mínimo e "?"; salvar |
| `robo-pagamento-2..5.webp` | Etapa de pagamento do wizard atual | blocos Entrega e Retirada; chave Pix; salvar |
| `reconectar-whatsapp-3..6.webp` | Quadro de conexão com QR e WhatsApp Business do celular | botão do QR; "Conectar um aparelho"; aviso verde |
| `pedido-fabrica-*`, `conferir-chegada-1.webp` | Foto do papel impresso com marcações | (depois que a impressão existir) |

## B. Dependem das telas NOVAS (tirar depois do redesenho)

| Arquivo | Tela | Recorte e marcação |
|---|---|---|
| `vendas-1.webp` | Início com a barra de baixo nova | seta no botão redondo "+ Nova venda", no meio |
| `vendas-6.webp` | Formulário de venda | círculo na chave "Já recebi o dinheiro" |
| `venda-recebida-1,2,4.webp` | Vendas com "A receber" | seta em Vendas na barra; círculo na etiqueta "A receber"; seta em "Recebi" |
| `corrigir-venda-1,2.webp` | Lista de Vendas nova | setas ◀ ▶ do mês; círculo numa venda |
| `planilha-vendas-1..4.webp` | Mais e fim do Resultado | seta em "Resultado do mês"; setas do mês; seta em "Baixar planilha"; aviso de download |
| `quem-chamar-hoje-1.webp` (ou `clientes-1`) | Meus clientes, aba "Chamar hoje" | seta na aba |
| `cadastrar-cliente-1,2.webp` | Meus clientes, aba "Todos" | seta em "Todos"; círculo em "+ Cliente" |
| `contar-estoque-1,3,4,5.webp` | Aba Estoque nova | seta em Estoque na barra; campo Quantidade (ou − +); Salvar; lista atualizada |
| `mudar-preco-1.webp`, `produto-proprio-1,5.webp` | Lista do Estoque nova | seta num produto; "Adicionar Produto"; produto oculto apagado |
| `pedido-fabrica-1..5.webp` | Aba "Pedir à fábrica" | nome da aba; − e +; frete estimado; "Enviar pedido à fábrica"; cartão a caminho |
| `imprimir-pedido-1..4.webp` | Cartão do pedido, opções de impressão | cartão; "Imprimir pedido"; "só quantidades"; impressora |
| `conferir-chegada-2..5.webp` | Cartão a caminho, "Recebi tudo certo", "Faltou algo" | botões e itens marcados |
| `repetir-pedido-1..4.webp` | Pedidos anteriores | último pedido; "Repetir"; − e +; enviar |
| `resultado-1..6.webp` | Resultado do mês novo | Resultado do mês no Mais; setas do mês; "Sobrou no mês"; Entrou × Saiu; Para onde foi / O que mudou; Quanto sobrou por mês |
| `lancar-gasto-1..5.webp` | Resultado, "+ Registrar gasto" e formulário | botão; tipo; valor; Salvar |
| `relatorio-mes-1..3.webp` | Resultado novo | Resultado do mês; setas; "Baixar relatório do mês (PDF)" |
| `pagar-equipe-digital-1..5.webp` | Mais › Pagamentos | Pagamentos; valor e vencimento; "Copiar código Pix"; "Baixar boleto"; "Já paguei" |
| `verba-marketing-1..6.webp` | Pagamentos, quadro da verba | quadro; mês; CNPJ; valor; anexar; "Registrar verba" |
| `artes-1.webp` | Lista do Mais | seta em Marketing |
| `robo-horarios-1,2.webp`, `robo-entrega-1,6.webp`, `robo-pagamento-1.webp`, `robo-cardapio-2..4.webp` | Lista do Meu robô e itens | seta no item certo; Retirada; foto do cardápio |
| `reconectar-whatsapp-2.webp` | Meu robô, botão "Verificar" | seta em "Verificar" |
| `testar-robo-1..4.webp` | "Testar como um cliente" | botão; campo de escrever; resposta com frete |
| `falar-com-maxi-1,2,3.webp` | Mais e WhatsApp da Maxi | seta em "Falar com a Maxi"; texto pronto; enviar |

---

# (2) Perguntas frequentes

1. **A venda "A receber" conta no meu mês?** Sim. Ela conta desde que foi lançada. "Recebi" só confirma que o dinheiro entrou.
2. **Por que marcar "Recebi"?** Para conferir o caixa. E ajuda o anúncio a achar clientes parecidos com quem comprou.
3. **"Sobrou no mês" é o saldo do meu banco?** Não. É o que entrou com as vendas menos a taxa de cartão e os gastos lançados.
4. **Preciso lançar o pedido à fábrica como gasto?** Não. Ele entra sozinho quando o pedido é entregue. A verba e a mensalidade também.
5. **Qual preço devo cobrar?** O markup recomendado é de 100%: o preço de venda é o dobro do custo (produto que custa R$ 10, venda por R$ 20). Você pode ajustar no Estoque.
6. **Por que meu produto próprio não aparece no pedido?** O pedido à fábrica só tem os produtos da Maxi. Os seus ficam só no Estoque.
7. **O robô parou de responder. E agora?** Vá em Mais › Meu robô › Verificar. Se estiver desconectado, leia o QR Code de novo (guia 29).
8. **Quanto vai para o anúncio da verba?** Do valor pago, 14% ficam em impostos e taxas. De R$ 200, R$ 172 vão para o anúncio.
9. **A mensalidade de R$ 150 inclui a verba?** Não. Os R$ 150 pagam a Equipe Digital Maxi. A verba do anúncio é à parte, a partir de R$ 200, sem fundo de marketing.
10. **O comprovante sai fraco na impressora. O que faço?** Na janela de impressão, ponha a escala em 80%. Se continuar, troque a bobina.
11. **O link do e-mail venceu.** Peça outro em "Primeiro acesso ou esqueceu a senha?". O link vale 24 horas e serve uma vez.
12. **Posso usar meu número pessoal no robô?** Não. Use um número só da unidade, com WhatsApp Business.

---

# (3) Conferência de linguagem

Busca feita no texto dos guias e das perguntas frequentes (fora desta seção e das notas de revisão):

| Palavra ou expressão proibida | Resultado |
|---|---|
| margem | não aparece (usa "markup recomendado de 100%") |
| amanhã | não aparece; nenhuma data prometida (pedido: "a Maxi avisa a data de entrega") |
| "sua loja", "na loja", "loja da unidade" | não aparece; a aba se chama Estoque |
| fábrica/cozinha como sendo a unidade | não aparece; "fábrica" só em "à fábrica" (Pedir à fábrica, Enviar pedido à fábrica, pedido à fábrica) |
| Líquido | não aparece |
| Ticket Médio | não aparece |
| Inventário | não aparece (sempre "Estoque") |
| reservar, reserva, separar, guardar | não aparecem |
| desconto, promoção, grátis em mensagem a cliente | não aparecem em mensagem a cliente. Aparecem só como nome de tela ou opção: "desconto" na conta do "Sobrou no mês" (guia 18), **Grátis** como tipo de taxa de entrega (guia 26) e "Promoções e avisos" como item do Meu robô (sem guia). Se o teste do app for ampliado para essas palavras, o guia 26 precisa de exceção para o rótulo **Grátis**. |
| taxa de marketing / fundo de marketing | só "sem fundo de marketing" (guia 22 e pergunta 9) |
| jargão: sincronizar, status, dashboard, CAPI, IA | não aparecem (usa "painel", "robô", "Verificar"; o Status do WhatsApp virou "aba Atualizações do WhatsApp") |

Busca real rodada em 28/09/2026 (`grep -P` com UTF-8, até o início desta seção): sobraram só "desconto" (guia 18, conta do "Sobrou no mês") e **Grátis** (guia 26, rótulo da opção de taxa), os dois fora de mensagem a cliente.

Reconferido em 28/09/2026 (S3.1/S3.2, após os ajustes desta rodada — `grep -niE` com os mesmos padrões): nenhuma palavra nova proibida entrou nos guias 1-31 com as reescritas da revisão leiga (Codex `gpt-6-astra`, S3.2).

Observação para quem for passar para o `guiasAjuda.js`: a trava `'fábrica' só como à fábrica` olha 12 caracteres antes da palavra. Títulos como "ESTOQUE E PEDIDO À FÁBRICA" ficam só neste documento (não vão para o app).
