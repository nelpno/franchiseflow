# Junção "Meu robô" × "Cardápio digital": revisão e proposta (10/11/2026)

> Só leitura: nada foi alterado no código nem no banco. Números de 10/11/2026 à noite, rede = 70 unidades ativas
> (`franchises.status='active'`, sem teste), 17 com o cardápio ligado. Consultas: Supabase `sulgicnqqopyhulglakd`, só SELECT
> (as principais estão no fim). Funções do banco lidas ao vivo (`pg_get_functiondef`), não pelos .sql da pasta.

## Resumo

As duas telas quase sempre leem a MESMA coluna (bom: o cardápio já nasceu lendo o Meu robô). O problema não é dado
duplicado no banco, é **editor duplicado e regra diferente para o mesmo conceito**:

1. **Prazo da entrega** tem dois editores (Meu robô e Cardápio) e duas regras: o cardápio promete "em cerca de 60 min"
   a quem o robô diz "dentro da janela". **23 de 70 unidades** (4 ligadas).
2. **Promoção** tem três editores em duas telas; **25 unidades** têm promoção no robô e o cardápio não mostra nada (8 ligadas).
3. **Checklist** trava ou avisa por regra velha: WhatsApp (6 travadas à toa), frete por bairro (10 com aviso falso).
4. **Feriado**: aviso em **70/70** unidades, só 1 marcou; o atalho joga a franqueada no topo da etapa 2 e não traz de volta.
5. **Antes de ligar** (53 unidades), a página do cardápio só mostra o checklist: pausa da entrega e promoção, que agora
   valem também para o robô, ficam fora do alcance.

Proposta em uma linha: **o Meu robô é a fonte única de "como a unidade funciona"; o Cardápio digital é "vender pelo link
hoje" (ligar, divulgar, pausar hoje, promoção, produtos, resultado) e só MOSTRA o resto, com atalho para o campo exato.**
Robô: nenhuma mudança.

---

## 1. Mapa campo a campo

Legenda das telas: **MR** = Meu robô (`pages/FranchiseSettings.jsx`, etapas 1–5); **CD** = página Cardápio digital
(`pages/CardapioDigital.jsx`); **CK** = checklist de ligar (`cardapio_checklist`, aparece no CD).
Leitores: **Robô** = V5 (`vw_dadosunidade` → Customer Context / prompt); **Site** = `cardapio_unidade` + `site/pedido/publico/assets/cardapio.js`;
**Edge** = `cardapio-frete`; **Painel** = `cardapio_painel`.

| Conceito | Onde a franqueada vê | Coluna | Quem escreve | Quem lê | Situação |
|---|---|---|---|---|---|
| Endereço, CEP | MR 1 (CEP, Rua e número, Bairro, Cidade) · CK "Endereço da unidade" | `franchise_configurations.street_address, neighborhood, city, cep` → `unit_address` (montado em `buildDbPayload`) | MR | Robô, Edge (origem do frete), CK | Bate. Uma fonte. |
| Nome que o cliente conhece | MR 1 "Como os clientes conhecem sua unidade?" | `franchise_name` | MR | Robô | Bate. (O site usa `franchises.name`, que a franqueada não edita.) |
| Instagram | MR 1 "Instagram da loja" | `social_media_links.instagram` | MR | Robô, Site (v7) | Bate. Uma fonte. |
| Link na bio | CD "Antes de divulgar › Link na bio? › Já coloquei" | `cardapio_link_bio_em` | CD (`cardapio_configurar`) | Painel | Bate. Só do CD. |
| WhatsApp do responsável | MR 1 "Seu WhatsApp (recebe cada pedido fechado e os avisos do robô)" | `personal_phone_for_summary`, `personal_phone_extra` | MR | Robô (avisos), `cardapio_whatsapp_pedido` (detecta "pedido cai no seu celular") | Bate. |
| Número do robô | card de conexão no topo do MR | `unidade_telefone_publico` (Zuck) | conexão | Site: o #PED- vai para ele quando conectado (`cardapio_whatsapp_pedido`) | **Divergência no CK** (P3). |
| WhatsApp público | **nenhuma tela** (só a Maxi por SQL, ou CK "Usar o número do robô") | `franchises.whatsapp_publico` | Maxi / `cardapio_configurar {whatsapp_do_robo}` | Site (reserva do #PED-, página em pausa), cupom de Vendas, CK (trava) | **Trava errada** (P3). |
| Entrega ligada / Retirada ligada | MR 2 "Sua unidade faz ENTREGA?" / "Aceita RETIRADA?" · CK "Entrega ou retirada ligada" | `has_delivery`, `has_pickup` | MR | Robô, Site, Edge, CK | Bate. |
| Dias e horários de entrega | MR 2 cartão "Entrega › Dias, horários e taxas" (janela de entrega) · CK | `delivery_schedule[].days/delivery_start/delivery_end` (estruturada: `delivery_pricing.grupos` e o MR deriva o `delivery_schedule`) | MR (`salvar_frete_estruturado`) | Robô, Site, Edge, CK | Bate. |
| Folga | não existe campo: dia que não está na grade | `delivery_schedule` / `pickup_schedule` | MR | Robô, Site | Bate (o CK explica: "os dias que ficam de fora são a sua folga"). |
| "Pedidos até" | MR 2 "Pedidos até" (por grupo de dias) · CD "Entrega de hoje" mostra (só leitura) | `delivery_schedule[].order_cutoff` | MR | Robô, Site, Painel | Bate. Link do CD cai na etapa errada (P5). |
| `order_cutoff_time`, `delivery_start_time`, `operating_hours` | nenhuma | colunas antigas | ninguém desde 12/09 | **ninguém** (nem view, nem função, nem o V5 atual) | **Campo morto** (P8). |
| Horário de retirada | MR 2 "Horário de retirada diferente da entrega?" + "Horários de retirada" · CK | `has_custom_pickup_hours`, `pickup_schedule` (sem próprio = o da entrega) | MR | Robô, Site, CK | Bate (mesma regra nos três). |
| Retirada só com hora combinada | MR 2 "Só com hora combinada" | `pickup_requires_scheduling` | MR | Robô | **Site ignora** (P9): 11 unidades dizem "pode chegar sem avisar" e o site obriga faixa. |
| Horário especial / feriado | MR 2, último cartão da etapa ("Horário especial") · CD "Antes de divulgar" (só leitura) · CK aviso "Feriado em DD/MM" | `horario_especial` | MR | Robô, Site, Edge (motor), CK | Bate. Difícil de achar (P4). |
| Pausa da entrega hoje | CD "Entrega de hoje › Pausar a entrega hoje / ou pausar até" | `cardapio_entrega_pausa_ate` | CD | Site e, **desde 10/11 20:02Z, o robô** (`vw_dadosunidade.entrega_pausada_ate`, patch `ped-pausa-hora`) | Bate; mas só aparece com o cardápio já ligado (P5) e o comentário do card diz que o robô não lê (desatualizado). |
| **Prazo / tempo de entrega** | MR 2 "Como chega ao cliente: Dentro da janela / Em até X min" · CD "Prazo da entrega (o quanto antes)" | simples: `avg_prep_time_minutes`; estruturada: `delivery_pricing…tipos[].promessa/minutos` | **MR e CD** (CD grava `avg_prep_time_minutes`, 15–180) | Robô: simples = `avg_prep_time_minutes`; estruturada = `tipos[].minutos` (o prompt ignora `avg_prep_time_minutes` com `delivery_pricing`). Site: **sempre** `cardapio_prazo_entrega(avg_prep_time_minutes)` = valor ou **60** | **Sobreposição + divergência** (P1). |
| Raio | MR 2 "Raio máximo de entrega (km)" · CK "Distância máxima de entrega" | `max_delivery_radius_km` (estruturada também `delivery_pricing.raio_km`) | MR | Robô, Edge, CK | Bate. |
| Frete por km / por dia | MR 2 "Taxa" por grupo de dias (faixas de km) · CK "Frete por distância", "Faixas de frete até o raio" | `delivery_fee_rules` (geral) + `delivery_schedule[].fee_rules` (do dia) | MR | Robô, Edge (tabela do DIA, igual ao robô), CK (só a geral) | Bate no cálculo; o CK confere só a tabela geral (10 unidades têm tabela por dia diferente). |
| Frete por bairro / tipos (estruturado) | MR 2 "Bairros com taxa própria" + tipos de entrega | `delivery_pricing` | MR (RPC `salvar_frete_estruturado`) | Robô (motor), Edge (mesmo motor, `cotaFrete.js`) | Bate no cálculo; **CK diz o contrário** (P3b). |
| Pedido mínimo | MR 2, dentro do bloco da entrega: "Pedido mínimo para entrega (R$)" | `min_order_value` | MR | Robô (prompt: "PEDIDO MÍNIMO", sem modalidade), Site (vale para entrega **e** retirada) | **Rótulo confuso** (P7): 27 unidades com mínimo e retirada. |
| Pagamento por modalidade | MR 3 tabela "Forma × Entrega/Retirada" · CK "Formas de pagamento na entrega/retirada" | `payment_delivery[]`, `payment_pickup[]` (vazio = o da entrega) | MR | Robô, Site (só os códigos), CK | Bate (mesma herança nos três). |
| Pix (tipo, chave, titular, banco) | MR 3 bloco "Pix" | `pix_key_type, pix_key_data, pix_holder_name, pix_bank` | MR | Robô | Bate. O site nunca mostra a chave ("a unidade manda a chave no WhatsApp"). |
| Pix na entrega | MR 3 "Aceito Pix na entrega (o cliente paga quando recebe)" | `pix_on_delivery` (7 unidades) | MR | Robô | Site não sabe (diz sempre "a unidade manda a chave"). |
| Reserva sem pagamento | MR **4** "Aceitar reserva para outro dia sem pagamento antecipado?" | `accepts_reservation_without_payment` (27) | MR | Robô | Está na etapa errada (é pagamento) (P6). |
| **Paga antes × na retirada** (em criação) | ainda não existe | — | — | — | Ver P6: entra na etapa 3, junto com os dois acima. |
| Link de pagamento | MR 3 | `payment_link` | MR | Robô | Bate. |
| Taxa de cartão | MR 3 | `charges_card_fee_to_customer`, `payment_fees` | MR | Robô, caixa | Bate. |
| Promoção (texto do robô) | MR 4 "Promoções ativas" (só leitura quando há promoção estruturada) | `promotions_combo` | MR, ou o trigger `franchise_configurations_promocao_texto` | Robô | **3 editores** (P2). |
| Promoção estruturada (kit / leve N) | CD "Promoção" (`PromocaoForm`) | `promocao_regras` → gera `promotions_combo` | CD | Robô (via texto), Site (com a chave `cardapio_kit`) | idem. |
| Frase da promoção para o cliente | CD "Promoção no cardápio › Texto para o cliente" (some quando há estruturada) | `promocao_cliente` (1 unidade preenchida) | CD | Site | idem. |
| Produtos, preço, estoque | Gestão › Estoque · CD "Produtos no cardápio" (só leitura do preço/estoque) · CK "Pelo menos 5 produtos" | `inventory_items.quantity, sale_price` | Gestão | Robô, Site | Bate. |
| Visível no cardápio | CD "Produtos no cardápio › Mostrar" | `inventory_items.cardapio_visivel` (14 itens, 5 unidades) | CD | **Só o Site** (o robô não lê) | Rótulo deve dizer isso (P10). Hoje os 14 escondidos estão zerados: sem efeito real. |
| Catálogo (imagem) | MR 4 "Catálogo / Cardápio (imagem que o robô envia ao cliente)" | `catalog_image_url` | MR | Robô | Rótulo confunde com o Cardápio digital (P10). |
| Ligar o cardápio / link | CD "Cardápio no ar / em pausa" | `cardapio_digital_ativo`, `cardapio_digital_slug` | CD | Site, Robô (`cardapio_digital_url` na view) | Bate. Só do CD. |

---

## 2. Problemas (do mais sério ao menor)

### P1. Prazo da entrega: dois editores e duas regras — 23 de 70 unidades (4 ligadas)

- **Sobreposição.** O MR edita o prazo em "Como chega ao cliente" (`EntregaCard.jsx:120-142`, `:512`); o CD edita em
  "Prazo da entrega (o quanto antes)" (`EntregaHojeCard.jsx:89-102`), que grava `avg_prep_time_minutes`
  (`cardapio_configurar`, bloco `entrega_prazo_min`). Limites diferentes: CD 15–180, MR ≥ 1.
- **Divergência.** O site mostra `cardapio_prazo_entrega(avg_prep_time_minutes)` = `least(180, greatest(15, coalesce(p_min, 60)))`,
  então **sem prazo cadastrado o cardápio inventa 60 min**. O robô:
  - frete simples: usa `avg_prep_time_minutes`; vazio = "dentro da janela, sem hora marcada" (`freteModelo.js:69,82`);
  - frete estruturado: usa `delivery_pricing…tipos[].minutos` e **ignora** `avg_prep_time_minutes`
    (`bots/vendedor/prompts/cerebro-enxuto-live.md:83`, condição `!delivery_pricing`); o MR estruturado nunca grava
    `avg_prep_time_minutes` (`freteModelo.js:189-190`, só `!estruturado`).
- **Efeitos colaterais da tela do CD.** O texto "É o mesmo tempo de entrega do Meu robô: o robô também fala esse prazo"
  (`EntregaHojeCard.jsx:91`) é falso nas estruturadas (o robô não lê o campo) e, nas simples, salvar ali troca o robô
  de "Dentro da janela" para "Em até X min" sem a franqueada perceber.
- **Quantas:** 16 simples sem prazo (o cardápio mostra 60, o robô diz janela) + 7 das 10 estruturadas (Guarujá, Iracemápolis,
  Itápolis, Itatiba, Leme e Santos com "janela" e o cardápio mostrando 60; Ubatuba com 60 no robô e 45 no cardápio).
  Ligadas hoje: **Itápolis, Itatiba, Leme, Uberaba**.
- O rodapé do CD diz "Horários, folga, entrega, retirada e pagamento ficam no Meu robô" (`CardapioDigital.jsx:266`) e,
  dois blocos acima, deixa editar o prazo.

### P2. Promoção em três editores, duas telas — 25 unidades com promoção que o cardápio não mostra (8 ligadas)

- MR 4 "Promoções ativas" (`FranchiseSettings.jsx:1409-1418`) = texto do robô (`promotions_combo`), vira só leitura quando
  há promoção estruturada.
- CD "Promoção" (`PromocaoForm.jsx`) = kit / leve N (`promocao_regras`), gera o texto do robô.
- CD "Promoção no cardápio" (`PromocaoClienteCard.jsx:127`) = frase do cliente (`promocao_cliente`), só aparece sem
  estruturada (`CardapioDigital.jsx:253-255`).
- Desde 10l o site mostra só `promocao_cliente` ou o texto da estruturada (`cardapio_promocao_cliente`). Resultado: 27
  unidades oferecem promoção pelo robô, 1 escreveu a frase do cliente; **25 têm promoção no robô e nada no cardápio**,
  8 delas com o cardápio ligado. Para mudar UMA promoção a franqueada passa por duas telas.

### P3. Checklist com regra velha

**P3a. WhatsApp trava pelo campo errado — 13 travadas, 6 à toa.** A trava "WhatsApp da unidade" confere
`franchises.whatsapp_publico` (`cardapio_checklist`), mas o pedido do cardápio vai para o **número do robô** quando ele
está conectado (`cardapio_whatsapp_pedido`): é assim em 61 das 70 unidades. Das 13 sem `whatsapp_publico`, 6 já têm o robô
conectado (o pedido teria para onde ir) e mesmo assim ficam travadas; 5 recebem o botão "Usar o número do robô", 1 nem isso.
Nenhuma tela deixa a franqueada cadastrar o número público: o botão é "Pedir à Maxi →" (`lib/cardapioDigital.js:189`).

**P3b. Aviso falso de frete por bairro — 10 unidades (4 ligadas).** Para `delivery_pricing` o checklist diz "O cardápio não
calcula esse tipo de frete: o cliente vê que a unidade confirma o valor no WhatsApp". Desde a Edge v8/v9 o cardápio calcula
com o **mesmo motor do robô** (`site/pedido/supabase/functions/cardapio-frete/index.ts:5-7` e `:504-508`, `cotarPorBairro`).
As 10 estruturadas veem o aviso amarelo (Itápolis, Itatiba, Leme e Jd. Santa Maria com o cardápio no ar).

### P4. Feriado: aviso em 70/70, atalho que não leva ao campo — 70 unidades

O CK avisa "Feriado em 15/11" (e 20/11) em **todas as 70**; só 1 marcou horário especial para essas datas. O botão
"Marcar no Meu robô →" abre a etapa 2 (`lib/cardapioDigital.js:205`), onde o cartão "Horário especial" é o **último**,
depois de todo o cartão de entrega e de retirada (`FranchiseSettings.jsx:1249`). O link do "Entrega de hoje"
("Mudar no Meu robô →", `EntregaHojeCard.jsx:85`) e o do horário especial nas pendências (`lib/cardapioDigital.js:168`) vão
para `/FranchiseSettings` **sem etapa**: abre na etapa 1 (ou na do rascunho). Depois de salvar, não há caminho de volta para o
cardápio (o "a lista se atualiza sozinha" só vale se ela voltar pelo menu).

### P5. Antes de ligar, a página só mostra o checklist — 53 unidades

No primeiro uso o CD renderiza só o `PrimeiroUsoCard` (`CardapioDigital.jsx:237-239`). Pausa da entrega (que **o robô lê desde
10/11 20:02Z**) e promoção ficam invisíveis para quem ainda não ligou o cardápio, e são justamente as duas coisas do dia a dia.
O comentário do `EntregaHojeCard.jsx:5` ("O robô NÃO sabe da pausa") ficou velho.

### P6. "Quando o cliente paga" espalhado em duas etapas — 34 unidades usam algum dos botões

`pix_on_delivery` (7 unidades) está na etapa 3; `accepts_reservation_without_payment` (27) está na etapa **4 "Seu vendedor"**
(`FranchiseSettings.jsx:1449-1451`), embora seja regra de pagamento. A opção nova "paga antes × na retirada" vai virar o
terceiro botão sobre o mesmo assunto. O texto do Pix na entrega já fala em "(ou na retirada)" (`FranchiseSettings.jsx:1314`),
o que vai brigar com o botão novo. O site não lê nenhum dos três (sempre "a unidade manda a chave no WhatsApp").

### P7. "Pedido mínimo para entrega" vale também na retirada — 27 unidades

Rótulo e ajuda dizem "para entrega" (`EntregaCard.jsx:533`, `helpTips.js:7-11`) e o campo só aparece com a entrega ligada.
O robô ("PEDIDO MÍNIMO", `cerebro-enxuto-live.md:82`) e o site (`cardapio.js:1346`) cobram em qualquer modalidade.
34 unidades têm mínimo; 27 delas fazem retirada.

### P8. Campos mortos — 63 unidades com valor velho

`order_cutoff_time`, `delivery_start_time` e `operating_hours` têm valor em 63 unidades e ninguém lê: nenhuma função, nenhuma
view, e o V5 atual não cita (backup do workflow de 10/11). Em 54 o `order_cutoff_time` já difere do "Pedidos até" real.
A própria tela registra isso (`FranchiseSettings.jsx:684-686`, `configSave.js:51-52`); `operating_hours` só serve de
reserva para o horário de retirada de unidade **sem** entrega (`FranchiseSettings.jsx:1234`), e as 70 têm entrega.
`welcome_message`, `price_table_url` e `shipping_rules_costs` estão vazios nas 70. Risco: alguém consultar a coluna errada
(regra do projeto: ver quem escreve antes de usar).

### P9. Retirada sem hora marcada que o site ignora — 11 unidades

`pickup_requires_scheduling=false` ("o cliente pode chegar sem avisar") em 11 unidades; o `cardapio_unidade` não manda esse
dado e o site obriga a escolher dia e faixa de 2 h para retirar.

### P10. Rótulos que confundem

- MR 4 "Catálogo / Cardápio (imagem que o robô envia ao cliente)" (`FranchiseSettings.jsx:1396`) com a página
  "Cardápio digital" ao lado no menu.
- CD "Produtos no cardápio" não diz que esconder vale **só para o cardápio**: o robô continua vendendo o que tem estoque
  (`ProdutosLista.jsx:60`; o V5 não lê `cardapio_visivel`).
- O CK confere só a tabela geral de frete (`delivery_fee_rules`); 10 unidades têm tabela por dia diferente da geral, que a
  Edge usa. Não trava ninguém hoje, mas o "Faixas de frete até o raio" pode passar com a tabela do dia furada.

O que **bate** (não mexer): endereço/CEP, Instagram, entrega e retirada ligadas, horários e herança da retirada, folga,
"pedidos até", raio, faixas e bairros no cálculo (mesmo motor), formas de pagamento com a mesma herança, Pix só no robô,
link do cardápio, estoque e preço.

---

## 3. Proposta (enxuta)

**Divisão pelo trabalho real:** o MR é preenchido na abertura e revisto de vez em quando (cadastro). O CD é aberto quando
ela quer vender pelo link ou mexer em algo de hoje. Então:

- **Meu robô = fonte única de "como a unidade funciona"**: endereço, contatos, entrega e retirada, dias, horários,
  "pedidos até", **prazo**, frete, raio, pedido mínimo, pagamento, Pix, quando o cliente paga, horário especial, nome,
  catálogo, bloqueados. Vale para o robô e para o cardápio.
- **Cardápio digital = "vender pelo link hoje"**: ligar/pausar o cardápio, link/QR/bio, pausar a entrega hoje,
  **promoção (toda)**, produtos no cardápio, resultado. O resto ele só mostra, com atalho para o campo exato.

Por que a promoção vai inteira para o CD e não para o MR: ela muda toda semana (dia a dia), a estruturada precisa do seletor
de produtos e do botão do kit, que já moram no CD, e a frase do cliente só faz sentido com a prévia do cardápio ao lado.

### O que sai, muda de lugar e fica

| Item | Hoje | Depois |
|---|---|---|
| Prazo da entrega | editável no MR e no CD | **Sai do CD.** Fica só no MR (etapa 2, "Como chega ao cliente"). O CD mostra uma linha. |
| Regra do prazo no site | `avg_prep_time_minutes` ou 60 | **A do robô**: simples = `avg_prep_time_minutes`; estruturada = minutos do tipo do dia; sem prazo = sem "o quanto antes" (decisão do Nelson, abaixo). |
| Promoção | MR 4 + 2 cartões no CD | **Um bloco "Promoção" no CD**, visível também antes de ligar. MR 4 vira resumo só leitura com atalho. |
| Pausa da entrega | CD, só com o cardápio ligado | Fica no CD, **visível também antes de ligar**, com o rótulo dizendo que vale para o robô. |
| Horário especial | MR 2, último cartão | Fica no MR 2; os atalhos levam direto ao cartão e há "Voltar ao Cardápio digital" depois de salvar. |
| "Quando o cliente paga" | MR 3 (Pix na entrega) + MR 4 (reserva) | **Um bloco no MR 3** com os três botões (inclui o novo da retirada). |
| Pedido mínimo | "para entrega" | Mesmo lugar, rótulo novo (vale nas duas). |
| Trava do WhatsApp no CK | `whatsapp_publico` | "Tem para onde mandar o pedido" (`cardapio_whatsapp_pedido.numero`). |
| Aviso de frete por bairro no CK | aviso amarelo falso | Some: item verde "Frete por bairro" (`ok=true`). |
| Campos mortos | 3 colunas com lixo | Saem da tela já; colunas apagadas depois de 30 dias, com backup. |

### Rótulos novos (texto exato)

**CD › "Entrega de hoje"**
- Título: `Entrega de hoje`
- Linha de status (com prazo): `Entrega funcionando. No cardápio e no robô, a primeira opção de hoje é "em cerca de 50 min".`
- Linha de status (janela): `Entrega funcionando, dentro da janela de hoje (até as 18h). Sem "o quanto antes": você entrega na rota do dia.`
- Abaixo do botão: `Vale para o cardápio e para o robô: os dois param de oferecer entrega hoje e voltam sozinhos.`
- No lugar do campo de prazo: `Prazo e horário-limite vêm do Meu robô.` + link `Mudar no Meu robô →` (para `?etapa=2&bloco=entrega`).

**CD › "Promoção"** (um bloco só)
- Título: `Promoção`
- Subtítulo: `Uma promoção por vez. Vale para o cardápio e para o robô.`
- Escolha: `Kit com preço fechado` · `Leve N e ganhe %` · `Escrever do meu jeito`
- Em "Escrever do meu jeito", dois campos:
  - `O que o cliente lê no cardápio (até 160 letras)` — `promocao_cliente`, com a sugestão de hoje (`sugestaoPromocaoCliente`).
  - `Detalhes para o robô (opcional)` — `promotions_combo`, dica: `Regras que o cliente não precisa ler: até quando vale, para quem, como combinar. O robô oferece uma vez por conversa.`
- Botões: `Salvar promoção` · `Encerrar promoção`

**MR 4 › no lugar de "Promoções ativas"** (só leitura)
- `Promoção que o robô oferece:` "<texto>" (ou `Nenhuma promoção agora.`) + link `Mudar em Cardápio digital › Promoção →`

**MR 3 › bloco "Quando o cliente paga"** (embaixo da tabela de formas)
- `Pix na entrega: o cliente pode pagar quando receber` (`pix_on_delivery`) — descrição sem "(ou na retirada)".
- `Retirada: o cliente pode pagar na hora de retirar` (coluna nova; desligado = paga antes) — descrição: `Desligado, o robô e o cardápio pedem o pagamento antes de o cliente vir buscar.`
- `Pedido para outro dia sem pagar antes (reserva)` (`accepts_reservation_without_payment`, vindo da etapa 4, texto atual mantido).

**MR 2 › entrega**
- `Pedido mínimo (R$) — vale para entrega e retirada` ; ajuda: `Valor mínimo de qualquer pedido, entrega ou retirada. O robô e o cardápio não fecham pedido abaixo dele. Em branco = sem mínimo.`

**MR 4 › catálogo**
- `Imagem do catálogo (o robô manda como foto)`

**CD › "Produtos no cardápio"**
- Subtítulo: `Preço e estoque vêm do Estoque. Esconder tira só do cardápio: o robô continua vendendo o que tiver estoque.`

**CK**
- WhatsApp: título `Número que recebe o pedido`; ok: `Os pedidos chegam no WhatsApp do robô, (11) 9xxxx-xxxx.`; trava (sem robô e sem número público): `Conecte o robô no topo do Meu robô ou peça à Maxi o número da unidade.`
- Frete estruturado: título `Frete por bairro`, verde, `O cardápio calcula com a mesma tabela do robô.`
- Feriado: botão `Marcar no Meu robô →` para `?etapa=2&bloco=horario-especial`.

**MR (quando aberto pelo CD, `?de=cardapio`)** — barra fixa depois de salvar: `Salvo. Voltar ao Cardápio digital →`

### As duas telas depois da junção

```
MEU ROBÔ (cadastro: como a unidade funciona)        CARDÁPIO DIGITAL (vender pelo link hoje)
[conexão do WhatsApp do robô]                       [Cardápio no ar  (o)]  link · Copiar · QR · Ver como o cliente vê
1 Sua unidade                                         (antes de ligar: checklist no lugar deste bloco)
   CEP, rua, bairro, cidade, nome, referência        Entrega de hoje  (vale para o robô e o cardápio)
   Instagram, seu WhatsApp, 2º WhatsApp                Pausar hoje · ou pausar até [hh:mm]
2 Entrega e retirada                                    "Prazo e horário-limite vêm do Meu robô" →
   Entrega: bairros, dias/janela/pedidos até/taxa,   Antes de divulgar (pendências, só leitura + atalho)
            como chega (janela | em até X min)          feriado → MR 2 › Horário especial
            raio, pedido mínimo (entrega e retirada)    em falta → Estoque · link na bio
   Retirada: tipo, hora combinada, endereço, horário Resultado · cotações de frete
   Horário especial  ← âncora dos atalhos            Promoção  (kit | leve N | do meu jeito: frase do cliente
3 Pagamento                                                    + detalhes para o robô)   ← única tela
   Forma × Entrega/Retirada, Pix, link, taxa cartão  Produtos no cardápio (Mostrar/Esconder)
   Quando o cliente paga: Pix na entrega ·           rodapé: "Horários, entrega, prazo, frete e pagamento
     Retirada paga na hora · Reserva sem pagar                 ficam no Meu robô" →
4 Seu vendedor
   nome, imagem do catálogo, bloqueados,
   Promoção que o robô oferece (só leitura) →
5 Como o robô vai responder
```

### Decisões do Nelson antes de mexer

1. **Unidade "dentro da janela" (23):** o cardápio deixa de oferecer "o quanto antes, em cerca de 60 min" (recomendado:
   é uma promessa que o robô não faz) ou ganha um prazo padrão que passa a valer também para o robô?
2. **Pedido mínimo:** só trocar o rótulo (recomendado, nada muda para ninguém) ou passar a valer só na entrega (muda o robô e o site)?
3. **Retirada sem hora marcada (11):** o site passa a oferecer "Hoje, a qualquer hora até as Xh" para essas unidades?

---

## 4. Migração (passos pequenos, cada um reversível)

Nenhum passo apaga dado de unidade. Robô: **nada muda** em nenhum passo (ele já lê as colunas certas; só o passo 2 muda o
site, não o V5).

| # | Passo | Onde | Volta |
|---|---|---|---|
| 1 | Textos: comentário do `EntregaHojeCard` (robô lê a pausa), rótulos do pedido mínimo, catálogo, produtos; links com `?etapa=2&bloco=…` e âncoras nos cartões do MR 2; `?de=cardapio` + "Voltar ao Cardápio digital". | dashboard | reverter o commit |
| 2 | `cardapio_prazo_entrega` passa a receber a unidade e usar a regra do robô (simples: `avg_prep_time_minutes`; estruturada: minutos do tipo de hoje; sem prazo: `null` = sem "o quanto antes"), conforme a decisão 1. `cardapio_unidade` e `cardapio_painel` chamam a nova. Antes: backup dos corpos em `docs/db-backups/`, prova `bun site/pedido/tests/…` com as 4 ligadas afetadas. | banco | reaplicar os backups |
| 3 | Tirar o campo de prazo do `EntregaHojeCard` (fica a linha só leitura). `cardapio_configurar` continua aceitando `entrega_prazo_min` por 30 dias (tela velha em cache), depois sai. | dashboard → banco | reverter |
| 4 | Checklist: WhatsApp pelo `cardapio_whatsapp_pedido.numero`; frete estruturado `ok=true`; feriado com o link novo. Conferir antes/depois com a consulta da seção 5 (esperado: 6 unidades destravam, 10 avisos somem). | banco | backup do `cardapio_checklist` |
| 5 | Promoção: bloco único no CD (reusa `PromocaoForm` + `PromocaoClienteCard` com o campo "Detalhes para o robô" gravando `promotions_combo` pelo `cardapio_configurar`, chave nova `promocao_robo`); visível também antes de ligar. MR 4 vira só leitura **depois** que o bloco do CD estiver no ar. Dado: nenhum muda; as 25 unidades veem a sugestão da frase, nunca preenchida sozinha. | dashboard + banco | reverter; o MR volta a editar |
| 6 | "Entrega de hoje" também antes de ligar o cardápio (a RPC já aceita `entrega_pausa` com a chave desligada). | dashboard | reverter |
| 7 | MR 3 "Quando o cliente paga": mover o botão da reserva da etapa 4 para cá (mesma coluna) e encaixar a opção nova da retirada (coluna criada pela outra sessão); `cardapio_unidade` passa a mandar o "quando paga" e o site ajusta o texto do Pix. | dashboard, depois banco/site | reverter |
| 8 | Campos mortos: tirar `operating_hours` do `initialFormData` e da reserva da linha 1234; após 30 dias sem leitor (conferir logs da Data API e os workflows n8n), `pg_dump` das 3 colunas para `docs/db-backups/` e `drop column`. | dashboard, depois banco | restaurar do dump |

Ordem sugerida: 1 → 4 → 2/3 (com a decisão 1) → 5 → 6 → 7 → 8. Cada passo com `/code-review` e o checklist da seção 5 rodado de novo.

---

## 5. Consultas usadas (todas só SELECT)

```sql
-- base: 70 ativas sem teste
with b as (select fc.*, f.whatsapp_publico from franchise_configurations fc
  join franchises f on f.evolution_instance_id = fc.franchise_evolution_instance_id
  where f.status = 'active' and not coalesce(f.is_test, false))
select count(*) total,                                                           -- 70
  count(*) filter (where cardapio_digital_ativo) ligadas,                        -- 17
  count(*) filter (where has_delivery and delivery_pricing is null
                   and avg_prep_time_minutes is null) simples_sem_prazo,         -- 16 (cardápio mostra 60)
  count(*) filter (where btrim(coalesce(promotions_combo,'')) <> ''
                   and nullif(btrim(promocao_cliente),'') is null
                   and coalesce(jsonb_array_length(promocao_regras),0) = 0) promo_so_robo,  -- 25 (8 ligadas)
  count(*) filter (where min_order_value > 0 and has_pickup) minimo_com_retirada, -- 27
  count(*) filter (where nullif(btrim(order_cutoff_time),'') is not null) campo_morto, -- 63
  count(*) filter (where has_pickup and pickup_requires_scheduling = false) retirada_livre -- 11
from b;

-- estruturadas: promessa do robô × o que o cardápio mostra (7 de 10 divergem)
select franchise_evolution_instance_id, cardapio_digital_ativo, avg_prep_time_minutes,
  (select string_agg(distinct coalesce(t->>'promessa','?')||':'||coalesce(t->>'minutos','-'), ',')
     from jsonb_array_elements(delivery_pricing->'grupos') g, jsonb_array_elements(g->'tipos') t) robo,
  public.cardapio_prazo_entrega(avg_prep_time_minutes) cardapio
from franchise_configurations where has_delivery and delivery_pricing is not null;

-- checklist da rede inteira (feriado 70/70, whatsapp 13, frete-aviso 10, raio_faixas 6 ...)
select x->>'id', x->>'nivel', count(*) filter (where not (x->>'ok')::boolean) falha
from <base> b, jsonb_array_elements(public.cardapio_checklist(b.evo)) x group by 1, 2;

-- WhatsApp: 13 sem número público, 6 com o robô conectado; destino do #PED-: 61 robô, 2 público
select count(*) filter (where whatsapp_publico is null and public.cardapio_robo_numero(evo) is not null),
       count(*) filter (where public.cardapio_whatsapp_pedido(evo)->>'destino' = 'robo') from <base>;

-- campos mortos sem leitor: nenhuma função nem view cita order_cutoff_time / operating_hours / delivery_start_time
select w, (select string_agg(proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) ilike '%'||w||'%'),
          (select string_agg(viewname, ', ') from pg_views where definition ilike '%'||w||'%')
from unnest(array['order_cutoff_time','operating_hours','delivery_start_time']) w;
```
