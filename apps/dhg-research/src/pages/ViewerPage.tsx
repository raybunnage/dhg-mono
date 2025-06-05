import { FileText } from 'lucide-react';

function ViewerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-text-primary">Document Viewer</h2>
        <p className="text-text-secondary mt-1">
          View and analyze research documents
        </p>
      </div>

      <div className="card">
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <FileText size={48} className="text-text-muted" />
          <p className="text-text-secondary">
            Document viewer will be integrated from shared components
          </p>
          <p className="text-text-muted text-sm">
            This will use the existing DocumentViewer from packages/shared
          </p>
        </div>
      </div>
    </div>
  );
}

export default ViewerPage;