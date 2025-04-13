import { useState, useEffect } from "react";
import { Document, Page } from "react-pdf";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import "@/lib/pdf-worker";
import pdfjs from "pdfjs-dist";

interface PDFViewerProps {
  url: string | null;
}

export const PDFViewer = ({ url }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workerError, setWorkerError] = useState<string | null>(null);

  useEffect(() => {
    // Check if worker is configured properly
    try {
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        console.error("PDF Worker not configured");
        setWorkerError("PDF Worker not properly configured");
      }
    } catch (err) {
      console.error("Error checking PDF worker:", err);
      setWorkerError(`PDF Worker error: ${err.message}`);
    }
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    console.log("PDF loaded successfully with", numPages, "pages");
    setNumPages(numPages);
    setIsLoading(false);
    setLoadError(null);
  }

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.1, 2));
  };
  
  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.1, 0.5));
  };
  
  const rotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  if (workerError) {
    return (
      <div className="h-full bg-background p-4 flex items-center justify-center text-destructive">
        {workerError}
      </div>
    );
  }

  if (!url) {
    return (
      <div className="h-full bg-background p-4 flex items-center justify-center text-muted-foreground">
        Select a document to view
      </div>
    );
  }

  return (
    <div className="h-full bg-background p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="font-semibold">PDF Viewer</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={rotate}>
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 bg-muted rounded-lg">
        <div className="p-8 flex flex-col items-center justify-start min-h-[calc(100vh-10rem)]">
          {isLoading && <div className="text-muted-foreground">Loading PDF...</div>}
          {loadError && (
            <div className="text-destructive">Error loading PDF: {loadError}</div>
          )}
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(error) => {
              console.error("PDF Load Error:", error);
              setIsLoading(false);
              setLoadError(
                `Error loading PDF: ${error.message}. Please try refreshing the page.`
              );
            }}
            loading={<div className="text-muted-foreground">Loading PDF...</div>}
          >
            {numPages && (
              <Page
                pageNumber={pageNumber}
                scale={scale}
                rotate={rotation}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                onLoadSuccess={() => {
                  console.log("Page loaded successfully");
                  setLoadError(null);
                }}
                onRenderSuccess={() => console.log("Page rendered successfully")}
                onRenderError={(error) => {
                  console.error("Page render error:", error);
                  setLoadError(`Error rendering page: ${error.message}`);
                }}
                loading={<div className="text-muted-foreground">Loading page...</div>}
              />
            )}
          </Document>
          {numPages && (
            <div className="mt-4 text-sm text-muted-foreground">
              Page {pageNumber} of {numPages}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}; 