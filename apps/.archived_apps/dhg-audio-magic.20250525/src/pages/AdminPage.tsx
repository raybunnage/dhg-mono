import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { AdminPanel } from '../components/AdminPanel';
import { authService } from '../services/auth-service';

export const AdminPage: React.FC = () => {
  const [showSetupOption, setShowSetupOption] = useState(false);

  const handleMakeAdmin = async () => {
    const result = await authService.makeMeAdmin();
    if (result.success) {
      alert('Admin role granted! Please refresh the page.');
      window.location.reload();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminPanel />
        
        {/* Developer Setup Tool - Remove in Production */}
        <div className="mt-12 p-4 bg-gray-100 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Developer Setup Tool</h3>
          <p className="text-xs text-gray-500 mb-3">
            For initial setup only - remove this section in production
          </p>
          
          {!showSetupOption ? (
            <button
              onClick={() => setShowSetupOption(true)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Show admin setup option
            </button>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-2">
                If you need to grant admin access to the current user, click below.
                This function should be removed after initial setup.
              </p>
              <button
                onClick={handleMakeAdmin}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Grant Admin Role
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};