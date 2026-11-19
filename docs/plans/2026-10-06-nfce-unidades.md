# NFC-e da unidade pelo dashboard (proposta, 06/10/2026)

Origem: o Rafael (Vila Maria, `franquiasaopaulosp2`) abriu ME e precisa emitir nota ao consumidor.
Decisão do Nelson (06/10): construir no dashboard, para a rede, e cobrar como adicional. A Vila Maria é a piloto.
Status: SÓ DESENHO. Nada aplicado.

## Ideia em uma linha
A venda continua sendo lançada no dashboard (balcão ou robô). Um botão "Emitir nota" na venda chama uma
Edge Function, que monta a NFC-e e emite pela Focus NFe (conta da Maxi, uma "empresa" por CNPJ de unidade).
A nota volta gravada na venda (número, chave, link do DANFE/QR). Estoque não muda: já baixa com a venda.

## Fluxo
```
SaleForm / lista de vendas ──"Emitir nota"──▶ Edge Function nfce (JWT do franqueado, confere a unidade)
                                               │ monta itens (catálogo fiscal) + pagamento + CPF opcional
                                               ▼
                                       Focus NFe  POST /v2/nfce?ref=<sale_id>  (token da empresa da unidade)
                                               │ autorizada / erro (síncrono na NFC-e)
                                               ▼
                               notas_fiscais (sale_id, status, número, chave, url) ──▶ selo na venda,
                                                                                     link p/ mandar ao cliente
```
Idempotência: `ref` = id da venda (+ `_vN` em reemissão). Cancelar = `DELETE /v2/nfce/<ref>` com justificativa.

## Banco (tudo novo com RLS + grant pós-30/10)
1. **Cadastro fiscal da unidade**: reaproveitar `wip/nfe-cadastro` (`fiscal-01`: razão social, IE, indicador IE,
   município IBGE em `franchises`). Acrescentar `franchise_nfce` (1 por unidade): regime (Simples), série,
   ambiente (homologação/produção), CFOP/CSOSN padrão definidos pelo contador, `focus_empresa_id`,
   vencimento do certificado, `habilitada`. Token da Focus e CSC: só service role (Vault), o front nunca lê.
2. **Catálogo fiscal**: `fiscal-02` do mesmo branch (NCM, CEST, código, unidade em `catalog_products`).
   NCM do molho só existe no SQLite do fiscal-bot.
3. **Vínculo item da unidade → produto do catálogo**: `inventory_items.catalog_product_id`.
   Medido 06/10 na Vila Maria: 51 itens ativos, 23 criados pelo franqueado, 24 sem nome igual no catálogo.
   Item sem vínculo = recusa "produto sem cadastro fiscal: X" (ou NCM informado na tela do item).
4. **`notas_fiscais`**: sale_id, franchise_id, ref, status (solicitada/autorizada/erro/cancelada), número,
   chave, url_danfe, url_xml, erro, emitida_em, cancelada_em, cancelada_por.
5. **`sales.cpf_nota`** (opcional; o banco não guarda CPF hoje). LGPD: só quando o cliente pede.

## Mapa venda → NFC-e
- Itens: `sale_items` (nome, qtd, preço) + NCM/CEST do catálogo pelo vínculo.
- Desconto: `discount_amount` rateado nos itens.
- Pagamento (`tPag`): cash 01 · credit 03 · debit 04 · meal_voucher 11 · pix 17 · payment_link 03 (conferir).
- Taxa de entrega e venda com entrega (indPres 4): como entra na NFC-e, conferir com o contador/Focus.
- Venda do robô nasce "a receber" e pode ter data futura: emitir na baixa/recebimento, não na criação.

## Telas
- Configurações › Nota fiscal: dados fiscais, upload do certificado A1 (.pfx + senha vão direto para a
  Focus pela Edge Function; não guardamos o arquivo), CSC, botão "Testar em homologação".
- Venda: campo "CPF na nota", botão "Emitir nota", selo (emitida / erro), "Enviar ao cliente" (link no WhatsApp).
- Editar/excluir venda com nota autorizada: bloquear edição; excluir pede cancelamento (prazo da Sefaz-SP: conferir).
- Admin: notas por unidade no mês (base da cobrança).

## Cobrança
Adicional na assinatura ASAAS da unidade. Custo de referência: Focus por CNPJ (preço de parceiro a confirmar;
plano avulso NFC-e visto em 06/10: R$ 62,90/mês) + margem.

## O que precisa antes de codar
| Quem | O quê |
|---|---|
| Contador do Rafael | CFOP/CSOSN da revenda (a fábrica vende ao franqueado SEM ST), tratamento da taxa de entrega |
| Rafael | IE da ME, credenciamento NFC-e na Sefaz-SP + CSC (id e código), certificado A1 |
| Nelson | Conta Focus com API de empresas (multi-CNPJ) e preço por CNPJ; NCM/CEST/código do molho (fiscal-bot) |

Pedido ao Rafael enviado em 06/10 (chat #1075): print do cartão CNPJ, IE, se é Simples, se já liberou NFC-e na
Sefaz; ao contador: CFOP/CSOSN da revenda e taxa de entrega. Certificado e CSC NÃO vêm pelo WhatsApp: ele sobe
na tela de configuração quando existir.

## Público
66 unidades (fora teste): 33 cadastradas com CPF, 33 com CNPJ. MEI vendendo a pessoa física não é obrigado a
emitir nota: o mercado real são as ME/EPP. Conferir quais são MEI antes de anunciar à rede.

## Fases
1. Banco + catálogo fiscal + vínculo dos itens da Vila Maria.
2. Edge Function emitir/consultar/cancelar, testada em homologação com a Vila Maria.
3. Telas (configuração, botão, selo, enviar ao cliente).
4. Produção na Vila Maria → cobrança no ASAAS → oferta à rede.
