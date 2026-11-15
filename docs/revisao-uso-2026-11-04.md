# Revisão de uso do app (04/11/2026)

Fontes: Clarity (API, 3 dias, 01–03/11, comparado ao pull de 07/09 em `.tmp/audit-2026-09/`), banco (`audit_logs`, `contact_actions`, `notifications`, `purchase_orders`, 30 dias). Scripts: `.tmp/clarity-2026-11/pull.mjs` e `rel.mjs`.

## Uso
- 69 unidades ativas; 64 lançaram venda à mão em 30 dias (3.072 vendas), 60 nos últimos 7. Mediana de 32 vendas manuais por unidade/mês.
- "Quem chamar hoje": 41 unidades, 2.202 contatos chamados em 30 dias (repetir 1.099, quase comprou 703, sumido 360).
- Verba pelo app: 57 unidades no mês. Pedido à fábrica pelo app: 56 unidades.
- Gasto lançado à mão: só 20–22 unidades. Aba Resultado: 14 sessões em 3 dias (9 pessoas).
- Ajuda (`/Tutoriais`): 13 sessões em 3 dias, de ~1.750 (<1%), poucas pessoas.

## Clarity: 07/09 → 03/11 (3 dias cada)
| | 07/09 | 03/11 |
|---|---:|---:|
| sessões | 1.788 | 1.750 |
| dead clicks | 577 | 476 (−18%) |
| quickback | 1.064 | 763 (−28%) |
| rage / erro de script / clique com erro | 3 / 0 / 0 | 3 / 0 / 0 |
| `/Vendas` PC dead clicks | 253 | 76 (−70%) |

Pior agora: `/Gestao?tab=estoque` PC (114 dead clicks em 83 sessões, 19%), `/Gestao?tab=reposicao` PC (38; 24%), `/Marketing` celular (29% das sessões), `/FranchiseSettings` celular (22%). Seletor só na UI do Clarity (a API não dá).
Peso da abertura (gzip, live): 276 KB (era 248 KB em 07/09).

## Achados
1. **Conferir entrega (S15) está desligada desde sempre**: o gatilho lê a chave `conferir_entrega`, que não existe em `feature_flags`. 109 pedidos entregues em 45 dias, 1 conferido. Código morto: `ConferirEntregaCard`, `AguardandoConferenciaSection`, `conferenciaEntrega.js`, cron `s15-entregas-sem-resposta`.
2. **"Estoque baixo" = ruído**: 1.562 avisos em 30 dias para 63 franqueados (~25 por pessoa), 28% lidos.
3. **Robô grava venda que a franqueada apaga**: 98 de 975 vendas do robô (10%) apagadas em 30 dias, por 37 unidades; só 27 tinham outra venda do mesmo cliente (duplicata). As outras 71 parecem venda que não aconteceu.
4. **Ajuda desatualizada**: `pedido-fabrica` ainda diz frete "10%, mín. R$ 250, máx. R$ 350" (a tela mostra R$ 350 desde 22/10, e a rede foi avisada em 02/11); não fala do Pix pedido pelo WhatsApp na entrega nem do pão de queijo em caixa de 12. `pagamentos` diz R$ 150 (vai a R$ 220 em jan/2027).
5. **"Isso resolveu?" e os eventos (manual baixado, modelo de pedido, relatório) só existem no painel do Clarity**: ninguém leu (a S21.3 previa leitura mensal).
