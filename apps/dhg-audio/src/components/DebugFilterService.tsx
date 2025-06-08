import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FilterService } from '@shared/services/filter-service/filter-service';

export function DebugFilterService() {
  const [debugInfo, setDebugInfo] = useState<any>({
    loading: true,
    supabaseClient: null,
    filterServiceTest: null,
    directQuery: null,
    error: null
  });

  useEffect(() => {
    const runDebug = async () => {
      console.log('🔍 DebugFilterService: Starting debug...');
      
      try {
        // 1. Check Supabase client
        console.log('🔍 1. Checking Supabase client...');
        const supabaseInfo = {
          exists: !!supabase,
          url: supabase.supabaseUrl,
          hasKey: !!supabase.supabaseKey,
          keyLength: supabase.supabaseKey?.length || 0
        };
        console.log('Supabase client info:', supabaseInfo);
        
        // 2. Direct query test
        console.log('🔍 2. Testing direct query to filter_user_profiles...');
        const { data: directData, error: directError } = await supabase
          .from('filter_user_profiles')
          .select('*');
        
        console.log('Direct query result:', { data: directData, error: directError });
        
        // 3. Create FilterService and test
        console.log('🔍 3. Creating FilterService...');
        const filterService = new FilterService(supabase);
        console.log('FilterService created:', !!filterService);
        
        // Check if FilterService has the right client
        console.log('FilterService supabase client:', (filterService as any).supabase);
        
        // 4. Test FilterService.listProfiles
        console.log('🔍 4. Calling filterService.listProfiles()...');
        const profiles = await filterService.listProfiles();
        console.log('FilterService listProfiles result:', profiles);
        
        // 5. Check for any console errors during the process
        const originalError = console.error;
        const errors: any[] = [];
        console.error = (...args) => {
          errors.push(args);
          originalError.apply(console, args);
        };
        
        // Update state with all debug info
        setDebugInfo({
          loading: false,
          supabaseClient: supabaseInfo,
          directQuery: {
            success: !directError,
            data: directData,
            error: directError,
            count: directData?.length || 0
          },
          filterServiceTest: {
            created: !!filterService,
            hasSupabaseClient: !!(filterService as any).supabase,
            listProfilesResult: profiles,
            profileCount: profiles.length
          },
          consoleErrors: errors,
          error: null
        });
        
        // Restore console.error
        console.error = originalError;
        
      } catch (err: any) {
        console.error('🔍 DebugFilterService error:', err);
        setDebugInfo(prev => ({
          ...prev,
          loading: false,
          error: err.message || 'Unknown error'
        }));
      }
    };
    
    runDebug();
  }, []);

  return (
    <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
      <h3 className="font-bold text-lg mb-3">Debug Filter Service</h3>
      
      {debugInfo.loading ? (
        <p>Running debug tests...</p>
      ) : (
        <div className="space-y-4">
          {/* Supabase Client Info */}
          <div>
            <h4 className="font-semibold text-sm">1. Supabase Client:</h4>
            <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto">
              {JSON.stringify(debugInfo.supabaseClient, null, 2)}
            </pre>
          </div>
          
          {/* Direct Query Results */}
          <div>
            <h4 className="font-semibold text-sm">2. Direct Query Results:</h4>
            <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto max-h-40">
              {JSON.stringify(debugInfo.directQuery, null, 2)}
            </pre>
          </div>
          
          {/* FilterService Test */}
          <div>
            <h4 className="font-semibold text-sm">3. FilterService Test:</h4>
            <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto max-h-40">
              {JSON.stringify(debugInfo.filterServiceTest, null, 2)}
            </pre>
          </div>
          
          {/* Console Errors */}
          {debugInfo.consoleErrors && debugInfo.consoleErrors.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm text-red-600">Console Errors Captured:</h4>
              <pre className="text-xs bg-red-50 p-2 rounded mt-1 overflow-auto max-h-40">
                {JSON.stringify(debugInfo.consoleErrors, null, 2)}
              </pre>
            </div>
          )}
          
          {/* General Error */}
          {debugInfo.error && (
            <div className="bg-red-100 p-3 rounded">
              <p className="text-sm text-red-800">Error: {debugInfo.error}</p>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-4 text-xs text-gray-600">
        Check the browser console for detailed logs
      </div>
    </div>
  );
}