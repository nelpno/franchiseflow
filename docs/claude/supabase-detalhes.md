# Supabase — telefone canônico e linter

> Texto original do CLAUDE.md do dashboard, sem edição — mudou de arquivo em 11/09/2026 para o CLAUDE.md caber no contexto. As regras de bolso continuam lá.

**Normalização de telefone (fix 16/04/2026):**
- `contacts.telefone`, `bot_conversations.contact_phone`, `conversation_messages.contact_phone`: SEMPRE canônicos (só dígitos, sem DDI 55). Triggers `BEFORE INSERT OR UPDATE OF <coluna>` garantem. Invariante: `telefone = public.normalize_phone_br(telefone)` sempre
- Helper banco: `public.normalize_phone_br(text)` (IMMUTABLE, PARALLEL SAFE) — reusado por RPCs e triggers. Remove não-dígitos e tira DDI 55 quando `length >= 12`
- RPCs normalizadas: `upsert_bot_contact`, `get_customer_intelligence`, `get_contact_by_phone`, `log_conversation_message`, `get_abandoned_for_followup`
- Frontend canônico: [normalizePhone()](../../src/lib/whatsappUtils.js) — usar antes de qualquer `Contact.create`/`update`/`filter`/`search` que envolva telefone
- Auditoria: `supabase/queries/audit-contact-phone-duplicates.sql` — esperado 0 linhas
- Fix 16/04/2026: desduplicados 37 pares (164 com DDI 55 → 0), removido `idx_contacts_franchise_telefone` (redundante com UNIQUE partial) e coluna morta `contacts.tags`
- `MyContacts.jsx:168`: usa `fetchAll: true` em vez de limit hardcoded (clientes antigos ficavam fora da lista quando franquia passava de 200 contatos — fix 16/04)
- Merge de duplicados em tabela com UNIQUE: DELETE do row DROP **antes** do UPDATE do KEEP (senão UPDATE bate na UNIQUE com o DROP ainda existente). Ex: `supabase/scripts/dedup-contacts-by-phone.mjs`
- Scripts de manutenção em `supabase/scripts/*.mjs`: padrão `--dry-run` default (relatório + backup JSON em `backups/`) / `--apply` / flag extra para casos que exigem revisão humana. TX por item, não TX gigante — resiliência em falha parcial

**Database Linter Compliance (fix 15/04/2026):**
- Funções SECURITY DEFINER: SEMPRE incluir `SET search_path = 'public'`
- RLS policies com `auth.uid()`: SEMPRE usar `(select auth.uid())` (initplan perf)
- NUNCA criar policy `FOR ALL` + policies específicas na mesma tabela (overlap = multiple_permissive)
- NUNCA criar policy `USING(true)` para role padrão — service_role já bypassa RLS
- Storage buckets públicos: leitura via URL pública funciona sem SELECT policy, MAS `upsert: true` da Storage API REQUER SELECT em `storage.objects` para verificar existência (sem ela: 403 row-level security em substituição). Manter SELECT policy em buckets onde franqueado/admin faz upload (catalog-images, marketing-comprovantes). Fix 16/04/2026: linter sugeriu dropar; reaplicado
- Storage buckets onde admin precisa **apagar** arquivo (não só ler/escrever): policy `FOR DELETE USING (bucket_id='X' AND (SELECT public.is_admin_or_manager()))`. Sem ela, `supabase.storage.from(b).remove([])` falha silenciosamente — arquivo órfão. Aplicado em `marketing-comprovantes` (30/04/2026) quando admin ganhou cancelamento de pagamento
- Debug 403 em upload Supabase Storage: checar `pg_policies WHERE schemaname='storage' AND tablename='objects'` ANTES de investigar código React/auth (root cause é quase sempre policy faltando ou mudada)
- FKs novas: SEMPRE criar índice correspondente (`CREATE INDEX IF NOT EXISTS`)
- Extensões: usar schema `extensions` (NÃO `public`)
- **Trigger SQL que reage a estado vindo de edge function**: SEMPRE checar o estado **normalizado** que a edge persiste (após `mapXyzStatus()`), nunca o estado cru externo. Pre-flight obrigatório: ler a função de mapeamento da edge antes de escrever WHERE/IF do trigger. Bug em `tr_subscription_payment_expense` (01/05/2026): trigger checava status ASAAS crus (`RECEIVED/CONFIRMED/RECEIVED_IN_CASH`) enquanto edge `mapPaymentStatus()` normaliza tudo para `'PAID'` → trigger nunca disparou em produção (11 mensalidades sumiram do DRE até o fix)
