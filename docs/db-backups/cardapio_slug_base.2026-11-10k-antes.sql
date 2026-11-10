-- corpo vivo antes da abertura do cardápio para a rede (10/11/2026). Reaplicar = voltar.
CREATE OR REPLACE FUNCTION public.cardapio_slug_base(p_nome text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  s text;
  t text[];
  saida text[] := '{}';
  w text;
  i int;
begin
  s := lower(extensions.unaccent(coalesce(p_nome, '')));
  s := regexp_replace(s, '^\s*maxi\s+massas\s*', '');
  s := regexp_replace(s, '[^a-z0-9.]+', ' ', 'g');
  t := regexp_split_to_array(btrim(s), '\s+');
  for i in 1 .. coalesce(array_length(t, 1), 0) loop
    w := t[i];
    if w in ('jd.', 'jd') then
      if i = 1 then saida := saida || 'jardim'::text; end if;
      continue;
    end if;
    w := case w
           when 'sto.' then 'santo' when 'sto' then 'santo' when 'sta.' then 'santa' when 'sta' then 'santa'
           when 'vl.' then 'vila' when 'vl' then 'vila' when 'v.' then 'vila' when 'pq.' then 'parque' when 'pq' then 'parque'
           when 'eng.' then 'engenheiro' when 'res.' then 'residencial' when 'jd' then 'jardim'
           else w end;
    w := replace(w, '.', '');
    if w <> '' then saida := saida || w; end if;
  end loop;
  -- até 40 caracteres, cortando em palavra inteira
  while array_length(saida, 1) > 1 and length(array_to_string(saida, '-')) > 40 loop
    saida := saida[1 : array_length(saida, 1) - 1];
  end loop;
  s := left(array_to_string(saida, '-'), 40);
  s := regexp_replace(s, '-+$', '');
  if length(s) < 2 then s := 'unidade'; end if;
  return s;
end;
$function$
;
