import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-civic-600">Loading CivicSync…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

