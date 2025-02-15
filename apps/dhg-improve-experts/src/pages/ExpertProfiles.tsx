import { useState } from "react";
import ExpertFolderAnalysis from "@/components/ExpertFolderAnalysis";
import { SourceButtons } from "@/components/SourceButtons";

export default function ExpertProfiles() {
  const [status, setStatus] = useState('');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-4">
        <h1 className="text-2xl mb-4">Expert Profiles</h1>
        
        {/* Only include SourceButtons here */}
        <SourceButtons />

        {/* Status Message */}
        {status && (
          <div className={`p-2 rounded ${
            status.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {status}
          </div>
        )}

        {/* Expert Folder Analysis - but without SourcesView */}
        <ExpertFolderAnalysis />
      </div>
    </div>
  );
} 