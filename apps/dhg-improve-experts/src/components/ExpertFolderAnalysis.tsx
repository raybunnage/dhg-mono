import { useState, useEffect } from 'react'
import { getExpertFolders } from '@/lib/supabase/expert-documents'
import type { ExpertFolder } from '@/types/expert'

export default function ExpertFolderAnalysis() {
  const [folders, setFolders] = useState<ExpertFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadFolders()
  }, [])

  async function loadFolders() {
    try {
      const data = await getExpertFolders()
      setFolders(data)
    } catch (error) {
      console.error('Error loading folders:', error)
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

  if (loading) return <div>Loading folders...</div>

  return (
    <div className="mt-8 p-4">
      <h2 className="text-xl font-semibold mb-4">Expert Documents Analysis</h2>
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
    </div>
  )
} 