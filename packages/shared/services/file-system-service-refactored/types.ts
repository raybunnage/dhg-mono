/**
 * File System Service Types
 */

export interface FileMetadata {
  path: string;
  name: string;
  size: number;
  mtime: Date;
  isDirectory: boolean;
  hash?: string;
}

export interface WalkOptions {
  includeDirectories?: boolean;
  excludePatterns?: RegExp[];
  maxDepth?: number;
  followSymlinks?: boolean;
  onProgress?: (path: string, filesInFolder: number) => void;
  parallelism?: number;
}

export interface HashOptions {
  algorithm?: 'sha256' | 'md5' | 'sha1';
  encoding?: 'hex' | 'base64';
}

export interface FileSystemServiceConfig {
  defaultMaxDepth?: number;
  defaultParallelism?: number;
  progressUpdateInterval?: number;
}

export interface FileSystemServiceMetrics {
  totalOperations: number;
  filesHashed: number;
  directoriesWalked: number;
  filesFound: number;
  errors: number;
  lastOperationTime?: Date;
  averageHashTime?: number;
  averageWalkTime?: number;
}