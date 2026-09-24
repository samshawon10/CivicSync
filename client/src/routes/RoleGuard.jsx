import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { dashboardPathFor } from '../utils/roles.js';

export default function RoleGuard({ role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-civic-600">Loading CivicSync…</div>;
  if (!user) return <Navigate to="/login" replace />;
  const allowedRoles = Array.isArray(role) ? role : [role];
  return allowedRoles.includes(user.role) ? <Outlet /> : <Navigate to={dashboardPathFor(user.role)} replace />;
}
