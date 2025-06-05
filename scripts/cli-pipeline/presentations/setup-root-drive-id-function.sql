-- Create a function to update presentations.root_drive_id
CREATE OR REPLACE FUNCTION update_presentations_root_drive_id(root_id TEXT)
RETURNS VOID AS
$$
BEGIN
  UPDATE presentations 
  SET root_drive_id = root_id
  WHERE root_drive_id IS NULL OR root_drive_id = '';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;