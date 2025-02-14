import { useState, useEffect } from 'react'
import { getExpertFolders } from '@/lib/supabase/expert-documents'
import type { ExpertFolder } from '@/types/expert'
import type { SourceGoogle } from '../../../../../supabase/types'
import { supabase } from '@/integrations/supabase/client'

export default function ExpertFolderAnalysis() {
  const [folders, setFolders] = useState<ExpertFolder[]>([])
  const [rawSources, setRawSources] = useState<SourceGoogle[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'folders' | 'raw'>('folders')
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      // Load folder view data
      const folderData = await getExpertFolders()
      setFolders(folderData)

      // Load raw sources data
      const { data: sourcesData, error: queryError } = await supabase
        .from('sources_google')
        .select('*')
        .order('path')
      
      if (queryError) throw queryError
      setRawSources(sourcesData)

      // Get expert documents with source info
      const { data: expertDocs, error: queryError2 } = await supabase
        .from('expert_documents')
        .select(`
          id,
          source_id,
          sources_google (
            id,
            name,
            mime_type,
            web_view_link
          )
        `)

      if (queryError2) throw queryError2

      // Safely handle the data
      const validDocs = (expertDocs || []).filter(doc => doc && doc.sources_google)
      setData(validDocs)

    } catch (err) {
      console.error('Error loading data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  const toggleFile = (fileId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(fileId)) {
        next.delete(fileId)
      } else {
        next.add(fileId)
      }
      return next
    })
  }

  if (loading) return <div>Loading data...</div>
  if (error) return <div className="text-red-500">Error: {error}</div>
  if (!data.length) return <div>No expert documents found</div>

  return (
    <div className="mt-8 p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Expert Documents Analysis</h2>
        <div className="flex items-center gap-2">
          <span className={`text-sm ${viewMode === 'folders' ? 'text-blue-600' : 'text-gray-500'}`}>
            Folder View
          </span>
          <button
            onClick={() => setViewMode(prev => prev === 'folders' ? 'raw' : 'folders')}
            className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200"
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
              viewMode === 'raw' ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
          <span className={`text-sm ${viewMode === 'raw' ? 'text-blue-600' : 'text-gray-500'}`}>
            Raw View
          </span>
        </div>
      </div>

      {viewMode === 'folders' ? (
        <div className="space-y-4">
          {folders.map(folder => (
            <div key={folder.id} className="border rounded-lg p-4">
              <button
                onClick={() => toggleFolder(folder.id)}
                className="flex items-center gap-2 w-full text-left"
              >
                <span className="text-gray-600">
                  {expandedFolders.has(folder.id) ? '📂' : '📁'}
                </span>
                <span className="font-medium">{folder.name}</span>
                <span className="text-sm text-gray-500">
                  ({folder.documents.docx.length + folder.documents.pdf.length} files)
                </span>
              </button>

              {expandedFolders.has(folder.id) && (
                <div className="ml-6 mt-2 space-y-2">
                  {folder.documents.docx.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-gray-600">Documents</h4>
                      {folder.documents.docx.map(file => (
                        <div key={file.id} className="flex items-center gap-2 ml-4">
                          <input
                            type="checkbox"
                            checked={selectedFiles.has(file.id)}
                            onChange={() => toggleFile(file.id)}
                            className="rounded"
                          />
                          <span className="text-sm">📄 {file.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {folder.documents.pdf.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-gray-600">PDFs</h4>
                      {folder.documents.pdf.map(file => (
                        <div key={file.id} className="flex items-center gap-2 ml-4">
                          <input
                            type="checkbox"
                            checked={selectedFiles.has(file.id)}
                            onChange={() => toggleFile(file.id)}
                            className="rounded"
                          />
                          <span className="text-sm">📕 {file.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {rawSources.map(source => (
            <div key={source.id} className="border rounded-lg p-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedFiles.has(source.id)}
                  onChange={() => toggleFile(source.id)}
                  className="rounded"
                />
                <div>
                  <div className="font-medium">{source.name}</div>
                  <div className="text-sm text-gray-500">
                    Path: {source.path.join(' / ')}
                  </div>
                  <div className="text-xs text-gray-400">
                    Type: {source.mime_type}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedFiles.size > 0 && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium">Selected Files: {selectedFiles.size}</h3>
          <button 
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => console.log('Selected files:', Array.from(selectedFiles))}
          >
            Process Selected Files
          </button>
        </div>
      )}

      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium">Expert Documents</h3>
        <div className="grid gap-4">
          {data.map((doc) => (
            <div key={doc.id} className="p-4 border rounded">
              <div className="font-medium">{doc.sources_google?.name || 'Unnamed Document'}</div>
              <div className="text-sm text-gray-600">
                Type: {doc.sources_google?.mime_type || 'Unknown'}
              </div>
              {doc.sources_google?.web_view_link && (
                <a 
                  href={doc.sources_google.web_view_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:underline"
                >
                  View in Drive
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 