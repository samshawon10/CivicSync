import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { dashboardPathFor } from '../utils/roles.js';
import { GlobalSearchProvider } from '../components/search/GlobalSearch.jsx';

/**
 * Role gate for every dashboard.
 *
 * Also owns the single Global CivicSearch instance for non-admin dashboards
 * (Ctrl/Cmd+K). The Super Admin shell mounts the same component through
 * CommandPalette, so no role gets a second, divergent search implementation.
 */
export default function RoleGuard({ role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-civic-600">Loading CivicSync…</div>;
  if (!user) return <Navigate to="/login" replace />;
  const allowedRoles = Array.isArray(role) ? role : [role];
  if (!allowedRoles.includes(user.role)) return <Navigate to={dashboardPathFor(user.role)} replace />;
  if (user.role === 'admin') return <Outlet />;
  return <GlobalSearchProvider><Outlet /></GlobalSearchProvider>;
}
