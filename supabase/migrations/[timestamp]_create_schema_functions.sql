-- Get tables and columns
create or replace function get_schema_info(schema_name text)
returns json
language plpgsql
security definer
as $$
begin
  return (
    select json_object_agg(
      table_name,
      json_build_object(
        'columns', columns,
        'foreign_keys', foreign_keys
      )
    )
    from (
      select 
        t.table_name,
        json_agg(
          json_build_object(
            'column_name', c.column_name,
            'data_type', c.data_type,
            'is_nullable', c.is_nullable,
            'column_default', c.column_default
          )
        ) as columns,
        (
          select json_agg(
            json_build_object(
              'column_name', kcu.column_name,
              'foreign_table', ccu.table_name,
              'foreign_column', ccu.column_name
            )
          )
          from information_schema.table_constraints tc
          join information_schema.key_column_usage kcu 
            on tc.constraint_name = kcu.constraint_name
          join information_schema.constraint_column_usage ccu 
            on tc.constraint_name = ccu.constraint_name
          where tc.constraint_type = 'FOREIGN KEY'
          and tc.table_name = t.table_name
        ) as foreign_keys
      from information_schema.tables t
      join information_schema.columns c 
        on t.table_name = c.table_name
      where t.table_schema = schema_name
      group by t.table_name
    ) subq
  );
end;
$$;

-- Get functions
create or replace function get_functions(schema_name text)
returns json
language plpgsql
security definer
as $$
begin
  return (
    select json_agg(
      json_build_object(
        'function_name', p.proname,
        'definition', pg_get_functiondef(p.oid)
      )
    )
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = schema_name
  );
end;
$$;

-- Get triggers
create or replace function get_triggers(schema_name text)
returns json
language plpgsql
security definer
as $$
begin
  return (
    select json_agg(
      json_build_object(
        'trigger_name', trigger_name,
        'event_manipulation', event_manipulation,
        'event_object_table', event_object_table,
        'action_statement', action_statement
      )
    )
    from information_schema.triggers
    where trigger_schema = schema_name
  );
end;
$$; 