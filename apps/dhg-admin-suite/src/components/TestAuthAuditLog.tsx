import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabase-admin';

export const TestAuthAuditLog: React.FC = () => {
  const [regularData, setRegularData] = useState<any>(null);
  const [adminData, setAdminData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    testAccess();
  }, []);

  const testAccess = async () => {
    console.log('=== Testing Auth Audit Log Access ===');
    
    // Test 1: Regular client
    console.log('1. Testing with regular supabase client...');
    const regularResult = await supabase
      .from('auth_audit_log')
      .select('*')
      .limit(5);
    
    console.log('Regular client result:', {
      hasData: !!regularResult.data,
      dataLength: regularResult.data?.length || 0,
      error: regularResult.error,
      data: regularResult.data
    });
    
    setRegularData({
      count: regularResult.data?.length || 0,
      error: regularResult.error?.message || null,
      sample: regularResult.data?.[0] || null
    });
    
    // Test 2: Admin client
    console.log('2. Testing with admin supabase client...');
    try {
      const adminResult = await supabaseAdmin
        .from('auth_audit_log')
        .select('*')
        .limit(5);
      
      console.log('Admin client result:', {
        hasData: !!adminResult.data,
        dataLength: adminResult.data?.length || 0,
        error: adminResult.error,
        data: adminResult.data
      });
      
      setAdminData({
        count: adminResult.data?.length || 0,
        error: adminResult.error?.message || null,
        sample: adminResult.data?.[0] || null
      });
    } catch (err: any) {
      console.error('Admin client error:', err);
      setAdminData({
        count: 0,
        error: err.message,
        sample: null
      });
    }
    
    setLoading(false);
  };

  if (loading) return <div>Testing access...</div>;

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">Auth Audit Log Access Test</h2>
      
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Regular Client (with RLS)</h3>
          <p>Count: {regularData?.count}</p>
          <p>Error: {regularData?.error || 'None'}</p>
          {regularData?.sample && (
            <div className="mt-2 text-xs">
              <p>Sample record:</p>
              <pre className="bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(regularData.sample, null, 2)}
              </pre>
            </div>
          )}
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Admin Client (service role)</h3>
          <p>Count: {adminData?.count}</p>
          <p>Error: {adminData?.error || 'None'}</p>
          {adminData?.sample && (
            <div className="mt-2 text-xs">
              <p>Sample record:</p>
              <pre className="bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(adminData.sample, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-yellow-50 p-4 rounded">
        <p className="text-sm">Check the browser console for detailed logs.</p>
      </div>
    </div>
  );
};