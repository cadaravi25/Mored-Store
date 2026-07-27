-- Mored Store: permisos para el rol de servidor
--
-- La 008 le dio permisos a `authenticated`, que es lo que usa la aplicación, y
-- se me pasó `service_role`. La app funciona igual, pero cualquier tarea de
-- servidor sin usuaria detrás falla con "permission denied":
--
--   - la consulta diaria de la tasa del BCV
--   - guiones de mantenimiento y respaldo
--   - altas de usuarias en lote
--
-- service_role se salta RLS por diseño. Nunca debe llegar al navegador.

begin;

grant usage on schema public to service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;

commit;
