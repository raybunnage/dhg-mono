import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { browserAuthService } from '../services/auth-service';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    profession: '',
    organization: '',
    professional_interests: '',
    bio: '',
    linkedin_url: ''
  });

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const currentUser = await browserAuthService.getCurrentUser();
      if (currentUser?.user_metadata) {
        setFormData({
          full_name: currentUser.user_metadata.full_name || '',
          profession: currentUser.user_metadata.profession || '',
          organization: currentUser.user_metadata.organization || '',
          professional_interests: currentUser.user_metadata.professional_interests || '',
          bio: currentUser.user_metadata.bio || '',
          linkedin_url: currentUser.user_metadata.linkedin_url || ''
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMessage('');

    try {
      await browserAuthService.updateUserProfile(formData);
      setSuccessMessage('Profile updated successfully!');
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    loadUserProfile(); // Reset to saved values
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {successMessage && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-700">{successMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <p className="text-gray-900">{user?.email}</p>
                </div>

                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isLoading}
                    />
                  ) : (
                    <p className="text-gray-900">{formData.full_name || '-'}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="profession" className="block text-sm font-medium text-gray-700 mb-1">
                    Profession
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      id="profession"
                      value={formData.profession}
                      onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Research Scientist, Medical Professional"
                      disabled={isLoading}
                    />
                  ) : (
                    <p className="text-gray-900">{formData.profession || '-'}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-1">
                    Organization
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      id="organization"
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Your company or institution"
                      disabled={isLoading}
                    />
                  ) : (
                    <p className="text-gray-900">{formData.organization || '-'}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="interests" className="block text-sm font-medium text-gray-700 mb-1">
                    Professional Interests
                  </label>
                  {isEditing ? (
                    <textarea
                      id="interests"
                      value={formData.professional_interests}
                      onChange={(e) => setFormData({ ...formData, professional_interests: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="What topics are you most interested in?"
                      disabled={isLoading}
                    />
                  ) : (
                    <p className="text-gray-900 whitespace-pre-wrap">
                      {formData.professional_interests || '-'}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                    Bio
                  </label>
                  {isEditing ? (
                    <textarea
                      id="bio"
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                      placeholder="Tell us about yourself"
                      disabled={isLoading}
                    />
                  ) : (
                    <p className="text-gray-900 whitespace-pre-wrap">
                      {formData.bio || '-'}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="linkedin" className="block text-sm font-medium text-gray-700 mb-1">
                    LinkedIn URL
                  </label>
                  {isEditing ? (
                    <input
                      type="url"
                      id="linkedin"
                      value={formData.linkedin_url}
                      onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://linkedin.com/in/yourprofile"
                      disabled={isLoading}
                    />
                  ) : (
                    formData.linkedin_url ? (
                      <a href={formData.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                        {formData.linkedin_url}
                      </a>
                    ) : (
                      <p className="text-gray-900">-</p>
                    )
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="mt-6 flex space-x-3">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};