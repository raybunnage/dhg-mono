import { ProcessingControls } from '@/components/ProcessingControls';
import Link from 'next/link';

export default function ProfilerPage() {
  console.log('Rendering ProfilerPage');
  
  return (
    <div className="p-4">
      <div className="flex items-center gap-4 mb-6">
        <Link 
          href="/experts" 
          className="text-blue-500 hover:text-blue-600"
        >
          ← Back to Experts
        </Link>
        <h1 className="text-2xl font-bold">Expert Profile Extractor</h1>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Expert Profile Extraction</h2>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg">Documents (59)</h3>
              <ProcessingControls />
            </div>
            
            {/* Existing document list */}
            <div className="space-y-4">
              {/* Your existing document items */}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Expert Profile</h2>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500">Select a document to view its profile</p>
          </div>
        </div>
      </div>
    </div>
  );
} 