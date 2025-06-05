import React, { useState } from 'react';
import type { ProfileFormData } from '@shared/services/user-profile-service';

interface ProfileFormProps {
  onSubmit: (profile: ProfileFormData) => Promise<void>;
  initialData?: Partial<ProfileFormData>;
  isLoading?: boolean;
}

// Predefined options for dropdowns
const INDUSTRY_SECTORS = [
  'Healthcare',
  'Research',
  'Education',
  'Technology',
  'Pharmaceutical',
  'Clinical Practice',
  'Mental Health',
  'Public Health',
  'Other'
];

const LEARNING_FORMATS = [
  { value: 'video', label: 'Video Presentations' },
  { value: 'audio', label: 'Audio Lectures' },
  { value: 'text', label: 'Written Articles' },
  { value: 'interactive', label: 'Interactive Sessions' },
  { value: 'discussion', label: 'Group Discussions' }
];

const TOPIC_SUGGESTIONS = [
  'Stress Biology',
  'Trauma Recovery',
  'Neuroscience',
  'Psychology',
  'Mental Health',
  'Integrative Medicine',
  'Mindfulness',
  'Epigenetics',
  'Psychopharmacology',
  'Behavioral Health',
  'PTSD',
  'Anxiety Disorders',
  'Depression',
  'Resilience',
  'Neuroplasticity'
];

export const ProfileForm: React.FC<ProfileFormProps> = ({
  onSubmit,
  initialData = {},
  isLoading = false
}) => {
  const [formData, setFormData] = useState<ProfileFormData>({
    // Professional Background
    profession: initialData.profession || '',
    professional_title: initialData.professional_title || '',
    years_experience: initialData.years_experience,
    industry_sectors: initialData.industry_sectors || [],
    specialty_areas: initialData.specialty_areas || [],
    credentials: initialData.credentials || [],
    
    // Learning Preferences
    learning_goals: initialData.learning_goals || [],
    reason_for_learning: initialData.reason_for_learning || '',
    preferred_formats: initialData.preferred_formats || ['video', 'audio'],
    learning_pace: initialData.learning_pace || 'self-paced',
    time_commitment: initialData.time_commitment || '',
    preferred_depth: initialData.preferred_depth || 'intermediate',
    preferred_session_length: initialData.preferred_session_length || 30,
    
    // Content Interests
    interested_topics: initialData.interested_topics || [],
    interested_experts: initialData.interested_experts || [],
    avoided_topics: initialData.avoided_topics || [],
    priority_subjects: initialData.priority_subjects || [],
    content_tags_following: initialData.content_tags_following || [],
    
    // Bio & Context
    bio_summary: initialData.bio_summary || '',
    learning_background: initialData.learning_background || '',
    current_challenges: initialData.current_challenges || '',
    intended_application: initialData.intended_application || '',
    referral_source: initialData.referral_source || ''
  });

  const [currentGoal, setCurrentGoal] = useState('');
  const [currentCredential, setCurrentCredential] = useState('');
  const [currentTopic, setCurrentTopic] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleNumberChange = (name: keyof ProfileFormData, value: string) => {
    const numValue = value === '' ? undefined : parseInt(value, 10);
    setFormData(prev => ({
      ...prev,
      [name]: numValue
    }));
  };

  const handleArrayToggle = (field: keyof ProfileFormData, value: string) => {
    setFormData(prev => {
      const currentArray = (prev[field] as string[]) || [];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(item => item !== value)
        : [...currentArray, value];
      return {
        ...prev,
        [field]: newArray
      };
    });
  };

  const addToArray = (field: keyof ProfileFormData, value: string) => {
    if (!value.trim()) return;
    setFormData(prev => ({
      ...prev,
      [field]: [...((prev[field] as string[]) || []), value.trim()]
    }));
  };

  const removeFromArray = (field: keyof ProfileFormData, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: ((prev[field] as string[]) || []).filter((_, i) => i !== index)
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.profession.trim()) {
      newErrors.profession = 'Profession is required';
    }
    if (formData.learning_goals.length === 0) {
      newErrors.learning_goals = 'At least one learning goal is required';
    }
    if (!formData.reason_for_learning.trim()) {
      newErrors.reason_for_learning = 'Please tell us why you want to learn';
    }
    if (formData.interested_topics.length === 0) {
      newErrors.interested_topics = 'Please select at least one topic of interest';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      await onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto">
      {/* Professional Background */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Professional Background</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Profession *
            </label>
            <input
              type="text"
              name="profession"
              value={formData.profession}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Clinical Psychologist"
            />
            {errors.profession && (
              <p className="mt-1 text-sm text-red-600">{errors.profession}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Professional Title
            </label>
            <input
              type="text"
              name="professional_title"
              value={formData.professional_title || ''}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Director of Clinical Services"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Years of Experience
            </label>
            <input
              type="number"
              value={formData.years_experience || ''}
              onChange={(e) => handleNumberChange('years_experience', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
              min="0"
              max="50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Industry Sectors
            </label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {INDUSTRY_SECTORS.map(sector => (
                <label key={sector} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.industry_sectors?.includes(sector) || false}
                    onChange={() => handleArrayToggle('industry_sectors', sector)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{sector}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Credentials & Certifications
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={currentCredential}
              onChange={(e) => setCurrentCredential(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addToArray('credentials', currentCredential);
                  setCurrentCredential('');
                }
              }}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Ph.D., LCSW, Board Certified"
            />
            <button
              type="button"
              onClick={() => {
                addToArray('credentials', currentCredential);
                setCurrentCredential('');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {formData.credentials?.map((cred, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
              >
                {cred}
                <button
                  type="button"
                  onClick={() => removeFromArray('credentials', index)}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Learning Preferences */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Learning Preferences</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Learning Goals * (What do you want to achieve?)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={currentGoal}
                onChange={(e) => setCurrentGoal(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addToArray('learning_goals', currentGoal);
                    setCurrentGoal('');
                  }
                }}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Understand trauma-informed care approaches"
              />
              <button
                type="button"
                onClick={() => {
                  addToArray('learning_goals', currentGoal);
                  setCurrentGoal('');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add
              </button>
            </div>
            {errors.learning_goals && (
              <p className="mt-1 text-sm text-red-600">{errors.learning_goals}</p>
            )}
            <div className="mt-2 space-y-1">
              {formData.learning_goals.map((goal, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <span className="text-sm">{goal}</span>
                  <button
                    type="button"
                    onClick={() => removeFromArray('learning_goals', index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Why are you interested in learning this material? *
            </label>
            <textarea
              name="reason_for_learning"
              value={formData.reason_for_learning}
              onChange={handleInputChange}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Tell us about your motivation and how you plan to apply this knowledge..."
            />
            {errors.reason_for_learning && (
              <p className="mt-1 text-sm text-red-600">{errors.reason_for_learning}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Learning Formats
              </label>
              <div className="space-y-2">
                {LEARNING_FORMATS.map(format => (
                  <label key={format.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.preferred_formats?.includes(format.value) || false}
                      onChange={() => handleArrayToggle('preferred_formats', format.value)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{format.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Learning Pace
              </label>
              <select
                name="learning_pace"
                value={formData.learning_pace || 'self-paced'}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="self-paced">Self-paced</option>
                <option value="structured">Structured</option>
                <option value="intensive">Intensive</option>
              </select>

              <label className="block text-sm font-medium text-gray-700 mt-4">
                Content Depth Preference
              </label>
              <select
                name="preferred_depth"
                value={formData.preferred_depth || 'intermediate'}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="beginner">Beginner - New to the topic</option>
                <option value="intermediate">Intermediate - Some background</option>
                <option value="advanced">Advanced - Deep dive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content Interests */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Content Interests</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Topics of Interest * (Select all that apply)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            {TOPIC_SUGGESTIONS.map(topic => (
              <label key={topic} className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.interested_topics.includes(topic)}
                  onChange={() => handleArrayToggle('interested_topics', topic)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{topic}</span>
              </label>
            ))}
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={currentTopic}
              onChange={(e) => setCurrentTopic(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addToArray('interested_topics', currentTopic);
                  setCurrentTopic('');
                }
              }}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Add other topics..."
            />
            <button
              type="button"
              onClick={() => {
                addToArray('interested_topics', currentTopic);
                setCurrentTopic('');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add Topic
            </button>
          </div>
          {errors.interested_topics && (
            <p className="mt-1 text-sm text-red-600">{errors.interested_topics}</p>
          )}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            Current Challenges You're Facing
          </label>
          <textarea
            name="current_challenges"
            value={formData.current_challenges || ''}
            onChange={handleInputChange}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="What specific problems are you trying to solve?"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            How do you plan to apply this knowledge?
          </label>
          <textarea
            name="intended_application"
            value={formData.intended_application || ''}
            onChange={handleInputChange}
            rows={2}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="In clinical practice, research, teaching, etc."
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : 'Complete Profile'}
        </button>
      </div>
    </form>
  );
};