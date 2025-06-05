import { useState, useEffect } from 'react';
import { db } from '../../utils/dbFunctions';

/**
 * Example component demonstrating how to use the database functions utility
 */
function DatabaseFunctionsExample() {
  // State for command history
  const [commandHistory, setCommandHistory] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // Load data on component mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        
        // Load categories
        const categoriesData = await db.public_get_all_categories();
        setCategories(categoriesData || []);
        
        // Load initial command history
        const historyData = await db.public_get_recent_command_history({
          limit: 10,
          offset: 0
        });
        setCommandHistory(historyData || []);
        
        setError(null);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data. See console for details.');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, []);

  // Load command history for a specific category
  const loadCategoryHistory = async (categoryId: number) => {
    try {
      setLoading(true);
      setSelectedCategory(categoryId);
      
      const historyData = await db.public_get_command_history_by_category({
        category_id: categoryId,
        limit: 10,
        offset: 0
      });
      
      setCommandHistory(historyData || []);
      setError(null);
    } catch (err) {
      console.error('Error loading category history:', err);
      setError('Failed to load category history. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  // Reset to show all commands
  const showAllCommands = async () => {
    try {
      setLoading(true);
      setSelectedCategory(null);
      
      const historyData = await db.public_get_recent_command_history({
        limit: 10,
        offset: 0
      });
      
      setCommandHistory(historyData || []);
      setError(null);
    } catch (err) {
      console.error('Error loading all commands:', err);
      setError('Failed to load all commands. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Database Functions Example</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Categories */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Command Categories</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={showAllCommands}
            className={`px-3 py-1 rounded ${
              selectedCategory === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => loadCategoryHistory(category.id)}
              className={`px-3 py-1 rounded ${
                selectedCategory === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* Command History */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Command History</h3>
        
        {loading ? (
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : commandHistory.length === 0 ? (
          <p className="text-gray-500 italic">No commands found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Command
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Executed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {commandHistory.map((cmd) => (
                  <tr key={cmd.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                      {cmd.command_text}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {cmd.category_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {formatDate(cmd.executed_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          cmd.success
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {cmd.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default DatabaseFunctionsExample; 