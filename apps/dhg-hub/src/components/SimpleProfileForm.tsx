import React, { useState } from 'react';

export interface SimpleProfileFormData {
  display_name: string;
  bio?: string;
  avatar_url?: string;
}

interface SimpleProfileFormProps {
  onSubmit: (data: SimpleProfileFormData) => void | Promise<void>;
  onCancel?: () => void;
  initialData?: Partial<SimpleProfileFormData>;
  isLoading?: boolean;
}

export const SimpleProfileForm: React.FC<SimpleProfileFormProps> = ({
  onSubmit,
  onCancel,
  initialData = {},
  isLoading = false
}) => {
  const [formData, setFormData] = useState<SimpleProfileFormData>({
    display_name: initialData.display_name || '',
    bio: initialData.bio || '',
    avatar_url: initialData.avatar_url || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.display_name.trim()) {
      await onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="display_name" className="block text-sm font-medium text-gray-700">
          Display Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="display_name"
          value={formData.display_name}
          onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          required
          placeholder="Enter your display name"
        />
      </div>

      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
          Bio
        </label>
        <textarea
          id="bio"
          value={formData.bio}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Tell us about yourself (optional)"
        />
      </div>

      <div>
        <label htmlFor="avatar_url" className="block text-sm font-medium text-gray-700">
          Avatar URL
        </label>
        <input
          type="url"
          id="avatar_url"
          value={formData.avatar_url}
          onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="https://example.com/avatar.jpg (optional)"
        />
      </div>

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading || !formData.display_name.trim()}
        >
          {isLoading ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  );
};