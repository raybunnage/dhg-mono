import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const main = async () => {
  try {
    console.log('Starting Supabase type generation...');
    
    // Get environment variables
    const projectId = process.env.SUPABASE_PROJECT_ID;
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
    
    if (!projectId || !accessToken) {
      throw new Error('Missing required environment variables: SUPABASE_PROJECT_ID or SUPABASE_ACCESS_TOKEN');
    }

    console.log('Executing type generation command...');
    const command = `supabase gen types typescript --project-id ${projectId} --access-token ${accessToken}`;
    
    const types = execSync(command, { encoding: 'utf-8' });
    
    // Ensure supabase directory exists
    const typesPath = path.join(process.cwd(), 'supabase');
    if (!fs.existsSync(typesPath)) {
      fs.mkdirSync(typesPath, { recursive: true });
    }
    
    // Write types file
    fs.writeFileSync(path.join(typesPath, 'types.ts'), types);
    
    console.log('Types generated successfully!');
  } catch (error) {
    console.error('Error generating types:', error);
    process.exit(1);
  }
};

main(); 