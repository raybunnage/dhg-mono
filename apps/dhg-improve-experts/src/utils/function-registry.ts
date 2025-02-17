interface FunctionMetadata {
  name: string;
  description: string;
  status: 'active' | 'deprecated' | 'experimental';
  location: string;
  category: string;
  dependencies?: string[];
  usedIn?: string[];
  targetPackage?: string;
  notes?: string;
}

// Add debug utility
const debug = {
  log: (stage: string, data: any) => {
    console.log('🔍 DEBUG:', `[Function Registry][${stage}]`, data);
  },
  error: (stage: string, error: any) => {
    console.error(`[Function Registry][${stage}] Error:`, {
      message: error.message,
      cause: error.cause,
      stack: error.stack,
      details: error
    });
  }
};

class FunctionRegistryService {
  private registry: Record<string, FunctionMetadata> = {};

  register(name: string, metadata: Omit<FunctionMetadata, 'name'>) {
    try {
      debug.log('register', { name, metadata });
      
      if (this.registry[name]) {
        debug.log('duplicate', { name, existing: this.registry[name] });
        console.warn(`Function ${name} is already registered. Skipping duplicate registration.`);
        return;
      }

      this.registry[name] = {
        name,
        ...metadata
      };
      
      debug.log('registered', { name, result: this.registry[name] });
    } catch (error) {
      debug.error('register', error);
      throw error;
    }
  }

  getAll(): FunctionMetadata[] {
    return Object.values(this.registry);
  }

  get(name: string): FunctionMetadata | undefined {
    return this.registry[name];
  }

  getByCategory(category: string): FunctionMetadata[] {
    return Object.values(this.registry).filter(fn => fn.category === category);
  }
}

export const functionRegistry = new FunctionRegistryService();

// Register all functions here instead of separate files
functionRegistry.register('processDocumentWithAI', {
  description: 'Main entry point for AI document processing',
  status: 'experimental',
  location: 'src/utils/ai-processing.ts',
  category: 'AI_PROCESSING',
  dependencies: ['anthropic', 'supabase'],
  usedIn: ['SourceButtons'],
  targetPackage: 'ai-processing',
  notes: 'Uses Claude API for content extraction and analysis'
});

// ... add other function registrations here

export const categories = [
  'all',
  'CONTENT_EXTRACTION',
  'GOOGLE_DRIVE',
  'GOOGLE_AUTH',
  'AI_PROCESSING',
  'BATCH_PROCESSING',
  'ERROR_HANDLING',
  'UI_INTERACTION',
  'DATA_MANAGEMENT',
  'FILE_OPERATIONS',
  'METADATA',
  'CONTENT_ANALYSIS',
  'AUDIO_PROCESSING',
  'UI_RENDERING',
  'DATA_TRANSFORMATION'
];

export function getFunctionInfo(name: string) {
  return functionRegistry.get(name);
}

export function getAllFunctions() {
  return functionRegistry.getAll();
}