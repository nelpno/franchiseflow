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
  verbaMarketing: {
    titulo: "Verba de marketing",
    texto:
      "É o dinheiro dos anúncios da sua unidade, à parte do pacote mensal (sem fundo de marketing). Mínimo de R$ 200 por mês. Do valor pago, 14% ficam em impostos e taxas. Nos últimos 5 dias do mês, o registro já vale para o mês seguinte. Confirmado quer dizer que a Maxi conferiu o pagamento; a campanha é colocada no ar depois.",
    exemplo: "De R$ 200 pagos, R$ 172 vão para o anúncio.",
  },
  formaPagamento: {
    titulo: "Formas de pagamento",
    texto:
      "Marque o que você aceita em cada modalidade. Na entrega o robô só aceita o que está marcado em Entrega; na retirada, só o que está em Retirada. Pix e link são pagos antes: o robô pede o comprovante e só fecha o pedido depois de recebê-lo.",
    exemplo: "Dinheiro marcado só em Retirada: o robô não aceita dinheiro na entrega.",
  },
};
