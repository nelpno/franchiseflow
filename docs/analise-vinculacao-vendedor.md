# Análise de Vinculação: FranchiseSettings ↔ Vendedor Genérico

## Como o vendedor usa cada campo

| Campo no Dashboard | Como o Vendedor Usa | Importância | Dica para o franqueado |
|---|---|---|---|
| **franchise_name** | Apresentação: "Olá! Sou da {franchise_name}" | Alta | Nome da unidade como aparece pro cliente |
| **agent_name** | "Meu nome é {agent_name}" | Média | Nome do assistente virtual (ex: "Maria", "Atendente Maxi") |
| **opening_hours** | Responde "funcionamos das X às Y" | Alta | Formato: "Seg-Sex 9h-18h, Sáb 9h-13h". Sem isso o bot não sabe responder |
| **unit_address** | Dá endereço para retirada e cálculo de frete | Alta | Endereço completo com número. Usado no Google Maps |
| **address_reference** | Complementa localização | Média | Ponto de referência (ex: "ao lado do mercado X") |
| **accepted_payment_methods** | Lista formas de pagamento ao cliente | Alta | Separar por vírgula: "PIX, Cartão, Dinheiro". Bot lista exatamente isso |
| **pix_key_data** | Envia chave PIX para pagamento | Alta | Formato: "CPF: 000.000.000-00" ou "Telefone: (11) 99999-9999" |
| **payment_link** | Envia link para pagamento online | Média | URL do link de pagamento (se usar) |
| **promotions_combo** | Oferece promoções ativamente em conversas | Alta | Formato livre. Ex: "Combo Família: 3 massas + 1 molho por R$89,90". Bot usa literalmente |
| **shipping_rules_costs** | Calcula e informa frete | Alta | Formato: "Até 5km: R$10 / 5-10km: R$18 / Acima: consultar". Bot calcula com Google Maps |
| **price_table_url** | Link da planilha Google Sheets com estoque | Crítica | URL da planilha de estoque. O bot consulta em TEMPO REAL. Sem isso, não vende |
| **social_media_links** | Quando perguntam sobre redes sociais | Baixa | Instagram da unidade |
| **personal_phone_for_summary** | Recebe resumo diário + escala atendimento humano | Alta | Seu WhatsApp pessoal. Recebe alertas quando o bot não consegue resolver |

## Campos que FALTAM no dashboard (oportunidade de melhoria)

| Campo sugerido | Uso no Vendedor | Prioridade |
|---|---|---|
| **raio_maximo_entrega** | Definir até onde entrega (km) | Alta |
| **tempo_preparo_medio** | "Seu pedido ficará pronto em ~{X} minutos" | Média |
| **pedido_minimo** | "Pedido mínimo para entrega: R${X}" | Alta |
| **dias_funcionamento** | Separar dias de horários para clareza | Média |
| **mensagem_boas_vindas** | Customizar primeira mensagem do bot | Baixa |

## Tooltips sugeridos para cada campo (didático, "à prova de burro")

- **Horário de Funcionamento**: "Digite os dias e horários que sua unidade atende. Ex: Seg a Sex 9h-18h, Sáb 9h-13h. O vendedor automático usa isso para informar clientes."
- **Endereço Completo**: "Endereço com número e CEP. Usado para cálculo de frete e para clientes que vêm buscar."
- **Formas de Pagamento**: "Liste todas as formas aceitas separadas por vírgula. Ex: PIX, Cartão de crédito, Cartão de débito, Dinheiro"
- **Chave PIX**: "Sua chave PIX completa. O vendedor envia isso quando o cliente escolhe pagar via PIX."
- **Promoções e Combos**: "Descreva as promoções ativas. O vendedor oferece automaticamente durante a conversa. Ex: Combo Família - 3 massas + 1 molho por R$89,90"
- **Regras de Frete**: "Defina o custo por faixa de distância. Ex: Até 5km: R$10,00 | 5-10km: R$18,00 | Acima de 10km: consultar"
- **URL da Planilha de Estoque**: "Link compartilhado da sua planilha Google Sheets com produtos, preços e quantidades. O vendedor consulta em tempo real."
- **Telefone Pessoal**: "Seu WhatsApp pessoal. Recebe resumo de vendas do dia e alertas quando o bot precisa de ajuda humana."
