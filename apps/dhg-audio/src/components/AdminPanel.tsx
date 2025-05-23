import React, { useState, useEffect } from 'react';
import { authService } from '../services/auth-service';

interface AccessRequest {
  id: string;
  email: string;
  name: string;
  profession?: string;
  professional_interests?: string;
  organization?: string;
  reason_for_access?: string;
  request_date: string;
  interests_array: string[];
}

interface AllowedEmail {
  id: string;
  email: string;
  name?: string;
  organization?: string;
  notes?: string;
  added_at: string;
  is_active: boolean;
}

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'requests' | 'allowed'>('requests');
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddEmailForm, setShowAddEmailForm] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'requests') {
        const requests = await authService.getPendingAccessRequests();
        setPendingRequests(requests);
      } else {
        const emails = await authService.getAllowedEmails();
        setAllowedEmails(emails);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (request: AccessRequest) => {
    if (!window.confirm(`Approve access for ${request.email}?`)) return;

    const result = await authService.approveAccessRequest(request.id);
    if (result.success) {
      loadData();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const handleDeny = async (request: AccessRequest) => {
    const reason = window.prompt(`Reason for denying ${request.email}?`);
    if (reason === null) return;

    const result = await authService.denyAccessRequest(request.id, reason);
    if (result.success) {
      loadData();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Access Management</h1>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('requests')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'requests'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pending Requests
            {pendingRequests.length > 0 && (
              <span className="ml-2 bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-xs">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('allowed')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'allowed'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Allowed Emails ({allowedEmails.length})
          </button>
        </nav>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {activeTab === 'requests' && (
            <PendingRequestsTab 
              requests={pendingRequests}
              onApprove={handleApprove}
              onDeny={handleDeny}
            />
          )}
          {activeTab === 'allowed' && (
            <AllowedEmailsTab 
              emails={allowedEmails}
              onRefresh={loadData}
            />
          )}
        </>
      )}
    </div>
  );
};

interface PendingRequestsTabProps {
  requests: AccessRequest[];
  onApprove: (request: AccessRequest) => void;
  onDeny: (request: AccessRequest) => void;
}

const PendingRequestsTab: React.FC<PendingRequestsTabProps> = ({ requests, onApprove, onDeny }) => {
  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No pending requests</h3>
        <p className="mt-1 text-sm text-gray-500">All access requests have been processed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <div key={request.id} className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <h3 className="text-lg font-medium text-gray-900">{request.name}</h3>
                <span className="ml-2 text-sm text-gray-500">({request.email})</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                {request.profession && (
                  <div>
                    <span className="font-medium text-gray-700">Profession:</span>{' '}
                    <span className="text-gray-600">{request.profession}</span>
                  </div>
                )}
                {request.organization && (
                  <div>
                    <span className="font-medium text-gray-700">Organization:</span>{' '}
                    <span className="text-gray-600">{request.organization}</span>
                  </div>
                )}
              </div>

              {request.professional_interests && (
                <div className="mt-3">
                  <span className="font-medium text-gray-700 text-sm">Interests:</span>
                  <p className="text-gray-600 text-sm mt-1">{request.professional_interests}</p>
                </div>
              )}

              {request.reason_for_access && (
                <div className="mt-3">
                  <span className="font-medium text-gray-700 text-sm">Reason for access:</span>
                  <p className="text-gray-600 text-sm mt-1">{request.reason_for_access}</p>
                </div>
              )}

              <div className="mt-3 text-xs text-gray-500">
                Requested {new Date(request.request_date).toLocaleDateString()}
              </div>
            </div>

            <div className="flex space-x-2 ml-4">
              <button
                onClick={() => onApprove(request)}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Approve
              </button>
              <button
                onClick={() => onDeny(request)}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                Deny
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

interface AllowedEmailsTabProps {
  emails: AllowedEmail[];
  onRefresh: () => void;
}

const AllowedEmailsTab: React.FC<AllowedEmailsTabProps> = ({ emails, onRefresh }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState({
    email: '',
    name: '',
    organization: '',
    notes: ''
  });

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await authService.addAllowedEmail(
      newEmail.email,
      newEmail.name,
      newEmail.organization,
      newEmail.notes
    );

    if (result.success) {
      setNewEmail({ email: '', name: '', organization: '', notes: '' });
      setShowAddForm(false);
      onRefresh();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Allowed Emails</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Add Email
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddEmail} className="mb-6 bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={newEmail.email}
                onChange={(e) => setNewEmail({ ...newEmail, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={newEmail.name}
                onChange={(e) => setNewEmail({ ...newEmail, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization
              </label>
              <input
                type="text"
                value={newEmail.organization}
                onChange={(e) => setNewEmail({ ...newEmail, organization: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={newEmail.notes}
                onChange={(e) => setNewEmail({ ...newEmail, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex space-x-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
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
                Added
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {emails.map((email) => (
              <tr key={email.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {email.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {email.name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {email.organization || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(email.added_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {email.notes || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};