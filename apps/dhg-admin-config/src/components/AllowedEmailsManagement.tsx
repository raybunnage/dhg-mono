import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface AllowedEmail {
  id: string;
  email: string;
  name: string;
  organization: string;
  added_at: string;
  added_by: string | null;
  notes: string;
  is_active: boolean;
  metadata: Record<string, any>;
}

export const AllowedEmailsManagement: React.FC = () => {
  const [emails, setEmails] = useState<AllowedEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmail, setEditingEmail] = useState<AllowedEmail | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    organization: '',
    notes: '',
    is_active: true
  });

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('allowed_emails')
        .select('*')
        .order('added_at', { ascending: false });

      if (error) {
        setMessage(`Error loading emails: ${error.message}`);
      } else {
        setEmails(data || []);
      }
    } catch (err) {
      setMessage('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      name: '',
      organization: '',
      notes: '',
      is_active: true
    });
    setEditingEmail(null);
    setShowAddForm(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      const { error } = await supabase
        .from('allowed_emails')
        .insert([{
          email: formData.email,
          name: formData.name,
          organization: formData.organization,
          notes: formData.notes,
          is_active: formData.is_active
        }]);

      if (error) {
        setMessage(`Error adding email: ${error.message}`);
      } else {
        setMessage(`Successfully added ${formData.email}`);
        resetForm();
        loadEmails();
      }
    } catch (err) {
      setMessage('An unexpected error occurred');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmail) return;
    
    setMessage('');

    try {
      const { error } = await supabase
        .from('allowed_emails')
        .update({
          email: formData.email,
          name: formData.name,
          organization: formData.organization,
          notes: formData.notes,
          is_active: formData.is_active
        })
        .eq('id', editingEmail.id);

      if (error) {
        setMessage(`Error updating email: ${error.message}`);
      } else {
        setMessage(`Successfully updated ${formData.email}`);
        resetForm();
        loadEmails();
      }
    } catch (err) {
      setMessage('An unexpected error occurred');
    }
  };

  const handleDelete = async (email: AllowedEmail) => {
    if (!confirm(`Are you sure you want to delete ${email.email}?`)) {
      return;
    }

    setMessage('');

    try {
      const { error } = await supabase
        .from('allowed_emails')
        .delete()
        .eq('id', email.id);

      if (error) {
        setMessage(`Error deleting email: ${error.message}`);
      } else {
        setMessage(`Successfully deleted ${email.email}`);
        loadEmails();
      }
    } catch (err) {
      setMessage('An unexpected error occurred');
    }
  };

  const startEdit = (email: AllowedEmail) => {
    setFormData({
      email: email.email,
      name: email.name,
      organization: email.organization,
      notes: email.notes,
      is_active: email.is_active
    });
    setEditingEmail(email);
    setShowAddForm(true);
  };

  const toggleActive = async (email: AllowedEmail) => {
    setMessage('');

    try {
      const { error } = await supabase
        .from('allowed_emails')
        .update({ is_active: !email.is_active })
        .eq('id', email.id);

      if (error) {
        setMessage(`Error updating status: ${error.message}`);
      } else {
        setMessage(`Successfully ${email.is_active ? 'deactivated' : 'activated'} ${email.email}`);
        loadEmails();
      }
    } catch (err) {
      setMessage('An unexpected error occurred');
    }
  };

  const sendAuthInvitation = async (email: AllowedEmail) => {
    if (!confirm(`Send full authentication invitation to ${email.email}?\n\nThis will send them a signup link to create a full Supabase account with password or OAuth login.`)) {
      return;
    }

    setMessage('');

    try {
      // Send invitation email using Supabase Auth
      const { error } = await supabase.auth.admin.inviteUserByEmail(email.email, {
        data: {
          name: email.name,
          organization: email.organization,
          invited_from_allowlist: true
        },
        redirectTo: `${window.location.origin}/login`
      });

      if (error) {
        setMessage(`Error sending invitation: ${error.message}`);
      } else {
        // Update the allowed_emails record to track invitation
        const updatedMetadata = {
          ...email.metadata,
          auth_invitation_sent: true,
          auth_invitation_date: new Date().toISOString(),
          auth_invitation_status: 'sent'
        };

        await supabase
          .from('allowed_emails')
          .update({ 
            metadata: updatedMetadata,
            notes: email.notes + `\n[${new Date().toLocaleDateString()}] Auth invitation sent`
          })
          .eq('id', email.id);

        setMessage(`Successfully sent authentication invitation to ${email.email}`);
        loadEmails();
      }
    } catch (err) {
      setMessage('An unexpected error occurred while sending invitation');
    }
  };

  const checkAuthStatus = async (email: AllowedEmail) => {
    setMessage('');

    try {
      // Check if user exists in auth.users using our safe function
      const { data, error } = await supabase
        .rpc('check_auth_user_exists', { 
          target_email: email.email
        });

      if (error) {
        setMessage(`Error checking auth status: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        const result = data[0];
        
        if (result.user_exists) {
          setMessage(`✅ ${email.email} is already a full authenticated user (created: ${new Date(result.created_at).toLocaleDateString()})`);
          
          // Update metadata to reflect they're now authenticated
          const updatedMetadata = {
            ...email.metadata,
            auth_user_exists: true,
            auth_user_id: result.user_id,
            auth_status_checked: new Date().toISOString()
          };

          await supabase
            .from('allowed_emails')
            .update({ metadata: updatedMetadata })
            .eq('id', email.id);
            
          loadEmails();
        } else {
          setMessage(`${email.email} is not yet a full authenticated user`);
        }
      } else {
        setMessage(`${email.email} is not yet a full authenticated user`);
      }
    } catch (err) {
      setMessage('An unexpected error occurred while checking auth status');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Allowed Emails Management</h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage lightweight authentication emails and invite users to create full Supabase accounts
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Add Email
        </button>
      </div>

      {/* Info Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Authentication Levels</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 mb-1">Light Only</span>
            <p className="text-blue-700">Email allowlist only, no password required</p>
          </div>
          <div>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 mb-1">Invited</span>
            <p className="text-blue-700">Invitation sent, waiting for signup</p>
          </div>
          <div>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 mb-1">Full Auth</span>
            <p className="text-blue-700">Full Supabase account with password/OAuth</p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-md ${
          message.includes('Error') 
            ? 'bg-red-50 text-red-800' 
            : 'bg-green-50 text-green-800'
        }`}>
          {message}
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {editingEmail ? 'Edit Email' : 'Add New Email'}
          </h3>
          <form onSubmit={editingEmail ? handleUpdate : handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address *
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="organization" className="block text-sm font-medium text-gray-700">
                  Organization
                </label>
                <input
                  id="organization"
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                  Active
                </label>
              </div>
            </div>
            
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Optional notes about this email..."
              />
            </div>
            
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {editingEmail ? 'Update Email' : 'Add Email'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Email List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Allowed Emails ({emails.length})
          </h3>
        </div>
        
        {isLoading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading emails...</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No emails found. Add your first email above.
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-visible">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Auth Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {emails.map((email) => (
                  <tr key={email.id} className={email.is_active ? '' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {email.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {email.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {email.organization || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        email.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {email.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {email.metadata?.auth_user_exists ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          Full Auth
                        </span>
                      ) : email.metadata?.auth_invitation_sent ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Invited
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          Light Only
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(email.added_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 text-sm font-medium">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => startEdit(email)}
                            className="text-indigo-600 hover:text-indigo-900 text-sm"
                          >
                            Edit
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => toggleActive(email)}
                            className={`text-sm ${
                              email.is_active 
                                ? 'text-yellow-600 hover:text-yellow-900' 
                                : 'text-green-600 hover:text-green-900'
                            }`}
                          >
                            {email.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => handleDelete(email)}
                            className="text-red-600 hover:text-red-900 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {!email.metadata?.auth_user_exists && (
                            <>
                              <button
                                onClick={() => sendAuthInvitation(email)}
                                className="text-blue-600 hover:text-blue-900 text-sm"
                                title="Send invitation to create full Supabase account"
                              >
                                Invite to Auth
                              </button>
                              <span className="text-gray-300">|</span>
                            </>
                          )}
                          <button
                            onClick={() => checkAuthStatus(email)}
                            className="text-purple-600 hover:text-purple-900 text-sm"
                            title="Check if user has created full Supabase account"
                          >
                            Check Auth
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};