// Base interfaces for analysis results
interface BaseAnalysisResult {
  timestamp: string;
  filePath: string;
  fileInfo: {
    size: number;
    lastModified: string;
    extension: string;
  };
}

interface ReactAnalysisResult extends BaseAnalysisResult {
  componentAnalysis: {
    name: string;
    type: 'function' | 'class' | 'hoc';
    props: {
      name: string;
      type: string;
      required: boolean;
      defaultValue?: any;
    }[];
    hooks: {
      name: string;
      type: string;
      purpose: string;
      dependencies?: string[];
    }[];
    lifecycle: {
      mounting: string[];
      updates: string[];
      cleanup: string[];
    };
    stateManagement: {
      localState: {
        name: string;
        type: string;
        initialValue: any;
      }[];
      contextUsage: {
        name: string;
        consumed: string[];
        provided: string[];
      }[];
    };
  };
}

interface EnhancedAnalysisResult extends BaseAnalysisResult {
  codeAnalysis: {
    functions: {
      name: string;
      type: 'async' | 'sync' | 'generator';
      complexity: 'low' | 'medium' | 'high';
      dependencies: string[];
      usageLocations: string[];
    }[];
    integrations: {
      type: string;
      purpose: string;
      usage: {
        location: string;
        purpose: string;
      }[];
    }[];
    errorHandling: {
      strategies: {
        type: string;
        location: string;
        handling: string;
      }[];
    };
  };
}

interface CombinedAnalysisResult extends BaseAnalysisResult {
  react: ReactAnalysisResult['componentAnalysis'];
  enhanced: EnhancedAnalysisResult['codeAnalysis'];
}

// Types for the analysis response
type AnalysisType = 'react' | 'enhanced' | 'combined';

interface AnalysisResponse {
  type: AnalysisType;
  result: ReactAnalysisResult | EnhancedAnalysisResult | CombinedAnalysisResult;
  reasons: string[];
  metadata: {
    analysisTime: number;
    prompts: {
      type: string;
      purpose: string;
    }[];
  };
}

// Error interfaces
interface AnalysisError {
  code: string;
  message: string;
  details?: {
    phase: 'preparation' | 'analysis' | 'processing';
    location?: string;
    suggestion?: string;
  };
}

// Props interface for the button component
interface FileAnalysisButtonProps {
  filePath: string;
  onAnalysisComplete?: (result: AnalysisResponse) => void;
  onError?: (error: AnalysisError) => void;
  className?: string;
  options?: {
    automaticRetry?: boolean;
    maxRetries?: number;
    analysisTimeout?: number;
  };
}

export type {
  BaseAnalysisResult,
  ReactAnalysisResult,
  EnhancedAnalysisResult,
  CombinedAnalysisResult,
  AnalysisType,
  AnalysisResponse,
  AnalysisError,
  FileAnalysisButtonProps
};