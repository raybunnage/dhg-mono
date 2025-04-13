import { useState, useEffect } from 'react';
import { processUnextractedDocuments, abortProcessing, getCurrentPrompt } from '@/utils/document-processing';

const COMPONENT_VERSION = '1.0.0';

interface ProcessingControlsProps {
  onProcess: () => Promise<void>;
  onAbort?: () => void;
  isProcessing: boolean;
  showPrompt?: boolean;
  systemPrompt?: string;
  userPrompt?: string;
}

export function ProcessingControls({
  onProcess,
  onAbort,
  isProcessing,
  showPrompt = true,
  systemPrompt,
  userPrompt
}: ProcessingControlsProps) {
  const [showPromptModal, setShowPromptModal] = useState(false);
  const componentName = 'ProcessingControls';

  useEffect(() => {
    console.log(`[${componentName}] Mounted`);
    return () => console.log(`[${componentName}] Unmounted`);
  }, []);

  return (
    <div className="relative" data-component="processing-controls-v1">
      {/* Main UI */}
      <div className="space-y-4">
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-500">
            Debug: isProcessing={isProcessing.toString()}, hasAbort={!!onAbort.toString()}
          </div>
        )}
        <div className="text-xs text-gray-500 mb-2">
          ProcessingControls v{COMPONENT_VERSION}
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={onProcess}
            disabled={isProcessing}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⟳</span>
                Processing...
              </span>
            ) : (
              'Process All Documents'
            )}
          </button>

          {/* Make abort button always visible when processing */}
          {isProcessing && (
            <button
              onClick={onAbort}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Stop Processing
            </button>
          )}

          {showPrompt && (
            <button
              onClick={() => setShowPromptModal(true)}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              View AI Prompt
            </button>
          )}
        </div>

        {showPromptModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold">Current AI Prompt</h3>
                <button
                  onClick={() => setShowPromptModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 overflow-auto space-y-4">
                <div>
                  <h4 className="font-medium mb-2">System Prompt:</h4>
                  <pre className="bg-gray-50 p-4 rounded whitespace-pre-wrap text-sm">
                    {systemPrompt || 'No system prompt loaded'}
                  </pre>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">User Message Template:</h4>
                  <pre className="bg-gray-50 p-4 rounded whitespace-pre-wrap text-sm">
                    {userPrompt || `Analyze this document and extract a professional profile according to the above structure. Return ONLY a JSON object with no additional text.

Document content:
[Document content will be inserted here]`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Expected Output Format:</h4>
                  <pre className="bg-gray-50 p-4 rounded whitespace-pre-wrap text-sm">
{`{
  "name": "Expert's full name",
  "title": "Highest earned degrees/credentials",
  "current_position": "Current professional role",
  "institution": "Primary institutional affiliation",
  "credentials": ["List", "of", "credentials"],
  "specialty_areas": ["List", "of", "specialties"],
  "research_summary": "Detailed paragraph about research...",
  "notable_achievements": ["List", "of", "achievements"],
  "website_urls": ["List", "of", "URLs"],
  "expertise_keywords": ["5-8", "specific", "terms"]
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 