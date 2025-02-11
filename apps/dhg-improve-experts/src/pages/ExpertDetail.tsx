import React, { useState } from 'react';

export default function ExpertDetail({ expertId }: { expertId: string }) {
  const [expert, setExpert] = useState<ExpertProfile | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'presentations' | 'publications'>('overview');

  // ... fetch expert data ...

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        {/* ... expert header info ... */}
      </div>

      {/* Navigation Tabs */}
      <div className="border-b mb-8">
        <nav className="flex gap-8">
          {['overview', 'presentations', 'publications'].map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab as any)}
              className={`pb-4 px-2 ${
                selectedTab === tab 
                  ? 'border-b-2 border-blue-600 text-blue-600' 
                  : 'text-gray-500'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Bio */}
          <div className="lg:col-span-2">
            {/* ... bio content ... */}
          </div>

          {/* Highlights */}
          <div>
            {/* ... achievements ... */}
          </div>
        </div>
      )}

      {selectedTab === 'presentations' && (
        <div className="grid gap-6">
          {/* ... list of presentations ... */}
        </div>
      )}

      {selectedTab === 'publications' && (
        <div>
          {/* ... publications grid ... */}
        </div>
      )}
    </div>
  );
} 