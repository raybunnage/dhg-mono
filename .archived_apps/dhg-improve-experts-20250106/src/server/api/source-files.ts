import fs from 'fs/promises';
import path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');

async function getFiles(dir: string): Promise<any[]> {
  console.log(`📂 Reading directory: ${dir}`);
  const files = await fs.readdir(dir);
  console.log(`📑 Found ${files.length} files/directories in ${dir}`);
  
  const fileInfos = await Promise.all(
    files.map(async file => {
      const filePath = path.join(dir, file);
      console.log(`   Checking: ${filePath}`);
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        console.log(`   📁 Directory found: ${filePath}`);
        return getFiles(filePath);
      } else {
        if (file.match(/\.(ts|tsx|js|jsx)$/)) {
          console.log(`   📄 Source file found: ${filePath}`);
          const content = await fs.readFile(filePath, 'utf-8');
          return [{
            path: filePath.replace(SRC_DIR + path.sep, ''),
            lastModified: stats.mtime.toISOString(),
            content,
            size: stats.size
          }];
        }
        console.log(`   ⏭️  Skipping non-source file: ${filePath}`);
        return [];
      }
    })
  );
  
  const result = fileInfos.flat();
  console.log(`📊 Processed ${result.length} source files in ${dir}`);
  return result;
}

export async function handler(req, res) {
  console.log('🎯 API Route called: /api/source-files');
  try {
    console.log('🔍 Starting file scan...');
    const files = await getFiles(SRC_DIR);
    console.log(`✅ Scan complete. Found ${files.length} source files`);
    
    // Proper response handling
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ files }));
  } catch (error) {
    console.error('❌ Error in API route:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: error.message,
      stack: error.stack,
      details: {
        srcDir: SRC_DIR,
        exists: await fs.access(SRC_DIR).then(() => true).catch(() => false)
      }
    }));
  }
} 