import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ChatContentProps {
  videoFileName: string;
}

export function ChatContent({ videoFileName }: ChatContentProps) {
  const [chatContent, setChatContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadChatContent = async () => {
      try {
        // Construct chat.txt filename from video filename
        const chatFileName = videoFileName.replace(/\.(mp4|mov|avi)$/, '.chat.txt');
        
        // Query Supabase for the chat file
        const { data: files, error } = await supabase
          .from('google_sources')
          .select('*')
          .eq('name', chatFileName)
          .single();

        if (error) throw error;
        
        if (files?.web_view_link) {
          // Fetch the chat content
          const response = await fetch(files.web_view_link);
          const text = await response.text();
          setChatContent(text);
        } else {
          setChatContent('No chat transcript available');
        }
      } catch (err) {
        console.error('Error loading chat:', err);
        setError('Could not load chat transcript');
      } finally {
        setLoading(false);
      }
    };

    loadChatContent();
  }, [videoFileName]);

  if (loading) return <div className="animate-pulse">Loading chat transcript...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!chatContent) return <div className="text-gray-500">No chat transcript available</div>;

  return (
    <pre className="whitespace-pre-wrap text-sm">
      {chatContent}
    </pre>
  );
} 