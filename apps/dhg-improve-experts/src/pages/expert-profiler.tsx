import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExpertProfileExtractor } from '@/components/ExpertProfileExtractor';

export default function ExpertProfilerPage() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/experts')}
            className="text-primary-600 hover:text-primary-800"
          >
            ← Back to Experts
          </button>
          <h1 className="text-3xl font-serif text-primary-900">
            Expert Profile Extractor
          </h1>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <ExpertProfileExtractor />
      </div>
    </div>
  );
} 