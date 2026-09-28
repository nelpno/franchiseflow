-- 28/09/2026 — S15.1 · Cron: conferência sem resposta em 48 h fecha como recebida completa.
--
-- ORDEM DE APLICAÇÃO: 1) supabase/2026-09-28-s15-conferir-entrega.sql (cria a função);
--                     2) ESTE arquivo.
-- De hora em hora (minuto 40, fora dos jobs das 11:05/11:10/11:15 UTC): fecha perto das 48 h,
-- nunca até 24 h depois. A função só pega em_rota COM awaiting_since (conferência S15) e usa
-- FOR UPDATE SKIP LOCKED (a franqueada conferindo naquele instante ganha).
-- Idempotente: reaplicar troca o job pelo mesmo.
--
-- ROLLBACK / desligar: select cron.unschedule('s15-entregas-sem-resposta');
-- Conferir (consulta separada):
--   select jobid, jobname, schedule, command, active from cron.job where jobname = 's15-entregas-sem-resposta';
--   -> 1 linha, '40 * * * *', active = true
--   select status, return_message, start_time from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 's15-entregas-sem-resposta')
--    order by start_time desc limit 3;   -- depois da 1ª hora cheia: succeeded, retorno = nº fechado

select cron.unschedule(jobid) from cron.job where jobname = 's15-entregas-sem-resposta';

select cron.schedule(
  's15-entregas-sem-resposta',
  '40 * * * *',
  $$select public.concluir_entregas_sem_resposta(48)$$
);
