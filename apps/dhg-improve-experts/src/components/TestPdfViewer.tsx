import { useState, useEffect } from 'react';
import { Document, Page } from 'react-pdf';
import { pdfjs } from 'react-pdf';
import '../utils/pdf-worker';  // Import worker initialization
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Test PDF URL - we can use a sample PDF
const TEST_PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

export function TestPdfViewer() {
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('PDF.js version:', pdfjs.version);
    console.log('Worker path:', pdfjs.GlobalWorkerOptions.workerSrc);
  }, []);

  return (
    <div className="flex flex-col items-center p-4">
      <div className="mb-4">
        <h2>PDF Test Viewer</h2>
        <p>Testing PDF.js version: {pdfjs.version}</p>
      </div>

      <Document
        file={TEST_PDF}
        onLoadSuccess={({ numPages }) => {
          console.log('PDF loaded successfully with', numPages, 'pages');
          setNumPages(numPages);
          setIsLoading(false);
        }}
        onLoadError={(error) => {
          console.error('Error loading PDF:', error);
          setError(error.message);
          setIsLoading(false);
        }}
        loading={
          <div className="animate-pulse text-blue-500">
            Loading PDF...
          </div>
        }
      >
        <Page 
          pageNumber={pageNumber} 
          renderTextLayer={true}
          renderAnnotationLayer={true}
        />
      </Document>

      {error && (
        <div className="mt-4 text-red-500">
          Error: {error}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button 
          onClick={() => setPageNumber(p => Math.max(1, p - 1))}
          disabled={pageNumber <= 1}
          className="px-2 py-1 bg-gray-100 rounded"
        >
          Previous
        </button>
        <span>Page {pageNumber} of {numPages}</span>
        <button 
          onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
          disabled={pageNumber >= numPages}
          className="px-2 py-1 bg-gray-100 rounded"
        >
          Next
        </button>
      </div>
    </div>
  );
} 