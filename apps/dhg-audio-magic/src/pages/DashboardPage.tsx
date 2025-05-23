import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { AudioPlayer } from '../components/AudioPlayer';
import { ProfilePrompt } from '../components/ProfilePrompt';
import { authService } from '../services/auth-service';

// Mock audio data - replace with real data from your API
const mockAudioFiles = [
  {
    id: '1',
    title: 'Introduction to DHG Audio',
    speaker: 'Dr. Sarah Johnson',
    duration: '15:32',
    date: '2024-01-15',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    topics: ['Introduction', 'Overview']
  },
  {
    id: '2',
    title: 'Advanced Research Methods',
    speaker: 'Prof. Michael Chen',
    duration: '42:18',
    date: '2024-01-20',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    topics: ['Research', 'Methodology']
  },
  {
    id: '3',
    title: 'Clinical Applications',
    speaker: 'Dr. Emily Roberts',
    duration: '28:45',
    date: '2024-01-25',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    topics: ['Clinical', 'Practice']
  }
];

export const DashboardPage: React.FC = () => {
  const [selectedAudio, setSelectedAudio] = useState<typeof mockAudioFiles[0] | null>(null);
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    checkUserProfile();
  }, []);

  const checkUserProfile = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      if (currentUser) {
        // Check if user has completed their profile
        const hasProfile = currentUser.user_metadata?.profession || 
                          currentUser.user_metadata?.professional_interests;
        
        if (!hasProfile) {
          setShowProfilePrompt(true);
        } else {
          setUserProfile(currentUser.user_metadata);
        }
      }
    } catch (error) {
      console.error('Error checking user profile:', error);
    }
  };

  const handleProfileComplete = (profile: any) => {
    setUserProfile(profile);
    setShowProfilePrompt(false);
  };

  return (
    <Layout>
      {showProfilePrompt && (
        <ProfilePrompt onComplete={handleProfileComplete} />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome to DHG Audio Magic
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Explore our curated collection of audio content
          </p>
          {userProfile && userProfile.professional_interests && (
            <p className="mt-1 text-sm text-gray-500">
              Personalized for your interests in: {userProfile.professional_interests}
            </p>
          )}
        </div>

        {/* Audio Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {mockAudioFiles.map((audio) => (
            <div
              key={audio.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedAudio(audio)}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {audio.title}
                </h3>
                <p className="text-sm text-gray-600 mb-3">{audio.speaker}</p>
                
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{audio.duration}</span>
                  <span>{new Date(audio.date).toLocaleDateString()}</span>
                </div>
                
                <div className="mt-3 flex flex-wrap gap-2">
                  {audio.topics.map((topic) => (
                    <span
                      key={topic}
                      className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Audio Player */}
        {selectedAudio && (
          <AudioPlayer
            audio={selectedAudio}
            onClose={() => setSelectedAudio(null)}
          />
        )}

        {/* Features Section */}
        <div className="mt-12 bg-blue-50 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Magic Link Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                🔐 Passwordless Access
              </h3>
              <p className="text-sm text-gray-600">
                No passwords to remember. Just click the magic link in your email.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                📋 Curated Access
              </h3>
              <p className="text-sm text-gray-600">
                Email allowlist ensures only authorized users can access content.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                🎯 Personalized Content
              </h3>
              <p className="text-sm text-gray-600">
                Content recommendations based on your professional interests.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};