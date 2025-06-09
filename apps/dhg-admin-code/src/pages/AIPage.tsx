import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { MarkdownViewer } from '../components/documents/MarkdownViewer';
import { useSupabase } from '../hooks/useSupabase';
import { FileText, RefreshCw, Calendar, AlertCircle, Eye } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface ContinuousDoc {
  id: string;
  file_path: string;
  title: string;
  area: string;
  description: string | null;
  review_frequency_days: number | null;
  next_review_date: string;
  last_updated: string | null;
  priority: string | null;
  status: string | null;
  owner: string | null;
  metadata: any;
  created_at: string | null;
  updated_at: string | null;
}

export const AIPage: React.FC = () => {
  const { supabase } = useSupabase();
  const [documents, setDocuments] = useState<ContinuousDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<ContinuousDoc | null>(null);
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // Load continuous documents
  const loadDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('doc_continuous_monitoring')
        .select('*')
        .order('next_review_date', { ascending: true });

      if (error) {
        console.error('Error loading documents:', error);
        return;
      }

      setDocuments(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // Get unique areas and priorities for filtering
  const areas = ['all', ...new Set(documents.map(doc => doc.area).filter(Boolean))];
  const priorities = ['all', ...new Set(documents.map(doc => doc.priority).filter(Boolean))];

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    if (selectedArea !== 'all' && doc.area !== selectedArea) return false;
    if (selectedPriority !== 'all' && doc.priority !== selectedPriority) return false;
    return true;
  });

  // Check if document needs review
  const needsReview = (doc: ContinuousDoc): boolean => {
    const reviewDate = new Date(doc.next_review_date);
    const today = new Date();
    return reviewDate <= today;
  };

  // Get days until review
  const getDaysUntilReview = (doc: ContinuousDoc): number => {
    const reviewDate = new Date(doc.next_review_date);
    const today = new Date();
    return differenceInDays(reviewDate, today);
  };

  // Handle document selection
  const handleDocumentSelect = (doc: ContinuousDoc) => {
    setSelectedDocument(doc);
  };

  // Update review date after review
  const handleMarkReviewed = async (doc: ContinuousDoc) => {
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + (doc.review_frequency_days || 7));

    const { error } = await supabase
      .from('doc_continuous_monitoring')
      .update({
        last_updated: new Date().toISOString(),
        next_review_date: nextReviewDate.toISOString()
      })
      .eq('id', doc.id);

    if (error) {
      console.error('Error updating document:', error);
      alert('Failed to update document');
    } else {
      await loadDocuments();
      if (selectedDocument?.id === doc.id) {
        setSelectedDocument(null);
      }
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getAreaColor = (area: string) => {
    const colors: Record<string, string> = {
      'documentation': 'bg-purple-100 text-purple-800',
      'applications': 'bg-blue-100 text-blue-800',
      'cli': 'bg-green-100 text-green-800',
      'monitoring': 'bg-orange-100 text-orange-800',
      'database': 'bg-red-100 text-red-800',
      'git': 'bg-indigo-100 text-indigo-800',
      'media': 'bg-pink-100 text-pink-800',
      'maintenance': 'bg-yellow-100 text-yellow-800',
      'ai': 'bg-purple-100 text-purple-800',
      'scripts': 'bg-teal-100 text-teal-800',
      'testing': 'bg-cyan-100 text-cyan-800'
    };
    return colors[area] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-full">
        {/* Left side - Document list */}
        <div className={`${selectedDocument ? 'w-1/2' : 'w-full'} flex flex-col h-full overflow-hidden`}>
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">AI Documentation Hub</h1>
            <p className="text-gray-600">Continuously monitored documentation for AI and development</p>
          </div>

          {/* Filters */}
          <div className="p-4 border-b bg-gray-50">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {areas.map(area => (
                    <option key={area} value={area}>
                      {area === 'all' ? 'All Areas' : area}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {priorities.map(priority => (
                    <option key={priority} value={priority}>
                      {priority === 'all' ? 'All Priorities' : priority}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={loadDocuments}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Summary stats */}
          <div className="p-4 bg-white border-b">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{documents.length}</div>
                <div className="text-sm text-gray-600">Total Documents</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {documents.filter(needsReview).length}
                </div>
                <div className="text-sm text-gray-600">Need Review</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {documents.filter(doc => doc.status === 'active').length}
                </div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
            </div>
          </div>

          {/* Document list */}
          <div className="flex-1 overflow-y-auto">
            {filteredDocuments.map(doc => {
              const daysUntil = getDaysUntilReview(doc);
              const isOverdue = needsReview(doc);
              
              return (
                <div
                  key={doc.id}
                  onClick={() => handleDocumentSelect(doc)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedDocument?.id === doc.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  } ${isOverdue ? 'bg-orange-50' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{doc.title}</h3>
                      {doc.description && (
                        <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-xs px-2 py-1 rounded ${getAreaColor(doc.area)}`}>
                          {doc.area}
                        </span>
                        {doc.priority && (
                          <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(doc.priority)}`}>
                            {doc.priority}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {doc.review_frequency_days} day cycle
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      {isOverdue ? (
                        <div className="flex items-center gap-1 text-orange-600">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Overdue</span>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          Review in {daysUntil} days
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        {format(new Date(doc.next_review_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right side - Markdown viewer */}
        {selectedDocument && (
          <div className="w-1/2 border-l flex flex-col h-full">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
                <h2 className="font-medium text-gray-900">{selectedDocument.title}</h2>
              </div>
              <button
                onClick={() => handleMarkReviewed(selectedDocument)}
                className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 text-sm"
              >
                <Eye className="w-4 h-4" />
                Mark Reviewed
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <MarkdownViewer
                document={{
                  id: selectedDocument.id,
                  file_path: selectedDocument.file_path,
                  title: selectedDocument.title,
                  created_at: selectedDocument.created_at || '',
                  updated_at: selectedDocument.updated_at || ''
                }}
                mode="side"
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};