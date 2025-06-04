import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { format, differenceInDays, differenceInHours } from 'date-fns';

interface TrackedDocument {
  originalPath: string;
  fileName: string;
  category: string;
  addedDate: string;
  lastUpdated: string;
  updateFrequency?: 'daily' | 'weekly' | 'on-change';
  description?: string;
}

type UpdateFrequency = 'daily' | 'weekly' | 'on-change';

export function ContinuousDocumentsPage() {
  const [documents, setDocuments] = useState<TrackedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<string | null>(null);
  const [newFrequency, setNewFrequency] = useState<UpdateFrequency>('weekly');

  // Load documents from the tracking file
  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3008/api/continuous-docs');
      
      if (!response.ok) {
        throw new Error('Failed to fetch continuous documents');
      }
      
      const data = await response.json();
      setDocuments(data.documents || []);
      setError(null);
    } catch (err) {
      setError('Failed to load continuous documents. Make sure the continuous docs server is running.');
      console.error('Error loading documents:', err);
      
      // Show sample data if server is not running
      const sampleDocs: TrackedDocument[] = [
        {
          originalPath: '/CLAUDE.md',
          fileName: 'CLAUDE.md',
          category: 'project-instructions',
          addedDate: '2025-01-15T10:00:00Z',
          lastUpdated: '2025-02-04T14:30:00Z',
          updateFrequency: 'weekly',
          description: 'Main project instructions for Claude Code'
        }
      ];
      setDocuments(sampleDocs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // Get unique categories
  const categories = Array.from(new Set(documents.map(doc => doc.category))).sort();

  // Filter documents by category
  const filteredDocuments = selectedCategory 
    ? documents.filter(doc => doc.category === selectedCategory)
    : documents;

  // Check if document needs update
  const needsUpdate = (doc: TrackedDocument): boolean => {
    const lastUpdate = new Date(doc.lastUpdated);
    const now = new Date();
    
    switch (doc.updateFrequency) {
      case 'daily':
        return differenceInDays(now, lastUpdate) >= 1;
      case 'weekly':
        return differenceInDays(now, lastUpdate) >= 7;
      case 'on-change':
        // Would need to check if source file changed
        return false;
      default:
        return differenceInDays(now, lastUpdate) >= 7;
    }
  };

  // Get time until next update
  const getNextUpdateTime = (doc: TrackedDocument): string => {
    const lastUpdate = new Date(doc.lastUpdated);
    const now = new Date();
    
    let nextUpdate: Date;
    switch (doc.updateFrequency) {
      case 'daily':
        nextUpdate = new Date(lastUpdate);
        nextUpdate.setDate(nextUpdate.getDate() + 1);
        break;
      case 'weekly':
        nextUpdate = new Date(lastUpdate);
        nextUpdate.setDate(nextUpdate.getDate() + 7);
        break;
      case 'on-change':
        return 'On file change';
      default:
        nextUpdate = new Date(lastUpdate);
        nextUpdate.setDate(nextUpdate.getDate() + 7);
    }
    
    if (nextUpdate <= now) {
      return 'Update due';
    }
    
    const hoursUntil = differenceInHours(nextUpdate, now);
    if (hoursUntil < 24) {
      return `${hoursUntil} hours`;
    }
    
    const daysUntil = Math.floor(hoursUntil / 24);
    return `${daysUntil} days`;
  };

  // Handle frequency update
  const handleFrequencyUpdate = async (docPath: string) => {
    try {
      const response = await fetch(`http://localhost:3008/api/continuous-docs/${encodeURIComponent(docPath)}/frequency`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency: newFrequency })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update frequency');
      }
      
      const result = await response.json();
      
      // Update local state
      setDocuments(docs => 
        docs.map(doc => 
          doc.originalPath === docPath 
            ? { ...doc, updateFrequency: newFrequency }
            : doc
        )
      );
      
      setEditingDoc(null);
    } catch (err) {
      console.error('Error updating frequency:', err);
      alert('Failed to update frequency');
    }
  };

  // Handle manual update
  const handleManualUpdate = async (docPath: string) => {
    try {
      const response = await fetch(`http://localhost:3008/api/continuous-docs/${encodeURIComponent(docPath)}/update`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to trigger update');
      }
      
      const result = await response.json();
      
      // Update last updated time locally
      setDocuments(docs => 
        docs.map(doc => 
          doc.originalPath === docPath 
            ? { ...doc, lastUpdated: new Date().toISOString() }
            : doc
        )
      );
      
      alert('Document update triggered successfully');
    } catch (err) {
      console.error('Error updating document:', err);
      alert('Failed to trigger update');
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      'project-instructions': 'bg-purple-100 text-purple-800',
      'technical-specs': 'bg-blue-100 text-blue-800',
      'solution-guides': 'bg-green-100 text-green-800',
      'deployment': 'bg-orange-100 text-orange-800',
      'general': 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getFrequencyBadgeColor = (frequency?: UpdateFrequency) => {
    switch (frequency) {
      case 'daily':
        return 'bg-red-100 text-red-800';
      case 'weekly':
        return 'bg-yellow-100 text-yellow-800';
      case 'on-change':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading continuous documents...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Continuously Updated Documents</h1>
          <p className="mt-2 text-gray-600">
            Manage documents that are tracked for continuous updates to keep them current.
          </p>
        </div>

        {/* Actions Bar */}
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            {/* Category Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Category:</label>
              <select
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
                className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex space-x-3">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Add Document
            </button>
            <button 
              onClick={loadDocuments}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm font-medium text-gray-500">Total Documents</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{documents.length}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm font-medium text-gray-500">Need Updates</div>
            <div className="mt-1 text-2xl font-semibold text-orange-600">
              {documents.filter(needsUpdate).length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm font-medium text-gray-500">Daily Updates</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {documents.filter(d => d.updateFrequency === 'daily').length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm font-medium text-gray-500">Weekly Updates</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {documents.filter(d => d.updateFrequency === 'weekly').length}
            </div>
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Frequency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next Update
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDocuments.map((doc) => (
                <tr key={doc.originalPath} className={needsUpdate(doc) ? 'bg-yellow-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{doc.fileName}</div>
                      <div className="text-sm text-gray-500">{doc.originalPath}</div>
                      {doc.description && (
                        <div className="text-xs text-gray-400 mt-1">{doc.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getCategoryBadgeColor(doc.category)}`}>
                      {doc.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingDoc === doc.originalPath ? (
                      <div className="flex items-center space-x-2">
                        <select
                          value={newFrequency}
                          onChange={(e) => setNewFrequency(e.target.value as UpdateFrequency)}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="on-change">On Change</option>
                        </select>
                        <button
                          onClick={() => handleFrequencyUpdate(doc.originalPath)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingDoc(null)}
                          className="text-xs text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getFrequencyBadgeColor(doc.updateFrequency)}`}>
                          {doc.updateFrequency || 'weekly'}
                        </span>
                        <button
                          onClick={() => {
                            setEditingDoc(doc.originalPath);
                            setNewFrequency(doc.updateFrequency || 'weekly');
                          }}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(doc.lastUpdated), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm ${needsUpdate(doc) ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                      {getNextUpdateTime(doc)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleManualUpdate(doc.originalPath)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Update Now
                    </button>
                    <a
                      href={`/api/markdown-file?path=${encodeURIComponent(doc.originalPath)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-gray-900"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-sm text-gray-600">
          <p className="font-medium mb-2">Update Frequencies:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Daily</strong>: Document is checked and updated every 24 hours</li>
            <li><strong>Weekly</strong>: Document is checked and updated every 7 days</li>
            <li><strong>On Change</strong>: Document is updated whenever the source file changes</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}