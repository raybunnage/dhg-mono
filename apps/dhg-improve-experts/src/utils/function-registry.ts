interface FunctionMetadata {
  name: string;
  description: string;
  status: 'active' | 'deprecated' | 'experimental';
  location: string;
  lastUsed?: string;
  dependencies?: string[];
  example?: string;
}

const functionRegistry: Record<string, FunctionMetadata> = {
  'handleExtractContent': {
    name: 'handleExtractContent',
    description: 'Extracts content from Google Drive documents',
    status: 'active',
    location: 'src/components/SourceButtons.tsx',
    lastUsed: '2024-04-22',
    dependencies: ['mammoth', 'supabase'],
    example: 'handleExtractContent(fileId)'
  },
  // Add other functions...
};

export function getFunctionInfo(functionName: string): FunctionMetadata | undefined {
  return functionRegistry[functionName];
}

export function registerFunction(metadata: Omit<FunctionMetadata, 'name'>) {
  return function <T extends Function>(fn: T): T {
    const name = fn.name;
    functionRegistry[name] = {
      name,
      ...metadata
    };
    return fn;
  };
} 