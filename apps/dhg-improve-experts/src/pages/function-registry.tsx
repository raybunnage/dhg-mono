import { useState, useEffect } from 'react';
import { getAllFunctions, getFunctionInfo } from '@/utils/function-registry';
import { generateMigrationReport } from '@/utils/function-migration';

export default function FunctionRegistryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showMigrationReport, setShowMigrationReport] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const categories = [
    'all',
    'CONTENT_EXTRACTION',
    'GOOGLE_DRIVE',
    'UI_INTERACTION',
    'DATA_MANAGEMENT'
  ];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Function Registry</h1>
      
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search functions..."
          className="px-4 py-2 border rounded"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border rounded"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat.toLowerCase().replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowMigrationReport(!showMigrationReport)}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          {showMigrationReport ? 'Show Registry' : 'Show Migration Report'}
        </button>
      </div>

      {showMigrationReport ? (
        <pre className="bg-gray-50 p-4 rounded">
          {generateMigrationReport()}
        </pre>
      ) : (
        <FunctionList 
          searchTerm={searchTerm}
          category={selectedCategory} 
        />
      )}
    </div>
  );
}

function FunctionList({ searchTerm, category }: { searchTerm: string; category: string }) {
  const [functions, setFunctions] = useState<string[]>([]);
  
  useEffect(() => {
    // Get all functions from registry
    const allFunctions = getAllFunctions();
    setFunctions(allFunctions.map(f => f.name));
  }, []);

  const filteredFunctions = functions.filter(f => {
    const info = getFunctionInfo(f);
    if (!info) return false;
    
    const matchesSearch = f.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = category === 'all' || info.category === category;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filteredFunctions.map(funcName => {
        const info = getFunctionInfo(funcName);
        if (!info) return null;

        return (
          <div key={funcName} className="border p-4 rounded-lg">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-lg">{info.name}</h3>
              <span className={`px-2 py-1 rounded text-sm ${
                info.status === 'active' ? 'bg-green-100' :
                info.status === 'deprecated' ? 'bg-red-100' :
                'bg-yellow-100'
              }`}>
                {info.status}
              </span>
            </div>
            <p className="text-gray-600 mt-2">{info.description}</p>
            <div className="mt-2 text-sm text-gray-500">
              Location: {info.location}
            </div>
            {info.targetPackage && (
              <div className="mt-1 text-sm text-blue-600">
                Target Package: {info.targetPackage}
              </div>
            )}
            {info.dependencies && (
              <div className="mt-2 text-sm">
                <span className="font-medium">Dependencies:</span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {info.dependencies.map(dep => (
                    <span key={dep} className="px-2 py-1 bg-gray-100 rounded">
                      {dep}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {info.usedIn && (
              <div className="mt-2 text-sm">
                <span className="font-medium">Used in:</span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {info.usedIn.map(location => (
                    <span key={location} className="px-2 py-1 bg-gray-50 rounded">
                      {location}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
} 