-- Read-only per-function fingerprints for reviewing live drift.

select concat_ws('.', n.nspname, p.proname,
                 pg_get_function_identity_arguments(p.oid)) as object_key,
       md5(pg_get_functiondef(p.oid)) as exact_hash,
       md5(
         regexp_replace(
           regexp_replace(
             regexp_replace(p.prosrc, E'--[^\\n\\r]*', '', 'g'),
             E'\\mas\\M', '', 'gi'
           ),
           E'\\s+', '', 'g'
         )
         || chr(31)
         || concat_ws('|', p.prolang, p.provolatile, p.prosecdef,
                      p.proleakproof, p.proisstrict, p.proretset,
                      p.proparallel, coalesce(array_to_string(p.proconfig, ','), ''))
       ) as review_hash
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by object_key;
