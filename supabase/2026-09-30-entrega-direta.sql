-- 30/09/2026 — Entrega direta: "entregue" da fábrica fecha o pedido na hora
--
-- Decisão do Nelson (30/09): ele já confere a entrega com o motorista, então marcar "entregue"
-- sobe direto (estoque e despesa entram na hora), sem esperar a unidade conferir. Menos atrito.
-- Substitui a decisão de 28/09 (S15.1: a franqueada confirma o que chegou).
--
-- O que muda: em s15_guard_conferencia, o desvio entregue -> em_rota deixa de seguir a chave
-- ui_v2 (ligada na rede) e passa a seguir a chave própria `conferir_entrega`, que NÃO existe em
-- feature_flags = desligada. Todo o resto da função fica igual (entregue terminal, colunas
-- protegidas, franqueada só cancela pendente). A RPC confirmar_recebimento_pedido, o cron de
-- 48 h e o card "Seu pedido chegou" seguem no lugar, sem nada para fazer (0 pedidos em em_rota).
--
-- Medido antes (30/09): md5(prosrc) = d66052a7bbba300c3935b2d77770b1d4, 1 ocorrência do trecho,
-- 0 pedidos em 'em_rota'. Se o corpo mudou, o bloco aborta sem alterar nada.
-- Backup do corpo vivo: docs/db-backups/s15_guard_conferencia.2026-09-30-antes.sql
--
-- VOLTAR a conferência pela unidade, sem deploy (rede ou uma unidade):
--   select public.set_feature_flag('conferir_entrega', null, true, 'conferência da entrega de volta');
--   select public.set_feature_flag('conferir_entrega', '<evo>', true, '<motivo>');
-- ROLLBACK completo: node supabase/cs-cockpit/_aplica-lf.mjs docs/db-backups/s15_guard_conferencia.2026-09-30-antes.sql
--
-- Aplicar: node supabase/cs-cockpit/_aplica-lf.mjs supabase/2026-09-30-entrega-direta.sql
-- Conferir depois (consulta separada):
--   select position('conferir_entrega' in prosrc) > 0 nova, position('''ui_v2''' in prosrc) > 0 velha,
--          position(E'\r' in prosrc) cr, prosecdef, proconfig from pg_proc where proname = 's15_guard_conferencia';
--   -> nova=true, velha=false, cr=0, prosecdef=true, search_path=public.

do $entrega$
declare
  v_oid  oid := 'public.s15_guard_conferencia()'::regprocedure;
  v_def  text;
  v_de   text := $$feature_flag_enabled('ui_v2', new.franchise_id)$$;
  v_para text := $$feature_flag_enabled('conferir_entrega', new.franchise_id)$$;
begin
  if (select md5(prosrc) from pg_proc where oid = v_oid) <> 'd66052a7bbba300c3935b2d77770b1d4' then
    raise exception 'ENTREGA_DIRETA: s15_guard_conferencia mudou desde 30/09; conferir antes de aplicar.';
  end if;
  v_def := pg_get_functiondef(v_oid);
  if (length(v_def) - length(replace(v_def, v_de, ''))) / length(v_de) <> 1 then
    raise exception 'ENTREGA_DIRETA: trecho da chave não encontrado uma única vez.';
  end if;
  execute replace(v_def, v_de, v_para);
end;
$entrega$;

revoke all on function public.s15_guard_conferencia() from public, anon, authenticated;
