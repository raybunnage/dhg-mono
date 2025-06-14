import React from 'react';

export const EnvDebug: React.FC = () => {
  const envVars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
  };

  return (
    <div className="p-4 bg-gray-100 rounded-lg mb-4">
      <h3 className="font-semibold mb-2">Environment Variables Debug:</h3>
      <div className="space-y-1 text-sm font-mono">
        {Object.entries(envVars).map(([key, value]) => (
          <div key={key} className="flex">
            <span className="font-semibold min-w-[200px]">{key}:</span>
            <span className={value ? 'text-green-600' : 'text-red-600'}>
              {value ? (typeof value === 'string' && value.length > 50 ? `${value.substring(0, 50)}...` : String(value)) : 'undefined'}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-gray-600">
        Note: Vite should automatically load .env.development in development mode
      </div>
    </div>
  );
};