import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { lightAuthService, type AllowedEmail } from '../services/light-auth-service';

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAllowedEmails();
  }, []);

  const loadAllowedEmails = async () => {
    setIsLoading(true);
    try {
      const emails = await lightAuthService.getAllowedEmails();
      setAllowedEmails(emails);
    } catch (error) {
      console.error('Error loading allowed emails:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveEmail = async (email: string) => {
    if (!window.confirm(`Remove ${email} from the whitelist?`)) return;

    const result = await lightAuthService.removeFromWhitelist(email);
    if (result.success) {
      loadAllowedEmails();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Allowed Emails</h2>
            <p className="text-sm text-gray-500 mt-1">
              These users have access to the application. Auto-registered users appear here immediately.
            </p>
          </div>

          {isLoading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : allowedEmails.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No allowed emails yet.
            </div>
          ) : (
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
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allowedEmails.map((email) => (
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
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleRemoveEmail(email.email)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">
              Total: {allowedEmails.length} allowed emails
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};