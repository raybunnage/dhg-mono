import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Expert {
  id: string;
  name: string;
  specialty: string;
  bio: string;
  imageUrl: string;
}

export default function Experts() {
  const [experts] = useState<Expert[]>([
    {
      id: '1',
      name: 'Dr. Sarah Johnson',
      specialty: 'Neurology',
      bio: 'Specializing in autonomic nervous system disorders',
      imageUrl: '/experts/sarah-johnson.jpg'
    },
    // Add more experts as needed
  ]);

  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-serif text-primary-900 mb-8">Our Experts</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {experts.map((expert) => (
          <div 
            key={expert.id}
            className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
          >
            <div className="aspect-w-16 aspect-h-9 bg-gray-200">
              <img
                src={expert.imageUrl}
                alt={expert.name}
                className="object-cover w-full h-48"
              />
            </div>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-primary-800 mb-2">
                {expert.name}
              </h2>
              <p className="text-secondary-600 font-medium mb-2">
                {expert.specialty}
              </p>
              <p className="text-gray-600 mb-4">
                {expert.bio}
              </p>
              <button
                onClick={() => navigate(`/experts/${expert.id}`)}
                className="btn-primary w-full"
              >
                View Profile
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}