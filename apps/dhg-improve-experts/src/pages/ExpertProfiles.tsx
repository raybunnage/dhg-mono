import { useState, useEffect } from 'react';
import { FileTree } from '@/components/FileTree';
import { supabase } from '@/integrations/supabase/client';
import { SourceButtons } from "@/components/SourceButtons";

export default function ExpertProfiles() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFiles() {
      const { data, error } = await supabase
        .from('sources_google')
        .select('*')
        .eq('deleted', false)
        .order('name');

      if (error) {
        console.error('Error loading files:', error);
        return;
      }

      setFiles(data || []);
      setLoading(false);
    }

    loadFiles();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-4">
        <h1 className="text-2xl mb-4">Expert Profiles</h1>
        <SourceButtons />
        {loading ? (
          <div>Loading files...</div>
        ) : (
          <FileTree files={files} />
        )}
      </div>
    </div>
  );
} 