import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface Expert {
  id: string;
  expert_name: string;
  full_name: string;
}

export default function Experts() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    getExperts();
  }, []);

  async function getExperts() {
    try {
      const { data, error } = await supabase
        .from('expert_profiles')
        .select('*')
        .order('expert_name');

      if (error) throw error;
      if (data) setExperts(data);
    } catch (error) {
      console.error('Error fetching experts:', error);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-primary-600 hover:text-primary-800"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-serif text-primary-900">Our Experts</h1>
        </div>
        <button 
          onClick={() => navigate('/experts/new')} 
          className="btn-primary"
        >
          Add Expert
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {experts.map((expert) => (
          <div 
            key={expert.id}
            className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer"
            onClick={() => navigate(`/experts/${expert.id}`)}
          >
            <div className="p-6">
              <h2 className="text-xl font-semibold text-primary-800 mb-2">
                {expert.expert_name}
              </h2>
              <p className="text-gray-600">
                Full Name: {expert.full_name}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}