import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthForm, AuthFormData } from '@dhg/shared-components';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic-link'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const { signIn, signUp, sendMagicLink } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (data: AuthFormData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'signin' && data.password) {
        const result = await signIn(data.email, data.password);
        if (result.error) {
          setError(result.error.message);
        } else {
          toast.success('Successfully signed in!');
          navigate('/');
        }
      } else if (mode === 'signup' && data.password) {
        const result = await signUp(data.email, data.password);
        if (result.error) {
          setError(result.error.message);
        } else {
          toast.success('Account created successfully!');
          navigate('/');
        }
      } else if (mode === 'magic-link') {
        const result = await sendMagicLink(data.email);
        if (result.error) {
          setError(result.error.message);
        } else {
          setSuccess('Check your email for the magic link!');
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Test Audio</h1>
          <p className="text-gray-600">Authentication Service Demo</p>
        </div>
        
        <AuthForm
          mode={mode}
          onSubmit={handleSubmit}
          onModeChange={setMode}
          loading={loading}
          error={error}
          success={success}
        />
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>This is a demo application to test the auth service</p>
          <p className="mt-2">
            Try signing up with any email address
          </p>
        </div>
      </div>
    </div>
  );
}