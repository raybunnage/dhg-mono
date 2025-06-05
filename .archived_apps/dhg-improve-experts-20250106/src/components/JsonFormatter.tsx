import React, { useState } from 'react';

interface JsonFormatterProps {
  data: any;
  fontSize?: string;
  className?: string;
}

/**
 * Enhanced JsonFormatter for displaying structured data in a readable format.
 * Specially designed for expert metadata with features to show structured JSON in a user-friendly way.
 */
const JsonFormatter: React.FC<JsonFormatterProps> = ({ 
  data, 
  fontSize = '0.875rem', 
  className = '' 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  // Parse string data if needed
  const jsonData = typeof data === 'string' ? 
    (() => {
      try {
        return JSON.parse(data);
      } catch (e) {
        return data; // If it can't be parsed as JSON, just use the string
      }
    })() : data;
  
  // Check if content is empty or invalid
  if (!jsonData || 
      (typeof jsonData === 'object' && 
       Object.keys(jsonData).length === 0)) {
    return <div className="text-gray-500 italic">No data available</div>;
  }
  
  // For simple string values
  if (typeof jsonData === 'string') {
    return <div className="whitespace-pre-wrap text-gray-800">{jsonData}</div>;
  }
  
  // For non-object types
  if (typeof jsonData !== 'object' || jsonData === null) {
    return <div>{String(jsonData)}</div>;
  }
  
  // Toggle section expansion
  const toggleSection = (key: string) => {
    const newExpandedSections = new Set(expandedSections);
    if (expandedSections.has(key)) {
      newExpandedSections.delete(key);
    } else {
      newExpandedSections.add(key);
    }
    setExpandedSections(newExpandedSections);
  };
  
  // Format a key for display (convert snake_case to Title Case)
  const formatKey = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  };
  
  // Render a value based on its type
  const renderValue = (value: any, level: number = 0): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">None</span>;
    }
    
    if (typeof value === 'string') {
      // If it's a longer text, render as paragraph
      if (value.length > 100) {
        return <p className="whitespace-pre-wrap text-gray-700">{value}</p>;
      }
      return <span className="text-gray-800">{value}</span>;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return <span className="text-blue-600 font-medium">{String(value)}</span>;
    }
    
    // Render arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-400 italic">Empty list</span>;
      }
      
      // Check if array contains objects
      if (typeof value[0] === 'object' && value[0] !== null) {
        return (
          <div className="mt-2 space-y-3">
            {value.map((item, index) => (
              <div key={index} className="bg-gray-50 p-3 rounded-md border border-gray-100">
                {renderValue(item, level + 1)}
              </div>
            ))}
          </div>
        );
      }
      
      // Simple array
      return (
        <ul className="list-disc ml-6 space-y-1">
          {value.map((item, index) => (
            <li key={index}>{renderValue(item, level + 1)}</li>
          ))}
        </ul>
      );
    }
    
    // Render objects
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return <span className="text-gray-400 italic">Empty object</span>;
      }
      
      return (
        <div className={level > 0 ? "pl-4 mt-2 border-l-2 border-gray-100" : ""}>
          {entries.map(([key, val]) => {
            const displayKey = formatKey(key);
            const isExpandable = typeof val === 'object' && val !== null && Object.keys(val).length > 0;
            const fullPath = `${level}-${key}`;
            const isExpanded = !isExpandable || expandedSections.has(fullPath);
            
            return (
              <div key={key} className="mb-3">
                <div className="flex items-center">
                  {isExpandable && (
                    <button
                      onClick={() => toggleSection(fullPath)}
                      className="mr-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {isExpanded ? '▼' : '►'}
                    </button>
                  )}
                  <span className="font-medium text-gray-700">{displayKey}</span>
                </div>
                
                {isExpanded && (
                  <div className="ml-5 mt-1">
                    {renderValue(val, level + 1)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }
    
    // Fallback for other types
    return <span>{String(value)}</span>;
  };
  
  // Determine if the data is large (might need expansion control)
  const isLargeObject = Object.keys(jsonData).length > 5;
  
  return (
    <div className={`json-formatter bg-white rounded-md p-4 ${className}`} style={{ fontSize }}>
      {isLargeObject && (
        <div className="mb-3 flex justify-between items-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none flex items-center"
          >
            <span className="mr-1">{isExpanded ? '▼' : '►'}</span>
            {isExpanded ? 'Collapse All' : 'Expand All'}
          </button>
          <span className="text-xs text-gray-500">
            {Object.keys(jsonData).length} fields
          </span>
        </div>
      )}
      
      <div className="divide-y">
        {Object.entries(jsonData).map(([key, value]) => {
          const sectionKey = `0-${key}`;
          const isExpandable = typeof value === 'object' && value !== null && Object.keys(value || {}).length > 0;
          const isKeyExpanded = isExpanded || expandedSections.has(sectionKey);
          
          return (
            <div key={key} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center">
                {isExpandable && (
                  <button
                    onClick={() => toggleSection(sectionKey)}
                    className="mr-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {isKeyExpanded ? '▼' : '►'}
                  </button>
                )}
                <span className="font-medium">{formatKey(key)}</span>
              </div>
              
              {(!isExpandable || isKeyExpanded) && (
                <div className="mt-2 ml-5">
                  {renderValue(value)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default JsonFormatter;