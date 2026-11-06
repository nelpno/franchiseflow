// Textos do "?" (HelpTip) nos campos que geram dúvida (Fase 4, 26/09/2026).
// Cada texto descreve o que o robô FAZ hoje, conferido no prompt LIVE do V5 (`aRBzPABwrjhWCPvq`,
// versão de 25/09) e no código: provas em `.tmp/onda2/conferencia-textos.md`.
// Mudou o prompt ou a regra? Mude o texto junto. Travas: `node src/lib/guiasAjuda.test.mjs`.

export const HELP_TIPS = {
  pedidoMinimo: {
    titulo: "Pedido mínimo para entrega",
    texto:
      "Valor mínimo do pedido para entrega. O robô recebe esse número junto com as regras de entrega e o leva em conta na conversa. Deixe em branco se não houver mínimo.",
    exemplo: "Preencha 50 para um pedido mínimo de R$ 50.",
  },
  taxaEntrega: {
    titulo: "Taxa de entrega",
    texto:
      "É o frete que o robô soma ao total do pedido. Antes de falar o valor, ele calcula a distância até o endereço do cliente (rua, número e bairro). Valor único vale para qualquer distância; Por distância cobra pela faixa de km; Grátis faz o robô dizer que a entrega é sem taxa.",
    exemplo: "Produtos de R$ 50 com frete de R$ 8: o cliente paga R$ 58.",
  },
  horarioCorte: {
    titulo: "Pedidos até",
    texto:
      "Até que horas o pedido ainda sai no mesmo dia. Depois desse horário o robô continua atendendo: anota o pedido e combina a entrega para o próximo horário de entrega da unidade. Sem horário escolhido, vale até o fim da janela.",
    exemplo: "Entrega das 18h às 21h, pedidos até 17h: quem pede às 17h30 recebe no próximo dia de entrega.",
  },
  // 06/11/2026: duas unidades tentaram dar frete grátis por condomínio escrevendo em Promoções ativas. Com o frete
  // calculado o motor de pagamento não aceita frete grátis com condição de lugar vinda da promoção (cobra o frete
  // cotado e avisa a unidade: `pagamentoFreteGratisPromocao` em bots/vendedor/scripts/assets/pagamento.js). O lugar
  // certo é a lista de bairros (motor `cota-frete.js`: casa o nome no endereço que o cliente escreve, sem o prefixo
  // "Condomínio/Residencial/Jardim", e vale em qualquer dia e além do raio).
  bairrosTaxaPropria: {
    titulo: "Bairro ou condomínio com taxa própria",
    texto:
      "Para dar frete grátis ou cobrar outro valor num lugar: toque em \"Adicionar bairros com outra taxa\", escreva o nome, toque em Enter e ponha o valor (R$ 0 é grátis). Vale em qualquer dia. O robô procura esse nome no endereço que o cliente escreve, então cadastre o condomínio do jeito que o cliente fala. Se o cliente costuma mandar só a rua e o bairro, cadastre o bairro também: aí a taxa vale para o bairro inteiro. Depois confira no Teste rápido, em Bairro do cliente.",
    exemplo: "Villa Verona com R$ 0: quem escreve \"Condomínio Villa Verona\" no endereço recebe sem frete.",
  },
  freteBairroSemCalculado: {
    titulo: "Frete grátis ou taxa diferente num bairro",
    texto:
      "Taxa por bairro ou condomínio, inclusive grátis, só funciona com o frete calculado ligado na unidade. Fale com o suporte para ligar: aí aparece nesta etapa o quadro Bairros com taxa própria, onde você cadastra o nome e o valor. Não escreva isso em Promoções ativas: ali o robô não confere o frete e pode cobrar errado.",
    exemplo: "Entrega grátis num condomínio: peça ao suporte o frete calculado e cadastre o condomínio com R$ 0.",
  },
  vendedorVaiDizer: {
    titulo: "O vendedor vai dizer",
    texto:
      "É uma prévia, não um campo para escrever. O app monta essa frase com os dias, a janela, o horário limite e a taxa que você preencheu. Para mudar a frase, mude esses campos: ela muda na hora.",
    exemplo: "Trocou a taxa para Grátis: a prévia passa a dizer que a entrega é sem taxa.",
  },
  promocoes: {
    titulo: "Promoções ativas",
    texto:
      "Só oferta: combo, brinde ou desconto, com o preço certo. O robô oferece uma vez por conversa. Frete grátis por valor do pedido pode ficar aqui. Não servem aqui: frete por bairro ou condomínio e horário (etapa Entrega e retirada), endereço e ponto de referência (etapa Sua unidade) e ingrediente (o robô já tem os das massas da Maxi). Acabou a promoção? Apague o texto.",
    exemplo: "Combo: 1 Canelone 4 Queijos 700g + 1 Molho 500g por R$ 74,90. Ou: Frete grátis nas compras acima de R$ 100.",
  },
  verbaMarketing: {
    titulo: "Verba de marketing",
    texto:
      "É o dinheiro dos anúncios da sua unidade, à parte do pacote mensal (sem fundo de marketing). Mínimo de R$ 200 por mês. Do valor pago, 14% ficam em impostos e taxas. Nos últimos 5 dias do mês, o registro já vale para o mês seguinte. Confirmado quer dizer que a Maxi conferiu o pagamento; a campanha é colocada no ar depois.",
    exemplo: "De R$ 200 pagos, R$ 172 vão para o anúncio.",
  },
  formaPagamento: {
    titulo: "Formas de pagamento",
    texto:
      "Marque o que você aceita em cada modalidade. Na entrega o robô só aceita o que está marcado em Entrega; na retirada, só o que está em Retirada. Crédito, débito e aproximação são na maquininha, na hora: marque em Entrega só se o entregador leva a maquininha. Pix e link são pagos antes: o robô pede o comprovante e só fecha o pedido depois de recebê-lo.",
    exemplo: "Crédito marcado só em Retirada e Link em Entrega: na entrega o robô oferece o cartão pelo link, pago antes.",
  },
};
