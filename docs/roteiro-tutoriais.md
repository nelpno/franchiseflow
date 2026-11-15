# Roteiro de Gravação — Tutoriais Maxi Massas

## Dicas Gerais
- Grave na TELA DO CELULAR (maioria dos franqueados usa mobile)
- Use uma conta de FRANQUEADO real (não admin)
- Fale como se estivesse explicando pra um amigo
- Cada vídeo: 2-4 minutos no máximo
- Comece cada vídeo dizendo o título: "Nesse vídeo vou mostrar como..."

---

## VIDEO 1 — Bem-vindo ao App (2 min)

**Objetivo:** Franqueado entende onde está cada coisa.

**Roteiro:**
1. Abra o app no celular (tela de login)
2. Faça login com email e senha
3. Mostre o Dashboard — "Essa é sua tela inicial, aqui você vê um resumo rápido"
4. Mostre o menu hambúrguer (3 risquinhos no canto) — abra o sidebar
5. Passe por cada item do menu explicando em uma frase:
   - "Início — seu painel com resumo do dia"
   - "Primeiros passos — a trilha para abrir sua unidade (só aparece enquanto ela está começando)"
   - "Vendas — onde você registra cada venda"
   - "Gestão — seu financeiro, estoque e reposição"
   - "Meus Clientes — quem chamar hoje e todos os seus clientes"
   - "Marketing — materiais e ferramentas de divulgação"
   - "Meu Vendedor — configura o robô do WhatsApp"
   - "Tutoriais — esses vídeos que você tá assistindo agora"
6. Mostre a barra inferior (bottom nav) — "Esses atalhos aqui embaixo são os mais usados"
7. Destaque o botão redondo "Vender" no centro — "Esse botão é seu atalho rápido pra registrar venda"
8. Mostre o sininho de notificações no topo

---

## VIDEO 2 — Primeiros passos (2 min) · também é o vídeo de boas-vindas

> Substituiu "Completando seu Onboarding" (`nnPNlIF26Ic`, os 28 checkboxes) em 17/09/2026.

**Objetivo:** a franqueada nova sabe onde está a trilha, o que fazer agora e o que a Maxi faz junto com ela.

**Onde aparece:** na tela de boas-vindas (link "Ver vídeo de boas-vindas") e no guia "Primeiros passos" em Tutoriais.

**Antes de gravar:**
- Use a unidade de teste "Maxi Teste 2" com a trilha **em andamento** (não conclua a trilha dela antes de gravar).
- Grave no celular, na vertical (sai como Short).
- Nada de dado de unidade real na tela.

**Roteiro (fala entre aspas, cerca de 2 minutos):**
1. **0:00, tela Início com o cartão vermelho.** "Oi, seja bem-vinda à Maxi Massas! Neste vídeo eu mostro por onde começar. Tudo o que falta para abrir sua unidade está aqui no app, em 5 passos."
2. **0:10, toque em Continuar.** "Toque em Continuar. Esta é a sua trilha. Lá em cima você vê em que passo está."
3. **0:20, cartão Agora.** "O cartão Agora mostra a próxima tarefa. Toque no botão vermelho, e o app leva você direto para a tela certa."
4. **0:30, role pelos 5 passos.** "São 5 passos, nesta ordem:
   - primeiro, seus dados;
   - depois, o robô vendedor, que atende seus clientes no WhatsApp;
   - depois, seu espaço e seus preços;
   - o primeiro pedido para a fábrica;
   - e, por último, o lançamento e a primeira venda."
5. **0:50, abra um passo e toque em Como fazer.** "Dentro de cada passo estão as tarefas. Cada uma tem um resumo e um botão. Ficou com dúvida? Toque em Como fazer."
6. **1:00, toque num botão que abre outra tela e mostre a faixa escura no topo.** "Quando a trilha leva você para outra tela, aparece esta faixa: Voltar aos Primeiros passos. Terminou? Toque nela."
7. **1:10, volte à trilha e mostre Marcar como feito.** "O que o app consegue ver, ele marca sozinho: o cardápio, o robô respondendo, o pedido. O que acontece fora do app, como o seu WhatsApp Business pronto, você marca aqui, em Marcar como feito."
8. **1:25, passo 4 aberto.** "No primeiro pedido, a lista já vem preenchida com o pedido modelo da Maxi. É uma referência: ajuste as quantidades do seu jeito antes de enviar."
9. **1:40, bloco dourado.** "E neste bloco dourado você acompanha o que a equipe Maxi faz com você: o contrato, a reunião de início, as redes sociais, o grupo das franquias, um pedido de teste no robô e os anúncios."
10. **1:52, fechamento.** "Quando os 5 passos estiverem prontos, a equipe Maxi é avisada e confere tudo com você. Qualquer dúvida, fale com a gente. Boas vendas!"

**Depois de subir:** o link vai em dois lugares.
- `VIDEO_BOAS_VINDAS = { url: "https://www.youtube.com/shorts/<ID>" }` em `src/components/onboarding/materiais.js`.
- `youtubeId: "<ID>"` no item `primeiros-passos` de `src/pages/Tutoriais.jsx`.

---

## VIDEO 3 — Configurando o Meu Vendedor (4 min)

**Objetivo:** Franqueado configura o robô de vendas do WhatsApp.

**Roteiro:**
1. Vá em "Meu Vendedor" no menu
2. Mostre o wizard — "São 5 passos pra configurar seu vendedor automático"

**Passo 1 — Informações:**
3. "Preencha o nome da franquia, endereço e ponto de referência"

**Passo 2 — Horário:**
4. "Selecione os dias que você trabalha e o horário de funcionamento"
5. "Se tiver janela de entrega diferente, configure aqui"

**Passo 3 — Delivery:**
6. "Ative se você faz entrega, defina o raio máximo em km"
7. "Configure a tabela de frete por distância"
8. "Se tiver frete grátis, ative aqui"

**Passo 4 — Pagamento:**
9. "Marque as formas de pagamento que você aceita"
10. "Se aceita Pix, preencha a chave"

**Passo 5 — Catálogo:**
11. "Suba a foto do seu cardápio em JPG"
12. "Pode colocar link do Instagram e da tabela de preços"

**Revisão:**
13. "Confira tudo e salve"

**WhatsApp:**
14. Mostre o botão de conectar WhatsApp
15. "Aponte a câmera do celular pro QR Code que aparece aqui"
16. "Quando ficar verde, tá conectado e o robô já começa a atender"

---

## VIDEO 4 — Registrando uma Venda (3 min)

**Objetivo:** Franqueado registra venda completa.

**Roteiro:**
1. Toque no botão redondo "Vender" na barra inferior (ou vá em Vendas no menu)
2. "Aqui você registra cada venda que fizer"
3. Selecione um cliente (ou crie novo) — "Pode vincular a um cliente ou deixar sem"
4. Adicione produtos — "Toque no produto e escolha a quantidade"
5. Mostre o resumo dos itens e o valor total
6. Selecione forma de pagamento — "Pix, dinheiro, cartão..."
7. Se for entrega, mostre o campo de taxa de entrega
8. Toque em "Registrar Venda"
9. Mostre o comprovante que aparece — "Esse é o comprovante da venda"
10. Mostre o botão de compartilhar — "Pode enviar pro cliente pelo WhatsApp"
11. "Pronto! A venda já aparece no seu financeiro e o estoque desconta automaticamente"

---

## VIDEO 5 — Resultado Financeiro (3 min)

**Objetivo:** Franqueado entende seus números.

**Roteiro:**
1. Vá em Gestão > aba Resultado
2. "Aqui é o coração do seu negócio — tudo que entrou e saiu"
3. Mostre o filtro de período — "Pode ver por dia, semana ou mês"
4. Explique as linhas:
   - "Faturamento — total das vendas"
   - "Taxa de entrega — o que você cobrou de frete"
   - "Taxas de cartão — desconto das maquininhas"
   - "Despesas — o que você gastou (sacolas, aluguel...)"
5. Mostre o resultado final — "Esse é seu resultado do período"
6. Mostre os gráficos — "Aqui você vê a evolução ao longo dos dias"
7. "Dica: consulte toda semana pra acompanhar como tá indo"

---

## VIDEO 6 — Estoque e Reposição (3 min)

**Objetivo:** Franqueado gerencia produtos e faz pedido.

**Roteiro:**

**Aba Estoque:**
1. Vá em Gestão > aba Estoque
2. "Aqui estão todos os seus produtos com a quantidade atual"
3. Mostre a lista de produtos com quantidades
4. Toque em um produto pra editar — "Pode ajustar o preço de custo e de venda"
5. "O estoque atualiza automaticamente quando você registra uma venda"

**Aba Reposição:**
6. Troque pra aba Reposição
7. "Quando precisar de mais produtos, é aqui que você faz o pedido"
8. Mostre como criar um novo pedido — selecionar produtos e quantidades
9. "Depois de enviar, o pedido aparece como Pendente"
10. Mostre os status — "Pendente, Confirmado, Em Rota, Entregue"
11. "Quando chegar Entregue, o estoque sobe automaticamente"

---

## VIDEO 7 — Gerenciando seus Clientes (3 min)

> ⚠️ Desatualizado: Meus Clientes mudou em 16/09/2026 (abas Hoje e Todos). Hoje quem explica é o guia ilustrado "Quem chamar hoje" em Tutoriais; regravar só se for preciso.

**Objetivo:** Franqueado usa o CRM de clientes.

**Roteiro:**
1. Vá em Meus Clientes
2. "Aqui ficam todos os seus clientes — os que compraram e os que o robô captou"
3. Mostre as abas de status:
   - "Todos — lista completa"
   - "Responder — leads novos que ainda não foram atendidos"
   - "Negociando — clientes em conversa"
   - "Clientes — quem já comprou"
   - "Fiéis — clientes recorrentes"
   - "Sumidos — faz tempo que não compram"
4. Mostre como adicionar um contato manualmente — botão de adicionar
5. Toque em um cliente — mostre os detalhes (compras, valor total, última compra)
6. Mostre a ação rápida de registrar venda direto do contato
7. "Dica: o robô do WhatsApp já salva os contatos automaticamente aqui"

---

## VIDEO 8 — Dicas e Atalhos (2 min)

**Objetivo:** Franqueado conhece truques pra ser mais rápido.

**Roteiro:**
1. "Agora vou mostrar uns atalhos pra você usar o app mais rápido"
2. Mostre o botão FAB "Vender" — "Esse botão tá sempre na barra de baixo, de qualquer tela"
3. Mostre as notificações (sininho) — "Aqui chegam avisos de pedidos e atualizações"
4. Mostre o Dashboard — "Seu painel mostra o resumo do dia sem precisar abrir cada tela"
5. Mostre o seletor de franquia (se tiver mais de uma) — "Se você tem mais de uma unidade, troca aqui"
6. "Lembrete: o estoque desconta sozinho quando você vende, e sobe quando o pedido chega"
7. "Se tiver dúvida, volte nos Tutoriais — os vídeos ficam salvos ali no menu"
8. "Boas vendas!"

---

## Ordem de Gravação Sugerida

Grave nessa ordem (segue a jornada do franqueado novo):

1. Bem-vindo ao App
2. Primeiros passos (também é o vídeo de boas-vindas)
3. Configurando o Meu Vendedor
4. Registrando uma Venda
5. Estoque e Reposição (gravar ANTES do financeiro — faz mais sentido no fluxo)
6. Resultado Financeiro
7. Gerenciando seus Clientes
8. Dicas e Atalhos

## Após Gravar

1. Suba cada vídeo no YouTube como **não-listado**
2. Me passe os 8 links/IDs do YouTube
3. Eu atualizo no código e faço deploy
