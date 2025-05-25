import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ProfileForm, ProfileFormData } from '../../../../packages/shared/components/profile/ProfileForm';
import { profileService } from '../services/profile-service';
import { dhgHubAuthService } from '../services/dhg-hub-auth-service';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');

  console.log('[ProfilePage] Rendering with user:', user);

  useEffect(() => {
    console.log('[ProfilePage] useEffect - user:', user);
    if (!user) {
      console.log('[ProfilePage] No user detected, checking localStorage...');
      const storedUser = localStorage.getItem('dhg_hub_auth_user');
      if (!storedUser) {
        console.log('[ProfilePage] No user in localStorage either, will redirect after delay');
        // Give auth state a chance to initialize
        const timer = setTimeout(() => {
          const currentUser = localStorage.getItem('dhg_hub_auth_user');
          if (!currentUser) {
            console.log('[ProfilePage] Still no user after wait, redirecting to home');
            navigate('/');
          }
        }, 500);
        return () => clearTimeout(timer);
      } else {
        console.log('[ProfilePage] User exists in localStorage but not in hook yet, waiting...');
        return;
      }
    }

    loadProfile();
  }, [user, navigate]);

  const loadProfile = async () => {
    if (!user) return;
    
    console.log('[ProfilePage] Loading profile for user:', user.id);
    
    try {
      setIsLoading(true);
      const result = await profileService.getProfile(user.id);
      console.log('[ProfilePage] Profile load result:', result);
      
      if (result.success && result.data) {
        console.log('[ProfilePage] Profile data loaded:', result.data);
        setProfileData(result.data);
      } else {
        // No profile yet - show form to complete it
        console.log('[ProfilePage] No profile found, showing edit form');
        setIsEditing(true);
      }
    } catch (err) {
      console.error('[ProfilePage] Error loading profile:', err);
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSubmit = async (formData: ProfileFormData) => {
    if (!user) return;
    
    console.log('[ProfilePage] handleProfileSubmit called with data:', formData);
    console.log('[ProfilePage] User ID:', user.id);
    
    setIsLoading(true);
    setError('');

    try {
      // Use the auth service to complete/update profile
      const result = await dhgHubAuthService.completeProfile(user.id, formData);
      console.log('[ProfilePage] Profile save result:', result);
      
      if (result.success) {
        await loadProfile();
        setIsEditing(false);
      } else {
        throw new Error(result.error || 'Failed to save profile');
      }
    } catch (err) {
      console.error('[ProfilePage] Profile update error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isEditing) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (isEditing || !profileData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">
          {profileData ? 'Edit Your Learning Preferences' : 'Complete Your Profile'}
        </h1>
        <div className="bg-white rounded-lg shadow p-6">
          <ProfileForm
            initialData={profileData || {}}
            onSubmit={handleProfileSubmit}
            onCancel={() => {
              if (profileData) {
                setIsEditing(false);
              } else {
                navigate('/');
              }
            }}
            isLoading={isLoading}
          />
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Learning Preferences</h1>
        <button
          onClick={() => setIsEditing(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Edit Preferences
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Professional Background */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Professional Background</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">Profession:</span>
              <p className="mt-1">{profileData.profession}</p>
            </div>
            {profileData.professional_title && (
              <div>
                <span className="font-medium text-gray-600">Title:</span>
                <p className="mt-1">{profileData.professional_title}</p>
              </div>
            )}
            {profileData.years_experience && (
              <div>
                <span className="font-medium text-gray-600">Years of Experience:</span>
                <p className="mt-1">{profileData.years_experience}</p>
              </div>
            )}
          </div>
        </section>

        {/* Learning Goals */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Learning Goals</h2>
          <div className="space-y-2">
            <div>
              <span className="font-medium text-gray-600">Goals:</span>
              <ul className="mt-1 list-disc list-inside">
                {profileData.learning_goals?.map((goal: string, index: number) => (
                  <li key={index}>{goal}</li>
                ))}
              </ul>
            </div>
            <div>
              <span className="font-medium text-gray-600">Reason for Learning:</span>
              <p className="mt-1">{profileData.reason_for_learning}</p>
            </div>
          </div>
        </section>

        {/* Topics of Interest */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Topics of Interest</h2>
          <div className="flex flex-wrap gap-2">
            {profileData.interested_topics?.map((topic: string) => (
              <span
                key={topic}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
              >
                {topic}
              </span>
            ))}
          </div>
        </section>

        {/* Learning Style */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Learning Style</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">Preferred Depth:</span>
              <p className="mt-1 capitalize">{profileData.preferred_depth}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Learning Pace:</span>
              <p className="mt-1 capitalize">{profileData.learning_pace}</p>
            </div>
            {profileData.preferred_formats && (
              <div>
                <span className="font-medium text-gray-600">Preferred Formats:</span>
                <p className="mt-1">{profileData.preferred_formats.join(', ')}</p>
              </div>
            )}
            {profileData.time_commitment && (
              <div>
                <span className="font-medium text-gray-600">Time Commitment:</span>
                <p className="mt-1">{profileData.time_commitment}</p>
              </div>
            )}
          </div>
        </section>

        {/* Profile Completeness */}
        {profileData.profile_completeness !== undefined && (
          <section className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Profile Completeness</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${profileData.profile_completeness}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium">{profileData.profile_completeness}%</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};