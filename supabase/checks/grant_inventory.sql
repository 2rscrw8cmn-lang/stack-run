-- Read-only application-role grant inventory. This avoids environment-owned
-- roles and compares only the browser/API contract STACK controls.

select 'table' as object_kind,
       concat_ws('.', n.nspname, c.relname) as object_key,
       coalesce(grantee.rolname, 'PUBLIC') as grantee,
       acl.privilege_type,
       acl.is_grantable
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
left join pg_roles grantee on grantee.oid = acl.grantee
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm', 'S')
  and coalesce(grantee.rolname, 'PUBLIC') in ('PUBLIC', 'anon', 'authenticated', 'service_role')

union all

select 'function',
       concat_ws('.', n.nspname, p.proname,
                 pg_get_function_identity_arguments(p.oid)),
       coalesce(grantee.rolname, 'PUBLIC'),
       acl.privilege_type,
       acl.is_grantable
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
left join pg_roles grantee on grantee.oid = acl.grantee
where n.nspname = 'public'
  and coalesce(grantee.rolname, 'PUBLIC') in ('PUBLIC', 'anon', 'authenticated', 'service_role')

order by object_kind, object_key, grantee, privilege_type;
