import { useState } from "react";

function PDFResearchPortal() {
  console.log("PDFResearchPortal rendering - basic test");
  
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
          <h2 className="font-semibold mb-2">Debug Info:</h2>
          <pre className="bg-muted p-2 rounded text-sm">
            {JSON.stringify({
              pathname: window.location.pathname,
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