import { useNavigate, useLocation } from 'react-router-dom';
import { LightEmailAuth } from '../components/LightEmailAuth';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the redirect path from state or default to home
  const from = location.state?.from?.pathname || '/';

  const handleSuccess = () => {
    navigate(from, { replace: true });
  };

  return (
    <LightEmailAuth 
      redirectTo={window.location.origin}
    />
  );
}