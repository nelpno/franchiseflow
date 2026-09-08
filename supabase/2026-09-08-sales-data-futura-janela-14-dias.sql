-- Venda com data futura: de "nada no futuro" para uma JANELA de 14 dias.
--
-- Por que. O trigger nasceu (07/09/2026) para pegar as 3 vendas da Vila Maria
-- datadas 30/09 — erro de MES que escondia uma queda de 30% como se fosse 18%.
-- Mas ele recusava QUALQUER data futura, e boa parte da rede usa data futura de
-- proposito: lanca a venda hoje com a data da entrega, e o pedido fica no topo da
-- lista do dia certo. E agenda de entrega, nao engano.
--
-- Medido em 08/09/2026 (180 dias, tabela `sales`):
--   663 vendas com sale_date > data de criacao, em 30 franquias
--   628 delas ate 7 dias a frente (455 sao exatamente "amanha")
--   a cauda de erro real so aparece a partir de ~14 dias: 16 casos esparsos
--   (31, 37, 42, 54, 66 e 97 dias a frente)
-- Guaruja: 44 vendas assim, nenhuma passando de 5 dias.
-- Osasco 179, Santo Andre 79, Cajamar 48.
--
-- 14 dias mata os 16 erros de digitacao e libera as 663 legitimas.
--
-- A MENSAGEM agora vai para a tela da franqueada: o errcode 23514 esta mapeado em
-- src/lib/safeErrorMessage.js (whitelist de prefixo — ver PREFIXOS_SEGUROS la).
-- Se mudar o texto aqui, o prefixo "A data da venda" tem de continuar valendo.
--
-- Trigger: tr_sales_data_futura, BEFORE INSERT OR UPDATE FOR EACH ROW em `sales`
-- (tgtype 23). Nao muda aqui — so o corpo da funcao.

create or replace function public.sales_bloqueia_data_futura()
 returns trigger
 language plpgsql
as $function$
declare
  hoje_brt date := (now() at time zone 'America/Sao_Paulo')::date;
  limite   date := hoje_brt + 14;
begin
  if new.sale_date > limite then
    raise exception 'A data da venda (%) está longe demais. Dá para lançar até % (14 dias à frente). Confira o dia e o mês.',
      to_char(new.sale_date,'DD/MM/YYYY'), to_char(limite,'DD/MM/YYYY')
      using errcode = '23514', hint = 'Erro de mês é a causa mais comum.';
  end if;
  return new;
end $function$;

-- Prova (rodada em 08/09/2026, dentro de transacao abortada):
--   +1 dia  (09/09): PASSOU
--   +14 dias (22/09): PASSOU
--   +15 dias (23/09): BLOQUEADO -> "A data da venda (23/09/2026) está longe
--                     demais. Dá para lançar até 22/09/2026 (14 dias à frente)..."
--
-- md5(prosrc) apos aplicar: 0a9edbc2ce8f59a7ef404bdc3ab006e8 | length 450 | 0 CR
-- Aplicar sempre com LF (arquivo do Windows injeta \r DENTRO do prosrc e quebra
-- a verificacao de paridade dali em diante).
