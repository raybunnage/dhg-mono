import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

router.get('/api/source-code', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const fullPath = path.join(process.cwd(), filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    res.send(content);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

export default router; 