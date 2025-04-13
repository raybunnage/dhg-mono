import { useState } from "react";

function PDFResearchPortal() {
  console.log("PDFResearchPortal rendering - basic test");
  const [pdfId, setPdfId] = useState("1oQvyH9OcSEwdcrPPunD6KEAmkJdZc8n6");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  
  const handleLoadPDF = () => {
    // Use the direct file viewer URL instead of download
    const url = `https://drive.google.com/file/d/${pdfId}/preview`;
    setPdfUrl(url);
    console.log("Loading PDF from:", url);
  };
  
  return (
    <div className="h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-3xl font-bold text-primary">PDF Research Portal</h1>
        
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-lg">Route is working! 🎉</p>
          <p className="text-muted-foreground mt-2">
            Current time: {new Date().toLocaleTimeString()}
          </p>
        </div>

        <div className="p-4 border rounded-lg">
          <h2 className="font-semibold mb-2">Google Drive PDF</h2>
          <div className="flex gap-2 items-center">
            <input 
              type="text"
              value={pdfId}
              onChange={(e) => setPdfId(e.target.value)}
              className="flex-1 p-2 border rounded"
              placeholder="Enter Google Drive PDF ID"
            />
            <button 
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              onClick={handleLoadPDF}
            >
              Load PDF
            </button>
          </div>
        </div>

        {pdfUrl && (
          <div className="p-4 border rounded-lg">
            <h2 className="font-semibold mb-2">PDF Preview</h2>
            <div className="h-[500px] bg-muted rounded">
              <iframe 
                src={pdfUrl}
                className="w-full h-full rounded"
                title="PDF Preview"
              />
            </div>
          </div>
        )}

        <div className="p-4 border rounded-lg">
          <h2 className="font-semibold mb-2">Debug Info:</h2>
          <pre className="bg-muted p-2 rounded text-sm">
            {JSON.stringify({
              pathname: window.location.pathname,
              pdfId,
              pdfUrl,
              timestamp: Date.now(),
              environment: import.meta.env.MODE
            }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default PDFResearchPortal; 