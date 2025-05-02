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

  // Filter out raw JSON and other internal fields
  const filteredData = React.useMemo(() => {
    if (typeof jsonData !== 'object' || jsonData === null) {
      return jsonData;
    }
    
    // Create a shallow copy of the object
    const filtered = { ...jsonData };
    
    // Remove any Raw JSON fields
    if ('raw' in filtered) {
      delete filtered.raw;
    }
    
    // List of keys to remove
    const keysToRemove = [
      // Classification data
      'classification_confidence', 
      'confidence_score', 
      'document_classification_confidence', 
      'classification_scores',
      'classification_reasoning',
      
      // Internal IDs and metadata
      'document_type_id',
      'processed_at'
    ];
    
    keysToRemove.forEach(key => {
      if (key in filtered) {
        delete filtered[key];
      }
    });
    
    return filtered;
  }, [jsonData]);

  // Convert snake_case to Title Case
  const formatKey = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  };

  // Check if the data is empty
  if (!filteredData || (typeof filteredData === 'object' && Object.keys(filteredData).length === 0)) {
    return <div className="text-gray-500 italic">No content available</div>;
  }

  // If it's just a string, render it directly
  if (typeof filteredData === 'string') {
    return <div className="whitespace-pre-wrap">{filteredData}</div>;
  }

  // For non-object data
  if (typeof filteredData !== 'object' || filteredData === null) {
    return <div>{String(filteredData)}</div>;
  }
  
  // Check if this is a summary with key points
  const hasSummary = filteredData.summary || filteredData.overview;
  const hasKeyPoints = filteredData.key_points || filteredData.highlights || filteredData.key_insights;
  
  if (hasSummary || hasKeyPoints) {
    // Get metadata entries (anything that's not summary or key points)
    const metadataEntries = Object.entries(filteredData)
      .filter(([key]) => !['summary', 'overview', 'key_points', 'highlights', 'key_insights'].includes(key))
      // Filter out any fields with "raw" in the key
      .filter(([key]) => !key.toLowerCase().includes('raw'));
    
    return (
      <div className={`${className} content-container bg-white rounded-lg text-gray-800`} style={{ fontSize }}>
        {/* Summary Section as Collapsible (initially open) */}
        {hasSummary && (
          <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
            <div className="flex items-center cursor-pointer">
              <CollapsibleTrigger className="flex items-center w-full text-left focus:outline-none">
                <h2 className="font-bold text-xl text-blue-700 py-4 pb-2 flex items-center flex-grow">
                  {summaryOpen ? <ChevronDown className="h-5 w-5 mr-2" /> : <ChevronRight className="h-5 w-5 mr-2" />}
                  Video Summary
                </h2>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="mb-4 pb-2 border-b border-blue-200">
                {typeof (filteredData.summary || filteredData.overview) === 'string' ?
                  (filteredData.summary || filteredData.overview).split('\n\n').map((paragraph: string, index: number) => (
                    <p key={index} className="mb-3">{paragraph}</p>
                  )) :
                  <div>Unable to display summary content</div>
                }
                
                {/* Key Points/Insights Section */}
                {hasKeyPoints && (
                  <div className="mt-6 bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-bold text-lg mb-3 text-blue-800">
                      {filteredData.key_points ? "Key Points" : 
                       filteredData.key_insights ? "Key Insights" : 
                       "Highlights"}
                    </h3>
                    <ul className="list-disc pl-5 space-y-2">
                      {(filteredData.key_points || filteredData.highlights || filteredData.key_insights || []).map((point: string, index: number) => (
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
                  Presentation Highlights
                </h2>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="mb-4">
                {/* Other sections */}
                {metadataEntries.map(([key, value]) => {
                  // Skip internal fields that shouldn't be shown
                  if (key.toLowerCase().includes('raw') || 
                      key.toLowerCase().includes('confidence') ||
                      key.toLowerCase().includes('classification_score') ||
                      key.toLowerCase().includes('classification_reasoning') ||
                      key.toLowerCase().includes('document_type_id') ||
                      key.toLowerCase().includes('processed_at')) {
                    return null;
                  }
                  
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
                                  {Object.entries(item).map(([itemKey, itemValue]) => {
                                    // Skip internal fields
                                    if (itemKey.toLowerCase().includes('confidence') || 
                                        itemKey.toLowerCase().includes('raw') ||
                                        itemKey.toLowerCase().includes('classification_reasoning') ||
                                        itemKey.toLowerCase().includes('document_type_id') ||
                                        itemKey.toLowerCase().includes('processed_at')) {
                                      return null;
                                    }
                                    
                                    return (
                                      <div key={itemKey} className="mb-2">
                                        <span className="font-semibold">{formatKey(itemKey)}: </span>
                                        <span>{String(itemValue)}</span>
                                      </div>
                                    );
                                  })}
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
                            // Skip internal fields
                            if (subKey.toLowerCase().includes('confidence') || 
                                subKey.toLowerCase().includes('raw') ||
                                subKey.toLowerCase().includes('classification_reasoning') ||
                                subKey.toLowerCase().includes('document_type_id') ||
                                subKey.toLowerCase().includes('processed_at')) {
                              return null;
                            }
                            
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
                                    {Object.entries(subValue)
                                      .filter(([deepKey]) => 
                                        !deepKey.toLowerCase().includes('confidence') && 
                                        !deepKey.toLowerCase().includes('raw') &&
                                        !deepKey.toLowerCase().includes('classification_reasoning') &&
                                        !deepKey.toLowerCase().includes('document_type_id') &&
                                        !deepKey.toLowerCase().includes('processed_at')
                                      )
                                      .map(([deepKey, deepValue]) => (
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
  if (filteredData.name || filteredData.full_name) {
    return (
      <div className={`${className} expert-profile`} style={{ fontSize }}>
        {/* Name and Title Section */}
        {(filteredData.name || filteredData.full_name) && (
          <h2 className="text-xl font-bold mb-3">{filteredData.name || filteredData.full_name}</h2>
        )}
        
        {filteredData.title && (
          <p className="text-lg text-gray-700 mb-4">{filteredData.title}</p>
        )}
        
        {/* Short Bio */}
        {(filteredData.short_bio || filteredData.bio) && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Biography</h3>
            <p className="text-gray-800">{filteredData.short_bio || filteredData.bio}</p>
          </div>
        )}
        
        {/* Areas of Expertise */}
        {filteredData.areas_of_expertise && filteredData.areas_of_expertise.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Areas of Expertise</h3>
            <ul className="list-disc pl-5 space-y-1">
              {filteredData.areas_of_expertise.map((area: string, index: number) => (
                <li key={index} className="text-gray-800">{area}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Publications */}
        {filteredData.publications && filteredData.publications.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Publications</h3>
            <ul className="list-disc pl-5 space-y-2">
              {filteredData.publications.map((pub: any, index: number) => (
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
        {filteredData.education && filteredData.education.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Education</h3>
            <ul className="list-disc pl-5 space-y-1">
              {filteredData.education.map((edu: any, index: number) => (
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
        {((filteredData.email || (filteredData.contact && filteredData.contact.email)) || 
          (filteredData.website || (filteredData.contact && filteredData.contact.website))) && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Contact</h3>
            {(filteredData.email || (filteredData.contact && filteredData.contact.email)) && 
              <div className="text-gray-800">Email: {filteredData.email || filteredData.contact.email}</div>}
            {(filteredData.website || (filteredData.contact && filteredData.contact.website)) && (
              <div className="text-gray-800">
                Website: <a href={filteredData.website || filteredData.contact.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{filteredData.website || filteredData.contact.website}</a>
              </div>
            )}
          </div>
        )}
        
        {/* Other fields */}
        {Object.entries(filteredData)
          .filter(([key]) => ![
            'name', 'full_name', 'title', 'short_bio', 'bio', 'areas_of_expertise', 
            'publications', 'education', 'email', 'website', 'contact',
            'document_type_id', 'processed_at', 'classification_confidence', 'classification_reasoning'
          ].includes(key))
          .filter(([key]) => !key.toLowerCase().includes('raw') && 
                             !key.toLowerCase().includes('confidence') &&
                             !key.toLowerCase().includes('document_type_id') &&
                             !key.toLowerCase().includes('processed_at'))
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
                          Object.entries(item)
                          .filter(([itemKey]) => !itemKey.toLowerCase().includes('raw') && 
                                                !itemKey.toLowerCase().includes('confidence') &&
                                                !itemKey.toLowerCase().includes('document_type_id') &&
                                                !itemKey.toLowerCase().includes('processed_at'))
                          .map(([itemKey, itemValue]) => (
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
                    {Object.entries(value)
                      .filter(([subKey]) => !subKey.toLowerCase().includes('raw') && 
                                           !subKey.toLowerCase().includes('confidence') &&
                                           !subKey.toLowerCase().includes('document_type_id') &&
                                           !subKey.toLowerCase().includes('processed_at'))
                      .map(([subKey, subValue]) => (
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
      {Object.entries(filteredData)
        .filter(([key]) => !key.toLowerCase().includes('raw') && 
                          !key.toLowerCase().includes('confidence') &&
                          !key.toLowerCase().includes('document_type_id') &&
                          !key.toLowerCase().includes('processed_at') &&
                          !key.toLowerCase().includes('classification_reasoning'))
        .map(([key, value]) => {
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
                          {Object.entries(item)
                            .filter(([itemKey]) => !itemKey.toLowerCase().includes('raw') && 
                                                 !itemKey.toLowerCase().includes('confidence') &&
                                                 !itemKey.toLowerCase().includes('document_type_id') &&
                                                 !itemKey.toLowerCase().includes('processed_at') &&
                                                 !itemKey.toLowerCase().includes('classification_reasoning'))
                            .map(([itemKey, itemValue]) => (
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
                  {Object.entries(value)
                    .filter(([subKey]) => !subKey.toLowerCase().includes('raw') && 
                                        !subKey.toLowerCase().includes('confidence') &&
                                        !subKey.toLowerCase().includes('document_type_id') &&
                                        !subKey.toLowerCase().includes('processed_at') &&
                                        !subKey.toLowerCase().includes('classification_reasoning'))
                    .map(([subKey, subValue]) => {
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
                              {Object.entries(subValue)
                                .filter(([deepKey]) => !deepKey.toLowerCase().includes('raw') && 
                                                    !deepKey.toLowerCase().includes('confidence') &&
                                                    !deepKey.toLowerCase().includes('document_type_id') &&
                                                    !deepKey.toLowerCase().includes('processed_at') &&
                                                    !deepKey.toLowerCase().includes('classification_reasoning'))
                                .map(([deepKey, deepValue]) => (
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