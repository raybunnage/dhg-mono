-- Function to temporarily disable the foreign key constraint
CREATE OR REPLACE FUNCTION public.update_expert_document_without_fk_check(
  p_expert_doc_id uuid,
  p_document_type_id uuid,
  p_fields jsonb
) RETURNS void AS $$
DECLARE
  current_setting text;
BEGIN
  -- Save current setting
  current_setting := current_setting('session.force_constraint_checks');

  -- Disable constraint checking
  EXECUTE 'SET session.force_constraint_checks = "off"';
  
  -- Update expert_document with the document_type_id field directly
  EXECUTE 'UPDATE expert_documents SET document_type_id = $1, updated_at = NOW() WHERE id = $2'
    USING p_document_type_id, p_expert_doc_id;
  
  -- Update the other fields
  EXECUTE 'UPDATE expert_documents SET ' || 
    (SELECT string_agg(key || ' = $1->' || quote_literal(key), ', ') 
     FROM jsonb_object_keys(p_fields) AS key) ||
    ' WHERE id = $2'
  USING p_fields, p_expert_doc_id;
  
  -- Restore previous setting
  EXECUTE 'SET session.force_constraint_checks = ' || quote_literal(current_setting);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add a constraint-ignoring RPC function
CREATE OR REPLACE FUNCTION public.create_update_function()
RETURNS void AS $$
BEGIN
  -- Create a simpler function that ignores FK constraints temporarily
  EXECUTE $BODY$
  CREATE OR REPLACE FUNCTION public.set_document_type_id_directly(
    p_expert_doc_id uuid,
    p_document_type_id uuid
  ) RETURNS void AS $$
  BEGIN
    -- Directly update the field without checking constraints
    EXECUTE 'ALTER TABLE expert_documents DISABLE TRIGGER ALL';
    
    UPDATE expert_documents 
    SET document_type_id = p_document_type_id,
        updated_at = NOW()
    WHERE id = p_expert_doc_id;
    
    EXECUTE 'ALTER TABLE expert_documents ENABLE TRIGGER ALL';
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  $BODY$;
END;
$$ LANGUAGE plpgsql;

-- Execute the function creation
SELECT create_update_function();