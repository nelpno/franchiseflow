// Conteúdo (texto puro, sem JSX) dos 5 passos da trilha "Primeiros passos" — a ordem
// AQUI é a ordem REAL do processo (o pedido à fábrica é um dos últimos, não o 6º de 9
// blocos como no onboarding antigo). Nada do texto de ITEM_DETAILS.jsx foi perdido:
// cada item virou dica, material ou tarefa automática de algum passo — ver a tabela em
// CLAUDE.md raiz do dashboard, seção "Primeiros passos (onboarding)".
//
// Lido por src/lib/onboardingJourney.js (montarJornada), que soma o estado calculado
// (fiscal, cardápio, vendedor, marcos com data) e o que está salvo em `items` por cima
// deste conteúdo estático. Este arquivo é só dado — zero lógica.
//
// Cada tarefa: { id, tipo: 'auto'|'dica'|'material'|'confirmacao', titulo, texto, destinos }.
// destinos: [{ tipo: 'app'|'drive'|'canva'|'video'|'acao', href?, acao?, rotulo }].
// tipo 'auto' e 'confirmacao' contam para o progresso do passo; 'dica' e 'material' não
// (são conteúdo de apoio, sem sinal próprio).

import {
  DRIVE_FRANQUEADOS,
  DRIVE_VIDEOS_TREINAMENTO,
  DRIVE_SACOLA,
  DRIVE_META_BUSINESS,
  DRIVE_POSTAGENS,
  CANVA_CARDAPIO,
} from "./materiais.js";

// Ícone por passo (usado por NextActionCard e JourneyStep). Fica separado dos
// objetos de passo abaixo porque montarJornada() (onboardingJourney.js) não
// espalha campos extras do passoDef no retorno — só id/numero/titulo/tarefas/maxi.
export const PASSO_ICONES = {
  dados: "description",
  robo: "smart_toy",
  espaco: "kitchen",
  pedido: "local_shipping",
  lancamento: "campaign",
};

export const JOURNEY_STEPS = [
  {
    id: "dados",
    numero: 1,
    titulo: "Seus dados",
    tarefas: [
      {
        id: "fiscal",
        tipo: "auto",
        titulo: "Confirmar os dados da unidade e de cobrança",
        resumo: "CPF ou CNPJ, endereço e e-mail de cobrança.",
        texto:
          "Confira o e-mail de cobrança, o CPF/CNPJ e o endereço completo da unidade. " +
          "É esse endereço que o robô usa para calcular a distância da entrega — por isso ele precisa estar certo.",
        destinos: [{ tipo: "acao", acao: "fiscal", rotulo: "Conferir meus dados" }],
      },
      {
        id: "numero_dedicado",
        tipo: "dica",
        titulo: "Separe um número só para a unidade",
        resumo: "Um chip só da unidade, separado do seu número pessoal.",
        texto:
          "Separe um número de celular só para a unidade (pode ser um chip novo). Não use o seu pessoal.",
        destinos: [],
      },
      {
        id: "materiais_franquia",
        tipo: "material",
        titulo: "Materiais da franquia",
        resumo: "Materiais e vídeos da franquia, no Drive.",
        texto:
          "No Drive estão os materiais e os vídeos de treinamento da franquia. " +
          "Se ele não abrir, avise a equipe Maxi o e-mail que você usa no Google.",
        destinos: [{ tipo: "drive", href: DRIVE_FRANQUEADOS, rotulo: "Abrir Drive de materiais" }],
      },
    ],
    maxi: [
      { id: "maxi_contrato", nome: "Contrato assinado" },
      { id: "maxi_kickoff", nome: "Reunião de início" },
    ],
  },

  {
    id: "robo",
    numero: 2,
    titulo: "Seu robô vendedor",
    tarefas: [
      {
        id: "whatsapp_perfil",
        tipo: "dica",
        titulo: "WhatsApp Business no número da unidade",
        resumo: "Instale e preencha foto, nome, endereço e horário.",
        texto:
          "Baixe o WhatsApp Business (ícone verde com B) e configure com um número exclusivo. " +
          "Pode ser um chip pré-pago novo.\n\n" +
          "Importante: não use seu número pessoal. Esse número será a linha direta da operação.\n\n" +
          "No WhatsApp Business → Configurações → Perfil comercial, preencha:\n" +
          "- Foto: logo da Maxi Massas\n" +
          "- Nome: Maxi Massas [Sua Cidade]\n" +
          "- Categoria: Restaurante\n" +
          "- Descrição: Massas artesanais congeladas prontas em minutos!\n" +
          "- Endereço e horário de funcionamento",
        destinos: [],
      },
      {
        id: "whatsapp_etiquetas",
        tipo: "dica",
        titulo: "Criar as 5 etiquetas",
        resumo: "Nunca comprou, Novo, Voltou, Fiel e Sumido.",
        texto:
          "Crie 5 etiquetas no WhatsApp Business. São as mesmas marcas que aparecem em Meus Clientes:\n\n" +
          "⚪ Nunca comprou — conversou, mas ainda não comprou.\n" +
          "🟢 Novo — comprou 1 vez.\n" +
          "🔵 Voltou — comprou de novo (2 a 4 vezes).\n" +
          "🟡 Fiel — 5 compras ou mais.\n" +
          "🔴 Sumido — mais de 30 dias sem comprar. Hora de chamar!",
        destinos: [],
      },
      {
        id: "videos_treinamento",
        tipo: "material",
        titulo: "Vídeos de treinamento",
        resumo: "Três vídeos, uns 45 minutos, no seu ritmo.",
        texto:
          "Assista os 3 vídeos no Drive:\n" +
          "1. Configuração do WhatsApp Business\n" +
          "2. Como usar o Meta Business Suite\n" +
          "3. Como funciona o Robô de Atendimento\n\n" +
          "Dura cerca de 45 minutos no total. Pode assistir no seu ritmo!",
        destinos: [{ tipo: "drive", href: DRIVE_VIDEOS_TREINAMENTO, rotulo: "Assistir vídeos de treinamento" }],
      },
      {
        id: "cardapio",
        tipo: "auto",
        titulo: "Fazer o cardápio no Canva",
        resumo: "Faça uma cópia do modelo e troque cidade e telefone.",
        texto:
          "Você tem um modelo pronto de cardápio no Canva! Siga os passos:\n\n" +
          '1. Abra o link abaixo (precisa ter conta no Canva — é grátis)\n' +
          '2. Toque em "Arquivo" → "Fazer uma cópia"\n' +
          "3. O modelo vai aparecer no seu Canva pessoal\n" +
          "4. Edite com os dados da sua unidade (cidade, telefone, preços se diferentes)\n" +
          '5. Quando terminar, exporte como JPG (Compartilhar → Baixar → JPG)\n\n' +
          "Esse cardápio será usado no catálogo do WhatsApp e no robô de vendas (próximo passo).",
        destinos: [{ tipo: "canva", href: CANVA_CARDAPIO, rotulo: "Abrir template no Canva" }],
      },
      {
        id: "vendedor",
        tipo: "auto",
        titulo: "Preencher o Meu Vendedor",
        resumo: "Unidade, entrega, pagamento, nome do vendedor e respostas.",
        texto:
          "É o que faz o robô atender seus clientes. Em Meu Vendedor, preencha as 5 etapas:\n" +
          "- sua unidade (nome e endereço)\n" +
          "- entrega e retirada (horários e raio)\n" +
          "- pagamento (e a chave PIX)\n" +
          "- nome do seu vendedor\n" +
          "- como o robô vai responder\n\n" +
          "Referência da rede: o raio de entrega mais comum fica entre 15 e 25 km e o pedido mínimo, perto de R$ 30. " +
          "Dá para aceitar vale-refeição na etapa de pagamento.",
        destinos: [{ tipo: "app", href: "/FranchiseSettings?de=primeiros-passos", rotulo: "Abrir Meu Vendedor" }],
      },
      {
        id: "robo_respondeu",
        tipo: "auto",
        titulo: "Conectar o WhatsApp e testar",
        resumo: "De outro celular, mande “oi” e peça um produto.",
        texto:
          "Envie uma mensagem de outro celular para o número do WhatsApp Business. O robô deve responder automaticamente. " +
          "Verifique se a saudação, cardápio e informações estão corretos.\n\n" +
          "Se algo estiver errado, ajuste em Meu Vendedor no app.",
        destinos: [{ tipo: "app", href: "/FranchiseSettings?de=primeiros-passos", rotulo: "Ajustar no Meu Vendedor" }],
      },
      {
        id: "p_whatsapp_ok",
        tipo: "confirmacao",
        titulo: "Meu WhatsApp Business está pronto (perfil e etiquetas)",
        resumo: "Toque quando o perfil e as etiquetas estiverem prontos.",
        texto: "Confirme quando o perfil comercial e as 5 etiquetas estiverem prontos no seu WhatsApp Business.",
        destinos: [],
      },
    ],
    maxi: [
      { id: "maxi_redes", nome: "Criar Facebook e Instagram e ligar ao WhatsApp" },
      {
        id: "maxi_grupo",
        nome: "Colocar no grupo das franquias",
        sub: "depois que o WhatsApp da unidade estiver pronto",
      },
      {
        id: "maxi_validacao",
        nome: "Validar o robô com um pedido de teste",
        sub:
          "Alguém da equipe Maxi manda mensagem como se fosse cliente e faz um pedido de teste com você.",
      },
    ],
  },

  {
    id: "espaco",
    numero: 3,
    titulo: "Seu espaço e seus preços",
    tarefas: [
      {
        id: "freezer",
        tipo: "dica",
        titulo: "Freezer na temperatura certa",
        resumo: "A -18 °C, com termômetro, em lugar ventilado.",
        texto:
          "Recomendamos um freezer horizontal de 540 litros — é o tamanho ideal para o estoque inicial. Freezer vertical também funciona!\n\n" +
          "Mantenha sempre em -18°C ou menos. Produto descongelado = produto perdido.\n\n" +
          "Dicas:\n" +
          "• Deixe espaço entre os produtos para o ar circular\n" +
          "• Posicione o freezer em local ventilado, longe do sol\n" +
          "• Organize por categoria (Massas | Molhos | Outros) para achar tudo rápido\n" +
          "• Tenha um termômetro para conferir a temperatura",
        destinos: [],
      },
      {
        id: "organizacao_fifo",
        tipo: "dica",
        titulo: "Organizar por categoria e usar FIFO",
        resumo: "Separe por tipo; os mais antigos ficam na frente.",
        texto:
          "Organize por categoria: Massas | Molhos | Outros.\n\n" +
          "No app, o estoque já separa os tipos (Canelone, Rondelli, Nhoque, etc.) em abas — aqui no freezer, basta agrupar por categoria geral.\n\n" +
          "Use o sistema FIFO: Primeiro que Entra, Primeiro que Sai (produtos mais antigos na frente).",
        destinos: [],
      },
      {
        id: "sacolas",
        tipo: "material",
        titulo: "Sacolas e embalagens",
        resumo: "Sacola boca de palhaço, 30×40 ou 35×45.",
        texto:
          "Use sacolas Boca de Palhaço para boa apresentação e segurança dos produtos.\n\n" +
          "Tamanhos recomendados:\n" +
          "• 30×40 — pacote com cerca de 350 unidades\n" +
          "• 35×45 — pacote com cerca de 265 unidades\n\n" +
          "Você encontra em papelarias, lojas de embalagens ou pela internet. O fornecedor recomendado está no Drive, " +
          "e você também pode comprar perto de você.\n\n" +
          "Dica: coloque um panfleto ou cartão de visita na sacola — gera indicações!",
        destinos: [{ tipo: "drive", href: DRIVE_SACOLA, rotulo: "Ver artes da sacola" }],
      },
      {
        id: "uniforme",
        tipo: "dica",
        titulo: "Uniforme",
        resumo: "Custa R$ 60 e vai junto com o seu pedido.",
        texto:
          "O uniforme custa R$ 60 e vai junto com a entrega do seu pedido.\n\n" +
          "Avise a equipe Maxi o tamanho e a quantidade antes do primeiro pedido.",
        destinos: [],
      },
      {
        id: "produtos",
        tipo: "dica",
        titulo: "Conheça os 28 produtos e prove pelo menos 3",
        resumo: "Conheça o cardápio para indicar com segurança.",
        texto:
          "São 28 produtos em 8 categorias. Você vai se apaixonar!\n\n" +
          "- Canelone (700g): 4 Queijos, Brócolis/Muss., Frango/Requeijão, Presunto/Muss.\n" +
          "- Conchiglione (700g): 4 Queijos, Brócolis/Muss., Presunto/Muss., Frango/Requeijão\n" +
          "- Rondelli (700g): 4 Queijos, Brócolis/Muss., Frango/Requeijão, Presunto/Muss.\n" +
          "- Rondelli Fatiado (500g): 4 Queijos, Presunto/Muss.\n" +
          "- Sofioli (700g): 4 Queijos, Brócolis/Muss., Presunto/Muss., Frango/Requeijão\n" +
          "- Nhoque: Batata 1kg, Batata 500g, Recheado 4Q, Muss., P&M, Calabresa (700g)\n" +
          "- Massas Base: Lasanha 500g, Pastel 1kg, Pastel 500g\n" +
          "- Molho: Sugo 250g\n\n" +
          "Dica: experimente cada um para falar com propriedade pros clientes!\n\n" +
          "A melhor forma de vender é conhecer o produto de verdade. Escolha pelo menos 3 sabores diferentes, " +
          "prepare em casa e prove. Você vai ver como é fácil — pronto em minutos!",
        destinos: [],
      },
      {
        id: "preco_venda",
        tipo: "dica",
        titulo: "Conferir o preço de venda",
        resumo: "Já vem com o dobro do custo; ajuste se quiser.",
        texto:
          "Seus preços de revenda já vêm pré-configurados com margem de 100% sobre o custo (preço de venda = custo x 2). " +
          "Confira e ajuste se necessário em Gestão → Estoque.",
        destinos: [{ tipo: "app", href: "/Gestao?tab=estoque&de=primeiros-passos", rotulo: "Abrir Estoque" }],
      },
      {
        id: "p_espaco_ok",
        tipo: "confirmacao",
        titulo: "Meu espaço está pronto",
        resumo: "Toque quando freezer, organização e sacolas estiverem prontos.",
        texto: "Confirme quando o freezer, a organização e as sacolas estiverem prontos.",
        destinos: [],
      },
    ],
    maxi: [],
  },

  {
    id: "pedido",
    numero: 4,
    titulo: "Primeiro pedido",
    tarefas: [
      {
        id: "pedido_enviado",
        tipo: "auto",
        titulo: "Fazer o primeiro pedido",
        resumo: "Já vem preenchido com o pedido modelo. Mude o que quiser.",
        texto:
          "A tela já vem preenchida com o pedido modelo da Maxi (225 unidades, com variedade). " +
          "Mude o que quiser e toque em Enviar pedido.\n\n" +
          "Os pedidos fecham no domingo e a entrega leva uns 10 dias.",
        destinos: [{ tipo: "app", href: "/Gestao?tab=reposicao&modelo=1&de=primeiros-passos", rotulo: "Ver pedido modelo" }],
      },
      {
        id: "pedido_entregue",
        tipo: "auto",
        titulo: "Pedido entregue",
        resumo: "A equipe Maxi marca na entrega e o estoque entra sozinho.",
        texto: "A equipe Maxi marca na entrega e os produtos entram no seu estoque.",
        destinos: [{ tipo: "app", href: "/Gestao?tab=estoque&de=primeiros-passos", rotulo: "Abrir Estoque" }],
      },
      {
        id: "p_pedido_ok",
        tipo: "confirmacao",
        titulo: "Conferi o pedido",
        resumo: "Confira quantidades, embalagem e validade.",
        texto:
          "Quando o pedido chegar, confira:\n" +
          "- as quantidades;\n" +
          "- se está bem embalado e congelado;\n" +
          "- as datas de validade.\n\n" +
          "Se algo vier errado, tire foto e avise a equipe Maxi. Você só paga depois de conferir, pelo PIX.",
        destinos: [{ tipo: "app", href: "/Gestao?tab=reposicao&de=primeiros-passos", rotulo: "Ver meu pedido" }],
      },
      {
        id: "freezer_ligado",
        tipo: "dica",
        titulo: "Freezer ligado e frio",
        resumo: "Ligue o freezer antes de o pedido chegar.",
        texto: "Freezer ligado e a -18 °C antes de o pedido chegar.",
        destinos: [],
      },
    ],
    maxi: [],
  },

  {
    id: "lancamento",
    numero: 5,
    titulo: "Lançamento e primeira venda",
    tarefas: [
      {
        id: "meta_business",
        tipo: "material",
        titulo: "Aprender o Meta Business Suite",
        resumo: "Quatro vídeos curtos sobre posts e anúncios.",
        texto:
          "No Drive tem uma pasta com vídeos tutoriais do Meta Business Suite. Assista na ordem:\n\n" +
          "1. Meta Business Suite — visão geral da ferramenta\n" +
          "2. Menu Lateral — onde fica cada coisa\n" +
          "3. Planner — como agendar seus posts\n" +
          "4. Planner Reforço — dicas extras para programar conteúdo\n\n" +
          "Depois de assistir, acesse business.facebook.com e explore:\n" +
          "- Alcance (quantas pessoas viram seus posts)\n" +
          "- Engajamento (curtidas, comentários)\n" +
          "- Resultados dos anúncios (leads, custo por lead)",
        destinos: [{ tipo: "drive", href: DRIVE_META_BUSINESS, rotulo: "Assistir vídeos tutoriais" }],
      },
      {
        id: "posts_do_mes",
        tipo: "material",
        titulo: "Programar o primeiro mês de posts",
        resumo: "Artes prontas do mês, no app e no Drive.",
        texto:
          "Você tem dois lugares com artes prontas:\n\n" +
          "📱 Marketing no app — aqui ficam as postagens do mês atual. Abra, baixe e poste!\n\n" +
          "📁 Drive Artes Redes Sociais — banco completo com todo o acervo:\n" +
          "- Artes por ano (2023 a 2026) — posts de meses anteriores\n" +
          "- Postagens Neutras — servem para qualquer época\n" +
          "- Reels Neutros — vídeos curtos para Instagram\n" +
          "- Destaques do Instagram — capas para organizar seu perfil\n" +
          "- Stories Feedback — modelos de stories com depoimentos\n" +
          "- Vídeos Influencer — conteúdo com influenciadores\n\n" +
          "Rotina: todo mês, abra o Marketing no app, baixe as artes novas e agende no Planner do Meta Business Suite.",
        destinos: [
          { tipo: "app", href: "/Marketing?de=primeiros-passos", rotulo: "Postagens do mês" },
          { tipo: "drive", href: DRIVE_POSTAGENS, rotulo: "Acervo completo (Drive)" },
        ],
      },
      {
        id: "avise_conhecidos",
        tipo: "dica",
        titulo: "Avise seus conhecidos",
        resumo: "Conte que a unidade abriu e poste no status.",
        texto: "Avise conhecidos e poste as artes no status do WhatsApp.",
        destinos: [],
      },
      {
        id: "primeira_venda",
        tipo: "auto",
        titulo: "Lançar a primeira venda",
        resumo: "Lance pelo botão Vender e vincule o cliente.",
        texto:
          "Lance pelo botão Vender e vincule o cliente: é assim que a lista Quem chamar hoje começa a funcionar.",
        destinos: [{ tipo: "app", href: "/Vendas?action=nova-venda&de=primeiros-passos", rotulo: "Lançar venda" }],
      },
    ],
    maxi: [
      { id: "maxi_anuncios", nome: "Ligar os anúncios", sub: "na semana da entrega" },
    ],
  },
];
