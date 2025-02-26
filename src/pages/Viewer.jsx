import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import FileTree from '../components/FileTree';
import ExpertDocumentView from '../components/ExpertDocumentView';
import { useSearchParams } from 'react-router-dom';
// Import all the components/hooks that were previously used in Home
// For example:
// import { useDocuments } from '../hooks/useDocuments';
// import DocumentList from '../components/DocumentList';

function Viewer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedNode, setSelectedNode] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Get the document ID from URL params if available
  useEffect(() => {
    const documentId = searchParams.get('documentId');
    if (documentId) {
      handleNodeSelect({ id: documentId, type: 'document' });
    }
  }, [searchParams]);

  // Load documents and build tree data
  useEffect(() => {
    async function fetchDocuments() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('expert_documents')
          .select('*, experts(name)')
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        setDocuments(data || []);
        // Build tree structure
        const tree = buildTreeFromDocuments(data);
        setTreeData(tree);
      } catch (err) {
        console.error('Error fetching documents:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchDocuments();
  }, []);
  
  // Build tree from document data
  const buildTreeFromDocuments = (documents) => {
    // Group documents by expert
    const expertGroups = {};
    
    documents.forEach(doc => {
      const expertName = doc.experts?.name || 'Unknown Expert';
      if (!expertGroups[expertName]) {
        expertGroups[expertName] = [];
      }
      expertGroups[expertName].push(doc);
    });
    
    // Convert to tree structure
    const tree = Object.entries(expertGroups).map(([expertName, docs]) => ({
      id: expertName,
      name: expertName,
      type: 'expert',
      children: docs.map(doc => ({
        id: doc.id,
        name: doc.title || doc.filename || 'Untitled Document',
        type: 'document',
        metadata: doc
      }))
    }));
    
    return tree;
  };

  // Handle node selection in the tree
  const handleNodeSelect = async (node) => {
    setSelectedNode(node);
    
    // Update URL params if a document is selected
    if (node?.type === 'document') {
      setSearchParams({ documentId: node.id });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Document Viewer</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-3">Documents</h2>
          {loading ? (
            <p className="text-gray-500">Loading documents...</p>
          ) : (
            <FileTree 
              data={treeData}
              onNodeSelect={handleNodeSelect}
              selectedNodeId={selectedNode?.id}
            />
          )}
        </div>
        
        <div className="md:col-span-3 bg-white rounded-lg shadow p-4">
          {selectedNode?.type === 'document' ? (
            <ExpertDocumentView documentId={selectedNode.id} />
          ) : (
            <div className="text-gray-500 p-8 text-center">
              <p>Select a document from the tree to view its contents</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Viewer; 