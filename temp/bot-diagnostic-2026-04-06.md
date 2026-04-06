# Diagnóstico do Bot Vendedor Maxi Massas
**Período**: 30/03 a 06/04/2026 | **Conversas**: 298 | **Modelo**: Gemini 2.5 Pro

---

## Resumo Executivo
O diagnóstico geral aponta uma alta taxa de escalonamento (76.8%) devido a falhas críticas do bot em diferenciar regras de entrega e retirada, gerando atrito no checkout. A falta de transparência e padronização nos métodos de pagamento, especialmente com links e taxas surpresa, causa perdas de vendas diretas. A abordagem inicial do bot é passiva, resultando em abandono precoce. As três ações imediatas são: 1) Padronizar e automatizar o processo de pagamento com total transparência de taxas. 2) Criar fluxos distintos e claros no bot para as lógicas de entrega e retirada. 3) Implementar um follow-up automático para recuperar clientes que abandonam a conversa após receber o cardápio.

---

## TOP 3 Ações Imediatas
1. **[Fácil]** Padronizar pagamento com transparência de taxas — Impacto: **Alto**
2. **[Médio]** Criar fluxos distintos entrega vs retirada no bot — Impacto: **Alto**
3. **[Médio]** Follow-up automático para abandono pós-cardápio — Impacto: **Alto**

---

## Análise de Pagamento (foco especial)
- **Menções a link de pagamento**: 11
- **Pedidos de alternativas ao Pix**: 6
- **Vendas perdidas por gap pagamento**: 3
- **Confusão sobre pagamento**: 5 casos
- **Distribuição nas conversas**: Pix 8 | Cartão 6 | Dinheiro 2 | Link 1

**Evidências reais:**
> "Para eu deixar tudo prontinho para o seu motorista, qual será a forma de pagamento: **Pix, Dinheiro ou Link**?" (#1)
> "Podemos confirmar para amanhã? Se sim, qual seria a forma de pagamento (Pix ou Link)?" (#3)
> "Prefere que eu gere o **Link** ou prefere fazer pelo **Pix**?" (#12)
> "Qual seria a melhor forma de pagamento para você: Pix, Link ou Cartão (na retirada)?" (#13)
> "Para receber ainda hoje, podemos finalizar via *Pix* ou *Link* e te entregamos em até 90 minutos. O que prefere?" (#35)
> "Link" (#80)
> "Hoje só consigo enviar via moto uber, não da pra enviar a maquininha. posso gerar o link de pagamento" (#118)

**Recomendação**: É crítico padronizar o processo de pagamento via link/cartão. O bot deve informar proativamente sobre quaisquer taxas adicionais ANTES do cliente escolher o método, como na conversa #80 que foi perdida por uma taxa surpresa de R$7. A flexibilidade de levar maquininha, já praticada por alguns franqueados (#4, #161), deveria ser uma opção clara no bot para salvar vendas como a #137. O fluxo precisa ser transparente: 'Para entrega, aceitamos Pix ou Link (cartão online com taxa de X%). Para retirada, aceitamos também cartão na maquininha e dinheiro.'

---

## Mudanças no Prompt do Bot

### [CRITICA] Pagamento
**Hoje**: Oferece opções de pagamento (Pix, Link, Cartão) de forma genérica, sem diferenciar as regras para entrega e retirada.
**Problema**: Cria confusão e falsas expectativas. Clientes assumem que podem pagar com cartão/dinheiro na entrega, o que muitas vezes não é possível com motoboys de aplicativo, resultando em cancelamentos no final do funil (#137, #167).
**Sugestão**: O bot deve apresentar as opções de forma condicional e clara: 'Para finalizar, temos duas opções: 1) ENTREGA (pagamento antecipado via Pix ou Link para Cartão) ou 2) RETIRADA (pagamento no local com Pix, Cartão na maquininha ou Dinheiro). Qual prefere?'
**Impacto esperado**: Reduzir drasticamente o abandono e a frustração na etapa de pagamento, alinhando as expectativas do cliente desde o início.

### [MEDIA] Saudação
**Hoje**: Saudação passiva, geralmente enviando o cardápio e fazendo uma pergunta aberta como 'O que você procura hoje?'.
**Problema**: Gera uma alta taxa de abandono inicial ('catalogue dropoff'), pois não engaja o cliente nem direciona a venda. O cliente recebe o cardápio e 'some'.
**Sugestão**: Adotar uma saudação proativa com sugestões e prova social: 'Olá, [Nome]! Sou a Ju da Maxi Massas 🍝. Nossos campeões de venda hoje são o Nhoque Recheado 4 Queijos (R$43,80) e o Rondelli de Presunto e Mussarela (R$39,90). Já te enviei o cardápio completo. Qual deles te deu mais água na boca?'
**Impacto esperado**: Reduzir a taxa de abandono na primeira mensagem e acelerar o processo de decisão do cliente.

---

## Features que Faltam

### [CRITICA] Carrinho de Compras Inteligente
- Demanda: 15x | Evidência: "Eu vou mudar meu pedido", "1 de cada rondelli", "2 combos de nhoque com muçarela"
- Como: Implementar um sistema de carrinho que permita ao cliente adicionar/remover itens. A cada adição, o bot responde: 'Ótimo, adicionei 1 Rondelli de Brócolis. Seu carrinho agora tem 2 itens, totalizando R$ 79,80. Deseja adicionar mais alguma coisa ou podemos ir para o pagamento?'

---

## Objeções Não Respondidas

**"Nossa a taxa de entrega é cara"** (3x) — Raiz: Custo Adicional Inesperado
- Bot hoje: O sistema envia errado — franqueado intervém manualmente corrigindo erro do bot
- Ideal (Ancoragem de Valor + Diluição de Custo): "O frete para seu endereço fica R$ 12,00. Como nossas massas duram 120 dias no freezer, muitos clientes aproveitam para levar mais itens e fazer o frete valer a pena. Se adicionarmos mais um Rondelli, por exemplo, o custo da entrega por produto cai pela metade. Quer aproveitar?"

---

## Saudação (Score: 7/10 — Morno)
- **Melhor**: "Olá, boa tarde! Sou a Ju, da Maxi Massas Vila Socorro. É um prazer atender você! 🍝 Acabei de te enviar nosso cardápio. Temos massas artesanais deliciosas como o *Nhoque Recheado Muçarela (700g) — R$ 43,00* e o *Rondelli Presunto e Muçarela Fatiado (500g) — R$ 32,00*. Você prefere massas recheadas ou tradicionais?" (#8)
- **Pior**: "Oi! Sou a Bia da Maxi Massas Osasco. Como posso te ajudar com nossas massas artesanais hoje?" (#33) — Muito genérico e passivo.
- **Recomendada**: "Olá, [Nome]! Aqui é a Ju da Maxi Massas [Franquia] 🍝. Para facilitar seu dia, que tal um Nhoque Recheado 4 Queijos (R$43,80) que serve até 3 pessoas? Já te enviei nosso cardápio completo. O que te deu mais água na boca hoje?"

---

## Timing
- Follow-up necessário: Sim (após 120min)
- Msgs para converter (média): 20
- Mensagem follow-up sugerida: "Oi, [Nome]! Vi que você deu uma olhada em nossas massas. Ficou alguma dúvida que eu possa ajudar a resolver? Se pedir nos próximos 30 minutos, ainda consigo incluir na rota de entregas de hoje! 😉"

---

## Dropoff — Onde o Cliente Para
- **Msg #3**: Após a saudação e o envio do cardápio, o cliente visualiza e não responde mais. É o 'Abandono de Cardápio'. (18x) → Mudar a saudação para ser mais proativa, sugerindo 1-2 produtos específicos com preço. Além disso, implementar um follow-up automático após 2 horas de inatividade.
- **Msg #10**: Após receber o valor do frete ou as opções de pagamento, o cliente some. É o 'Abandono de Checkout'. (7x) → Otimizar a argumentação de valor do frete (diluição) e oferecer mais flexibilidade/clareza nas formas de pagamento.

---

## Fricção no Fluxo
- **[Loop de Confusão Logística]** O cliente fica preso em um ciclo de perguntas sobre horário, endereço, taxa e forma de pagamento porque o bot não diferencia claramente as regras para entrega e retirada. (10x) → Após o cliente escolher os produtos, o bot deve apresentar dois caminhos claros: [Quero RETIRAR] e [Quero ENTREGA], cada um iniciando um fluxo com suas respectivas regras.
- **[Intercalação Excessiva]** O bot envia múltiplas mensagens seguidas (até 11x na conversa #120) sem esperar a resposta do cliente, o que sobrecarrega, confunde e transmite uma sensação robótica e ansiosa. (15x) → Agrupar informações em mensagens únicas e bem formatadas. Usar pausas inteligentes e esperar pela confirmação do cliente antes de prosseguir para a próxima etapa do fluxo.

---

## Padrões Robóticos
- **"Posso te ajudar com mais alguma coisa?"** (25x) → "Enquanto seu pedido é preparado, ficou alguma dúvida sobre o modo de preparo do seu Rondelli? A dica de ouro é não economizar no molho!"
- **"Calling Memoria_Lead1 with input: {...}"** (1x) → Erro de sistema, mensagem interna do bot vazou para o cliente. Deve ser removida/ocultada.

---

## Quase Converteu (oportunidades perdidas)
- **Sorocaba Vila Lucy** (#80): Cliente pediu para pagar com link. O bot confirmou R$43,80. Um humano interveio e adicionou taxa de cartão de R$7,00 + taxa de entrega não mencionada. O cliente se sentiu enganado e cancelou. → Transparência total: informar taxas ANTES.
- **Santo André** (#137): Cliente queria pagar com cartão na entrega. O bot informou que o motoboy não leva maquininha e ofereceu link. A cliente não sabia usar o link e só receberia salário no dia seguinte. O bot foi inflexível e não permitiu agendar. → Flexibilidade: mini-tutorial do link + opção de agendar.
- **Americana** (#35): Cliente ficou confuso com regras de pagamento (dinheiro só na retirada) e horários conflitantes. Fricção causou desistência. → Fluxo claro separando regras entrega/retirada desde o início.

---

## Intervenções Humanas (77.9% das conversas)
- **Flexibilização de Pagamento/Entrega** (14x) — Automatizável: Sim — O bot precisa ter regras mais flexíveis. Ex: 'Normalmente, o pagamento é antecipado, mas posso verificar com o entregador de hoje se ele consegue levar a maquininha.'
- **Correção de Erros do Bot** (9x) — Automatizável: Não — Melhorar prompts e base de conhecimento do bot para reduzir frequência.
- **Gestão de Pedidos Complexos/Alterações** (12x) — Automatizável: Sim — Implementar sistema de carrinho onde cliente pode adicionar/remover itens antes de confirmar.

---

## Perfis de Comprador

### A Praticidade Planejada (~65%)
- Gatilhos: praticidade, refeição caseira sem esforço, dura 120 dias no freezer, agendamento de entrega
- Abordagem ideal: Focar nos benefícios de economia de tempo e planejamento. Usar frases como 'Garanta o jantar da semana' e 'Sempre à mão para uma refeição especial'. Oferecer combos para abastecer o freezer.

---

## Métricas Brutas
- Total conversas: 298 | Converted: 18 | Abandoned: 37 | Escalated: 229
- Taxa conversão: 6.0% | Taxa abandono: 12.4% | Taxa escalação: 76.8%
- Msgs para converter (mediana): 20 | Msgs até abandonar (mediana): 2
- Bot msgs seguidas (metralhadora): 147 ocorrências
- Clientes recompra: 11 (3.7%) | Novos: 287
- Score médio qualidade: 4/10
