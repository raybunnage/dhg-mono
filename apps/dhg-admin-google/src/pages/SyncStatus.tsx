import React from 'react';
import { DashboardLayout } from '../components/DashboardLayout';

export const SyncStatus: React.FC = () => {
  return (
    <DashboardLayout>
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Sync Status</h2>
        <p className="text-gray-600">
          Monitor and manage Google Drive synchronization status.
        </p>
        <div className="mt-6 p-8 bg-gray-50 rounded-lg text-center">
          <p className="text-gray-500">Sync status functionality coming soon...</p>
        </div>
      </div>
    </DashboardLayout>
  );
};