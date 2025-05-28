import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabaseBrowserClient } from '@/services/supabase-browser';

export const TestProfilePage: React.FC = () => {
  const { user } = useAuth();

  const testDirectSave = async () => {
    if (!user) {
      console.log('No user!');
      return;
    }

    console.log('Testing direct save for user:', user.id);

    try {
      const supabase = supabaseBrowserClient.getClient();
      
      const testData = {
        id: user.id,
        profession: 'Test Profession',
        learning_goals: ['Test Goal 1', 'Test Goal 2'],
        reason_for_learning: 'Test Reason',
        interested_topics: ['Topic 1', 'Topic 2'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Attempting to save:', testData);

      const { data, error } = await supabase
        .from('auth_user_profiles')
        .upsert(testData)
        .select()
        .single();

      if (error) {
        console.error('Direct save error:', error);
      } else {
        console.log('Direct save success:', data);
      }
    } catch (err) {
      console.error('Test failed:', err);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Test Profile Save</h1>
      <p className="mb-4">User ID: {user?.id}</p>
      <button
        onClick={testDirectSave}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Test Direct Save
      </button>
    </div>
  );
};