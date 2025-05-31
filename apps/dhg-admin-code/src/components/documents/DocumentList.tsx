import React, { useState, useEffect, useMemo } from 'react';
import { useSupabase } from '../../hooks/useSupabase';
import { formatDistanceToNow } from 'date-fns';
import { Search, Filter, FileText, Folder, Tag, Star, Clock } from 'lucide-react';

// Define types locally until we have proper type imports
interface DocFile {
  id: string;
  file_path: string;
  title: string;
  file_hash?: string | null;
  file_size?: number | null;
  language?: string | null;
  document_type_id?: string | null;
  is_deleted?: boolean | null;
  created_at: string;
  updated_at: string;
  last_modified_at?: string | null;
  last_synced_at?: string | null;
  auto_update_enabled?: boolean | null;
  update_frequency?: string | null;
  update_source?: string | null;
  importance_score?: number | null;
  view_count?: number | null;
  tags?: string[] | null;
}

interface DocumentType {
  id: string;
  name: string;
  description?: string | null;
  is_general_type?: boolean | null;
}

export interface DocumentFilters {
  search?: string;
  documentTypeId?: string;
  tags?: string[];
  importanceScore?: number;
  folder?: string;
}

interface DocumentListProps {
  groupBy: 'folder' | 'type' | 'recent' | 'important';
  searchTerm?: string;
  filters?: DocumentFilters;
  onDocumentSelect?: (doc: DocFile) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  groupBy = 'recent',
  searchTerm = '',
  filters = {},
  onDocumentSelect
}) => {
  const { supabase } = useSupabase();
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Fetch documents and document types
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        // Fetch document types
        const { data: types } = await supabase
          .from('document_types')
          .select('*')
          .order('name');
        
        if (types) setDocumentTypes(types);
        
        // Build query
        let query = supabase
          .from('doc_files')
          .select('*');
        
        // Apply filters
        if (filters.documentTypeId) {
          query = query.eq('document_type_id', filters.documentTypeId);
        }
        
        if (filters.importanceScore) {
          query = query.gte('importance_score', filters.importanceScore);
        }
        
        if (filters.folder) {
          query = query.like('file_path', `${filters.folder}%`);
        }
        
        // Fetch documents
        const { data: docs } = await query.order('updated_at', { ascending: false });
        
        if (docs) setDocuments(docs);
        
      } catch (error) {
        console.error('Error fetching documents:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [supabase, filters]);

  // Filter documents based on search and filters
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          doc.title.toLowerCase().includes(searchLower) ||
          doc.file_path.toLowerCase().includes(searchLower) ||
          (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(searchLower)));
        
        if (!matchesSearch) return false;
      }
      
      // Tag filter
      if (filters.tags && filters.tags.length > 0) {
        if (!doc.tags || !filters.tags.some(tag => doc.tags?.includes(tag))) {
          return false;
        }
      }
      
      return true;
    });
  }, [documents, searchTerm, filters]);

  // Group documents based on groupBy prop
  const groupedDocuments = useMemo(() => {
    const groups: Record<string, DocFile[]> = {};
    
    filteredDocuments.forEach(doc => {
      let groupKey: string;
      
      switch (groupBy) {
        case 'folder':
          const folderPath = doc.file_path.substring(0, doc.file_path.lastIndexOf('/'));
          groupKey = folderPath || 'Root';
          break;
          
        case 'type':
          const docType = documentTypes.find(t => t.id === doc.document_type_id);
          groupKey = docType?.name || 'Unclassified';
          break;
          
        case 'important':
          groupKey = `Importance: ${doc.importance_score || 3}`;
          break;
          
        case 'recent':
        default:
          const date = new Date(doc.updated_at);
          const today = new Date();
          const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === 0) groupKey = 'Today';
          else if (daysDiff === 1) groupKey = 'Yesterday';
          else if (daysDiff < 7) groupKey = 'This Week';
          else if (daysDiff < 30) groupKey = 'This Month';
          else groupKey = 'Older';
          break;
      }
      
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(doc);
    });
    
    // Sort groups
    const sortedGroups = Object.entries(groups).sort((a, b) => {
      if (groupBy === 'recent') {
        const order = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];
        return order.indexOf(a[0]) - order.indexOf(b[0]);
      } else if (groupBy === 'important') {
        return b[0].localeCompare(a[0]); // Higher importance first
      }
      return a[0].localeCompare(b[0]);
    });
    
    return sortedGroups;
  }, [filteredDocuments, groupBy, documentTypes]);

  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const getImportanceStars = (score: number) => {
    return '⭐'.repeat(score);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Results summary */}
      <div className="text-sm text-gray-600">
        Found {filteredDocuments.length} documents in {groupedDocuments.length} groups
      </div>
      
      {/* Document groups */}
      {groupedDocuments.map(([groupKey, docs]) => (
        <div key={groupKey} className="border rounded-lg">
          {/* Group header */}
          <button
            onClick={() => toggleGroup(groupKey)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {groupBy === 'folder' && <Folder className="w-4 h-4 text-gray-500" />}
              {groupBy === 'type' && <FileText className="w-4 h-4 text-gray-500" />}
              {groupBy === 'important' && <Star className="w-4 h-4 text-gray-500" />}
              {groupBy === 'recent' && <Clock className="w-4 h-4 text-gray-500" />}
              <span className="font-medium">{groupKey}</span>
              <span className="text-sm text-gray-500">({docs.length})</span>
            </div>
            <div className="text-gray-400">
              {expandedGroups.has(groupKey) ? '−' : '+'}
            </div>
          </button>
          
          {/* Group documents */}
          {expandedGroups.has(groupKey) && (
            <div className="border-t">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => onDocumentSelect?.(doc)}
                  className="p-4 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{doc.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">{doc.file_path}</p>
                      
                      {/* Tags and metadata */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {doc.importance_score && doc.importance_score > 3 && (
                          <span>{getImportanceStars(doc.importance_score)}</span>
                        )}
                        
                        {doc.tags && doc.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {doc.tags.join(', ')}
                          </div>
                        )}
                        
                        <span>
                          Updated {formatDistanceToNow(new Date(doc.updated_at))} ago
                        </span>
                        
                        {doc.view_count > 0 && (
                          <span>{doc.view_count} views</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Document type badge */}
                    {doc.document_type_id && (
                      <div className="ml-4">
                        {documentTypes.find(t => t.id === doc.document_type_id)?.name && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {documentTypes.find(t => t.id === doc.document_type_id)?.name}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      
      {filteredDocuments.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No documents found matching your criteria
        </div>
      )}
    </div>
  );
};