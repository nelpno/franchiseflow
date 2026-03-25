// Detalhes expandíveis — tom guiado, tranquilo, com links pro dashboard
// Cada item ensina o franqueado a usar uma parte do sistema

export const ITEM_DETAILS = {
  // === MISSÃO 1: Primeiros Passos ===
  "1-1": {
    text: "Marcado automaticamente — seu contrato foi assinado antes do convite.",
  },
  "1-2": {
    text: "Marcado automaticamente — a reunião de kick-off já aconteceu com o CS antes de você receber o acesso.",
  },
  "1-3": {
    text: "O Drive contém todos os vídeos de treinamento. Se não conseguir acessar, peça ao franqueador para liberar seu e-mail.",
    links: [{ label: "Acessar Drive de Treinamento", url: "https://drive.google.com/drive/u/1/folders/1JuqdvhWBdK7-YvLhZEMX0mh9xfrel3lh" }],
  },

  // === MISSÃO 2: Conheça Seus Produtos ===
  "2-1": {
    text: "São 28 produtos em 8 categorias. Você vai se apaixonar!\n\n- Canelone (700g): 4 Queijos, Brócolis/Muss., Frango/Requeijão, Presunto/Muss.\n- Conchiglione (700g): 4 Queijos, Brócolis/Muss., Presunto/Muss., Frango/Requeijão\n- Rondelli (700g): 4 Queijos, Brócolis/Muss., Frango/Requeijão, Presunto/Muss.\n- Rondelli Fatiado (500g): 4 Queijos, Presunto/Muss.\n- Sofioli (700g): 4 Queijos, Brócolis/Muss., Presunto/Muss., Frango/Requeijão\n- Nhoque: Batata 1kg, Batata 500g, Recheado 4Q, Muss., P&M, Calabresa (700g)\n- Massas Base: Lasanha 500g, Pastel 1kg, Pastel 500g\n- Molho: Sugo 250g\n\nDica: experimente cada um para falar com propriedade pros clientes!",
  },
  "2-2": {
    text: "A melhor forma de vender é conhecer o produto de verdade. Escolha pelo menos 3 sabores diferentes, prepare em casa e prove. Você vai ver como é fácil — pronto em minutos!",
  },
  "2-3": {
    text: "Seus preços de revenda já vêm pré-configurados com margem de 100% sobre o custo (preço de venda = custo x 2). Confira e ajuste se necessário em Gestão → Estoque.",
    links: [{ label: "Abrir Estoque", url: "/Gestao?tab=estoque" }],
  },

  // === MISSÃO 3: Prepare Seu Espaço ===
  "3-1": {
    text: "Recomendamos um freezer horizontal de 540 litros — é o tamanho ideal para o estoque inicial. Freezer vertical também funciona!\n\nMantenha sempre em -18°C ou menos. Produto descongelado = produto perdido.\n\nDicas:\n• Deixe espaço entre os produtos para o ar circular\n• Posicione o freezer em local ventilado, longe do sol\n• Organize por categoria (Massas | Molhos | Outros) para achar tudo rápido",
  },
  "3-2": {
    text: "Organize por categoria: Massas | Molhos | Outros.\n\nNo app, o estoque já separa os tipos (Canelone, Rondelli, Nhoque, etc.) em abas — aqui no freezer, basta agrupar por categoria geral.\n\nUse o sistema FIFO: Primeiro que Entra, Primeiro que Sai (produtos mais antigos na frente).",
  },
  "3-3": {
    text: "Use sacolas Boca de Palhaço para boa apresentação e segurança dos produtos.\n\n- 30x40 — pacote com cerca de 350 unidades\n- 35x45 — pacote com cerca de 265 unidades\n\nFornecedor: Rodrigo — D'Momentus Uniformes\nWhatsApp: (18) 99610-9903\n\nDica: coloque um panfleto ou cartão de visita na sacola — gera indicações!",
    links: [{ label: "Artes da sacola (Google Drive)", url: "https://drive.google.com/drive/folders/1GrhGrvR7x1tBYSwWQQEs5gQk4YqoR2h9?usp=drive_link" }],
  },

  // === MISSÃO 4: Configure o WhatsApp ===
  "4-1": {
    text: "Baixe o WhatsApp Business (ícone verde com B) e configure com um número exclusivo. Pode ser um chip pré-pago novo.\n\nImportante: não use seu número pessoal. Esse número será a linha direta da operação.",
  },
  "4-2": {
    text: "No WhatsApp Business → Configurações → Perfil comercial, preencha:\n- Foto: logo da Maxi Massas\n- Nome: Maxi Massas [Sua Cidade]\n- Categoria: Restaurante\n- Descrição: Massas artesanais congeladas prontas em minutos!\n- Endereço e horário de funcionamento",
  },
  "4-3": {
    text: "Crie 5 etiquetas no WhatsApp Business usando as cores padrão. Elas casam com o pipeline de 'Meus Clientes' no app:\n\n🟢 Novo — Acabou de chegar, responder rápido!\n🔵 Negociando — Respondeu mas ainda não fechou. Follow-up em 24h.\n🟡 Cliente — Já comprou pelo menos 1 vez.\n🟠 VIP — Comprou 3+ vezes. Tratamento especial!\n🔴 Reativar — Sumiu há 15+ dias. Mandar oferta!",
  },
  "4-4": {
    text: "Este item é responsabilidade do franqueador. Será marcado quando seu WhatsApp for adicionado ao grupo oficial.",
  },

  // === MISSÃO 5: Configure Seu Vendedor ===
  "5-1": {
    text: "Você tem um modelo pronto de cardápio no Canva! Siga os passos:\n\n1. Abra o link abaixo (precisa ter conta no Canva — é grátis)\n2. Clique em \"Arquivo\" → \"Fazer uma cópia\"\n3. O modelo vai aparecer no seu Canva pessoal\n4. Edite com os dados da sua unidade (cidade, telefone, preços se diferentes)\n5. Quando terminar, exporte como JPG (Compartilhar → Baixar → JPG)\n\nEsse cardápio será usado no catálogo do WhatsApp e no robô de vendas (próximo passo).",
    links: [{ label: "Abrir template no Canva", url: "https://www.canva.com/design/DAHAY6s9N14/jD40oAe1dD47Ie-hEJ0adQ/edit?utm_content=DAHAY6s9N14&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton" }],
  },
  "5-2": {
    text: "Essa é a missão mais importante! No menu lateral, clique em 'Meu Vendedor' e preencha o formulário completo (6 passos).\n\nEle configura de uma vez:\n- Dados da sua unidade\n- Horários de funcionamento\n- Formas de pagamento e PIX\n- Raio e taxa de entrega\n- Catálogo de produtos (foto JPG do cardápio que você criou no Canva)\n\nQuando terminar, seu robô de vendas estará pronto para atender clientes 24h!\n\nEste item marca automaticamente quando o formulário estiver completo.",
    links: [{ label: "Abrir Meu Vendedor", url: "/FranchiseSettings" }],
  },

  // === MISSÃO 6: Faça Seu Primeiro Pedido ===
  "6-1": {
    text: "Hora de abastecer! Clique no botão abaixo para ir direto à tela de Reposição.\n\nLá você vai ver todos os 28 produtos organizados por tipo. É só:\n1. Escolher os produtos que quer pedir\n2. Definir as quantidades\n3. Clicar em \"Enviar Pedido\"\n\nO franqueador recebe na hora e você acompanha o status por aqui. Este item marca automaticamente quando seu primeiro pedido for enviado.",
    links: [{ label: "Fazer Meu Primeiro Pedido", url: "/Gestao?tab=reposicao" }],
  },
  "6-2": {
    text: "Quando o pedido chegar, confira tudo:\n- Quantidades batem?\n- Produtos bem embalados e congelados?\n- Datas de validade ok?\n\nSe algo estiver errado, registre com foto e avise o franqueador.\n\nVocê pode acompanhar o status do pedido (pendente, confirmado, em rota, entregue) na tela de Reposição.",
    links: [{ label: "Acompanhar meu pedido", url: "/Gestao?tab=reposicao" }],
  },
  "6-3": {
    text: "Com o pedido conferido, registre as quantidades em Gestão → Estoque. A partir daqui, cada venda que você registrar vai atualizar o estoque automaticamente!\n\nEste item marca automaticamente quando algum produto tiver estoque registrado.",
    links: [{ label: "Abrir Estoque", url: "/Gestao?tab=estoque" }],
  },

  // === MISSÃO 7: Treinamento ===
  "7-1": {
    text: "Assista os 3 vídeos no Drive:\n1. Configuração do WhatsApp Business\n2. Como usar o Meta Business Suite\n3. Como funciona o Robô de Atendimento\n\nDura cerca de 45 minutos no total. Pode assistir no seu ritmo!",
    links: [{ label: "Acessar Drive", url: "https://drive.google.com/drive/u/1/folders/1DwQLHOKo2Lf8RJ83-ADAqJcIYmi5m-VH" }],
  },
  "7-2": {
    text: "Envie uma mensagem de outro celular para o número do WhatsApp Business. O robô deve responder automaticamente. Verifique se a saudação, cardápio e informações estão corretos.\n\nSe algo estiver errado, ajuste em Meu Vendedor no app.",
    links: [{ label: "Ajustar no Meu Vendedor", url: "/FranchiseSettings" }],
  },

  // === MISSÃO 8: Redes Sociais ===
  "8-1": {
    text: "O franqueador cuida da criação do Facebook, Instagram, vinculação do WhatsApp e configuração do Meta Business Suite. Será marcado quando tudo estiver pronto.",
  },
  "8-2": {
    text: "No Drive tem uma pasta com vídeos tutoriais do Meta Business Suite. Assista na ordem:\n\n1. Meta Business Suite — visão geral da ferramenta\n2. Menu Lateral — onde fica cada coisa\n3. Planner — como agendar seus posts\n4. Planner Reforço — dicas extras para programar conteúdo\n\nDepois de assistir, acesse business.facebook.com e explore:\n- Alcance (quantas pessoas viram seus posts)\n- Engajamento (curtidas, comentários)\n- Resultados dos anúncios (leads, custo por lead)",
    links: [{ label: "Assistir Vídeos Tutoriais", url: "https://drive.google.com/drive/folders/1dHR5Erx6ShhkL4eIFFZPUm-R4q2bjbXU?usp=drive_link" }],
  },
  "8-3": {
    text: "Você tem dois lugares com artes prontas:\n\n📱 Marketing no app — aqui ficam as postagens do mês atual. Abra, baixe e poste!\n\n📁 Drive Artes Redes Sociais — banco completo com todo o acervo:\n- Artes por ano (2023 a 2026) — posts de meses anteriores\n- Postagens Neutras — servem para qualquer época\n- Reels Neutros — vídeos curtos para Instagram\n- Destaques do Instagram — capas para organizar seu perfil\n- Stories Feedback — modelos de stories com depoimentos\n- Vídeos Influencer — conteúdo com influenciadores\n\nRotina: todo mês, abra o Marketing no app, baixe as artes novas e agende no Planner do Meta Business Suite.",
    links: [
      { label: "Postagens do Mês (Marketing)", url: "/Marketing" },
      { label: "Acervo Completo (Drive)", url: "https://drive.google.com/drive/folders/1r-0rojeukSj4Hdw98zSmPEqemwg7anWC?usp=drive_link" },
    ],
  },

  // === GATE 9: Liberação ===
  "9-1": {
    text: "Marca automaticamente quando as 8 missões estiverem completas. Se está faltando algo, verifique cada missão acima.",
  },
  "9-2": {
    text: "O CS vai simular ser um cliente: manda mensagem no seu WhatsApp, você atende, apresenta o cardápio, fecha o pedido e simula entrega/retirada. É o teste final!",
  },
  "9-3": {
    text: "O CS verifica tudo: WhatsApp Business, freezer (foto com termômetro), estoque no app, redes sociais, PIX testado e Meu Vendedor preenchido.",
  },
  "9-4": {
    text: "Quando o franqueador marca este item, seus anúncios serão ativados em até 48h. A partir daí, leads reais vão chegar pelo WhatsApp. O robô responde automaticamente, mas você dá continuidade às conversas!",
  },
};
