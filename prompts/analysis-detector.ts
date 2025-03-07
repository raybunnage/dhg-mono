interface AnalysisTypes {
  needsReactAnalysis: boolean;
  needsEnhancedAnalysis: boolean;
  reasons: string[];
}

// Regular expressions for detecting various patterns
const patterns = {
  reactComponent: /export\s+(?:default\s+)?(?:function|class|const)\s+\w+\s*(?:\([^)]*\)|=)/,
  jsxContent: /<[A-Z][A-Za-z0-9]*|<>/,
  reactHooks: /use[A-Z]\w+\s*\(/,
  businessLogic: /async|await|try|catch|\.then|export\s+(?:async\s+)?function/,
  externalIntegrations: /fetch|axios|supabase|anthropic|\.(get|post|put|delete)\(|new\s+(\w+)Client/i,
  stateManagement: /useState|useReducer|createContext|useContext/,
  propTypes: /PropTypes|interface\s+\w+Props|type\s+\w+Props/,
  effectHooks: /useEffect|useLayoutEffect/
};

function detectFileContent(content: string): AnalysisTypes {
  const result: AnalysisTypes = {
    needsReactAnalysis: false,
    needsEnhancedAnalysis: false,
    reasons: []
  };

  // Check for React Component indicators
  const hasReactComponent = patterns.reactComponent.test(content);
  const hasJSX = patterns.jsxContent.test(content);
  const hasReactHooks = patterns.reactHooks.test(content);
  const hasStateManagement = patterns.stateManagement.test(content);
  const hasPropTypes = patterns.propTypes.test(content);
  const hasEffectHooks = patterns.effectHooks.test(content);

  // Check for Enhanced Analysis indicators
  const hasBusinessLogic = patterns.businessLogic.test(content);
  const hasExternalIntegrations = patterns.externalIntegrations.test(content);

  // Complex scoring system for React analysis
  let reactScore = 0;
  if (hasReactComponent) reactScore += 2;
  if (hasJSX) reactScore += 3;
  if (hasReactHooks) reactScore += 2;
  if (hasStateManagement) reactScore += 2;
  if (hasPropTypes) reactScore += 1;
  if (hasEffectHooks) reactScore += 1;

  // Complex scoring system for Enhanced analysis
  let enhancedScore = 0;
  if (hasBusinessLogic) enhancedScore += 2;
  if (hasExternalIntegrations) enhancedScore += 2;
  // Additional score if the file has a lot of non-JSX code
  const nonJSXLines = content.split('\n').filter(line => !patterns.jsxContent.test(line)).length;
  if (nonJSXLines > 50) enhancedScore += 1;

  // Determine if React analysis is needed
  if (reactScore >= 3) {
    result.needsReactAnalysis = true;
    result.reasons.push(
      'File contains React component patterns:',
      ...[
        hasReactComponent && '- Exports a React component',
        hasJSX && '- Contains JSX syntax',
        hasReactHooks && '- Uses React hooks',
        hasStateManagement && '- Implements state management',
        hasPropTypes && '- Defines prop types/interfaces',
        hasEffectHooks && '- Uses effect hooks'
      ].filter(Boolean)
    );
  }

  // Determine if Enhanced analysis is needed
  if (enhancedScore >= 2) {
    result.needsEnhancedAnalysis = true;
    result.reasons.push(
      'File contains complex business logic:',
      ...[
        hasBusinessLogic && '- Contains business logic functions',
        hasExternalIntegrations && '- Integrates with external services',
        nonJSXLines > 50 && '- Contains significant non-UI code'
      ].filter(Boolean)
    );
  }

  return result;
}

interface FileInfo {
  path: string;
  content: string;
  extension: string;
}

export function determineAnalysisType(file: FileInfo): AnalysisTypes {
  const { content, extension, path } = file;
  
  const result = detectFileContent(content);
  
  // Additional file-based checks
  if (extension === '.tsx' || path.includes('components/')) {
    if (!result.needsReactAnalysis && !result.needsEnhancedAnalysis) {
      // If it's a .tsx file but no clear indicators, default to React analysis
      result.needsReactAnalysis = true;
      result.reasons.push('File is a TypeScript React file (.tsx)');
    }
  }

  // Special case for utility files
  if (
    path.includes('utils/') || 
    path.includes('helpers/') || 
    path.includes('services/')
  ) {
    result.needsEnhancedAnalysis = true;
    result.reasons.push('File is located in a utility/service directory');
  }

  // If no analysis type was determined, default to enhanced analysis
  if (!result.needsReactAnalysis && !result.needsEnhancedAnalysis) {
    result.needsEnhancedAnalysis = true;
    result.reasons.push('Default to enhanced analysis for unclassified files');
  }

  return result;
}

// Example usage in a button handler:
async function analyzeFile(filePath: string) {
  try {
    // Read the file content
    const content = await window.fs.readFile(filePath, { encoding: 'utf8' });
    
    const fileInfo: FileInfo = {
      path: filePath,
      content,
      extension: filePath.split('.').pop() || ''
    };

    const analysisType = determineAnalysisType(fileInfo);
    
    console.log('Analysis determination:', {
      filePath,
      ...analysisType
    });

    // Run appropriate analysis based on determination
    if (analysisType.needsReactAnalysis && analysisType.needsEnhancedAnalysis) {
      // Run both analyses and merge results
      return {
        type: 'combined',
        reactAnalysis: await runReactAnalysis(fileInfo),
        enhancedAnalysis: await runEnhancedAnalysis(fileInfo)
      };
    } else if (analysisType.needsReactAnalysis) {
      return {
        type: 'react',
        analysis: await runReactAnalysis(fileInfo)
      };
    } else {
      return {
        type: 'enhanced',
        analysis: await runEnhancedAnalysis(fileInfo)
      };
    }
  } catch (error) {
    console.error('Error analyzing file:', error);
    throw error;
  }
}

// Example implementation of analysis runners
async function runReactAnalysis(fileInfo: FileInfo) {
  // Implementation would use the React Component Analysis prompt
  // and process the file accordingly
  return { /* analysis results */ };
}

async function runEnhancedAnalysis(fileInfo: FileInfo) {
  // Implementation would use the Enhanced Analysis prompt
  // and process the file accordingly
  return { /* analysis results */ };
}