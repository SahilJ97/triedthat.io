import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();  // Change from authState to user since that's what our context provides
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {  // Simply check if user exists instead of authState.isAuthenticated
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}