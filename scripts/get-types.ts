import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Get environment variables with fallbacks
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Anon Key in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function getTypes() {
  const { data, error } = await supabase.rpc('get_types');
  if (error) throw error;
  return data;
}

getTypes()
  .then(data => {
    fs.writeFileSync('supabase/types.ts', data);
    console.log('Types generated successfully!');
  })
  .catch(err => {
    console.error('Error generating types:', err);
    process.exit(1);
  }); 