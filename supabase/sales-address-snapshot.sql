-- Snapshot do endereço do cliente na venda (2026-07-01)
-- Irmão de sales-customer-name-denormalize.sql.
--
-- Problema: a tela Vendas carrega só os ~1000 contatos mais recentes da franquia
-- (Contact.filter sem fetchAll). O comprovante (SaleReceipt) lia o endereço EXCLUSIVAMENTE
-- do contato "vivo" carregado na tela. Cliente antigo (fora da janela de 1000) → o app não
-- achava o contato → o endereço sumia do comprovante, mesmo cadastrado corretamente.
-- O nome não sumia porque já era denormalizado (customer_name, 16/06); o endereço não tinha
-- esse fallback. Sintoma "uns saem com endereço, outros não" = quem está dentro/fora dos 1000.
--
-- Fix (mesma estratégia do nome): denormalizar endereço+bairro na própria venda via trigger.
-- O(1)/venda, sem fetch extra, serve comprovante + lista + export. Vale para venda manual
-- (save_sale_with_items) e venda do bot (n8n) — o trigger BEFORE INSERT preenche dos contacts.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS customer_address      text,
  ADD COLUMN IF NOT EXISTS customer_neighborhood text;

COMMENT ON COLUMN public.sales.customer_address      IS 'Snapshot do endereço do cliente no momento da venda (preenchido pelo trigger a partir de contacts.endereco).';
COMMENT ON COLUMN public.sales.customer_neighborhood IS 'Snapshot do bairro do cliente no momento da venda (preenchido pelo trigger a partir de contacts.bairro).';

-- Estende o trigger existente (trg_sales_fill_customer_snapshot, BEFORE INSERT OR UPDATE)
-- para também copiar endereço + bairro. coalesce = não sobrescreve snapshot já gravado
-- (preserva o endereço do pedido mesmo que o cliente mude de endereço depois).
CREATE OR REPLACE FUNCTION public.sales_fill_customer_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if NEW.contact_id is not null
     and (NEW.customer_name is null
          or NEW.contact_phone is null
          or NEW.customer_address is null
          or NEW.customer_neighborhood is null) then
    select coalesce(NEW.customer_name,         nome),
           coalesce(NEW.contact_phone,         telefone),
           coalesce(NEW.customer_address,      endereco),
           coalesce(NEW.customer_neighborhood, bairro)
      into NEW.customer_name, NEW.contact_phone,
           NEW.customer_address, NEW.customer_neighborhood
    from public.contacts
    where id = NEW.contact_id;
  end if;
  return NEW;
end;
$function$;

-- Backfill das vendas já existentes: copia o endereço ATUAL do contato (histórico não existe).
-- Rodado 2026-07-01: 2183 vendas preenchidas.
UPDATE public.sales s
   SET customer_address      = c.endereco,
       customer_neighborhood = c.bairro
  FROM public.contacts c
 WHERE s.contact_id = c.id
   AND s.customer_address IS NULL
   AND s.customer_neighborhood IS NULL
   AND (c.endereco IS NOT NULL OR c.bairro IS NOT NULL);
