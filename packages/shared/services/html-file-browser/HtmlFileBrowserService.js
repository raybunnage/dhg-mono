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
exports.HtmlFileBrowserService = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class HtmlFileBrowserService {
    static instance;
    basePath;
    excludedDirs;
    constructor() {
        // Default to project root
        this.basePath = path.resolve(process.cwd());
        this.excludedDirs = new Set(['node_modules', '.git', '.next', 'dist', 'build']);
    }
    static getInstance() {
        if (!HtmlFileBrowserService.instance) {
            HtmlFileBrowserService.instance = new HtmlFileBrowserService();
        }
        return HtmlFileBrowserService.instance;
    }
    /**
     * Configure the service
     */
    configure(options) {
        if (options.basePath) {
            this.basePath = path.resolve(options.basePath);
        }
        if (options.excludeDirs) {
            this.excludedDirs = new Set(options.excludeDirs);
        }
    }
    /**
     * Get the base path
     */
    getBasePath() {
        return this.basePath;
    }
    /**
     * Validate that a path is within the base path
     */
    validatePath(requestedPath) {
        const fullPath = path.join(this.basePath, requestedPath);
        // Ensure the resolved path is within the base path
        if (!fullPath.startsWith(this.basePath)) {
            throw new Error('Access denied: Path outside of base directory');
        }
        return fullPath;
    }
    /**
     * List directory contents
     */
    async listDirectory(dirPath = '') {
        const fullPath = this.validatePath(dirPath);
        try {
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
                    // Ignore stat errors (e.g., broken symlinks)
                }
                return {
                    name: item.name,
                    type,
                    size,
                    mtime,
                    path: path.relative(this.basePath, itemPath)
                };
            }));
            // Sort by modification time (most recent first)
            return this.sortFileItems(result);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Directory not found: ${dirPath}`);
            }
            if (error.code === 'ENOTDIR') {
                throw new Error(`Not a directory: ${dirPath}`);
            }
            if (error.code === 'EACCES') {
                throw new Error(`Permission denied: ${dirPath}`);
            }
            throw error;
        }
    }
    /**
     * Read file content
     */
    async readFile(filePath) {
        const fullPath = this.validatePath(filePath);
        try {
            const content = await fs.readFile(fullPath, 'utf-8');
            return content;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`File not found: ${filePath}`);
            }
            if (error.code === 'EISDIR') {
                throw new Error(`Cannot read directory: ${filePath}`);
            }
            if (error.code === 'EACCES') {
                throw new Error(`Permission denied: ${filePath}`);
            }
            throw error;
        }
    }
    /**
     * Search for files
     */
    async searchFiles(searchTerm, options = {}) {
        const { searchPath = '', maxResults = 100, excludeDirs = Array.from(this.excludedDirs) } = options;
        const fullPath = this.validatePath(searchPath);
        const results = [];
        const searchTermLower = searchTerm.toLowerCase();
        await this.searchRecursive(fullPath, searchTermLower, results, maxResults, new Set(excludeDirs));
        return results;
    }
    /**
     * Recursive search implementation
     */
    async searchRecursive(dir, searchTerm, results, maxResults, excludeDirs) {
        if (results.length >= maxResults) {
            return;
        }
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                if (results.length >= maxResults) {
                    break;
                }
                const fullPath = path.join(dir, item.name);
                // Skip excluded directories
                if (item.isDirectory() && excludeDirs.has(item.name)) {
                    continue;
                }
                // Check if name matches search term
                if (item.name.toLowerCase().includes(searchTerm)) {
                    let size = 0;
                    let mtime = null;
                    try {
                        const stats = await fs.stat(fullPath);
                        size = stats.size;
                        mtime = stats.mtime;
                    }
                    catch (e) {
                        // Ignore stat errors
                    }
                    results.push({
                        name: item.name,
                        type: item.isDirectory() ? 'directory' : 'file',
                        size,
                        mtime,
                        path: path.relative(this.basePath, fullPath)
                    });
                }
                // Recurse into directories
                if (item.isDirectory() && results.length < maxResults) {
                    await this.searchRecursive(fullPath, searchTerm, results, maxResults, excludeDirs);
                }
            }
        }
        catch (error) {
            // Ignore errors (e.g., permission denied)
            console.debug(`Search error in ${dir}:`, error);
        }
    }
    /**
     * Sort file items
     */
    sortFileItems(items) {
        return items.sort((a, b) => {
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
    /**
     * Get file/directory stats
     */
    async getStats(filePath) {
        const fullPath = this.validatePath(filePath);
        try {
            const stats = await fs.stat(fullPath);
            return {
                exists: true,
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile(),
                size: stats.size,
                mtime: stats.mtime
            };
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return {
                    exists: false,
                    isDirectory: false,
                    isFile: false,
                    size: 0,
                    mtime: null
                };
            }
            throw error;
        }
    }
}
exports.HtmlFileBrowserService = HtmlFileBrowserService;
//# sourceMappingURL=HtmlFileBrowserService.js.map