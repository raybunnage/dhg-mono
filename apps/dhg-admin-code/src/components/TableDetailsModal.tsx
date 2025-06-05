import React from 'react';

interface TableInfo {
  table_name: string;
  table_schema: string;
  table_type: string;
  row_count: number;
  size_pretty?: string;
  description?: string;
  purpose?: string;
  created_date?: string;
  created_by?: string;
  notes?: string;
  columns?: string[];
  column_count?: number;
  has_primary_key?: boolean;
  has_rls?: boolean;
}

interface TableDetailsModalProps {
  table: TableInfo;
  isOpen: boolean;
  onClose: () => void;
}

export function TableDetailsModal({ table, isOpen, onClose }: TableDetailsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-green-50 px-6 py-4 border-b border-green-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-green-900">
              {table.table_schema === 'auth' && (
                <span className="text-orange-600">{table.table_schema}.</span>
              )}
              {table.table_name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Overview Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Overview</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="text-sm font-medium text-gray-900">
                  {table.description || 'No description available'}
                </p>
              </div>
              {table.purpose && (
                <div>
                  <p className="text-sm text-gray-500">Purpose</p>
                  <p className="text-sm font-medium text-gray-900">{table.purpose}</p>
                </div>
              )}
            </div>
          </div>

          {/* Metadata Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Metadata</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Created Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {table.created_date 
                    ? new Date(table.created_date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })
                    : 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created By</p>
                <p className="text-sm font-medium text-gray-900">
                  {table.created_by || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Table Type</p>
                <p className="text-sm font-medium text-gray-900">{table.table_type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Row Count</p>
                <p className="text-sm font-medium text-gray-900">
                  {table.row_count.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Size</p>
                <p className="text-sm font-medium text-gray-900">
                  {table.size_pretty || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Columns</p>
                <p className="text-sm font-medium text-gray-900">
                  {table.column_count || table.columns?.length || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Features</h3>
            <div className="flex gap-3">
              {table.has_primary_key && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                  </svg>
                  Primary Key
                </span>
              )}
              {table.has_rls && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                  <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Row Level Security
                </span>
              )}
              {table.table_schema === 'auth' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                  <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0010 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
                  </svg>
                  Auth Schema
                </span>
              )}
            </div>
          </div>

          {/* Notes Section */}
          {table.notes && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Notes</h3>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                {table.notes}
              </p>
            </div>
          )}

          {/* Columns Section */}
          {table.columns && table.columns.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Columns ({table.columns.length})
              </h3>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {table.columns.map((column, index) => (
                    <div
                      key={index}
                      className="text-sm font-mono text-gray-700 bg-white px-2 py-1 rounded border border-gray-200"
                    >
                      {column}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}