import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast, Toaster } from 'sonner';
import { AuthForm, AuthFormData } from '@dhg/shared-components';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic-link'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const { signIn, signUp, sendMagicLink } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the redirect path from state or default to home
  const from = location.state?.from?.pathname || '/';

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
          navigate(from, { replace: true });
        }
      } else if (mode === 'signup' && data.password) {
        const result = await signUp(data.email, data.password);
        if (result.error) {
          setError(result.error.message);
        } else {
          toast.success('Account created successfully!');
          navigate(from, { replace: true });
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
    <>
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">DHG Audio</h1>
            <p className="text-gray-600">Sign in to access audio content</p>
          </div>
          
          <AuthForm
            mode={mode}
            onSubmit={handleSubmit}
            onModeChange={setMode}
            loading={loading}
            error={error}
            success={success}
          />
        </div>
      </div>
      <Toaster position="top-right" richColors />
    </>
  );
}