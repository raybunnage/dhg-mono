import { ExpertProfileExtractor } from '@/components/ExpertProfileExtractor';
import { Link } from "react-router-dom";

export default function ProfilerPage() {
  console.log('Rendering ProfilerPage');
  
  return (
    <div className="p-4">
      <div className="flex items-center gap-4 mb-6">
        <Link 
          to="/experts" 
          className="text-blue-500 hover:text-blue-600"
        >
          ← Back to Experts
        </Link>
        <h1 className="text-2xl font-bold">Expert Profile Extractor</h1>
      </div>

      <ExpertProfileExtractor />
    </div>
  );
} 