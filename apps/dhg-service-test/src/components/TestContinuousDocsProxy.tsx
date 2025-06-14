import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Plus, Trash2, Clock } from 'lucide-react';

interface ContinuousDocument {
  originalPath: string;
  fileName: string;
  category: string;
  addedDate: string;
  lastUpdated: string;
  updateFrequency: 'daily' | 'weekly' | 'monthly' | 'on-demand';
  description?: string;
}

const PROXY_URL = 'http://localhost:9882';

export function TestContinuousDocsProxy() {
  const [documents, setDocuments] = useState<ContinuousDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newDoc, setNewDoc] = useState({
    originalPath: '',
    category: 'general',
    frequency: 'weekly' as const,
    description: ''
  });

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${PROXY_URL}/api/continuous-docs`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const addDocument = async () => {
    if (!newDoc.originalPath) return;
    
    try {
      const response = await fetch(`${PROXY_URL}/api/continuous-docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalPath: newDoc.originalPath,
          category: newDoc.category,
          frequency: newDoc.frequency,
          description: newDoc.description
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add document');
      }
      
      await fetchDocuments();
      setNewDoc({ originalPath: '', category: 'general', frequency: 'weekly', description: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add document');
    }
  };

  const updateFrequency = async (docPath: string, frequency: string) => {
    try {
      const response = await fetch(`${PROXY_URL}/api/continuous-docs/${encodeURIComponent(docPath)}/frequency`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency })
      });
      
      if (!response.ok) throw new Error('Failed to update frequency');
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update frequency');
    }
  };

  const triggerUpdate = async (docPath: string) => {
    try {
      const response = await fetch(`${PROXY_URL}/api/continuous-docs/${encodeURIComponent(docPath)}/update`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to trigger update');
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger update');
    }
  };

  const removeDocument = async (docPath: string) => {
    try {
      const response = await fetch(`${PROXY_URL}/api/continuous-docs/${encodeURIComponent(docPath)}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to remove document');
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove document');
    }
  };

  const getRelativeTime = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Continuous Docs Proxy Test</span>
          <Button 
            onClick={fetchDocuments} 
            disabled={loading}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Add new document form */}
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="font-medium">Add New Document</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Document path (e.g., docs/README.md)"
              value={newDoc.originalPath}
              onChange={(e) => setNewDoc({ ...newDoc, originalPath: e.target.value })}
            />
            <Select
              value={newDoc.category}
              onValueChange={(value) => setNewDoc({ ...newDoc, category: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="architecture">Architecture</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="guide">Guide</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={newDoc.frequency}
              onValueChange={(value: any) => setNewDoc({ ...newDoc, frequency: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="on-demand">On Demand</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Description (optional)"
              value={newDoc.description}
              onChange={(e) => setNewDoc({ ...newDoc, description: e.target.value })}
            />
          </div>
          <Button onClick={addDocument} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        </div>

        {/* Documents list */}
        <div className="space-y-2">
          {documents.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No documents tracked yet</p>
          ) : (
            documents.map((doc) => (
              <div key={doc.originalPath} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{doc.fileName}</div>
                    <div className="text-sm text-gray-500">{doc.originalPath}</div>
                    {doc.description && (
                      <div className="text-sm text-gray-600 mt-1">{doc.description}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{doc.category}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeDocument(doc.originalPath)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>Last updated: {getRelativeTime(doc.lastUpdated)}</span>
                  </div>
                  
                  <Select
                    value={doc.updateFrequency}
                    onValueChange={(value) => updateFrequency(doc.originalPath, value)}
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="on-demand">On Demand</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => triggerUpdate(doc.originalPath)}
                  >
                    Update Now
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}