import React, { useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

export interface ProfileFormData {
  // Basic Info
  profession: string;
  professional_title: string;
  years_experience: number;
  industry_sectors: string[];
  specialty_areas: string[];
  credentials: string[];
  
  // Learning Preferences
  interested_topics: string[];
  avoided_topics: string[];
  interested_experts: string[];
  learning_goals: string[];
  reason_for_learning: string;
  intended_application: string;
  current_challenges: string;
  
  // Learning Style
  preferred_depth: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  preferred_formats: string[];
  preferred_session_length: number;
  learning_pace: 'slow' | 'moderate' | 'fast';
  time_commitment: string;
  
  // Optional
  bio_summary?: string;
  referral_source?: string;
  learning_background?: string;
  priority_subjects?: string[];
  content_tags_following?: string[];
}

interface ProfileFormProps {
  onSubmit: (data: ProfileFormData) => void | Promise<void>;
  onCancel?: () => void;
  initialData?: Partial<ProfileFormData>;
  isLoading?: boolean;
}

const INDUSTRY_SECTORS = [
  'Healthcare', 'Biotechnology', 'Pharmaceuticals', 'Medical Devices',
  'Research & Academia', 'Technology', 'Finance', 'Education', 'Other'
];

const LEARNING_FORMATS = [
  'Video presentations', 'Audio lectures', 'Written articles',
  'Interactive workshops', 'Q&A sessions', 'Case studies'
];

const TOPICS = [
  'Mitochondrial medicine', 'Cell danger response', 'Metabolomics',
  'Autism research', 'Chronic fatigue syndrome', 'Long COVID',
  'Integrative medicine', 'Systems biology', 'Precision medicine',
  'Neuroscience', 'Immunology', 'Epigenetics', 'Microbiome',
  'Environmental health', 'Functional medicine'
];

export const ProfileForm: React.FC<ProfileFormProps> = ({
  onSubmit,
  onCancel,
  initialData = {},
  isLoading = false
}) => {
  const [step, setStep] = useState(1);
  const totalSteps = 4;
  
  const [formData, setFormData] = useState<ProfileFormData>({
    profession: initialData.profession || '',
    professional_title: initialData.professional_title || '',
    years_experience: initialData.years_experience || 0,
    industry_sectors: initialData.industry_sectors || [],
    specialty_areas: initialData.specialty_areas || [],
    credentials: initialData.credentials || [],
    interested_topics: initialData.interested_topics || [],
    avoided_topics: initialData.avoided_topics || [],
    interested_experts: initialData.interested_experts || [],
    learning_goals: initialData.learning_goals || [],
    reason_for_learning: initialData.reason_for_learning || '',
    intended_application: initialData.intended_application || '',
    current_challenges: initialData.current_challenges || '',
    preferred_depth: initialData.preferred_depth || 'intermediate',
    preferred_formats: initialData.preferred_formats || [],
    preferred_session_length: initialData.preferred_session_length || 30,
    learning_pace: initialData.learning_pace || 'moderate',
    time_commitment: initialData.time_commitment || '',
    bio_summary: initialData.bio_summary || '',
    referral_source: initialData.referral_source || '',
    learning_background: initialData.learning_background || '',
    priority_subjects: initialData.priority_subjects || [],
    content_tags_following: initialData.content_tags_following || []
  });

  const updateField = (field: keyof ProfileFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: keyof ProfileFormData, item: string) => {
    const currentArray = formData[field] as string[];
    const updated = currentArray.includes(item)
      ? currentArray.filter(i => i !== item)
      : [...currentArray, item];
    updateField(field, updated);
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.profession && formData.professional_title && 
               formData.industry_sectors.length > 0;
      case 2:
        return formData.interested_topics.length > 0 && 
               formData.reason_for_learning;
      case 3:
        return formData.preferred_formats.length > 0;
      case 4:
        return true; // Optional fields
      default:
        return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      await onSubmit(formData);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Professional Background</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profession *
              </label>
              <input
                type="text"
                value={formData.profession}
                onChange={(e) => updateField('profession', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Physician, Researcher, Healthcare Professional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Professional Title *
              </label>
              <input
                type="text"
                value={formData.professional_title}
                onChange={(e) => updateField('professional_title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., MD, PhD, Research Director"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Years of Experience
              </label>
              <input
                type="number"
                value={formData.years_experience}
                onChange={(e) => updateField('years_experience', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                max="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Industry Sectors * (Select all that apply)
              </label>
              <div className="space-y-2">
                {INDUSTRY_SECTORS.map(sector => (
                  <label key={sector} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.industry_sectors.includes(sector)}
                      onChange={() => toggleArrayItem('industry_sectors', sector)}
                      className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{sector}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Credentials (Optional)
              </label>
              <input
                type="text"
                value={formData.credentials.join(', ')}
                onChange={(e) => updateField('credentials', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., MD, PhD, Board Certified (comma separated)"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Learning Interests</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topics of Interest * (Select all that apply)
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {TOPICS.map(topic => (
                  <label key={topic} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.interested_topics.includes(topic)}
                      onChange={() => toggleArrayItem('interested_topics', topic)}
                      className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{topic}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Why are you interested in learning? *
              </label>
              <textarea
                value={formData.reason_for_learning}
                onChange={(e) => updateField('reason_for_learning', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Share your motivation for learning..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How will you apply this knowledge?
              </label>
              <textarea
                value={formData.intended_application}
                onChange={(e) => updateField('intended_application', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Describe how you plan to use what you learn..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Challenges (Optional)
              </label>
              <textarea
                value={formData.current_challenges}
                onChange={(e) => updateField('current_challenges', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Any specific challenges you're facing..."
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Learning Preferences</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Content Depth
              </label>
              <select
                value={formData.preferred_depth}
                onChange={(e) => updateField('preferred_depth', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="beginner">Beginner - New to the field</option>
                <option value="intermediate">Intermediate - Some background knowledge</option>
                <option value="advanced">Advanced - Deep understanding desired</option>
                <option value="expert">Expert - Cutting-edge research level</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Learning Formats * (Select all that apply)
              </label>
              <div className="space-y-2">
                {LEARNING_FORMATS.map(format => (
                  <label key={format} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.preferred_formats.includes(format)}
                      onChange={() => toggleArrayItem('preferred_formats', format)}
                      className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{format}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Session Length (minutes)
              </label>
              <input
                type="number"
                value={formData.preferred_session_length}
                onChange={(e) => updateField('preferred_session_length', parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="5"
                max="120"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Learning Pace
              </label>
              <select
                value={formData.learning_pace}
                onChange={(e) => updateField('learning_pace', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="slow">Slow - Take time to digest</option>
                <option value="moderate">Moderate - Steady progress</option>
                <option value="fast">Fast - Accelerated learning</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Commitment
              </label>
              <input
                type="text"
                value={formData.time_commitment}
                onChange={(e) => updateField('time_commitment', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 2 hours per week"
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Additional Information (Optional)</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brief Bio
              </label>
              <textarea
                value={formData.bio_summary}
                onChange={(e) => updateField('bio_summary', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Tell us a bit about yourself..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Learning Background
              </label>
              <textarea
                value={formData.learning_background}
                onChange={(e) => updateField('learning_background', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Previous relevant education or experience..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How did you hear about us?
              </label>
              <input
                type="text"
                value={formData.referral_source}
                onChange={(e) => updateField('referral_source', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Colleague, Conference, Web search"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Profile Complete!</h3>
              <p className="text-sm text-blue-700">
                Thank you for providing your information. This will help us personalize your learning experience.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Step {step} of {totalSteps}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round((step / totalSteps) * 100)}% Complete
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {renderStep()}

            <div className="mt-8 flex justify-between">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>
              )}
              
              <div className="flex gap-2 ml-auto">
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
                
                <button
                  type="submit"
                  disabled={!canProceed() || isLoading}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {step < totalSteps ? (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    isLoading ? 'Submitting...' : 'Complete Profile'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};