-- corpo vivo antes da abertura do cardápio para a rede (10/11/2026). Reaplicar = voltar.
CREATE OR REPLACE FUNCTION public.cardapio_horario_ok(p jsonb, p_ini text, p_fim text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(jsonb_typeof(p) = 'array' and exists (
    select 1 from jsonb_array_elements(p) r
     where jsonb_typeof(r->'days') = 'array' and jsonb_array_length(r->'days') > 0
       and coalesce(r->>p_ini, '') ~ '^\d{1,2}:\d{2}$' and coalesce(r->>p_fim, '') ~ '^\d{1,2}:\d{2}$'
       and split_part(r->>p_ini, ':', 1)::int * 60 + split_part(r->>p_ini, ':', 2)::int
           < split_part(r->>p_fim, ':', 1)::int * 60 + split_part(r->>p_fim, ':', 2)::int
       and split_part(r->>p_fim, ':', 1)::int * 60 + split_part(r->>p_fim, ':', 2)::int <= 1440), false)
$function$
;
