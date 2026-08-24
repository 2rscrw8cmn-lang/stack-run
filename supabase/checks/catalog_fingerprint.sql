-- Read-only catalog fingerprint for comparing STACK schemas.
-- Function bodies are hashed exactly; formatting-only differences will appear
-- and must be reviewed rather than silently normalized away.

with objects(category, object_key, definition) as (
  select 'tables',
         c.oid::regclass::text,
         concat_ws('|', c.relkind, c.relrowsecurity, c.relforcerowsecurity)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'S')

  union all
  select 'columns',
         concat_ws('.', table_schema, table_name, lpad(ordinal_position::text, 4, '0'), column_name),
         concat_ws('|', data_type, udt_schema, udt_name, is_nullable,
                   coalesce(column_default, ''), coalesce(is_identity, 'NO'),
                   coalesce(identity_generation, ''), coalesce(is_generated, 'NEVER'),
                   coalesce(generation_expression, ''))
  from information_schema.columns
  where table_schema = 'public'

  union all
  select 'constraints',
         concat_ws('.', n.nspname, c.relname, con.conname),
         concat_ws('|', con.contype, pg_get_constraintdef(con.oid, true),
                   con.condeferrable, con.condeferred, con.convalidated)
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'

  union all
  select 'indexes',
         concat_ws('.', schemaname, tablename, indexname),
         indexdef
  from pg_indexes
  where schemaname = 'public'

  union all
  select 'functions',
         concat_ws('.', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
         pg_get_functiondef(p.oid)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'

  union all
  select 'triggers',
         concat_ws('.', n.nspname, c.relname, t.tgname),
         pg_get_triggerdef(t.oid, true)
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and not t.tgisinternal

  union all
  select 'policies',
         concat_ws('.', n.nspname, c.relname, p.polname),
         concat_ws('|', p.polpermissive, p.polcmd,
                   array_to_string(p.polroles::regrole[], ','),
                   coalesce(pg_get_expr(p.polqual, p.polrelid), ''),
                   coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''))
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'

  union all
  select 'views',
         concat_ws('.', n.nspname, c.relname),
         pg_get_viewdef(c.oid, true)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('v', 'm')

  union all
  select 'types',
         concat_ws('.', n.nspname, t.typname, coalesce(e.enumsortorder::text, '')),
         concat_ws('|', t.typtype, t.typcategory, coalesce(e.enumlabel, ''))
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  left join pg_enum e on e.enumtypid = t.oid
  where n.nspname = 'public'
    and t.typtype in ('e', 'd')

  union all
  select 'table_grants',
         concat_ws('.', n.nspname, c.relname, coalesce(grantee.rolname, 'PUBLIC'), acl.privilege_type),
         acl.is_grantable::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
  left join pg_roles grantee on grantee.oid = acl.grantee
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'S')
    and coalesce(grantee.rolname, 'PUBLIC') in ('PUBLIC', 'anon', 'authenticated', 'service_role')

  union all
  select 'routine_grants',
         concat_ws('.', n.nspname, p.proname,
                   pg_get_function_identity_arguments(p.oid),
                   coalesce(grantee.rolname, 'PUBLIC'), acl.privilege_type),
         acl.is_grantable::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
  left join pg_roles grantee on grantee.oid = acl.grantee
  where n.nspname = 'public'
    and coalesce(grantee.rolname, 'PUBLIC') in ('PUBLIC', 'anon', 'authenticated', 'service_role')
)
select category,
       count(*) as object_count,
       md5(string_agg(object_key || chr(31) || definition,
                      chr(30) order by object_key)) as fingerprint
from objects
group by category
order by category;
