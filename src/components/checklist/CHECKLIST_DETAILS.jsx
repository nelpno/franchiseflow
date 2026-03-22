// Detalhes expansíveis para cada item do checklist diário
// Estrutura: { text, script, scriptLabel, note }

export const CHECKLIST_DETAILS = {
  // === MANHÃ ===
  m1: {
    text: "Abra o WhatsApp Business e veja TODAS as conversas não lidas. Priorize: 🔴 Contato Novo primeiro, depois 🟡 Interessado, depois 🔵 Pedido Confirmado. O robô pode ter respondido durante a noite — confira se as respostas estão corretas.",
  },
  m2: {
    text: "Filtre pela etiqueta 🔴 Contato Novo. Responda TODOS — cada lead não respondido é venda perdida. Use o script abaixo:",
    script: `Olá, [nome]! 😊 Tudo bem? Sou [seu nome], da Maxi Massas!

Vi que você se interessou pelas nossas massas artesanais. Que bom ter você aqui! 🍝

Trabalhamos com massas congeladas e pré-cozidas, prontas em minutos. Canelone, nhoque, rondelli, sofioli... tudo feito com ingredientes selecionados!

Posso te enviar nosso cardápio completo? Qual sabor te chamou mais atenção?`,
    scriptLabel: "Primeiro Contato",
    note: "Após responder, mude a etiqueta de 🔴 Contato Novo para 🟡 Interessado.",
  },
  m3: {
    text: "Revise as conversas que o robô respondeu durante a noite/madrugada. Verifique se: as respostas fazem sentido, os preços estão corretos, nenhum lead ficou sem resposta. Se o robô errou algo, corrija manualmente e avise o franqueador.",
  },
  m4: {
    text: "Abra o freezer e confira visualmente: quais produtos estão acabando? Anote na planilha ou no celular. Se algum produto está com menos de 3 unidades, considere fazer pedido de reposição hoje no Bloco Noite.",
  },
  m5: {
    text: "Verifique todos os contatos com etiqueta 🔵 Pedido Confirmado. Para cada um: pagamento já foi feito? Horário de entrega/retirada combinado? Produtos separados? Se falta algo, entre em contato agora.",
  },
  m6: {
    text: `Poste pelo menos 1 story. Sugestões rápidas:
• 📸 Foto do freezer abastecido com texto 'Estoque fresquinho!'
• 🍝 Foto de um produto com preço e 'Peça o seu!'
• 🎥 Bastidores: separando pedidos, embalando
• ⭐ Print de elogio de cliente (com autorização)
• 🔥 Promoção do dia
Use os templates de conteúdo enviados pelo franqueador.`,
  },
  m7: {
    text: "Confira o termômetro do freezer. Deve estar em -18°C ou menos. Anote o valor. Se estiver acima de -15°C, investigue: porta ficou aberta? Freezer com defeito? Produto descongelado NÃO pode ser recongelado — deve ser descartado ou consumido.",
  },

  // === MEIO-DIA ===
  md1: {
    text: "Filtre pela etiqueta 🟡 Interessado. Para cada contato que não respondeu há 24h+, envie o script abaixo:",
    script: `Oi, [nome]! 😊 Passando aqui rapidinho...

Enviei nosso cardápio ontem e queria saber se ficou alguma dúvida!

Hoje os mais pedidos estão sendo o Canelone 4 Queijos e o Rondelli de Frango com Requeijão. Quer experimentar? 🍝

Qualquer dúvida, é só me chamar!`,
    scriptLabel: "Follow-up",
    note: "Se não responder após 2º follow-up, mude para ⚪ Não Fechou após 7 dias.",
  },
  md2: {
    text: "Filtre pela etiqueta 🟣 Clientes Sumidos (clientes inativos há 15+ dias). Escolha 5-10 e envie mensagem personalizada:",
    script: `Oi, [nome]! Quanto tempo! 😊

Estava lembrando de você aqui na Maxi Massas e queria saber: já está na hora de reabastecer o freezer?

Temos [produto novo ou promoção da semana] e acho que você vai adorar!

Quer que eu separe um pedido pra você? 🍝`,
    scriptLabel: "Clientes Sumidos",
    note: "Personalize! Mencione o que o cliente comprou da última vez. Se comprar, mude para 🟢 Cliente ou 🟢 Cliente Fiel.",
  },
  md3: {
    text: "Filtre pela etiqueta ⚪ Não Fechou. Escolha contatos que estão lá há 30+ dias. Tente com abordagem diferente — promoção, produto novo, ou simplesmente perguntar se algo mudou.",
    script: `Oi, [nome]! Tudo bem? 😊

Faz um tempo que conversamos e queria te contar uma novidade: estamos com [promoção/produto novo] esta semana!

[Produto] por apenas R$ [valor] — serve bem 2-3 pessoas e é só aquecer!

Quer aproveitar? Posso separar o seu! 🍝`,
    scriptLabel: "Reativação",
  },
  md4: {
    text: "Abra o Instagram da sua unidade. Responda TODOS os comentários nos posts e TODOS os DMs. Seja rápido e amigável. Para DMs de pessoas interessadas, direcione para o WhatsApp: 'Oi! Que bom que se interessou! Me chama no WhatsApp que te mando o cardápio completo: [seu número]'",
  },
  md5: {
    text: "Abra o Meta Business Suite (business.facebook.com ou app). Verifique: quantos leads chegaram hoje? Qual o custo por lead? Os anúncios estão ativos? Se notar algo estranho (leads pararam, custo subiu muito), avise o franqueador.",
  },
  md6: {
    text: `Revise suas conversas e atualize as etiquetas:
• Respondeu mas não fechou → 🟡 Interessado
• Fechou pedido → 🔵 Pedido Confirmado
• Já recebeu/retirou → 🟢 Cliente
• Comprou 3+ vezes → 🟢 Cliente Fiel
• Inativo 15+ dias → 🟣 Clientes Sumidos
• Não quer comprar → ⚪ Não Fechou
Todo contato DEVE ter etiqueta!`,
  },
  md7: {
    text: "Filtre pela etiqueta 🟢 Cliente Fiel. Escolha 2-3 e mande mensagem de relacionamento (NÃO de venda direta):",
    script: `Oi, [nome]! 😊 Tudo bem por aí?

Passando pra te contar que chegou [sabor novo / reposição do que você gosta]. Separei um(a) pra você antes de acabar!

Quer que eu reserve? Você é cliente especial, tem prioridade! 🍝💛`,
    scriptLabel: "Relacionamento VIP",
  },

  // === TARDE ===
  t1: {
    text: "Filtre pela etiqueta 🔵 Pedido Confirmado. Para cada um: pagamento recebido? Se não, cobre educadamente. Se sim, confirme os dados de entrega/retirada e horário.",
  },
  t2: {
    text: "Separe fisicamente os produtos de cada pedido. Confira: quantidade correta, sabores corretos, produtos congelados. Coloque cada pedido em embalagem separada com o nome do cliente.",
  },
  t3: {
    text: "Para entregas: abra o app Uber ou 99 e solicite Uber Moto/99 Moto. Informe ao entregador que é produto congelado. Para retiradas: separe o pedido, vista o uniforme e avise o cliente que está pronto.",
  },
  t4: {
    text: "Use sacola térmica para entregas. Se não tiver, use sacola plástica + jornal/papelão como isolante. Produtos devem chegar congelados. Cole adesivo Maxi Massas na embalagem. Inclua cartão de visita e ímã de geladeira.",
  },
  t5: {
    text: "Para cada cliente que recebeu/retirou hoje, envie:",
    script: `Oi, [nome]! Seu pedido já foi [entregue/está pronto para retirada]! 🎉

Queria saber: chegou tudo certinho? Como ficou a massa?

Se puder tirar uma fotinho do prato pronto e me mandar, eu adoraria! Sua opinião é super importante pra gente. 😊

Obrigado(a) por confiar na Maxi Massas!`,
    scriptLabel: "Pós-Venda",
    note: "Mude a etiqueta para 🟢 Cliente.",
  },
  t6: {
    text: "Se o cliente elogiou, peça: 'Posso usar seu depoimento nas nossas redes? Adoraríamos mostrar!' Fotos de pratos prontos dos clientes são o MELHOR conteúdo para Instagram.",
  },
  t7: {
    text: "Aproveite o momento positivo:",
    script: `[nome], que bom que você gostou! 😊 Fico muito feliz!

Tenho um pedido especial: se você conhecer alguém que também adora uma boa massa caseira, pode indicar pra gente?

É só passar meu contato! E como agradecimento, na próxima compra [ofereça um benefício: desconto, brinde, molho grátis, etc.]. 🍝`,
    scriptLabel: "Pedido de Indicação",
    note: "Se indicar alguém, marque o indicado como 🟠 Indicação.",
  },

  // === NOITE ===
  n1: {
    text: "Abra o Dashboard (maximassas.tech) e registre cada venda do dia: cliente, produtos, valor, forma de pagamento. NÃO deixe para depois — se acumular, você perde o controle.",
  },
  n2: {
    text: "Subtraia do estoque todos os produtos vendidos hoje. Verifique: algum produto está abaixo de 5 unidades? Se sim, anote para fazer pedido de reposição.",
  },
  n3: {
    text: "Última revisão do dia nas etiquetas. Garanta que TODO contato que interagiu hoje está com a etiqueta correta atualizada.",
  },
  n4: {
    text: "Verifique se ficou alguma mensagem sem resposta. Responda tudo antes de encerrar o dia. Ative a mensagem de ausência se for parar de atender.",
  },
  n5: {
    text: "Se algum produto está com menos de 5 unidades, faça o pedido de reposição agora usando a Planilha de Pedido oficial. Lembre-se do prazo de entrega da fábrica ao calcular.",
  },
  n6: {
    text: `Anote rapidamente:
• Quem precisa de follow-up amanhã?
• Alguma entrega agendada?
• Algum conteúdo para postar?
• Promoção para lançar?
Ter um plano para o dia seguinte agiliza o Bloco Manhã.`,
  },

  // === SEMANAL ===
  s1: {
    text: "Olhe suas vendas da semana no Dashboard. Quais 5 produtos mais venderam? Quais menos? Ajuste seu próximo pedido: mais do que vende, menos do que encalha.",
  },
  s2: {
    text: "Filtre ⚪ Não Fechou. Quem está lá há 30+ dias merece uma nova tentativa com abordagem diferente. Use o script de Reativação do Bloco Meio-Dia.",
  },
  s3: {
    text: "No WhatsApp Business, crie uma lista de transmissão segmentada (ex: só clientes, só remarketing) e envie a promoção da semana. IMPORTANTE: o contato precisa ter seu número salvo para receber transmissão.",
  },
  s4: {
    text: "Verifique se todos os produtos estão com foto, preço e descrição corretos. Remova produtos sem estoque temporariamente. Adicione novos se houver.",
  },
  s5: {
    text: "Pergunte a 3 clientes fiéis: 'O que está gostando? Alguma sugestão? Algum sabor que gostaria que tivéssemos?' Esse feedback é ouro.",
  },
  s6: {
    text: "Use a Planilha de Pedido oficial. Considere: produtos que acabaram na semana + produtos com estoque baixo + variedade para novos clientes.",
  },
  s7: {
    text: "No Meta Business Suite, veja: alcance, engajamento, melhores posts da semana. O que funcionou? Repita. O que não funcionou? Evite.",
  },
  s8: {
    text: "Verifique: quantos leads vieram esta semana? Qual o custo por lead? Compare com a semana anterior. Se algo estiver fora do normal, avise o franqueador.",
  },

  // === MENSAL ===
  me1: {
    text: "Reunião mensal de acompanhamento. Prepare: faturamento do mês, número de vendas, dificuldades encontradas, sugestões de melhoria. Duração: ~15-30 min.",
  },
  me2: {
    text: "Acesse Relatórios no Dashboard. Analise: faturamento total, ticket médio, produtos mais vendidos, comparação com mês anterior.",
  },
  me3: {
    text: "Para cada produto, calcule: Preço de Venda − Custo de Compra = Lucro Bruto. Divida pelo Preço de Venda × 100 = Margem %. Se algum produto tem margem muito baixa, discuta com o franqueador.",
  },
  me4: {
    text: "Contatos sem resposta há 60+ dias podem ser removidos das etiquetas ativas. Não delete — apenas remova a etiqueta para não poluir suas listas.",
  },
  me5: {
    text: "Com base no mês atual, defina meta realista para o próximo. Considere: sazonalidade, aprendizados, capacidade de estoque.",
  },
  me6: {
    text: "Pense: restaurantes que não fazem massa, empresas para cestas de final de ano, academias, condomínios. Parcerias B2B podem ser grande fonte de vendas recorrentes.",
  },
  me7: {
    text: "Se precisa de fotos novas, artes específicas ou conteúdo sazonal, peça ao franqueador com antecedência (pelo menos 1 semana antes de precisar).",
  },
  me8: {
    text: "Pergunte a si mesmo: estou seguindo o checklist todos os dias? Quantos dias completei este mês? O que está me travando? O que posso fazer diferente? Seja honesto — é pra você crescer.",
  },
};