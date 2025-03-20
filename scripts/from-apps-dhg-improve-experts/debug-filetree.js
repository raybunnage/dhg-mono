
async function debugFileTree() {
  const { supabase } = require('../../apps/dhg-improve-experts/src/integrations/supabase/client');
  
  // Get a sample of old records that work
  console.log('FETCHING WORKING RECORDS (ORIGINAL)...');
  const { data: oldRecords, error: oldError } = await supabase
    .from('sources_google')
    .select('id, name, mime_type, path, parent_path, parent_folder_id, is_root, drive_id')
    .limit(3)
    .order('created_at', { ascending: true });
  
  if (oldError) {
    console.error('Error fetching old records:', oldError);
    return;
  }
  
  // Get a sample of new records that don't work
  console.log('
FETCHING NEW RECORDS...');
  const { data: newRecords, error: newError } = await supabase
    .from('sources_google')
    .select('id, name, mime_type, path, parent_path, parent_folder_id, is_root, drive_id')
    .limit(3)
    .order('created_at', { ascending: false });
  
  if (newError) {
    console.error('Error fetching new records:', newError);
    return;
  }
  
  // Log the records for comparison
  console.log('
OLD RECORDS (WORKING):');
  oldRecords.forEach(record => {
    console.log(JSON.stringify(record, null, 2));
  });
  
  console.log('
NEW RECORDS (NOT WORKING):');
  newRecords.forEach(record => {
    console.log(JSON.stringify(record, null, 2));
  });
  
  // Get a root folder that works
  console.log('
FETCHING WORKING ROOT FOLDER...');
  const { data: workingRoot, error: workingRootError } = await supabase
    .from('sources_google')
    .select('id, name, mime_type, path, parent_path, parent_folder_id, is_root, drive_id')
    .eq('is_root', true)
    .order('created_at', { ascending: true })
    .limit(1);
    
  if (workingRootError) {
    console.error('Error fetching working root:', workingRootError);
    return;
  }
  
  // Get a root folder that doesn't work
  console.log('
FETCHING NON-WORKING ROOT FOLDER...');
  const { data: nonWorkingRoot, error: nonWorkingRootError } = await supabase
    .from('sources_google')
    .select('id, name, mime_type, path, parent_path, parent_folder_id, is_root, drive_id')
    .eq('is_root', true)
    .order('created_at', { ascending: false })
    .limit(1);
    
  if (nonWorkingRootError) {
    console.error('Error fetching non-working root:', nonWorkingRootError);
    return;
  }
  
  // For a working root, find a direct child and its path
  if (workingRoot && workingRoot.length > 0) {
    const rootFolder = workingRoot[0];
    console.log('
WORKING ROOT FOLDER:');
    console.log(JSON.stringify(rootFolder, null, 2));
    
    // Find children using parent_path
    console.log('
CHILDREN USING parent_path:');
    const { data: pathChildren } = await supabase
      .from('sources_google')
      .select('id, name, mime_type, path, parent_path, parent_folder_id, is_root')
      .eq('parent_path', rootFolder.path)
      .limit(3);
      
    pathChildren.forEach(child => {
      console.log(JSON.stringify(child, null, 2));
    });
    
    // Find children using parent_folder_id
    console.log('
CHILDREN USING parent_folder_id:');
    const { data: idChildren } = await supabase
      .from('sources_google')
      .select('id, name, mime_type, path, parent_path, parent_folder_id, is_root')
      .eq('parent_folder_id', rootFolder.drive_id)
      .limit(3);
      
    idChildren.forEach(child => {
      console.log(JSON.stringify(child, null, 2));
    });
  }
  
  // For a non-working root, try the same queries
  if (nonWorkingRoot && nonWorkingRoot.length > 0) {
    const rootFolder = nonWorkingRoot[0];
    console.log('
NON-WORKING ROOT FOLDER:');
    console.log(JSON.stringify(rootFolder, null, 2));
    
    // Find children using parent_path
    console.log('
CHILDREN USING parent_path:');
    const { data: pathChildren } = await supabase
      .from('sources_google')
      .select('id, name, mime_type, path, parent_path, parent_folder_id, is_root')
      .eq('parent_path', rootFolder.path)
      .limit(3);
      
    console.log('Count:', pathChildren?.length || 0);
    if (pathChildren && pathChildren.length > 0) {
      pathChildren.forEach(child => {
        console.log(JSON.stringify(child, null, 2));
      });
    } else {
      console.log('No children found using parent_path');
    }
    
    // Find children using parent_folder_id
    console.log('
CHILDREN USING parent_folder_id:');
    const { data: idChildren } = await supabase
      .from('sources_google')
      .select('id, name, mime_type, path, parent_path, parent_folder_id, is_root')
      .eq('parent_folder_id', rootFolder.drive_id)
      .limit(3);
      
    console.log('Count:', idChildren?.length || 0);
    if (idChildren && idChildren.length > 0) {
      idChildren.forEach(child => {
        console.log(JSON.stringify(child, null, 2));
      });
    } else {
      console.log('No children found using parent_folder_id');
    }
  }
}

debugFileTree().catch(console.error);

