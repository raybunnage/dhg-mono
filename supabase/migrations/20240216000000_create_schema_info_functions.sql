-- Create function to get table info
create or replace function public.get_schema_info(schema_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  return (
    select json_object_agg(
      t.table_name,
      json_build_object(
        'columns', (
          select json_agg(
            json_build_object(
              'column_name', c.column_name,
              'data_type', c.data_type,
              'is_nullable', c.is_nullable,
              'column_default', c.column_default
            )
          )
          from information_schema.columns c
          where c.table_name = t.table_name
            and c.table_schema = schema_name
        )
      )
    )
    from information_schema.tables t
    where t.table_schema = schema_name
      and t.table_type = 'BASE TABLE'
  );
end;
$$;

-- Create function to get foreign keys
create or replace function public.get_foreign_keys(schema_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  return (
    select json_object_agg(
      tc.table_name,
      json_agg(
        json_build_object(
          'column_name', kcu.column_name,
          'foreign_table', ccu.table_name,
          'foreign_column', ccu.column_name
        )
      )
    )
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu 
      on tc.constraint_name = kcu.constraint_name
    join information_schema.constraint_column_usage ccu 
      on tc.constraint_name = ccu.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = schema_name
    group by tc.table_name
  );
end;
$$;

-- Create function to get functions
create or replace function public.get_functions(schema_name text)
returns json
language plpgsql
security definer
set search_path = public
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

-- Create function to get triggers
create or replace function public.get_triggers(schema_name text)
returns json
language plpgsql
security definer
set search_path = public
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