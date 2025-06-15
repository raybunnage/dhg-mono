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
exports.DocsArchiveService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
class DocsArchiveService {
    static instance;
    projectRoot;
    archivedFolder = '.archive_docs';
    allowedExtensions = ['.md', '.txt', '.markdown'];
    constructor() {
        // Default to project root (4 levels up from this service)
        this.projectRoot = path.resolve(__dirname, '../../../..');
    }
    static getInstance() {
        if (!DocsArchiveService.instance) {
            DocsArchiveService.instance = new DocsArchiveService();
        }
        return DocsArchiveService.instance;
    }
    /**
     * Configure the service
     */
    configure(options) {
        if (options.projectRoot) {
            this.projectRoot = path.resolve(options.projectRoot);
        }
    }
    /**
     * Validate file extension
     */
    validateExtension(filePath) {
        return this.allowedExtensions.some(ext => filePath.endsWith(ext));
    }
    /**
     * Get document file content
     */
    async getDocFile(filePath) {
        const normalizedPath = path.normalize(filePath);
        // Validate extension
        if (!this.validateExtension(normalizedPath)) {
            throw new Error(`Only document files allowed (${this.allowedExtensions.join(', ')})`);
        }
        // Try multiple locations
        const possiblePaths = [
            path.join(this.projectRoot, normalizedPath),
            path.join(this.projectRoot, 'docs', normalizedPath),
            path.join(this.projectRoot, 'scripts', normalizedPath),
            path.join(this.projectRoot, 'scripts/cli-pipeline', normalizedPath)
        ];
        // Try to find the file
        for (const tryPath of possiblePaths) {
            try {
                if (fs.existsSync(tryPath)) {
                    const content = fs.readFileSync(tryPath, 'utf8');
                    const fileName = path.basename(tryPath);
                    const stats = fs.statSync(tryPath);
                    return {
                        file_path: normalizedPath,
                        title: fileName,
                        content,
                        size: stats.size,
                        created_at: stats.birthtime,
                        updated_at: stats.mtime
                    };
                }
            }
            catch (error) {
                console.error(`Error reading ${tryPath}:`, error);
            }
        }
        throw new Error(`File not found: ${normalizedPath}`);
    }
    /**
     * List all document files
     */
    async listDocFiles() {
        try {
            // Build find command with exclusions - search the entire project for docs
            const extensions = this.allowedExtensions.map(ext => `-name "*${ext}"`).join(' -o ');
            const cmd = `find ${this.projectRoot} \\( ${extensions} \\) -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/${this.archivedFolder}/*" -not -path "*/dist/*" -not -path "*/build/*" | head -300`;
            console.log(`Executing find command: ${cmd}`);
            const output = (0, child_process_1.execSync)(cmd, { encoding: 'utf8' }).trim();
            const files = output.split('\n').filter(Boolean);
            // Normalize paths
            const relativePaths = files.map(f => f.replace(this.projectRoot + '/', ''));
            return {
                total: relativePaths.length,
                files: relativePaths
            };
        }
        catch (error) {
            console.error('Error listing document files:', error);
            throw new Error(`Error listing document files: ${error.message}`);
        }
    }
    /**
     * Archive a document file
     */
    async archiveDocFile(filePath) {
        const normalizedPath = path.normalize(filePath);
        // Validate extension
        if (!this.validateExtension(normalizedPath)) {
            throw new Error(`Only document files allowed (${this.allowedExtensions.join(', ')})`);
        }
        // Try multiple locations
        const possiblePaths = [
            path.join(this.projectRoot, normalizedPath),
            path.join(this.projectRoot, 'docs', normalizedPath),
            path.join(this.projectRoot, 'scripts', normalizedPath),
            path.join(this.projectRoot, 'scripts/cli-pipeline', normalizedPath)
        ];
        // Try to find and archive the file
        for (const tryPath of possiblePaths) {
            if (fs.existsSync(tryPath)) {
                console.log(`Found file to archive: ${tryPath}`);
                // Create archive directory path based on the original location
                const originalDirname = path.dirname(tryPath);
                const archiveDirPath = path.join(originalDirname, this.archivedFolder);
                // Make sure the archive directory exists
                if (!fs.existsSync(archiveDirPath)) {
                    fs.mkdirSync(archiveDirPath, { recursive: true });
                    console.log(`Created archive directory: ${archiveDirPath}`);
                }
                // Create the new path for the archived file
                const filename = path.basename(tryPath);
                const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
                const archivedFilename = `${path.parse(filename).name}.${timestamp}${path.extname(filename)}`;
                const archivedFilePath = path.join(archiveDirPath, archivedFilename);
                // Move the file to the archived location
                fs.renameSync(tryPath, archivedFilePath);
                // Generate the new path for database update (relative to project root)
                const relativeNewPath = path.relative(this.projectRoot, archivedFilePath);
                return {
                    success: true,
                    originalPath: normalizedPath,
                    archivedPath: relativeNewPath
                };
            }
        }
        throw new Error(`File not found: ${normalizedPath}`);
    }
    /**
     * Delete a document file (permanent deletion)
     */
    async deleteDocFile(filePath) {
        const normalizedPath = path.normalize(filePath);
        // Validate extension
        if (!this.validateExtension(normalizedPath)) {
            throw new Error(`Only document files allowed (${this.allowedExtensions.join(', ')})`);
        }
        // Try multiple locations
        const possiblePaths = [
            path.join(this.projectRoot, normalizedPath),
            path.join(this.projectRoot, 'docs', normalizedPath),
            path.join(this.projectRoot, 'scripts', normalizedPath),
            path.join(this.projectRoot, 'scripts/cli-pipeline', normalizedPath)
        ];
        // Try to find and delete the file
        for (const tryPath of possiblePaths) {
            if (fs.existsSync(tryPath)) {
                console.log(`Found file to delete: ${tryPath}`);
                // Delete the file
                fs.unlinkSync(tryPath);
                return {
                    success: true,
                    message: `Document file deleted: ${normalizedPath}`
                };
            }
        }
        throw new Error(`File not found: ${normalizedPath}`);
    }
}
exports.DocsArchiveService = DocsArchiveService;
//# sourceMappingURL=DocsArchiveService.js.map