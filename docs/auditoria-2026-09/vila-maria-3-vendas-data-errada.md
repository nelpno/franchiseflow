# Vila Maria — 3 vendas com a data no futuro

**Para mandar à franqueada de Vila Maria (São Paulo - SP).** Nada foi alterado no banco:
o que muda a data é a resposta dela.

## O que aconteceu

As três vendas abaixo estão gravadas com **30/09/2026** — uma data que ainda não chegou.
Pelo dia em que cada uma foi digitada, parece erro de mês na hora de escolher a data.

Enquanto ficarem assim, elas:

- **inflam o faturamento de setembro em R$ 1.279,80** e tiram esse valor do mês a que
  pertencem — o comparativo da unidade mostra **▼18%** quando o real é **▼30%**;
- ficam **fixas no topo da lista de Vendas** dela (a lista ordena por data) e para sempre
  como **Pendentes**, porque nenhuma foi confirmada.

São as únicas três da rede inteira nessa situação. O sistema hoje **bloqueia** data futura
(o aviso aparece ao salvar), mas essa trava foi criada depois delas.

## A mensagem

> Oi! Achamos três vendas suas com a data trocada — estão gravadas como **30/09/2026**, que
> ainda nem chegou. Dá uma olhada e me diz a data certa de cada uma? Aí eu corrijo aqui e o
> seu faturamento do mês volta a bater.

| Venda | Cliente | Valor | Gravada como | Digitada em | Pagamento | Itens |
|---|---|---|---|---|---|---|
| **#509** | Andressa | R$ 336,00 | 30/09/2026 | **25/06/2026** | PIX · retirada | Nhoque de Batata 1kg ×16 |
| **#805** | Andréa Moura | R$ 348,00 | 30/09/2026 | **07/08/2026** | PIX · entrega | Nhoque de Batata 1kg ×4, Nhoque Rech. Mussarela ×2, Calabresa ×2, Presunto e Mussarela ×2, 4 Queijos ×2 |
| **#909** | Associação | R$ 595,80 | 30/09/2026 | **19/08/2026** | PIX · retirada | Nhoque de Batata 1kg ×8, Conchiglione 4 Queijos ×2, Nhoque Rech. 4 Queijos ×4, Rondelli Presunto e Mussarela ×3, Sofioli Brócolis ×2 |

O palpite mais provável é que a data certa seja a da coluna **"Digitada em"** — mas é ela
quem sabe, porque pode ter lançado a venda dias depois de fazer.

## Quando ela responder

Correção por venda, uma a uma, com backup antes:

```sql
-- backup
create table if not exists _backup_vendas_data_2026_09_08 as
select * from sales where sale_date > current_date;

-- uma linha por venda, com a data que ELA confirmar
update sales set sale_date = date '<AAAA-MM-DD>' where sale_number = 509  and franchise_id = 'franquiasaopaulosp2';
update sales set sale_date = date '<AAAA-MM-DD>' where sale_number = 805  and franchise_id = 'franquiasaopaulosp2';
update sales set sale_date = date '<AAAA-MM-DD>' where sale_number = 909  and franchise_id = 'franquiasaopaulosp2';
```

⚠️ O trigger `sales_bloqueia_data_futura` roda em UPDATE também — se a data nova for futura
ele recusa, que é o comportamento certo. E mudar `sale_date` **mexe no faturamento de meses
já fechados** (junho e agosto), então vale avisar antes de qualquer fechamento novo.
