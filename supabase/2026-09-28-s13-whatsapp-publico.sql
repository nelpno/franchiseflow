-- S13.2 (Onda 6, 28/09/2026): WhatsApp de ATENDIMENTO da unidade para o comprovante.
--
-- Decisão do Nelson (28/09): a fonte é o número do robô (instância da unidade no Zuck).
-- Coluna PRÓPRIA, nunca franchises.phone_number: get_unit_360, get_admin_network_overview,
-- cs_unit_motives, get_cs_mural e get_cs_franchise_contacts usam phone_number ANTES do celular
-- do dono para o "Chamar" do CS — gravar o robô ali faria o Celso cair no robô.
--
-- Quem lê: só o comprovante (src/lib/receiptUtils.js resolveUnitWhatsApp, via Vendas.jsx).
-- Quem escreve: o backfill abaixo (números das instâncias CONECTADAS em 28/09, gerado por
-- .tmp/onda6/s13-zuck.mjs, fora do git). Unidade nova ou robô trocado: preencher à mão
-- (ou sincronizar do Zuck) — sem valor, a linha do comprovante simplesmente não aparece.
-- Formato: só dígitos, sem DDI 55, 10 (fixo) ou 11 (celular com o 9) — igual ao telefone
-- canônico do app (formatPhone mostra "(DD) 9XXXX-XXXX").
--
-- ROLLBACK (o front lê a coluna: publicar o revert do front ANTES de dropar, senão a lista
-- de Vendas dá 400):
--   alter table public.franchises drop column if exists whatsapp_publico;

alter table public.franchises add column if not exists whatsapp_publico text;

alter table public.franchises drop constraint if exists franchises_whatsapp_publico_formato;
alter table public.franchises add constraint franchises_whatsapp_publico_formato
  -- Formato BRASILEIRO (P3): DDD + celular com 9 (11) ou fixo 2-5 (10). Número estrangeiro
  -- com 10/11 dígitos passaria num check só de tamanho e o formatPhone o mostraria como BR.
  check (whatsapp_publico is null or whatsapp_publico ~ '^[1-9][1-9](9[0-9]{8}|[2-5][0-9]{7})$');

comment on column public.franchises.whatsapp_publico is
  'WhatsApp de atendimento ao cliente (número do robô no Zuck). Só o comprovante lê. NÃO usar para o CS chamar a franqueada (isso é phone_number / personal_phone_for_summary).';
