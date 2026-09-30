# Guia de Ajuda do franqueado (v2) — texto final

> Fechado em 29/09/2026 (S24.1, Onda 7b) contra as telas FINAIS, com a chave `ui_v2` ligada (ligada na rede desde 28/09). Todos os rótulos foram conferidos no código (`src/`); nenhuma marca `[tela nova]`, `[conferir]` ou `[decisão Nelson]` sobrou.
> Os 33 guias (31 da S24.1 + `inicio` e `vendas-por-produto`, Onda 7c) estão no app em `src/lib/guiasAjuda.js` (mesmos slugs, mesma ordem de passos). O que vale é a tela: mudou a tela, mude o guia e este documento juntos.
> Público: franqueada leiga, 55+, no celular. Cada passo = uma ação. **Negrito** = nome exato do botão ou do título na tela.
> Fotos: `public/tutoriais/<slug>-<n>.webp`, onde `<n>` é o número do passo NESTE documento. Exceções antigas: `primeiros-passos-*` e `quem-chamar-hoje-*` (numeração própria, já ligadas no app).
>
> Slugs antigos mantidos (os links já enviados no WhatsApp continuam abrindo): `primeiros-passos`, `vendas`, `clientes`, `resultado`, `pedido-fabrica`, `verba-marketing`, `artes`, `reconectar-whatsapp`; `pagamentos` também abre por `mensalidade` e `pagar-equipe-digital`.
> O alias `estoque` passou a abrir "Contar o estoque" (`contar-estoque`) em 29/09/2026: a aba se chama Estoque. O "?" da aba Estoque abre o mesmo guia; o da aba Reposição continua em "Fazer pedido à fábrica".

## Mapa do app (para situar a franqueada)

**No celular**, a barra de baixo tem 5 botões: **Início** · **Vendas** · **Nova venda** (o redondo com +, no meio) · **Estoque** · **Mais**.
- **Estoque** abre a tela Estoque, com duas abas no alto: **Estoque** (o que você tem e quanto vende) e **Reposição** (onde se faz o pedido à fábrica).
- **Mais** abre a lista: Gestão, Meus Clientes, Marketing, Meu robô, Pagamentos e Ajuda. Enquanto a unidade está começando, "Primeiros passos" aparece em primeiro.
- **Mais › Gestão** abre o **Resultado** (quanto sobrou no mês). Na Início, o atalho **Resultado do mês** leva ao mesmo lugar.
- **Falar com a Maxi** fica em **Mais › Ajuda** (no fim da tela) e no fim de cada guia.
- Para sair do app: toque na bolinha com a sua inicial, no alto à direita, e em **Sair da conta**.
- O **?** no alto de cada tela abre o guia daquela tela.

**No computador**, a barra da esquerda tem os mesmos itens (Início, Vendas, Gestão, Meus Clientes, Marketing, Meu robô, Estoque, Pagamentos, Ajuda). A venda nova começa em **Vendas › Nova Venda**. **Estoque** abre o Estoque e a Reposição; **Gestão** abre o Resultado.

Nos caminhos dos guias, "›" quer dizer "toque em". Exemplo: "Mais › Pagamentos" = toque em **Mais** e depois em **Pagamentos**.

---

## Índice

**Começar**
1. Seguir os Primeiros passos — `primeiros-passos`
2. Entrar quando esqueci a senha ou o link venceu — `esqueci-senha`
3. Trocar de unidade — `trocar-unidade`
31. Entender a tela Início — `inicio`

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
11. Contar o estoque — `contar-estoque` (alias `estoque`)
12. Mudar o preço de venda — `mudar-preco`
13. Cadastrar produto próprio ou ocultar um produto — `produto-proprio`
14. Fazer pedido à fábrica — `pedido-fabrica`
15. Imprimir o pedido — `imprimir-pedido`
16. Repetir o último pedido — `repetir-pedido`

**Dinheiro**
17. Ver quanto sobrou no mês — `resultado`
18. Lançar um gasto — `lancar-gasto`
19. Baixar o relatório do mês — `relatorio-mes`
32. Ver as vendas por produto — `vendas-por-produto`
20. Pagar a mensalidade da Equipe Digital Maxi — `pagamentos` (aliases `mensalidade`, `pagar-equipe-digital`)
21. Registrar a verba do anúncio — `verba-marketing`

**Marketing**
22. Baixar as artes e a legenda do mês — `artes`
23. Agendar postagens no Meta Business Suite — `agendar-postagens`
33. Entender como funciona o anúncio no Meta — `como-funciona-anuncio`

**Meu robô**
24. Ajustar os dias e horários de entrega — `robo-horarios`
25. Ajustar entrega, frete e retirada — `robo-entrega`
26. Escolher as formas de pagamento — `robo-pagamento`
27. Trocar o cardápio do robô — `robo-cardapio`
28. Reconectar o WhatsApp do robô — `reconectar-whatsapp`
29. Conferir o que o robô vai responder — `testar-robo`

**Ajuda**
30. Falar com a Maxi — `falar-com-maxi`

---

# COMEÇAR

## 1. Seguir os Primeiros passos
`slug: primeiros-passos` · **Onde começa:** Início › cartão vermelho "Primeiros passos" (ou Mais › Primeiros passos) · **Tempo:** leitura de 3 minutos; a trilha inteira leva alguns dias

**Quando usar:** sua unidade está abrindo e você quer saber o que fazer primeiro.

**Passos**
1. Na tela Início, toque em **Continuar**, no cartão vermelho (ou toque em **Mais** e em **Primeiros passos**). Abre a trilha com os 5 passos.
   - Imagem: cartão vermelho "Primeiros passos" da Início. Círculo em **Continuar**. (existe: `primeiros-passos-6.webp`)
2. No alto da trilha, leia o cartão "Agora". Ele mostra a próxima tarefa. Toque no botão vermelho dele para ir à tela certa.
   - Imagem: cartão "Agora". (existe: `primeiros-passos-1.webp`)
3. Siga os 5 passos na ordem: seus dados, seu robô vendedor, seu espaço e seus preços, primeiro pedido, lançamento e primeira venda. Passo pronto fica verde.
   - Imagem: lista dos 5 passos. (existe: `primeiros-passos-2.webp`)
4. Toque num passo para ver as tarefas. Em **Como fazer** está o passo a passo.
   - Imagem: passo aberto. (existe: `primeiros-passos-3.webp`)
5. O que acontece fora do app, você confirma. Toque em **Marcar como feito**. A tarefa fica verde.
   - Imagem: tarefa de confirmação. (existe: `primeiros-passos-4.webp`)
6. Veja no bloco dourado **A Maxi faz por você** a parte da equipe: contrato, reunião de início, redes sociais, grupo, teste do robô e anúncios.
   - Imagem: bloco dourado. (existe: `primeiros-passos-5.webp`)

**O que o app marca sozinho:** seus dados, o cardápio, o Meu robô preenchido, o robô respondendo, o primeiro pedido, a entrega e a primeira venda.

**Deu certo quando:** os 5 passos ficam verdes. A equipe Maxi é avisada e confere tudo com você. Depois disso, "Primeiros passos" sai do menu.

**Dica:** quando a trilha leva você para outra tela, aparece uma faixa no alto. Toque em **Voltar aos Primeiros passos** para voltar.

**Erro comum:** tocou em **Marcar como feito** sem querer. O botão passa a dizer **Feito · toque para desfazer**: toque nele de novo.

**Se não resolver:** Falar com a Maxi (guia 30).

---

## 2. Entrar quando esqueci a senha ou o link venceu
`slug: esqueci-senha` · **Onde começa:** tela de entrada do app (app.maximassas.tech) · **Tempo:** 5 minutos

**Quando usar:** é seu primeiro acesso, você esqueceu a senha, ou o link do e-mail venceu.

**Passos**
1. Na tela de entrada, toque em **Primeiro acesso ou esqueceu a senha?**, abaixo do botão Entrar. O título muda para "Receber link de acesso".
   - Imagem: tela de entrada no celular. Seta no link **Primeiro acesso ou esqueceu a senha?**.
2. Digite o seu e-mail, o mesmo que recebeu o convite da Maxi.
   - Imagem: modo "Receber link de acesso". Círculo no campo E-mail.
3. Toque em **Enviar link**. Aparece a mensagem: "Se (seu e-mail) estiver cadastrado, o link chega em alguns minutos."
   - Imagem: aviso com o e-mail escrito. Seta no aviso.
4. Abra o seu e-mail e toque no link da Maxi Massas.
   - Imagem: e-mail recebido (e-mail fictício). Círculo no link.
5. Na tela "Crie sua senha", digite a senha em **Nova senha** e de novo em **Repita a senha**. Toque em **Criar senha e entrar**. O app abre na Início.
   - Imagem: tela "Crie sua senha". Seta em **Criar senha e entrar**.

**Deu certo quando:** você entra e vê a tela Início da sua unidade.

**Dica:** o link vale por 24 horas e serve uma vez só. A senha precisa de 8 caracteres ou mais, com letras e números.

**Erro comum:** o e-mail não chega. Olhe a caixa de spam e confira o e-mail digitado: a mensagem mostra o endereço que você escreveu. Se aparecer "Esse link já foi usado ou venceu", peça um link novo (passo 1).

**Se não resolver:** na tela de entrada, toque em **Falar com a Maxi no WhatsApp** e diga o e-mail que você usa.

---

## 3. Trocar de unidade
`slug: trocar-unidade` · **Onde começa:** alto da tela (nome da unidade) · **Tempo:** 1 minuto

**Quando usar:** você cuida de duas ou mais unidades e quer ver ou lançar na outra.

**Passos**
1. No celular, toque no nome da unidade, no alto da tela, à esquerda (no computador, fica à direita). Abre a lista das suas unidades.
   - Imagem: alto da tela Início no celular. Seta no nome da unidade.
2. Toque na unidade que você quer.
   - Imagem: lista aberta com duas unidades de exemplo. Círculo na segunda.
3. Confira o nome no alto. Agora tudo que você vê e lança é dessa unidade.
   - Imagem: alto da tela com o nome novo. Círculo no nome.

**Deu certo quando:** o nome no alto mudou e as vendas mostradas são da outra unidade.

**Dica:** o app lembra a última unidade escolhida neste aparelho.

**Erro comum:** lançar uma venda na unidade errada. Antes de tocar em **Nova venda**, olhe o nome no alto. Se já lançou, exclua (guia 6) e lance de novo na unidade certa.

**Se não resolver:** o nome da unidade só aparece para quem tem duas ou mais. Se você tem duas e não aparece, a Maxi precisa ligar a segunda ao seu acesso (guia 30).

---

# VENDER

## 4. Lançar uma venda
`slug: vendas` · **Onde começa:** botão redondo **Nova venda**, no meio da barra de baixo (no computador: Vendas › **Nova Venda**) · **Tempo:** 2 a 4 minutos
> Fotos (S21.1): `vendas-1.webp`..`vendas-6.webp`, uma por passo.

**Quando usar:** você vendeu fora do robô (telefone, conhecido, balcão) e quer que a venda conte no mês e desconte do estoque.

**Passos**
1. Toque em **Nova venda**, o botão redondo com + no meio da barra de baixo. Abre a venda nova.
   - Imagem: barra de baixo. Seta no botão redondo. (existe: `vendas-1.webp`)
2. Em **Cliente**, digite o nome ou o telefone e toque na pessoa. Cliente novo? Toque em **Novo contato**, preencha o nome e o telefone com DDD e toque em **Criar e selecionar**.
   - Imagem: campo **Cliente** com uma sugestão. (existe: `vendas-2.webp`)
3. Em **Produtos**, busque cada produto e digite a quantidade em **Qtd.**. Para mais um produto, toque em **Adicionar produto**.
   - Imagem: produtos da venda. (existe: `vendas-3.webp`)
4. Em **Pagamento**, toque em como o cliente pagou (PIX, Dinheiro, Crédito…). O cliente ainda vai pagar? Ligue **Ainda vou receber**, logo abaixo.
   - Imagem: botões de pagamento. (existe: `vendas-4.webp`)
5. Em **Entrega**, toque em **Delivery** se foi entrega. Confira o endereço e o **Frete (R$)**. O frete entra no valor da venda.
   - Imagem: bloco Entrega. (existe: `vendas-5.webp`)
6. Confira o total no rodapé e toque em **Registrar venda**. Aparece "Venda registrada!", com o botão **Comprovante**.
   - Imagem: rodapé com o total. Seta em **Registrar venda**. (existe: `vendas-6.webp`)

**Deu certo quando:** aparece "Venda registrada!" e a venda está na lista de **Vendas**, com o valor certo.

**Dica:** sempre escolha o cliente, com telefone. É assim que ele entra no "Quem chamar hoje" e que o anúncio aprende. Se o cliente não quis dar o número, toque em **Cliente não quis informar**.

**Erro comum:** tocar duas vezes em **Registrar venda**. Toque uma vez e espere o aviso. Deu erro? Antes de tentar de novo, olhe em **Vendas** se a venda já entrou. Se duplicou, exclua a repetida (guia 6). Aviso "O robô já lançou esta venda?": se for a mesma, toque em **É a mesma, não lançar**.

**Se não resolver:** produto não aparece na busca? Veja se ele está oculto no Estoque (guia 13). Senão, Falar com a Maxi (guia 30).

---

## 5. Marcar que recebi o dinheiro
`slug: venda-recebida` · **Onde começa:** Vendas › quadro "A receber" · **Tempo:** 1 minuto

**Quando usar:** você lançou uma venda com **Ainda vou receber** e agora o dinheiro caiu.

**Passos**
1. Toque em **Vendas**, na barra de baixo.
   - Imagem: barra de baixo. Seta em **Vendas**.
2. No alto, o quadro **A receber** mostra as vendas dos últimos 6 meses que faltam receber. Ache a venda. Na lista, ela aparece com **A receber**, em amarelo.
   - Imagem: quadro "A receber" com duas vendas. Círculo no quadro.
3. Confira no banco, no Pix ou na maquininha se o dinheiro entrou mesmo.
   - Imagem: sem recorte do app (passo fora do app).
4. Toque em **Recebi**, ao lado da venda. Aparece "Recebido!" e a venda passa a mostrar "Recebido em" e a data.
   - Imagem: venda com o botão **Recebi**. Seta no botão.

**Deu certo quando:** a venda mostra "Recebido em" com a data e sai do quadro "A receber".

**Dica:** a venda já conta no Resultado do mês desde que foi lançada. Marcar **Recebi** confere o seu caixa e ensina o anúncio a achar clientes parecidos com quem comprou.

**Erro comum:** tocou em **Recebi** na venda errada. Toque em **Desfazer**, no aviso que aparece embaixo. Se o aviso já sumiu, toque na venda para abrir e em **Voltar para a receber**.

**Se não resolver:** guia 6 (corrigir venda) ou Falar com a Maxi (guia 30).

---

## 6. Corrigir ou excluir uma venda
`slug: corrigir-venda` · **Onde começa:** Vendas › toque na venda · **Tempo:** 2 a 3 minutos

**Quando usar:** a venda saiu com produto, quantidade, cliente ou valor errado, ou foi lançada duas vezes.

**Passos**
1. Toque em **Vendas** e ache a venda. Se for de outro mês, use as setas ao lado do nome do mês, no alto.
   - Imagem: alto da tela Vendas. Seta nas setas ◀ ▶ do mês.
2. Toque na venda. Ela se abre ali mesmo, com os botões embaixo. São dois caminhos: siga só o que você precisa.
   - Imagem: venda aberta. Círculo nos botões.

**Caminho A — corrigir**
3. Toque em **Editar**. Abre a venda já preenchida.
   - Imagem: venda aberta. Seta em **Editar**.
4. Mude o que estava errado e toque em **Salvar mudanças**. Pronto, não precisa mexer mais nela.
   - Imagem: rodapé da venda em edição. Seta em **Salvar mudanças**.

**Caminho B — apagar**
5. Toque em **Excluir venda**, no canto de baixo, à direita. Aparece a pergunta "Excluir venda?".
   - Imagem: venda aberta. Círculo em **Excluir venda**.
6. Toque em **Excluir** só se a venda está mesmo errada (repetida ou por engano). Ela some da lista.
   - Imagem: janela "Excluir venda?". Seta em **Excluir**.

**Deu certo quando:** a venda aparece com os dados certos, ou a repetida sumiu, e o total do mês mudou.

**Dica:** para mudar só a forma de pagamento ou o cliente, use **Editar**. Não precisa excluir e lançar de novo.

**Erro comum:** aparecer "Atenção" ao excluir. É porque a venda já foi contada no anúncio. Se ela é repetida ou foi por engano, toque em **Excluir mesmo assim**. Lançou à mão uma venda que o robô já tinha lançado? Exclua a sua e fique com a do robô: é ela que conta para o anúncio.

**Se não resolver:** Falar com a Maxi (guia 30), dizendo a data e o valor da venda.

---

## 7. Mandar e imprimir o comprovante
`slug: comprovante` · **Onde começa:** aviso "Venda registrada!" (venda nova) ou Vendas › toque na venda (venda antiga) · **Tempo:** 1 minuto

**Quando usar:** mandar o comprovante para o cliente ou imprimir para o entregador.

**Para mandar no WhatsApp**
1. Venda nova: no aviso "Venda registrada!", toque em **Comprovante** (o aviso fica alguns segundos). Venda antiga: em **Vendas**, toque na venda e em **Enviar comprovante**.
   - Imagem: venda aberta. Seta em **Enviar comprovante**.
2. Abre o menu de compartilhar do celular, com a imagem do comprovante. Escolha o WhatsApp.
   - Imagem: menu de compartilhar do celular. Círculo no WhatsApp.
3. Escolha o contato e toque em enviar, como manda qualquer foto.
   - Imagem: WhatsApp com a imagem do comprovante (cliente fictício). Seta no enviar.

**Para imprimir (é outro caminho)**
4. Em **Vendas**, toque na venda e em **Imprimir**. Abre a janela de impressão.
   - Imagem: venda aberta. Seta em **Imprimir**.
5. Escolha a sua impressora e imprima.
   - Imagem: janela de impressão. Círculo no nome da impressora.
6. Saiu fraco na impressora térmica? Na janela de impressão, mude a **Escala** para **80%** e imprima de novo.
   - Imagem: janela de impressão com "Mais opções". Seta no campo **Escala**.

**Deu certo quando:** o cliente recebeu a imagem no WhatsApp, ou o papel saiu legível, com o endereço e o telefone.

**Dica:** o comprovante serve para bobina de 58 mm e de 80 mm. No computador, **Enviar comprovante** baixa a imagem; depois é só anexar no WhatsApp.

**Erro comum:** o comprovante sai com "ENDEREÇO NÃO INFORMADO". O endereço não foi preenchido na venda nem no cliente. Corrija a venda (guia 6) ou o cliente (guia 10). Papel ainda fraco com 80%? Troque a bobina.

**Se não resolver:** Falar com a Maxi (guia 30), com uma foto do papel impresso.

---

## 8. Baixar a planilha de vendas
`slug: planilha-vendas` · **Onde começa:** Vendas · **Tempo:** 2 minutos

**Quando usar:** você quer a lista de vendas do mês numa planilha (para o contador ou para conferir).

**Passos**
1. Toque em **Vendas**, na barra de baixo.
   - Imagem: barra de baixo. Seta em **Vendas**.
2. Escolha o mês com as setas ao lado do nome do mês. Deixe marcado **Todas**, logo abaixo.
   - Imagem: alto da tela Vendas. Círculo nas setas ◀ ▶ e em **Todas**.
3. Toque em **Excel**, na mesma linha. O arquivo é baixado no aparelho.
   - Imagem: linha dos filtros. Seta em **Excel**.
4. Abra o arquivo baixado. No celular, ele fica em "Downloads" ou nas notificações.
   - Imagem: aviso de download do celular. Círculo no nome do arquivo.

**Deu certo quando:** a planilha abre com uma linha por venda: data, hora, cliente, produtos, pagamento e valor.

**Dica:** a mesma planilha sai em **Mais › Gestão**, no quadro **Planilha das vendas**. Para mandar ao contador, abra o arquivo e use o compartilhar do celular.

**Erro comum:** a planilha sai faltando vendas porque um filtro ficou ligado (**A receber**, **Recebidas** ou a busca). Deixe **Todas** e a busca vazia antes de baixar.

**Se não resolver:** Falar com a Maxi (guia 30).

---

# CLIENTES

## 9. Chamar clientes (Quem chamar hoje)
`slug: clientes` · **Onde começa:** Início › "Quem chamar hoje" (ou Mais › Meus Clientes › aba **Hoje**) · **Tempo:** 3 a 5 minutos por dia
> Fotos já no app: `quem-chamar-hoje-1..6.webp` (numeração própria, anterior a este documento).

**Quando usar:** todo dia, para chamar no WhatsApp quem tem mais chance de comprar.

**Passos**
1. Toque em **Mais** e em **Meus Clientes**. A tela abre na aba **Hoje**.
   - Imagem: Meus Clientes, aba **Hoje**. (existe: `quem-chamar-hoje-1.webp`)
2. Leia o motivo de cada cartão: voltou a falar e não comprou, quase comprou, hora de repetir, primeira compra ou sumido.
   - Imagem: um cartão. (existe: `quem-chamar-hoje-2.webp`)
3. Toque em **Chamar no WhatsApp**. O WhatsApp abre com a mensagem pronta, com o nome do cliente. O cartão já conta como feito nessa hora, mesmo que você não envie (dá para desfazer).
   - Imagem: cartão. (existe: `quem-chamar-hoje-3.webp`)
4. Leia a mensagem, mude o que quiser e envie pelo WhatsApp da unidade (o mesmo número do robô). Depois, volte para o app.
   - Imagem: conversa com o texto pronto (cliente fictício). Seta no enviar.
5. Não é hora de chamar alguém? Toque em **Pular** e escolha **Só hoje**. Se a pessoa pediu para não receber, escolha **Não chamar mais**.
   - Imagem: menu do Pular. (existe: `quem-chamar-hoje-4.webp`)

**Deu certo quando:** o cartão vira "Chamado hoje" e, no alto, o número de feitos do dia sobe.

**Dica:** são no máximo 8 por dia, de propósito: mensagem pessoal, para poucas pessoas por vez, vende mais e protege o seu número. Quando você escreve, o robô pausa e deixa a conversa com você.

**Erro comum:** tocar em **Chamar no WhatsApp** e não enviar. O cartão já conta como feito. Toque em **Desfazer**, no aviso embaixo, e chame depois.

**Se não resolver:** cliente sem telefone não entra na lista. Complete o número (guia 10).

---

## 10. Cadastrar ou corrigir um cliente
`slug: cadastrar-cliente` · **Onde começa:** Mais › Meus Clientes › aba **Todos** · **Tempo:** 2 minutos

**Quando usar:** cliente novo que ainda não comprou, ou telefone, nome ou endereço errado.

**Passos**
1. Toque em **Mais**, em **Meus Clientes** e na aba **Todos**.
   - Imagem: Meus Clientes. Seta na aba **Todos**.
2. Cliente novo: toque em **Novo Cliente**, no alto (no celular é o botão com o desenho de uma pessoa e o +).
   - Imagem: alto da tela. Círculo no botão **Novo Cliente**.
3. Corrigir: busque o nome e toque no cartão do cliente. Abre "Editar Contato".
   - Imagem: busca com um nome digitado. Seta no cliente.
4. Preencha ou corrija nome, telefone com DDD, endereço e bairro.
   - Imagem: formulário. Círculo no campo **Telefone**.
5. Toque em **Criar Contato** (cliente novo) ou **Salvar** (correção).
   - Imagem: fim do formulário. Seta no botão.

**Deu certo quando:** o cliente aparece em **Todos** com o telefone certo e pode ser escolhido na próxima venda.

**Dica:** telefone só com DDD e número, sem o 55. Cliente de outro país: comece com + e o código do país.

**Erro comum:** cadastrar a mesma pessoa duas vezes. Antes de criar, busque o nome e o telefone. Se aparecer "Contato com este telefone já existe", use o cadastro que já está lá.

**Se não resolver:** Falar com a Maxi (guia 30).

---

# ESTOQUE E PEDIDO À FÁBRICA

## 11. Contar o estoque
`slug: contar-estoque` (alias `estoque`) · **Onde começa:** Estoque (barra de baixo no celular; menu à esquerda no computador) › **Contar estoque** · **Tempo:** 10 a 20 minutos (conforme o freezer)

**Quando usar:** uma vez por semana, ou quando o número do app não bate com o freezer.

**Passos**
1. Toque em **Estoque**: no celular, na barra de baixo; no computador, no menu à esquerda. No alto aparecem **Acabando**, **Valor em estoque** e **Se vender tudo**; embaixo, a lista dos produtos.
   - Imagem: barra de baixo. Contorno em **Estoque**. (existe: `contar-estoque-1.webp`)
2. Toque em **Contar estoque**, acima da lista. Cada produto ganha os botões **−** e **+**.
   - Imagem: botões acima da lista. Contorno em **Contar estoque**. (existe: `contar-estoque-2.webp`)
3. Abra o freezer e conte quantas unidades de cada produto há. Deixe esse total no app: se contou 12, o número fica 12 (não digite só a diferença). Use **−** e **+**, ou toque no número e digite. Número muito diferente? Antes, veja se uma venda foi lançada 2 vezes (guia 6).
   - Imagem: um produto no modo de contar. Contorno no produto. (existe: `contar-estoque-3.webp`)
4. No fim, toque em **Salvar** (ele mostra quantos produtos você mudou). Aparece "Contagem salva".
   - Imagem: alto da contagem. Contorno em **Salvar (1)**. (existe: `contar-estoque-4.webp`)
5. Confira a lista: os números devem bater com o freezer.
   - Imagem: lista do estoque depois de salvar. O número depois de **Tem** é o que o app tem. (existe: `contar-estoque-5.webp`)

**Deu certo quando:** aparece "Contagem salva" e os números da lista batem com o freezer.

**Dica:** saiu da tela no meio? A contagem fica guardada neste aparelho: toque em **Continuar contagem**. Venda lançada já desconta sozinha; pedido entregue já soma sozinho.

**Erro comum:** aparecer "Mudou enquanto você contava". Uma venda baixou o estoque durante a contagem. Confira o produto destacado e toque em **Salvar** de novo. Número abaixo de zero aparece em vermelho, com o aviso **Conte o estoque**: saiu mais do que entrou no app (contagem antiga, venda lançada 2 vezes). Conte de novo e salve o número real. Só lance uma venda (guia 4) se ela de fato faltou.

**Se não resolver:** Falar com a Maxi (guia 30).

---

## 12. Mudar o preço de venda
`slug: mudar-preco` · **Onde começa:** Estoque › toque no produto · **Tempo:** 2 minutos por produto

**Quando usar:** você quer subir ou ajustar o preço que o cliente paga.

**Passos**
1. Toque em **Estoque** (no celular, na barra de baixo; no computador, no menu à esquerda) e toque no produto na lista.
   - Imagem: lista do estoque. Contorno num produto. (existe: `mudar-preco-1.webp`)
2. Abre o produto. **Preço de venda** é o que o cliente paga e **Custo** vem da tabela da Maxi. **Markup** compara os dois: custo R$ 10 e venda R$ 20 dá Markup de 100%.
   - Imagem: produto aberto. Contorno em **Preço de venda** e **Custo**. (existe: `mudar-preco-2.webp`)
3. Toque em **Editar produto**. Apague o **Preço de venda (R$)**, digite o novo e toque em **Salvar**.
   - Imagem: formulário "Editar Produto". Contorno no campo **Preço de venda (R$)**. (existe: `mudar-preco-3.webp`)
4. Espere aparecer "Produto atualizado.". O robô passa a usar esse preço. Atualize também a imagem do cardápio que o robô envia (guia 27).
   - Imagem: aviso "Produto atualizado." no alto. (existe: `mudar-preco-4.webp`)

**Deu certo quando:** ao abrir o produto de novo, o **Preço de venda** é o novo. O robô passa a usar esse preço com os clientes.

**Dica:** o markup recomendado é de 100%: o preço de venda é o dobro do custo. Exemplo: produto que custa R$ 10, venda por R$ 20. Os preços já vêm assim.

**Erro comum:** tentar mudar o custo de um produto da Maxi. Não dá: o custo é o da tabela da Maxi. Mude só o **Preço de venda**.

**Se não resolver:** Falar com a Maxi (guia 30).

---

## 13. Cadastrar produto próprio ou ocultar um produto
`slug: produto-proprio` · **Onde começa:** Estoque · **Tempo:** 3 minutos

**Quando usar:** você vende algo que não é da Maxi (queijo ralado, um molho seu), ou quer parar de vender um produto. São dois caminhos: siga só o que você precisa.

**Caminho A — cadastrar produto próprio**
1. Toque em **Estoque** (no celular, na barra de baixo; no computador, no menu à esquerda) e em **Adicionar**, acima da lista.
   - Imagem: botões acima da lista. Contorno em **Adicionar**. (existe: `produto-proprio-1.webp`)
2. Em **Nome do Produto**, escreva o nome do que você vende. Depois, a quantidade que você tem, o custo (quanto você paga por uma unidade) e o preço de venda (quanto o cliente paga por uma unidade).
   - Imagem: formulário "Adicionar Produto". (existe: `produto-proprio-2.webp`)
3. Toque em **Adicionar**, no fim do formulário. Aparece "Produto adicionado ao estoque." Pronto.
   - Imagem: fim do formulário. Contorno em **Adicionar**. (existe: `produto-proprio-3.webp`)

**Caminho B — ocultar um produto**
4. Toque no produto na lista e em **Ocultar**. Aparece "Produto oculto" e o robô para de oferecer.
   - Imagem: produto aberto. Contorno em **Ocultar**. (existe: `produto-proprio-4.webp`)
5. O produto sai da lista e vai para o fim da tela, em "produto oculto". Para voltar a vender, toque ali e em **Reativar**.
   - Imagem: fim da lista, produtos ocultos aberto. Contorno em **Reativar**. (existe: `produto-proprio-5.webp`)

**Deu certo quando:** o produto próprio aparece na lista e na venda nova; o oculto aparece só no fim, em produtos ocultos, e o robô não oferece mais.

**Dica:** oculto é diferente de zerado. Oculto: o robô não oferece, mesmo com estoque. Zerado (quantidade 0): o robô avisa que está em falta no momento.

**Erro comum:** procurar o produto próprio no pedido à fábrica. Ele não aparece lá: o pedido à fábrica só tem os produtos da Maxi. Produto oculto também fica fora do pedido.

**Se não resolver:** sumiu um produto da Maxi do seu pedido? Veja se ele não está oculto. Se não estiver, Falar com a Maxi (guia 30).

---

## 14. Fazer pedido à fábrica
`slug: pedido-fabrica` · **Onde começa:** Estoque › aba **Reposição** · **Tempo:** 5 a 10 minutos
> Fotos (S25): `pedido-fabrica-1.webp`..`pedido-fabrica-6.webp`, uma por passo.

**Quando usar:** repor o freezer com os produtos da Maxi.

**Passos**
1. Toque em **Estoque** (no celular, na barra de baixo; no computador, no menu à esquerda) e na aba **Reposição**, no alto.
   - Imagem: abas no alto. Contorno em **Reposição**. (existe: `pedido-fabrica-1.webp`)
2. No quadro **Próximo pedido à fábrica**, toque em **Montar pedido com a sugestão**: as quantidades vêm das suas vendas. No primeiro pedido, o botão é **Novo pedido** e abre a lista modelo da Maxi. Produto próprio fica fora do pedido.
   - Imagem: quadro da sugestão. Contorno em **Montar pedido com a sugestão**. (existe: `pedido-fabrica-2.webp`)
3. Confira as quantidades. Ajuste com **−** e **+**, ou toque no número e digite. Para incluir um produto sem sugestão, procure em **Outros produtos**, embaixo.
   - Imagem: um produto com − e +. (existe: `pedido-fabrica-3.webp`)
4. Toque em **Enviar pedido** para abrir a revisão. O pedido ainda não foi enviado. Em **Confira antes de enviar**, veja produtos, quantidades, valores, frete e total. Para corrigir, toque em **Voltar e ajustar**.
   - Imagem: a revisão do pedido. (existe: `pedido-fabrica-4.webp`)
5. Para enviar à Maxi, toque em **Confirmar e enviar** e espere a mensagem "Pedido enviado com sucesso!".
   - Imagem: rodapé da revisão. Contorno em **Confirmar e enviar**. (existe: `pedido-fabrica-5.webp`)
6. Acompanhe em **Histórico de Pedidos**: Pendente, Confirmado, Em Rota e Entregue. Quando chegar, confira as caixas com o motorista: faltou algo, avise na hora. O estoque sobe sozinho quando a Maxi marca o pedido como Entregue.
   - Imagem: histórico com um pedido. (existe: `pedido-fabrica-6.webp`)

**Deu certo quando:** o pedido aparece em **Histórico de Pedidos** como Pendente.

**Dica:** o app usa suas vendas para sugerir quanto pedir. A conta cobre até a entrega seguinte (você costuma pedir a cada ~3 semanas e a entrega leva ~5 dias), mais uma semana, e já considera o estoque e os produtos a caminho. Produto sem venda em 3 meses não entra. Confira se as quantidades atendem ao que você precisa. O frete mostrado é uma previsão: 10% do valor dos produtos, no mínimo R$ 250 e no máximo R$ 350. A Maxi confirma o valor.

**Erro comum:** apareceu "Já tem um pedido enviado há pouco"? Outro celular ou outra aba já enviou um pedido: confira no **Histórico de Pedidos** antes de enviar outro. Enviou errado e ainda está Pendente? Abra o pedido e toque em **Cancelar Pedido**.

**Se não resolver:** Falar com a Maxi (guia 30).

---

## 15. Imprimir o pedido
`slug: imprimir-pedido` · **Onde começa:** Estoque › aba **Reposição** › Histórico de Pedidos · **Tempo:** 2 minutos

**Quando usar:** ter o pedido no papel para conferir a mercadoria quando chegar, ou para o seu controle.

**Passos**
1. Em **Estoque**, toque na aba **Reposição**, desça até **Histórico de Pedidos** e toque no pedido. Ele se abre com os produtos.
   - Imagem: histórico. Contorno num pedido. (existe: `imprimir-pedido-1.webp`)
2. Toque em **Imprimir pedido**, embaixo dos produtos. Aparecem duas opções.
   - Imagem: pedido aberto. Círculo em **Imprimir pedido**.
3. Escolha **Só quantidades** (sem valores, para quem recebe conferir) ou **Com valores** (preços e total, para o seu controle).
   - Imagem: as duas opções. Seta em **Só quantidades**.
4. O pedido é salvo num arquivo PDF; isso ainda não imprime. Abra o arquivo (se não achar, procure em **Arquivos** ou **Downloads** do celular), toque em **Imprimir** ou em **Compartilhar**, escolha a impressora e confirme.
   - Imagem: aviso de download do PDF. Círculo no nome do arquivo.

**Deu certo quando:** o papel sai com a lista de produtos, as quantidades e um espaço para marcar o que chegou.

**Dica:** imprima **Só quantidades** antes da entrega e deixe perto do freezer. Assim quem recebe confere sem ver valores.

**Erro comum:** o PDF abre, mas não imprime no celular. Use o compartilhar do celular e escolha a impressora, ou mande o PDF para o seu WhatsApp e imprima no computador.

**Se não resolver:** Falar com a Maxi (guia 30).

---

## 16. Repetir o último pedido
`slug: repetir-pedido` · **Onde começa:** Estoque › aba **Reposição** · **Tempo:** 3 minutos

**Quando usar:** você quer pedir igual ao último pedido.

**Passos**
1. Toque em **Estoque** (no celular, na barra de baixo; no computador, no menu à esquerda) e na aba **Reposição**.
   - Imagem: abas no alto. Contorno em **Reposição**. (existe: `repetir-pedido-1.webp`)
2. Toque em **Repetir último pedido**, embaixo de **Montar pedido com a sugestão**. Ele copia as quantidades do pedido anterior, sem ajustar às vendas recentes.
   - Imagem: botões do quadro. Contorno em **Repetir último pedido**. (existe: `repetir-pedido-2.webp`)
3. Confira o que você tem e mude as quantidades com **−** e **+**.
   - Imagem: lista preenchida. (existe: `repetir-pedido-3.webp`)
4. Toque em **Enviar pedido**, confira o frete e o total e toque em **Confirmar e enviar**. Aparece "Pedido enviado com sucesso!".
   - Imagem: rodapé da revisão. Contorno em **Confirmar e enviar**. (existe: `repetir-pedido-4.webp`)

**Deu certo quando:** o pedido novo aparece em **Histórico de Pedidos** como Pendente.

**Dica:** quer quantidades calculadas pelas suas vendas? Use **Montar pedido com a sugestão**. O Repetir copia o pedido anterior como ele foi.

**Erro comum:** repetir um pedido grande num mês fraco e ficar com o freezer cheio. Olhe o Estoque antes.

**Se não resolver:** Falar com a Maxi (guia 30).

---

# DINHEIRO

## 17. Ver quanto sobrou no mês
`slug: resultado` · **Onde começa:** Mais › Gestão (abre o **Resultado**) · **Tempo:** 3 a 5 minutos
> Fotos (S21.1): `resultado-1.webp`..`resultado-5.webp`, uma por passo.

**Quando usar:** saber se o mês deu resultado e para onde foi o dinheiro.

**Passos**
1. No celular, toque em **Mais** e em **Gestão**; no computador, em **Gestão** no menu à esquerda. Abre o **Resultado**. (Na Início, o atalho **Resultado do mês** leva ao mesmo lugar.)
   - Imagem: tela **Resultado**. (existe: `resultado-1.webp`)
2. Escolha o mês com as setas ao lado do nome do mês.
   - Imagem: setas do mês. (existe: `resultado-2.webp`)
3. Leia o número grande **Sobrou em (mês)**. Logo abaixo, as barras **Entrou** e **Saiu**.
   - Imagem: topo do Resultado. (existe: `resultado-3.webp`)
4. Role para ver **De onde veio**, **Para onde foi** e **Mais vendidos**. Mais abaixo: **O que mudou**, **Quanto sobrou por mês** e **Gastos do mês**.
   - Imagem: bloco **Para onde foi**. (existe: `resultado-4.webp`)
5. Para ter o mês numa folha, toque em **Baixar relatório do mês (PDF)** (guia 19).
   - Imagem: botão do relatório. (existe: `resultado-5.webp`)

**Deu certo quando:** você sabe quanto entrou, quanto saiu e quanto sobrou no mês.

**Dica:** "Sobrou" = o que entrou com as vendas (com frete, menos desconto) menos a taxa de cartão que a unidade pagou e os gastos lançados. Não é o saldo do seu banco: venda "A receber" já conta aqui, e gasto que você ainda não lançou ainda não foi descontado.

**Erro comum:** o número parece alto demais porque faltam gastos (gás, sacolas, aluguel). Lance os gastos (guia 18). O pedido à fábrica, a verba confirmada e a mensalidade paga entram sozinhos.

**Se não resolver:** Falar com a Maxi (guia 30).

---

## 18. Lançar um gasto
`slug: lancar-gasto` · **Onde começa:** Mais › Gestão (Resultado) › **Registrar gasto** · **Tempo:** 1 a 2 minutos

**Quando usar:** você pagou algo da unidade: sacolas, gás, entregador, aluguel, embalagem.

**Passos**
1. No celular, toque em **Mais** e em **Gestão**; no computador, em **Gestão** no menu à esquerda. Abre o **Resultado**.
   - Imagem: lista do Mais. Seta em **Gestão**.
2. Role até **Gastos do mês** e toque em **Registrar gasto**. Escolha **Um gasto do dia a dia**.
   - Imagem: janela "Registrar gasto". Seta em **Um gasto do dia a dia**.
3. Em **Categoria**, escolha o tipo (por exemplo, Embalagem ou Transporte).
   - Imagem: lista de categorias. Círculo numa categoria.
4. Escreva a **Descrição**, o **Valor (R$)** e confira a **Data**.
   - Imagem: formulário. Círculo no valor.
5. Toque em **Lançar despesa**. O gasto aparece em **Gastos do mês** e o "Sobrou" diminui.
   - Imagem: fim do formulário. Seta em **Lançar despesa**.

**Deu certo quando:** aparece "Despesa lançada!", o gasto está em **Gastos do mês** e o "Sobrou" mudou.

**Dica:** lance o gasto no dia em que pagou. Comprou produto para revender fora da fábrica? No passo 2, escolha **Produto comprado fora da fábrica**: ele entra no estoque e vira gasto junto.

**Erro comum:** lançar à mão o pedido à fábrica, a verba do anúncio ou a mensalidade. Esses entram sozinhos; lançar de novo conta em dobro. Para apagar o repetido, toque na lixeira ao lado dele, em **Gastos do mês**, e em **Excluir**.

**Se não resolver:** Falar com a Maxi (guia 30).

---

## 19. Baixar o relatório do mês
`slug: relatorio-mes` · **Onde começa:** Mais › Gestão (Resultado) · **Tempo:** 1 minuto

**Quando usar:** ter o resumo do mês numa folha, para consultar ou mostrar a alguém.

**Passos**
1. No celular, toque em **Mais** e em **Gestão**; no computador, em **Gestão** no menu à esquerda. Abre o **Resultado**.
   - Imagem: lista do Mais. Seta em **Gestão**.
2. Escolha o mês com as setas.
   - Imagem: setas do mês. Círculo nas setas ◀ ▶.
3. Toque em **Baixar relatório do mês (PDF)**, logo abaixo das barras Entrou e Saiu. Aparece "Relatório baixado!".
   - Imagem: botão **Baixar relatório do mês (PDF)**. Seta no botão.
4. Abra o PDF pelo aviso de download.
   - Imagem: página do PDF (unidade fictícia). Círculo nos três meses lado a lado.

**Deu certo quando:** abre um PDF de 1 página com 3 meses lado a lado, os mais vendidos e o anúncio.

**Dica:** para mandar a alguém, abra o PDF e use o compartilhar do celular.

**Erro comum:** o relatório sai com o mês errado. Escolha o mês antes de tocar no botão. Se o PDF avisar que o anúncio não carregou, o resto está certo; tente de novo mais tarde.

**Se não resolver:** Falar com a Maxi (guia 30).

---

## 20. Pagar a mensalidade da Equipe Digital Maxi
`slug: pagamentos` (aliases `mensalidade`, `pagar-equipe-digital`) · **Onde começa:** Mais › Pagamentos · **Tempo:** 3 minutos
> Fotos (S21.1): `pagamentos-2`, `-3`, `-4`, `-7.webp`. Faltam os passos 1, 5 e 6 (S24.2).

**Quando usar:** pagar a mensalidade de R$ 150 (gestão dos anúncios, painel, robô e artes).

**Passos**
1. Toque em **Mais** e em **Pagamentos**.
   - Imagem: lista do Mais. Seta em **Pagamentos**.
2. Veja o quadro **Equipe Digital Maxi**. Em aberto, mostra o valor e o vencimento. Vencida, mostra "Regularize para evitar bloqueio". Paga, mostra Pago.
   - Imagem: quadro da mensalidade. (existe: `pagamentos-2.webp`)
3. Toque em **Pagar →** (ou **Regularizar**, se já venceu). Abre a cobrança com as formas de pagar.
   - Imagem: cobrança aberta. (existe: `pagamentos-3.webp`)
4. Para Pix, toque em **Copiar código PIX** e cole no app do banco, em "Pix Copia e Cola". Ou leia o QR Code com o celular do banco.
   - Imagem: QR e botão. (existe: `pagamentos-4.webp`)
5. Prefere boleto? Toque em **Abrir boleto bancário** e pague pelo app do banco ou impresso.
   - Imagem: cobrança com boleto. Seta em **Abrir boleto bancário**.
6. Não apareceu o QR Code nem o código Pix? Toque em **Atualizar cobrança**.
   - Imagem: cobrança sem QR. Seta em **Atualizar cobrança**.
7. Depois de pagar, toque em **Já paguei, verificar agora**. Pago, o quadro fica verde.
   - Imagem: botão de verificar. (existe: `pagamentos-7.webp`)

**Deu certo quando:** o quadro mostra Pago e aparece "Mensalidade em dia.".

**Dica:** pelo Pix a liberação costuma sair em poucos minutos. O boleto leva o tempo do banco. A verba do anúncio é à parte (guia 21).

**Erro comum:** deixar vencer. No 1º e no 2º dia de atraso aparece uma faixa vermelha, mas o app segue normal. A partir do 3º dia o app mostra só a tela de pagamento; mesmo assim dá para pagar, trocar de unidade e lançar venda.

**Se não resolver:** pagou e continua em aberto? Não pague de novo. Toque em **Já paguei, verificar agora** mais uma vez. Se seguir em aberto, Falar com a Maxi com o comprovante (guia 30).

---

## 21. Registrar a verba do anúncio
`slug: verba-marketing` · **Onde começa:** Mais › Marketing › quadro "Investimento em Marketing" · **Tempo:** 5 minutos

**Quando usar:** todo mês, quando você paga o dinheiro dos anúncios da sua unidade.

**Passos**
1. Toque em **Mais** e em **Marketing**. Logo abaixo da arte do mês está o quadro **Investimento em Marketing**. (Em Pagamentos, a linha "Investimento Marketing" leva ao mesmo quadro.)
   - Imagem: tela Marketing. Seta no quadro **Investimento em Marketing**.
2. Confira o mês no seletor, ao lado do título. Nos últimos 5 dias do mês, ele já abre no mês seguinte; troque se precisar.
   - Imagem: seletor do mês. Círculo no mês.
3. Toque em **Copiar**, ao lado da chave Pix (CNPJ 00.494.317/0001-21), e faça o Pix no app do seu banco. O mínimo é R$ 200.
   - Imagem: linha da chave Pix. Seta em **Copiar**.
4. Digite em **Valor que você pagou** o valor do Pix.
   - Imagem: campo do valor. Círculo no campo.
5. Toque em **Anexar** e escolha o comprovante do Pix (foto da tela do banco ou PDF).
   - Imagem: caixa **Anexar**. Seta na caixa.
6. Toque em **Registrar Pagamento**. O registro fica **Aguardando** até a Maxi conferir.
   - Imagem: fim do quadro. Seta em **Registrar Pagamento**.

**Deu certo quando:** o quadro mostra o valor com **Aguardando**. Depois muda para **Confirmado**.

**Dica:** do valor pago, 14% ficam em impostos e taxas: de R$ 200, R$ 172 vão para o anúncio. A verba é à parte da mensalidade (sem fundo de marketing). Confirmado quer dizer que a Maxi conferiu; a campanha entra no ar depois.

**Erro comum:** achar que registrar no app faz o Pix. Não faz: o Pix é no seu banco. Sem o comprovante agora? Toque em **Registrar sem comprovante** e anexe depois, em **Anexar comprovante**.

**Se não resolver:** Falar com a Maxi (guia 30), com o comprovante.

---

# MARKETING

## 22. Baixar as artes e a legenda do mês
`slug: artes` · **Onde começa:** Mais › Marketing · **Tempo:** 5 a 10 minutos

**Quando usar:** pegar as artes prontas do mês para postar no Instagram e no Facebook da unidade.

**Passos**
1. Toque em **Mais** e em **Marketing**. No alto aparece a **Arte do mês**.
   - Imagem: lista do Mais. Seta em **Marketing**.
2. Para ver as outras, desça até os materiais e escolha o mês em **Mês**. Os botões de cima filtram por tipo: Imagens, Vídeos, PDFs e Links.
   - Imagem: filtros dos materiais. Círculo em **Mês**.
3. Se a arte tem legenda, toque em **Copiar legenda** ANTES de baixar a imagem. Aparece "Legenda copiada!".
   - Imagem: cartão da arte. Seta em **Copiar legenda**.
4. Toque em **Baixar** na mesma arte. Abre uma tela nova só com a imagem.
   - Imagem: cartão da arte. Seta em **Baixar**.
5. Toque e segure o dedo na imagem e escolha "Salvar imagem" (ou "Baixar imagem"). Depois, volte ao app pelo botão de voltar do celular.
   - Imagem: imagem aberta com o menu do celular. Círculo em "Salvar imagem".

**Deu certo quando:** a arte está na galeria do celular e a legenda está copiada, pronta para colar.

**Dica:** baixe as artes do mês de uma vez e agende tudo no Meta Business Suite (guia 23). Poste também na aba Atualizações do WhatsApp.

**Erro comum:** achar que o app posta sozinho. Não posta: a postagem é feita por você, no Instagram ou no Facebook da unidade.

**Se não resolver:** não achou a arte do mês? Falar com a Maxi (guia 30).

---

## 23. Agendar postagens no Meta Business Suite
`slug: agendar-postagens` · **Onde começa:** app **Meta Business Suite** no celular (ou business.facebook.com no computador), fora do app da Maxi · **Tempo:** 20 a 30 minutos para o mês todo

**Quando usar:** deixar as postagens do mês programadas de uma vez, no Instagram e no Facebook da unidade.

> Este guia é sobre um app de fora (Meta). Os nomes das telas do Meta mudam de vez em quando; o texto usa os nomes gerais. As fotos, se houver, são tiradas da versão do dia.

**Passos**
1. Baixe as artes e copie as legendas (guia 22).
   - Imagem: sem recorte novo (reusar a do guia 22).
2. Abra o **Meta Business Suite** e entre na página da unidade.
   - Imagem: tela inicial do Meta Business Suite. Círculo no nome da página.
3. Abra o **Planejador** (em alguns aparelhos aparece como "Planner"). Abre o calendário do mês.
   - Imagem: menu do Meta Business Suite. Seta no Planejador.
4. Comece uma publicação nova e marque o Facebook e o Instagram da unidade.
   - Imagem: tela de publicação. Círculo nas duas marcações.
5. Adicione a foto e cole a legenda.
   - Imagem: mesma tela. Seta na foto e no texto.
6. Em vez de publicar agora, escolha a opção de agendar e marque a data e a hora.
   - Imagem: opções de publicação. Seta na opção de agendar.
7. Confirme. A postagem aparece no calendário do Planejador.
   - Imagem: calendário com a postagem. Círculo na postagem.

**Deu certo quando:** o calendário do Planejador mostra as postagens nos dias escolhidos.

**Dica:** poste em dias e horários variados, de 3 a 4 vezes por semana. Os vídeos "Planner" e "Planner Reforço", no Drive, mostram o mesmo passo a passo.

**Erro comum:** o Instagram não aparece para marcar. Ele não está ligado à página da unidade. A Maxi faz essa ligação: fale com a equipe (guia 30).

**Se não resolver:** Falar com a Maxi (guia 30).

---

# MEU ROBÔ

> A tela **Meu robô** tem 5 etapas no alto: **Sua unidade**, **Entrega e retirada**, **Pagamento**, **Vendedor** e **Como o robô responde**. Toque na etapa para ir direto a ela. Não há botão "Salvar": o botão **Próximo**, embaixo, salva o que mudou e passa para a etapa seguinte (na última, **Concluir**). Aparece "Configurações salvas com sucesso!".

## 24. Ajustar os dias e horários de entrega
`slug: robo-horarios` · **Onde começa:** Mais › Meu robô › etapa **Entrega e retirada** · **Tempo:** 5 minutos

**Quando usar:** mudou o dia ou o horário de entregar.

**Passos**
1. Toque em **Mais** e em **Meu robô**.
   - Imagem: lista do Mais. Seta em **Meu robô**.
2. No alto, toque na etapa **Entrega e retirada**. Desça até **Dias, horários e taxas**.
   - Imagem: etapas no alto. Círculo em **Entrega e retirada**.
3. Marque os dias (Seg, Ter, Qua…) e acerte a **Janela de entrega** (das tantas às tantas).
   - Imagem: dias marcados e janela de entrega. Círculo nos dias.
4. Se quiser, escolha **Pedidos até**: o horário limite para o pedido sair no mesmo dia.
   - Imagem: campo **Pedidos até** e o "?" ao lado. Seta no campo.
5. Toque em **Próximo**, embaixo. Aparece "Configurações salvas com sucesso!".
   - Imagem: rodapé. Seta em **Próximo**.

**Deu certo quando:** a caixa **O vendedor vai dizer** mostra os dias e horários novos. O robô passa a falar esses horários.

**Dica:** dias com horário diferente? Toque em **Adicionar dias com horário diferente**. Depois do horário de **Pedidos até**, o robô continua atendendo e combina para o próximo horário de entrega.

**Erro comum:** apagar o horário para fechar um dia. Desmarque o dia, ou toque em **Remover estes dias** no grupo que não vale mais. Apagar o horário deixa a tela com erro e não salva.

**Se não resolver:** "Só funciona em outro celular"? Pode ser um rascunho antigo neste aparelho. Falar com a Maxi (guia 30).

---

## 25. Ajustar entrega, frete e retirada
`slug: robo-entrega` · **Onde começa:** Mais › Meu robô › etapa **Entrega e retirada** · **Tempo:** 5 a 10 minutos

**Quando usar:** mudar o frete, o pedido mínimo, a distância de entrega ou a retirada.

**Passos**
1. Toque em **Mais**, **Meu robô** e, no alto, na etapa **Entrega e retirada**.
   - Imagem: etapas no alto. Seta em **Entrega e retirada**.
2. Em **Taxa**, escolha o tipo: **Valor único**, **Por distância** ou **Grátis**.
   - Imagem: botões da taxa. Círculo em **Por distância**.
3. Preencha os valores. Em **Por distância**, cada faixa de km tem um preço; para mais uma, toque em **Adicionar faixa de km**.
   - Imagem: faixas de km. Círculo numa faixa.
4. Se quiser, preencha o **Pedido mínimo para entrega (R$)**. Em branco = sem mínimo.
   - Imagem: campo do pedido mínimo e o "?". Seta no campo.
5. Para retirada, ligue **Aceita RETIRADA?** e confira o **Endereço de retirada** e o horário.
   - Imagem: bloco da retirada. Círculo na chave **Aceita RETIRADA?**.
6. Antes de tocar em **Próximo**, confira o frete no **Teste rápido**, no fim desta etapa (o Próximo passa para a etapa seguinte). Depois toque em **Próximo**, embaixo. Aparece "Configurações salvas com sucesso!".
   - Imagem: rodapé. Seta em **Próximo**.

**Deu certo quando:** o **Teste rápido** mostrou o frete certo e apareceu "Configurações salvas com sucesso!".

**Dica:** o robô calcula a distância até o endereço do cliente antes de falar o frete. Por isso o endereço da unidade, na etapa **Sua unidade**, precisa estar certo.

**Erro comum:** tocar em outro tipo de taxa só para olhar e salvar sem querer. Antes de tocar em **Próximo**, confira se o tipo escolhido é o que você quer.

**Se não resolver:** o robô fala um frete diferente do que está na tela? Falar com a Maxi (guia 30), com um print da conversa.

---

## 26. Escolher as formas de pagamento
`slug: robo-pagamento` · **Onde começa:** Mais › Meu robô › etapa **Pagamento** · **Tempo:** 3 minutos

**Quando usar:** passou a aceitar (ou deixou de aceitar) cartão, dinheiro, Pix ou vale-refeição.

**Passos**
1. Toque em **Mais**, **Meu robô** e, no alto, na etapa **Pagamento**.
   - Imagem: etapas no alto. Seta em **Pagamento**.
2. Na coluna **Entrega**, marque o que você aceita na entrega.
   - Imagem: tabela das formas. Círculo na coluna **Entrega**.
3. Na coluna **Retirada**, marque o que você aceita na retirada.
   - Imagem: mesma tabela. Círculo na coluna **Retirada**.
4. No bloco **Pix**, confira ou troque a **Chave Pix** e o **Nome do titular**. O titular tem de ser o dono da conta que recebe o Pix.
   - Imagem: bloco Pix. Seta em **Chave Pix**.
5. Toque em **Próximo**, embaixo. Aparece "Configurações salvas com sucesso!".
   - Imagem: rodapé. Seta em **Próximo**.

**Deu certo quando:** o robô oferece só as formas marcadas em cada caso.

**Dica:** Pix e link de pagamento são pagos ANTES da entrega: o robô pede o comprovante e só fecha o pedido depois de receber.

**Erro comum:** marcar dinheiro só em Retirada e estranhar que o robô recusa dinheiro na entrega. Marque nas duas colunas se aceita nas duas.

**Se não resolver:** trocou de chave Pix? Mude aqui mesmo, na etapa **Pagamento**, e toque em **Próximo** para salvar. Só fale com a Maxi (guia 30) se a tela não deixar salvar.

---

## 27. Trocar o cardápio do robô
`slug: robo-cardapio` · **Onde começa:** Mais › Meu robô › etapa **Vendedor** · **Tempo:** 3 minutos (com a imagem pronta)

**Quando usar:** mudou preço ou produto e o cardápio que o robô manda precisa ser o novo.

**Passos**
1. Deixe a imagem nova do cardápio no celular (JPG ou PNG, feita no Canva a partir do modelo da Maxi).
   - Imagem: sem recorte do app (passo fora do app).
2. Toque em **Mais**, **Meu robô** e, no alto, na etapa **Vendedor**. Ache **Catálogo / Cardápio**.
   - Imagem: etapa Vendedor. Seta em **Catálogo / Cardápio**.
3. Toque em **Trocar** (ou na caixa **clique para selecionar**, se ainda não tem) e escolha a imagem na galeria.
   - Imagem: cardápio atual. Seta em **Trocar**.
4. Espere aparecer "Catálogo atualizado!" e a imagem nova. Depois toque em **Próximo**.
   - Imagem: imagem nova na tela. Círculo na imagem.

**Deu certo quando:** a tela mostra o cardápio novo. Nas próximas conversas, o robô manda essa imagem.

**Dica:** o robô manda o cardápio uma vez por conversa. Mude os preços no Estoque também (guia 12), para bater com a imagem. Para fazer a imagem, abra **Criar cardápio no Canva**, na mesma etapa.

**Erro comum:** imagem torta, cortada ou escura. Use o arquivo exportado do Canva, não um print da tela.

**Se não resolver:** o robô ainda manda o cardápio antigo depois de algumas horas? Falar com a Maxi (guia 30).

---

## 28. Reconectar o WhatsApp do robô
`slug: reconectar-whatsapp` · **Onde começa:** Mais › Meu robô (quadro "Conectar WhatsApp", no alto) · **Tempo:** 3 a 5 minutos

**Quando usar:** o robô parou de responder os clientes.

**Passos**
1. Abra o app no computador ou em outro celular. O celular da unidade vai ler o código que aparece nessa tela.
   - Imagem: sem recorte (ilustração de dois aparelhos).
2. Toque em **Mais** e em **Meu robô**. No alto aparece **Conectado** ou **Não conectado**.
   - Imagem: alto do Meu robô. Círculo em **Não conectado**.
3. No quadro **Conectar WhatsApp**, toque em **Gerar QR Code** (ou **Reconectar**). Abre a janela com o código.
   - Imagem: quadro da conexão. Seta em **Gerar QR Code**.
4. No celular da unidade, abra o WhatsApp: **Menu**, **Aparelhos conectados**, **Conectar um aparelho**.
   - Imagem: WhatsApp Business do celular, Aparelhos conectados. Círculo em **Conectar um aparelho**.
5. Aponte a câmera para o QR Code da tela.
   - Imagem: sem recorte do app (foto do celular lendo a tela).
6. Toque em **Verificar Status**. Aparece "WhatsApp Conectado com Sucesso!". Toque em **Fechar**.
   - Imagem: janela com o aviso verde. Círculo no aviso.

**Deu certo quando:** o alto do Meu robô diz **Conectado** e o robô responde uma mensagem de teste (guia 29).

**Dica:** a conexão cai quando o celular da unidade fica muito tempo sem internet ou sem bateria. Deixe-o carregando e no Wi-Fi.

**Erro comum:** tentar ler o QR Code com o próprio celular que mostra o código. Precisa de duas telas: uma mostra, a outra lê.

**Se não resolver:** conectou e o robô não responde? Falar com a Maxi (guia 30).

---

## 29. Conferir o que o robô vai responder
`slug: testar-robo` · **Onde começa:** Mais › Meu robô › etapa **Como o robô responde** · **Tempo:** 5 minutos

**Quando usar:** depois de mudar horário, frete, pagamento ou cardápio, ou quando um cliente reclamou.

**Passos**
1. Toque em **Mais**, **Meu robô** e, no alto, na etapa **Como o robô responde**.
   - Imagem: etapas no alto. Seta em **Como o robô responde**.
2. Leia as conversas de exemplo. Elas são montadas com o que você preencheu: horário, frete, pagamento e retirada.
   - Imagem: conversas de exemplo. Círculo numa resposta.
3. Para conferir o frete, volte à etapa **Entrega e retirada** e use o **Teste rápido**, no fim dela (antes de tocar em Próximo): coloque a distância, o dia e a hora do pedido.
   - Imagem: Teste rápido. Seta no valor do frete.
4. Para testar o WhatsApp de verdade, peça para outra pessoa (não o celular da unidade) mandar "oi" para o número da unidade. Nesse teste, não conclua a compra: ali o pedido seria de verdade.
   - Imagem: sem recorte do app (conversa de teste no WhatsApp).

**Deu certo quando:** as respostas de exemplo e o Teste rápido mostram o que você configurou.

**Dica:** os exemplos e o Teste rápido não mandam mensagem a ninguém e não criam pedido. Só o teste de outra pessoa passa pelo WhatsApp de verdade.

**Erro comum:** testar pelo próprio celular da unidade. O robô não conversa com o próprio número; peça para outra pessoa mandar a mensagem.

**Se não resolver:** resposta errada? Ajuste no Meu robô (guias 24 a 27). Se continuar, Falar com a Maxi com um print (guia 30).

---

# AJUDA

## 30. Falar com a Maxi
`slug: falar-com-maxi` · **Onde começa:** Mais › Ajuda (no fim da tela) · **Tempo:** 1 minuto

**Quando usar:** um guia não resolveu, ou é algo que só a equipe faz (troca de dono da unidade, Instagram, cobrança).

**Passos**
1. Toque em **Mais** e em **Ajuda**. Desça até o fim e toque em **Falar com a Maxi**. (Dentro de um guia, o botão fica no fim do guia.)
   - Imagem: fim da tela Ajuda. Seta em **Falar com a Maxi**.
2. O WhatsApp da Maxi abre com uma mensagem pronta ("Olá! Preciso de ajuda com o app da Maxi Massas."). Acrescente o que aconteceu, em poucas palavras, e qual tela.
   - Imagem: conversa aberta com o texto pronto. Círculo no texto.
3. Se puder, anexe uma foto da tela (aperte ao mesmo tempo o botão de ligar e o de abaixar o volume) e toque em enviar.
   - Imagem: WhatsApp com a foto anexada. Seta no enviar.

**Deu certo quando:** a mensagem foi enviada. Um tique = enviada; dois tiques = chegou no celular da Maxi.

**Dica:** diga o nome da unidade, a tela e o que você tocou. Print ajuda muito. Não consegue entrar no app? Na tela de entrada tem **Falar com a Maxi no WhatsApp**.

**Erro comum:** mandar no grupo das franquias. Dúvida da sua unidade vai no privado da Maxi.

**Se não resolver:** a equipe responde no horário comercial.

---

## 31. Entender a tela Início
`slug: inicio` · **Onde começa:** Início (primeiro botão da barra de baixo) · **Tempo:** 3 minutos
> Fotos (Onda 7c): `inicio-1.webp`..`inicio-8.webp`, uma por passo.

**Quando usar:** entender para que serve cada quadro da Início e o que fazer com ele.

**Passos**
1. Toque em **Início**. No celular, é o primeiro botão da barra de baixo; no computador, fica no menu à esquerda. É a tela que abre quando você entra no app.
   - Imagem: barra de baixo. Contorno em **Início**. (existe: `inicio-1.webp`)
2. O quadro de cima mostra quanto a unidade vendeu no mês até hoje, quantas vendas e o valor médio. O selo no canto compara com o mesmo trecho do mês passado (por exemplo, **−8% que agosto**) e só aparece quando há base para comparar. Logo abaixo, o app sugere o próximo passo. A partir do dia 8, aparece uma previsão de quanto você pode vender até o fim do mês; não é um valor garantido. A mediana aparece se houve vendas nos 3 meses anteriores: é o valor do meio (R$ 800, R$ 1.000 e R$ 1.500 dão mediana de R$ 1.000). Toque em **Ver o resultado do mês** para abrir o Resultado.
   - Imagem: quadro do mês. (existe: `inicio-2.webp`)
3. Quando há dado, o troféu mostra a sua posição entre as unidades da Maxi que venderam no mês (por exemplo, **12º de 58 em setembro**). A seta diz se você subiu ou caiu posições desde o mês passado. Ao lado aparece a posição de hoje, se já houve venda hoje.
   - Imagem: quadro do ranking. (existe: `inicio-3.webp`)
4. O quadro **Hoje** mostra quanto você vendeu hoje. A barra enche até a **Meta do dia**, que é a sua média dos últimos 30 dias mais 10%; ela aparece quando o app tem pelo menos 7 dias de histórico nesses 30 dias. Ao bater, aparece "meta do dia batida". Embaixo, os dias seguidos em que você bateu a meta. Toque em **Vendas de hoje** para ver as vendas.
   - Imagem: quadro Hoje com a barra e os dias seguidos. (existe: `inicio-4.webp`)
5. O quadro **Evolução** mostra, em barras, quanto a unidade vendeu em cada um dos últimos 6 meses. A barra vermelha é o mês atual, que vai só até hoje. Embaixo está a sua mediana dos 3 meses anteriores (o valor do meio), quando você vendeu nos 3.
   - Imagem: quadro Evolução. (existe: `inicio-5.webp`)
6. O quadro **Agora** reúne o que pede uma ação sua: mensalidade perto de vencer (**Pagar**), vendas esperando você marcar como recebidas e o aviso da verba do anúncio (**Registrar**). Toque no aviso para ir direto à tela certa; no aviso da verba, toque em **Registrar**. Quando o app termina de conferir e não há avisos, aparece "Tudo em dia!".
   - Imagem: quadro Agora. (existe: `inicio-6.webp`)
7. O quadro **Quem chamar hoje** traz até 3 clientes para chamar no WhatsApp, com a mensagem pronta. Toque em **Chamar** ao lado do nome: o WhatsApp abre com a mensagem pronta e o cliente já fica marcado como chamado, então confira e envie. Para abrir a lista inteira do dia, toque em **Ver os outros** ou em **Ver lista completa**. Se você nunca usou, antes dele aparece o convite "Conheça o Quem chamar hoje".
   - Imagem: quadro Quem chamar hoje. (existe: `inicio-7.webp`)
8. No fim da tela há quatro atalhos. **Repor estoque** abre a Reposição, dentro de Estoque. **Clientes**, **Resultado do mês** e **Meu robô** também ficam no botão **Mais**. Vendas, Nova venda e Estoque já estão na barra de baixo.
   - Imagem: os quatro atalhos. (existe: `inicio-8.webp`)

**Deu certo quando:** você acha na Início quanto vendeu no mês, como está no ranking, quanto falta para a meta de hoje e o que precisa fazer agora.

**Dica:** comece o dia pelo quadro **Agora** e pelo **Quem chamar hoje**: são os dois que pedem uma ação sua.

**Erro comum:** não vê a meta do dia, o ranking ou a projeção? Cada um só aparece quando o app tem base para calcular. Nos Primeiros passos, antes da 1ª venda, a Início mostra o cartão da trilha, a orientação da 1ª venda e os avisos de pagamento.

**Se não resolver:** Falar com a Maxi (guia 30).

---

## 32. Ver as vendas por produto
`slug: vendas-por-produto` · **Onde começa:** Mais › Gestão (Resultado) › **Mais vendidos** › **Ver todos os produtos** · **Tempo:** 2 minutos
> Fotos (Onda 7c): `vendas-por-produto-1.webp`..`vendas-por-produto-5.webp`, uma por passo.

**Quando usar:** saber quanto você vendeu de cada produto no mês, em unidades e em reais.

**Passos**
1. No celular, toque em **Mais** e em **Gestão**; no computador, toque em **Gestão** no menu à esquerda. Abre o **Resultado**.
   - Imagem: lista do Mais. Contorno em **Gestão**. (existe: `vendas-por-produto-1.webp`)
2. Use as setas ao lado do nome do mês para escolher o mês.
   - Imagem: setas do mês. (existe: `vendas-por-produto-2.webp`)
3. Role até **Mais vendidos**, que mostra os 5 que mais saíram, em unidades. No fim do quadro, toque em **Ver todos os produtos**. O número entre parênteses é quantos produtos diferentes você vendeu no mês.
   - Imagem: botão **Ver todos os produtos**. (existe: `vendas-por-produto-3.webp`)
4. A janela **Vendas por produto** já está aberta. **Qtd** mostra quantas unidades você vendeu no mês escolhido. **Valor** mostra o total vendido do produto, sem frete e sem tirar descontos. **%** mostra a parte do produto nesse total: 20% são R$ 20 de cada R$ 100. Deslize para cima para ver o resto da lista.
   - Imagem: tabela. (existe: `vendas-por-produto-4.webp`)
5. Toque em **Excel** para a planilha, ou em **PDF** para consultar ou imprimir. O arquivo baixa com uma linha por produto e uma linha TOTAL no fim. Aparece "Excel exportado com sucesso!" (ou "PDF exportado com sucesso!").
   - Imagem: botões **Excel** e **PDF**. (existe: `vendas-por-produto-5.webp`)

**Deu certo quando:** a planilha abre com uma linha por produto (produto, quantidade, valor e % do total) e o TOTAL no fim.

**Dica:** a lista é do mês escolhido. Para ver outro mês, feche a janela, troque o mês nas setas e abra de novo.

**Erro comum:** não aparece **Ver todos os produtos**? Confira o mês. Se há vendas, carregue a tela de novo. O **Valor** pode ser diferente do **Entrou** do Resultado, porque aqui não entram frete nem desconto.

**Se não resolver:** Falar com a Maxi (guia 30).

---

## 33. Entender como funciona o anúncio no Meta
`slug: como-funciona-anuncio` · **Onde começa:** é só leitura (não tem tela própria) · **Tempo:** 3 minutos

**Quando usar:** O que acontece com a sua verba, por que o custo muda e o que faz o anúncio vender mais.

**Passos**
1. **A verba vira anúncio na sua cidade.** A Equipe Digital Maxi monta a campanha da sua unidade no Facebook e no Instagram (é o Meta), mostrando para quem mora perto de você. Quem toca no anúncio cai no WhatsApp da unidade, e o robô atende.
2. **O Meta faz um leilão.** Cada vez que alguém abre o Facebook ou o Instagram, várias empresas disputam aquele espaço. O Meta escolhe quem aparece pelo lance (quanto a empresa topa pagar) e por quanto o anúncio agrada às pessoas. A Maxi cuida do lance e da arte; você cuida da verba e do atendimento.
3. **Por que às vezes fica mais caro.** Quando muita gente anuncia ao mesmo tempo (eleição, datas comemorativas, fim de ano), o leilão fica disputado e a mesma verba chega a menos pessoas. Anúncio mostrado muitas vezes para as mesmas pessoas também cansa e rende menos: aí a Maxi troca a arte.
4. **O anúncio aprende com as suas vendas.** Quando você marca a venda como Recebi e ela tem o telefone do cliente, o app avisa o Meta que aquela pessoa comprou. Com isso, o Meta procura gente parecida com quem compra. Venda sem telefone não ensina nada ao anúncio.
5. **O que mais ajuda a vender.** Responder rápido (o robô faz isso), ter no estoque o produto que o anúncio mostra, deixar preço e cardápio certos no Meu robô e manter a verba todo mês: campanha parada perde parte do que aprendeu.

**Deu certo quando:** você entende para onde vai a verba e o que pode fazer para o anúncio vender mais.

**Dica:** Verba maior alcança mais gente, mas quem fecha a venda é o atendimento: responda rápido e marque Recebi em toda venda, com o telefone do cliente.

**Erro comum:** Achar que o valor todo vira anúncio: 14% ficam em impostos e taxas (de R$ 200, R$ 172 vão para o anúncio). E comparar um mês com o outro sem lembrar que o preço do leilão muda.

> Os números do mês do anúncio e do robô aparecem em Mais › Pagamentos. Para pagar a verba, veja o guia Registrar a verba do anúncio.

**Se não resolver:** Falar com a Maxi (guia 30).

---

# (1) Fotos: o que existe e o que falta

Padrão: `public/tutoriais/<slug>-<n>.webp`, `<n>` = número do passo neste documento, 390 px, contorno vermelho da marca no elemento, unidade e clientes fictícios.

| Guia | Já existe | Falta (passos) |
|---|---|---|
| primeiros-passos | `primeiros-passos-1..6` (numeração própria) | — |
| clientes | `quem-chamar-hoje-1..6` (numeração própria) | — |
| vendas | `vendas-1..6` | — |
| pedido-fabrica | `pedido-fabrica-1..6` | — |
| resultado | `resultado-1..5` | — |
| inicio | `inicio-1..8` (Onda 7c) | — |
| vendas-por-produto | `vendas-por-produto-1..5` (Onda 7c) | — |
| pagamentos | `pagamentos-2,3,4,7` | 1, 5, 6 |
| demais 24 guias | — | todos os passos com recorte do app (passos marcados "sem recorte do app" não levam foto) |

---

# (2) Perguntas frequentes

1. **Por onde eu começo?** Na Início, toque em Continuar no cartão vermelho "Primeiros passos" (ou em Mais › Primeiros passos). → `primeiros-passos`
2. **A venda "A receber" conta no meu mês?** Sim, desde que foi lançada. "Recebi" só confirma que o dinheiro entrou. → `venda-recebida`
3. **"Sobrou no mês" é o saldo do meu banco?** Não. É o que entrou com as vendas menos a taxa de cartão e os gastos lançados. → `resultado`
4. **Preciso lançar o pedido à fábrica como gasto?** Não. Ele entra sozinho quando chega. A verba confirmada e a mensalidade paga também. → `lancar-gasto`
5. **Qual preço devo cobrar?** O markup recomendado é de 100%: o preço de venda é o dobro do custo. → `mudar-preco`
6. **Por que meu produto próprio não aparece no pedido?** O pedido à fábrica só tem os produtos da Maxi. Os seus ficam só no Estoque. → `produto-proprio`
7. **O robô parou de responder. E agora?** Em Mais › Meu robô, veja se está conectado. Se não, leia o QR Code de novo: precisa de duas telas. Sem outra tela, fale com a Maxi. → `reconectar-whatsapp`
8. **Quanto da verba vai para o anúncio?** Do valor pago, 14% ficam em impostos e taxas: de R$ 200, R$ 172 vão para o anúncio. → `verba-marketing`
9. **Paguei a mensalidade e continua em aberto.** Abra Pagamentos e toque em "Já paguei, verificar agora". → `pagamentos`
10. **O comprovante sai fraco na impressora.** Na janela de impressão, ponha a escala em 80%. Se continuar, troque a bobina. → `comprovante`
11. **O link do e-mail venceu.** Peça outro em "Primeiro acesso ou esqueceu a senha?". O link vale 24 horas e serve uma vez. → `esqueci-senha`
12. **Onde vejo quanto vendi de cada produto?** Em Mais › Gestão (o Resultado), toque em Ver todos os produtos. A lista é do mês escolhido e dá para baixar em Excel ou PDF. → `vendas-por-produto`
13. **Posso usar meu número pessoal no robô?** Não. Use um número só da unidade, com WhatsApp Business. (sem guia próprio)

No app (`PERGUNTAS_FREQUENTES`) ficam as 9 que já existiam (algumas passaram a apontar para o guia novo que responde melhor) mais 5 novas.

---

# (3) Conferência de linguagem

Busca feita nos textos dos 31 guias e das perguntas frequentes. No app, a trava automática é o `guiasAjuda.test.mjs` (palavras proibidas, "fábrica" só como "à fábrica", "sem fundo de marketing").

| Palavra ou expressão proibida | Resultado |
|---|---|
| margem | não aparece (usa "markup recomendado de 100%"). A tela do Estoque também passou a dizer "markup" (Onda 7c) |
| amanhã | não aparece; nenhuma data prometida |
| loja | não aparece |
| Líquido, Ticket Médio, Inventário | não aparecem (sempre "Estoque") |
| reservar, reserva, separar, guardar | não aparecem |
| fábrica como sendo a unidade | não aparece; "fábrica" só em "à fábrica" e no rótulo da tela "Produto comprado fora da fábrica" (guia 18, só neste documento; no app o texto diz "comprado fora do pedido à fábrica") |
| taxa de marketing / fundo de marketing | só "sem fundo de marketing" |
| jargão: sincronizar, status, dashboard, CAPI, IA | não aparecem ("Verificar Status" é o rótulo exato do botão da janela do WhatsApp) |

Observação: a trava `'fábrica' só como à fábrica` olha 12 caracteres antes da palavra. Títulos como "ESTOQUE E PEDIDO À FÁBRICA" ficam só neste documento.
