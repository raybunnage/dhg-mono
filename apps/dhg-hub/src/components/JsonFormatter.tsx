import React from 'react';

interface JsonFormatterProps {
  data: any;
  fontSize?: string;
  className?: string;
}

// Reusable JSON formatter component with consistent styling
const JsonFormatter: React.FC<JsonFormatterProps> = ({ 
  data, 
  fontSize = '0.875rem', 
  className = '' 
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);
  
  // Copy JSON to clipboard
  const copyToClipboard = () => {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      navigator.clipboard.writeText(jsonStr);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };
  
  // Detect if JSON is large
  const isLargeJson = React.useMemo(() => {
    const jsonSize = JSON.stringify(data).length;
    return jsonSize > 5000; // Consider data over 5KB as "large"
  }, [data]);
  
  return (
    <div className={`${className} bg-gray-900 rounded-md overflow-hidden`}>
      {/* Controls header for JSON */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
        <div className="text-xs text-gray-400 font-mono">
          {isLargeJson ? "Large JSON" : "JSON"} ({formatDataSize(getDataSize(data))})
        </div>
        <div className="flex space-x-2">
          {isLargeJson && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-0.5 rounded transition-colors"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          )}
          <button 
            onClick={copyToClipboard}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-0.5 rounded transition-colors"
            title="Copy JSON to clipboard"
          >
            {isCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      
      {/* JSON content with max height limit for large data unless expanded */}
      <div 
        className={`overflow-auto ${isLargeJson && !isExpanded ? 'max-h-64' : ''}`}
        style={isLargeJson && !isExpanded ? { 
          WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)' 
        } : {}}
      >
        <pre 
          className="p-4 text-blue-300 font-mono"
          style={{ fontSize }}
        >
          {formatJsonWithSyntaxHighlighting(data)}
        </pre>
      </div>
      
      {/* Show expand prompt for large JSONs */}
      {isLargeJson && !isExpanded && (
        <div 
          className="py-1.5 px-3 text-center text-xs text-gray-400 bg-gray-800 cursor-pointer hover:bg-gray-700 transition-colors border-t border-gray-700"
          onClick={() => setIsExpanded(true)}
        >
          Click to view all content
        </div>
      )}
    </div>
  );
};

// Get approximate size of data in bytes
function getDataSize(data: any): number {
  try {
    return JSON.stringify(data).length;
  } catch (error) {
    return 0;
  }
}

// Format byte size to human-readable format
function formatDataSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return size.toFixed(1) + ' ' + units[unitIndex];
}

// Helper function to format JSON with syntax highlighting using HTML
function formatJsonWithSyntaxHighlighting(data: any): React.ReactNode {
  try {
    // Convert data to pretty JSON string
    const jsonString = JSON.stringify(data, null, 2);
    
    // Handle empty or invalid data
    if (!jsonString || jsonString === '{}' || jsonString === '[]') {
      return <span className="text-gray-400 italic">Empty data</span>;
    }
    
    // Use regular expressions to add spans with color classes
    let highlightedJson = jsonString
      // Highlight keys
      .replace(/"([^"]+)":/g, '<span class="text-pink-500 font-bold">"$1"</span>:')
      // Highlight string values (handle multi-line strings)
      .replace(/: "([^"]*)"/g, (match, p1) => {
        // If string contains newlines, handle specially
        if (p1.includes('\n')) {
          const formattedStr = p1.replace(/\n/g, '<br />');
          return ': <span class="text-green-400">"' + formattedStr + '"</span>';
        }
        return ': <span class="text-green-400">"' + p1 + '"</span>';
      })
      // Highlight numbers
      .replace(/: (-?\d+\.?\d*)/g, ': <span class="text-orange-400">$1</span>')
      // Highlight booleans
      .replace(/: (true|false)/g, ': <span class="text-purple-400">$1</span>')
      // Highlight null
      .replace(/: (null)/g, ': <span class="text-gray-500">$1</span>');
    
    // Add line numbers for better readability of large JSON objects
    const lines = highlightedJson.split('\n');
    if (lines.length > 10) { // Only add line numbers for larger JSON objects
      highlightedJson = lines.map((line, index) => {
        const lineNumber = `<span class="text-gray-400 inline-block w-8 text-right pr-2 select-none">${index + 1}</span>`;
        return `${lineNumber}${line}`;
      }).join('\n');
    }
    
    // Return the HTML with className for potential additional styling
    return <div dangerouslySetInnerHTML={{ __html: highlightedJson }} className="json-content" />;
  } catch (error) {
    // Handle any JSON stringification errors
    console.error('Error formatting JSON:', error);
    return (
      <div className="text-red-500">
        <p className="font-bold">Error formatting data</p>
        <p className="text-sm">{String(error)}</p>
        <p className="text-xs mt-2">Raw data:</p>
        <pre className="text-xs mt-1 bg-gray-800 p-2 rounded overflow-auto">
          {String(data)}
        </pre>
      </div>
    );
  }
}

export default JsonFormatter;