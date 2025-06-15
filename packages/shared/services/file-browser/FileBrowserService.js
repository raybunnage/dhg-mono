"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileBrowserService = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class FileBrowserService {
    basePath;
    constructor(basePath) {
        // Default to repository root
        this.basePath = basePath || path.resolve(__dirname, '../../../../..');
    }
    /**
     * List directory contents with security checks
     */
    async listDirectory(options = {}) {
        const { dirPath = '', sortByDate = true } = options;
        const fullPath = path.join(this.basePath, dirPath);
        // Security check - ensure we're within the base path
        if (!fullPath.startsWith(this.basePath)) {
            throw new Error('Access denied: Path outside base directory');
        }
        const items = await fs.readdir(fullPath, { withFileTypes: true });
        const result = await Promise.all(items.map(async (item) => {
            const itemPath = path.join(fullPath, item.name);
            let type = item.isDirectory() ? 'directory' : 'file';
            let size = 0;
            let mtime = null;
            try {
                const stats = await fs.stat(itemPath);
                size = stats.size;
                mtime = stats.mtime;
            }
            catch (e) {
                // Ignore stat errors (permissions, broken links, etc.)
            }
            return {
                name: item.name,
                type,
                size,
                mtime,
                path: path.relative(this.basePath, itemPath)
            };
        }));
        if (sortByDate) {
            // Sort by modification time (most recent first)
            result.sort((a, b) => {
                // Directories first, then files
                if (a.type === 'directory' && b.type !== 'directory')
                    return -1;
                if (a.type !== 'directory' && b.type === 'directory')
                    return 1;
                // Within same type, sort by modification time (most recent first)
                if (a.mtime && b.mtime) {
                    return b.mtime.getTime() - a.mtime.getTime();
                }
                // Fallback to alphabetical if no mtime
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            });
        }
        return result;
    }
    /**
     * Read file content with security checks
     */
    async readFile(filePath) {
        const fullPath = path.join(this.basePath, filePath);
        // Security check
        if (!fullPath.startsWith(this.basePath)) {
            throw new Error('Access denied: Path outside base directory');
        }
        const content = await fs.readFile(fullPath, 'utf-8');
        return content;
    }
    /**
     * Search for files by name
     */
    async searchFiles(options) {
        const { searchTerm, searchPath = '', maxResults = 100 } = options;
        const fullPath = path.join(this.basePath, searchPath);
        if (!fullPath.startsWith(this.basePath)) {
            throw new Error('Access denied: Path outside base directory');
        }
        const results = [];
        await this.searchFilesRecursive(fullPath, searchTerm.toLowerCase(), results, maxResults);
        return results.slice(0, maxResults);
    }
    /**
     * Recursive file search helper
     */
    async searchFilesRecursive(dir, searchTerm, results, maxResults) {
        if (results.length >= maxResults)
            return;
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                // Skip node_modules, .git, and other common large directories
                if (['node_modules', '.git', '.next', 'dist', 'build'].includes(item.name)) {
                    continue;
                }
                if (item.name.toLowerCase().includes(searchTerm)) {
                    results.push({
                        name: item.name,
                        type: item.isDirectory() ? 'directory' : 'file',
                        size: 0,
                        mtime: null,
                        path: path.relative(this.basePath, fullPath)
                    });
                }
                if (item.isDirectory() && results.length < maxResults) {
                    await this.searchFilesRecursive(fullPath, searchTerm, results, maxResults);
                }
            }
        }
        catch (error) {
            // Ignore errors (e.g., permission denied)
        }
    }
    /**
     * Get statistics about a path
     */
    async getPathStats(filePath) {
        const fullPath = path.join(this.basePath, filePath);
        if (!fullPath.startsWith(this.basePath)) {
            throw new Error('Access denied: Path outside base directory');
        }
        return await fs.stat(fullPath);
    }
    /**
     * Check if a path exists
     */
    async pathExists(filePath) {
        const fullPath = path.join(this.basePath, filePath);
        if (!fullPath.startsWith(this.basePath)) {
            return false;
        }
        try {
            await fs.access(fullPath);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.FileBrowserService = FileBrowserService;
//# sourceMappingURL=FileBrowserService.js.map