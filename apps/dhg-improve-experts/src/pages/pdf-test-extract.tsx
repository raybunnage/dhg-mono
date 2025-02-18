import { useState, useEffect } from 'react';
import { getFileFromDrive, listDriveContents } from '@/lib/google-drive';
import { processGoogleDrivePDF } from '@/lib/pdf-utils';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export default function PDFTestExtract() {
  const [fileId, setFileId] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);

  useEffect(() => {
    async function loadFiles() {
      try {
        const result = await listDriveContents();
        const pdfFiles = result.files.filter(f => 
          f.mimeType === 'application/pdf'
        );
        setFiles(pdfFiles);
      } catch (err) {
        console.error('Error loading files:', err);
      }
    }
    loadFiles();
  }, []);

  async function handleExtract() {
    setLoading(true);
    setError(null);
    try {
      const pdfBuffer = await getFileFromDrive(fileId);
      const extractedContent = await processGoogleDrivePDF(pdfBuffer);
      setContent(extractedContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process PDF');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">PDF Extraction Test</h1>
      
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Available PDFs:</h2>
        <div className="grid gap-2">
          {files.map(file => (
            <button
              key={file.id}
              onClick={() => setFileId(file.id)}
              className={`p-2 border rounded text-left hover:bg-gray-100 ${
                fileId === file.id ? 'border-blue-500 bg-blue-50' : ''
              }`}
            >
              {file.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={fileId}
          onChange={(e) => setFileId(e.target.value)}
          placeholder="Or enter Google Drive File ID"
          className="w-full p-2 border rounded"
        />
      </div>

      <button
        onClick={handleExtract}
        disabled={loading || !fileId}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
      >
        {loading ? 'Processing...' : 'Extract PDF Content'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {content && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Extracted Content:</h2>
          <pre className="p-4 bg-gray-100 rounded whitespace-pre-wrap">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
} 