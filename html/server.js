const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for all origins (for development)
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname)));

// Base path for the repository
const BASE_PATH = path.resolve(__dirname, '..');

// API endpoint to list directory contents
app.post('/api/list-directory', async (req, res) => {
    try {
        const { dirPath = '' } = req.body;
        const fullPath = path.join(BASE_PATH, dirPath);
        
        // Security check - ensure we're within the base path
        if (!fullPath.startsWith(BASE_PATH)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const items = await fs.readdir(fullPath, { withFileTypes: true });
        
        const result = await Promise.all(
            items.map(async (item) => {
                const itemPath = path.join(fullPath, item.name);
                let type = item.isDirectory() ? 'directory' : 'file';
                let size = 0;
                
                if (type === 'file') {
                    try {
                        const stats = await fs.stat(itemPath);
                        size = stats.size;
                    } catch (e) {
                        // Ignore stat errors
                    }
                }
                
                return {
                    name: item.name,
                    type,
                    size,
                    path: path.relative(BASE_PATH, itemPath)
                };
            })
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to get file content
app.post('/api/read-file', async (req, res) => {
    try {
        const { filePath } = req.body;
        const fullPath = path.join(BASE_PATH, filePath);
        
        // Security check
        if (!fullPath.startsWith(BASE_PATH)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const content = await fs.readFile(fullPath, 'utf-8');
        res.json({ content });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to search files
app.post('/api/search-files', async (req, res) => {
    try {
        const { searchTerm, searchPath = '' } = req.body;
        const fullPath = path.join(BASE_PATH, searchPath);
        
        if (!fullPath.startsWith(BASE_PATH)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const results = [];
        await searchFiles(fullPath, searchTerm.toLowerCase(), results, BASE_PATH);
        
        res.json(results.slice(0, 100)); // Limit to 100 results
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function searchFiles(dir, searchTerm, results, basePath) {
    try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            
            // Skip node_modules and .git directories
            if (item.name === 'node_modules' || item.name === '.git') {
                continue;
            }
            
            if (item.name.toLowerCase().includes(searchTerm)) {
                results.push({
                    name: item.name,
                    type: item.isDirectory() ? 'directory' : 'file',
                    path: path.relative(basePath, fullPath)
                });
            }
            
            if (item.isDirectory() && results.length < 100) {
                await searchFiles(fullPath, searchTerm, results, basePath);
            }
        }
    } catch (error) {
        // Ignore errors (e.g., permission denied)
    }
}

app.listen(PORT, () => {
    console.log(`File browser server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT}/file-browser.html in your browser`);
});