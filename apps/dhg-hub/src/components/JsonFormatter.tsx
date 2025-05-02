import React, { useState } from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface JsonFormatterProps {
  data: any;
  fontSize?: string;
  className?: string;
}

// Clean content formatter that renders JSON data as nicely formatted content
// without JSON syntax (no braces, quotes, etc.)
const JsonFormatter: React.FC<JsonFormatterProps> = ({ 
  data, 
  fontSize = '0.875rem', 
  className = '' 
}) => {
  // State for collapsible sections
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [metadataOpen, setMetadataOpen] = useState(false);

  // Parse string data if needed
  const jsonData = React.useMemo(() => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        return data; // If it can't be parsed as JSON, just use the string
      }
    }
    return data;
  }, [data]);

  // Convert snake_case to Title Case
  const formatKey = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  };

  // Check if the data is empty
  if (!jsonData || (typeof jsonData === 'object' && Object.keys(jsonData).length === 0)) {
    return <div className="text-gray-500 italic">No content available</div>;
  }

  // If it's just a string, render it directly
  if (typeof jsonData === 'string') {
    return <div className="whitespace-pre-wrap">{jsonData}</div>;
  }

  // For non-object data
  if (typeof jsonData !== 'object' || jsonData === null) {
    return <div>{String(jsonData)}</div>;
  }
  
  // Check if this is a summary with key points
  const hasSummary = jsonData.summary || jsonData.overview;
  const hasKeyPoints = jsonData.key_points || jsonData.highlights || jsonData.key_insights;
  
  if (hasSummary || hasKeyPoints) {
    // Get metadata entries (anything that's not summary or key points)
    const metadataEntries = Object.entries(jsonData)
      .filter(([key]) => !['summary', 'overview', 'key_points', 'highlights', 'key_insights'].includes(key));
    
    return (
      <div className={`${className} content-container bg-white rounded-lg text-gray-800`} style={{ fontSize }}>
        {/* Summary Section as Collapsible (initially open) */}
        {hasSummary && (
          <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
            <div className="flex items-center cursor-pointer">
              <CollapsibleTrigger className="flex items-center w-full text-left focus:outline-none">
                <h2 className="font-bold text-xl text-blue-700 py-4 pb-2 flex items-center flex-grow">
                  {summaryOpen ? <ChevronDown className="h-5 w-5 mr-2" /> : <ChevronRight className="h-5 w-5 mr-2" />}
                  {jsonData.summary ? "Summary" : "Overview"}
                </h2>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="mb-4 pb-2 border-b border-blue-200">
                {typeof (jsonData.summary || jsonData.overview) === 'string' ?
                  (jsonData.summary || jsonData.overview).split('\n\n').map((paragraph: string, index: number) => (
                    <p key={index} className="mb-3">{paragraph}</p>
                  )) :
                  <div>Unable to display summary content</div>
                }
                
                {/* Key Points/Insights Section */}
                {hasKeyPoints && (
                  <div className="mt-6 bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-bold text-lg mb-3 text-blue-800">
                      {jsonData.key_points ? "Key Points" : 
                       jsonData.key_insights ? "Key Insights" : 
                       "Highlights"}
                    </h3>
                    <ul className="list-disc pl-5 space-y-2">
                      {(jsonData.key_points || jsonData.highlights || jsonData.key_insights || []).map((point: string, index: number) => (
                        <li key={index} className="text-gray-700">{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {/* Metadata Section as Collapsible (initially closed) */}
        {metadataEntries.length > 0 && (
          <Collapsible open={metadataOpen} onOpenChange={setMetadataOpen}>
            <div className="flex items-center cursor-pointer">
              <CollapsibleTrigger className="flex items-center w-full text-left focus:outline-none">
                <h2 className="font-bold text-xl text-blue-700 py-4 pb-2 flex items-center flex-grow">
                  {metadataOpen ? <ChevronDown className="h-5 w-5 mr-2" /> : <ChevronRight className="h-5 w-5 mr-2" />}
                  Additional Metadata
                </h2>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="mb-4">
                {/* Other sections */}
                {metadataEntries.map(([key, value]) => {
                  if (value === null || value === undefined) return null;
                  
                  return (
                    <div key={key} className="mt-6">
                      <h3 className="font-bold text-lg text-blue-700 mb-3">{formatKey(key)}</h3>
                      
                      {typeof value === 'string' && (
                        <p>{value}</p>
                      )}
                      
                      {typeof value === 'number' && (
                        <p>{value}</p>
                      )}
                      
                      {typeof value === 'boolean' && (
                        <p>{value ? 'Yes' : 'No'}</p>
                      )}
                      
                      {Array.isArray(value) && value.length > 0 && (
                        <ul className="list-disc pl-5 space-y-2">
                          {value.map((item, idx) => (
                            <li key={idx}>
                              {typeof item === 'object' ? 
                                <div className="text-sm p-2">
                                  {Object.entries(item).map(([itemKey, itemValue]) => (
                                    <div key={itemKey} className="mb-2">
                                      <span className="font-semibold">{formatKey(itemKey)}: </span>
                                      <span>{String(itemValue)}</span>
                                    </div>
                                  ))}
                                </div> : 
                                String(item)
                              }
                            </li>
                          ))}
                        </ul>
                      )}
                      
                      {typeof value === 'object' && !Array.isArray(value) && value !== null && (
                        <div className="pl-4 mt-2">
                          {Object.entries(value).map(([subKey, subValue]) => {
                            if (subValue === null || subValue === undefined) return null;
                            
                            return (
                              <div key={subKey} className="mb-3">
                                <h4 className="font-semibold text-blue-600 mb-2">{formatKey(subKey)}</h4>
                                
                                {typeof subValue === 'string' && (
                                  <p className="ml-2">{subValue}</p>
                                )}
                                
                                {typeof subValue === 'number' && (
                                  <p className="ml-2">{subValue}</p>
                                )}
                                
                                {typeof subValue === 'boolean' && (
                                  <p className="ml-2">{subValue ? 'Yes' : 'No'}</p>
                                )}
                                
                                {Array.isArray(subValue) && subValue.length > 0 && (
                                  <ul className="list-disc pl-7 space-y-1">
                                    {subValue.map((item, i) => (
                                      <li key={i} className="mb-1">{String(item)}</li>
                                    ))}
                                  </ul>
                                )}
                                
                                {typeof subValue === 'object' && !Array.isArray(subValue) && subValue !== null && (
                                  <div className="ml-4 border-l-2 border-gray-200 pl-4">
                                    {Object.entries(subValue).map(([deepKey, deepValue]) => (
                                      <div key={deepKey} className="mb-2">
                                        <span className="font-medium">{formatKey(deepKey)}: </span>
                                        <span>{typeof deepValue === 'object' ? JSON.stringify(deepValue) : String(deepValue)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    );
  }
  
  // For expert profiles (special case)
  if (jsonData.name || jsonData.full_name) {
    return (
      <div className={`${className} expert-profile`} style={{ fontSize }}>
        {/* Name and Title Section */}
        {(jsonData.name || jsonData.full_name) && (
          <h2 className="text-xl font-bold mb-3">{jsonData.name || jsonData.full_name}</h2>
        )}
        
        {jsonData.title && (
          <p className="text-lg text-gray-700 mb-4">{jsonData.title}</p>
        )}
        
        {/* Short Bio */}
        {(jsonData.short_bio || jsonData.bio) && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Biography</h3>
            <p className="text-gray-800">{jsonData.short_bio || jsonData.bio}</p>
          </div>
        )}
        
        {/* Areas of Expertise */}
        {jsonData.areas_of_expertise && jsonData.areas_of_expertise.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Areas of Expertise</h3>
            <ul className="list-disc pl-5 space-y-1">
              {jsonData.areas_of_expertise.map((area: string, index: number) => (
                <li key={index} className="text-gray-800">{area}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Publications */}
        {jsonData.publications && jsonData.publications.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Publications</h3>
            <ul className="list-disc pl-5 space-y-2">
              {jsonData.publications.map((pub: any, index: number) => (
                <li key={index} className="text-gray-800">
                  {typeof pub === 'string' ? pub : 
                   pub.title ? (
                     <div>
                       <div className="font-medium">{pub.title}</div>
                       {pub.journal && <div>{pub.journal}</div>}
                       {pub.year && <div className="text-sm text-gray-600">{pub.year}</div>}
                     </div>
                   ) : JSON.stringify(pub)}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Education */}
        {jsonData.education && jsonData.education.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Education</h3>
            <ul className="list-disc pl-5 space-y-1">
              {jsonData.education.map((edu: any, index: number) => (
                <li key={index} className="text-gray-800">
                  {typeof edu === 'string' ? edu : 
                   (edu.degree || edu.institution) ? (
                     <div>
                       {edu.degree && <span className="font-medium">{edu.degree}</span>}
                       {edu.field && <span> in {edu.field}</span>}
                       {edu.institution && <div>{edu.institution}</div>}
                       {edu.year && <div className="text-sm text-gray-600">{edu.year}</div>}
                     </div>
                   ) : JSON.stringify(edu)}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Contact Information */}
        {((jsonData.email || (jsonData.contact && jsonData.contact.email)) || 
          (jsonData.website || (jsonData.contact && jsonData.contact.website))) && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Contact</h3>
            {(jsonData.email || (jsonData.contact && jsonData.contact.email)) && 
              <div className="text-gray-800">Email: {jsonData.email || jsonData.contact.email}</div>}
            {(jsonData.website || (jsonData.contact && jsonData.contact.website)) && (
              <div className="text-gray-800">
                Website: <a href={jsonData.website || jsonData.contact.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{jsonData.website || jsonData.contact.website}</a>
              </div>
            )}
          </div>
        )}
        
        {/* Other fields */}
        {Object.entries(jsonData)
          .filter(([key]) => ![
            'name', 'full_name', 'title', 'short_bio', 'bio', 'areas_of_expertise', 
            'publications', 'education', 'email', 'website', 'contact'
          ].includes(key))
          .map(([key, value]) => {
            // Skip if value is null/undefined or empty array/string
            if (value === null || value === undefined) return null;
            if (Array.isArray(value) && value.length === 0) return null;
            if (typeof value === 'string' && value.trim() === '') return null;
            
            const formattedKey = formatKey(key);
            
            // Format arrays as lists
            if (Array.isArray(value)) {
              return (
                <div key={key} className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">{formattedKey}</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {value.map((item: any, i: number) => (
                      <li key={i} className="text-gray-800">
                        {typeof item === 'object' && item !== null ? 
                          Object.entries(item).map(([itemKey, itemValue]) => (
                            <div key={itemKey}>
                              <span className="font-medium">{formatKey(itemKey)}:</span> {String(itemValue)}
                            </div>
                          )) : 
                          String(item)
                        }
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }
            
            // Format objects
            if (typeof value === 'object' && value !== null) {
              return (
                <div key={key} className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">{formattedKey}</h3>
                  <div className="pl-2">
                    {Object.entries(value).map(([subKey, subValue]) => (
                      <div key={subKey} className="mb-2">
                        <span className="font-medium">{formatKey(subKey)}:</span>{' '}
                        {typeof subValue === 'object' ? 
                          (Array.isArray(subValue) ? 
                            <ul className="list-disc pl-6 mt-1">
                              {subValue.map((item, i) => <li key={i}>{String(item)}</li>)}
                            </ul> : 
                            JSON.stringify(subValue)
                          ) : 
                          String(subValue)
                        }
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            
            // Format primitives
            return (
              <div key={key} className="mb-6">
                <h3 className="text-lg font-semibold mb-2">{formattedKey}</h3>
                <p className="text-gray-800">{String(value)}</p>
              </div>
            );
          })
        }
      </div>
    );
  }
  
  // General case - render all properties in a clean format
  return (
    <div className={`${className} clean-json-content`} style={{ fontSize }}>
      {Object.entries(jsonData).map(([key, value]) => {
        const formattedKey = formatKey(key);
        
        // Skip null/undefined values
        if (value === null || value === undefined) return null;
        
        return (
          <div key={key} className="mb-6">
            <h3 className="font-bold text-lg text-blue-700 mb-2">{formattedKey}</h3>
            
            {/* String values */}
            {typeof value === 'string' && (
              <div className="whitespace-pre-wrap">{value}</div>
            )}
            
            {/* Number or boolean values */}
            {(typeof value === 'number' || typeof value === 'boolean') && (
              <div>{String(value)}</div>
            )}
            
            {/* Arrays */}
            {Array.isArray(value) && value.length > 0 && (
              <ul className="list-disc pl-5 space-y-1">
                {value.map((item, idx) => (
                  <li key={idx}>
                    {typeof item === 'object' && item !== null ? 
                      <div className="mt-1">
                        {Object.entries(item).map(([itemKey, itemValue]) => (
                          <div key={itemKey} className="mb-1">
                            <span className="font-medium">{formatKey(itemKey)}:</span>{' '}
                            {typeof itemValue === 'object' ? JSON.stringify(itemValue) : String(itemValue)}
                          </div>
                        ))}
                      </div> : 
                      String(item)
                    }
                  </li>
                ))}
              </ul>
            )}
            
            {/* Nested objects */}
            {typeof value === 'object' && !Array.isArray(value) && value !== null && (
              <div className="pl-4 border-l-2 border-gray-200">
                {Object.entries(value).map(([subKey, subValue]) => {
                  if (subValue === null || subValue === undefined) return null;
                  
                  return (
                    <div key={subKey} className="mb-4">
                      <h4 className="font-medium text-blue-600 mb-1">{formatKey(subKey)}</h4>
                      
                      {typeof subValue === 'string' && (
                        <div className="ml-4">{subValue}</div>
                      )}
                      
                      {(typeof subValue === 'number' || typeof subValue === 'boolean') && (
                        <div className="ml-4">{String(subValue)}</div>
                      )}
                      
                      {Array.isArray(subValue) && subValue.length > 0 && (
                        <ul className="list-disc pl-8 space-y-1 ml-4">
                          {subValue.map((item, i) => (
                            <li key={i}>
                              {typeof item === 'object' && item !== null ? 
                                JSON.stringify(item) : String(item)}
                            </li>
                          ))}
                        </ul>
                      )}
                      
                      {typeof subValue === 'object' && !Array.isArray(subValue) && subValue !== null && (
                        <div className="ml-4 mt-2">
                          {Object.entries(subValue).map(([deepKey, deepValue]) => (
                            <div key={deepKey} className="mb-2">
                              <span className="font-medium">{formatKey(deepKey)}:</span>{' '}
                              {typeof deepValue === 'object' ? 
                                JSON.stringify(deepValue) : String(deepValue)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default JsonFormatter;