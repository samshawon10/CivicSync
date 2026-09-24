import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import RoleGuard from './routes/RoleGuard.jsx';
import { AdminDashboard, DepartmentHeadDashboard, DepartmentOfficerDashboard, OfficerDashboard, FieldWorkerDashboard } from './pages/RoleDashboards.jsx';
import CitizenDashboard from './pages/citizen/CitizenDashboard.jsx';
import ReportDetails from './pages/citizen/ReportDetails.jsx';
import CitizenReports from './pages/citizen/CitizenReports.jsx';
import CreateReport from './pages/citizen/CreateReport.jsx';
import CitizenAccount from './pages/citizen/CitizenAccount.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { dashboardPathFor } from './utils/roles.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import NotFound from './pages/NotFound.jsx';
const AdminPortal = lazy(() => import('./pages/admin/AdminPortal.jsx'));
const CitizenEmergency = lazy(() => import('./pages/citizen/CitizenEmergency.jsx'));
const CreateEmergency = lazy(() => import('./pages/citizen/CreateEmergency.jsx'));
const EmergencyTracking = lazy(() => import('./pages/citizen/EmergencyTracking.jsx'));
const SafetyMap = lazy(() => import('./pages/citizen/SafetyMap.jsx'));
const NearbyServices = lazy(() => import('./pages/citizen/NearbyServices.jsx'));
import SafetyAlerts from './pages/citizen/SafetyAlerts.jsx';
import EmergencyContacts from './pages/citizen/EmergencyContacts.jsx';
import WomenSafety from './pages/citizen/WomenSafety.jsx';
import EmergencyAnalytics from './pages/emergency/EmergencyAnalytics.jsx';
import EmergencyDashboard from './pages/emergency/EmergencyDashboard.jsx';

export default function App() {
  const { user, loading } = useAuth();
  const roleRedirect = loading ? <div className="grid min-h-screen place-items-center text-civic-600">Loading CivicSync…</div> : <Navigate to={user ? dashboardPathFor(user.role) : '/login'} replace />;
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-semibold text-civic-600" aria-live="polite">Loading CivicSync…</div>}>
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={roleRedirect} />
      </Route>
      <Route element={<RoleGuard role="citizen" />}>
        <Route path="/dashboard/citizen" element={<CitizenDashboard />} />
        <Route path="/dashboard/citizen/emergency" element={<CitizenEmergency />} />
        <Route path="/dashboard/citizen/emergency/new" element={<CreateEmergency />} />
        <Route path="/dashboard/citizen/emergency/:id" element={<EmergencyTracking />} />
        <Route path="/dashboard/citizen/women-safety" element={<WomenSafety />} />
        <Route path="/dashboard/citizen/safety-map" element={<SafetyMap />} />
        <Route path="/dashboard/citizen/alerts" element={<SafetyAlerts />} />
        <Route path="/dashboard/citizen/nearby-services" element={<NearbyServices />} />
        <Route path="/dashboard/citizen/emergency-contacts" element={<EmergencyContacts />} />
        <Route path="/dashboard/citizen/reports/new" element={<CreateReport />} />
        <Route path="/dashboard/citizen/reports" element={<CitizenReports />} />
        <Route path="/dashboard/citizen/reports/:id" element={<ReportDetails />} />
        <Route path="/dashboard/citizen/:section" element={<CitizenAccount />} />
      </Route>
      <Route element={<RoleGuard role="department_head" />}>
        <Route path="/dashboard/department-head" element={<DepartmentHeadDashboard />} />
      </Route>
      <Route element={<RoleGuard role="department_officer" />}>
        <Route path="/dashboard/department-officer" element={<DepartmentOfficerDashboard />} />
      </Route>
      <Route element={<RoleGuard role="officer" />}>
        <Route path="/dashboard/officer" element={<OfficerDashboard />} />
      </Route>
      <Route element={<RoleGuard role="field_worker" />}>
        <Route path="/dashboard/field-worker" element={<FieldWorkerDashboard />} />
      </Route>
      <Route element={<RoleGuard role="emergency_department_head" />}>
        <Route path="/dashboard/emergency-head" element={<EmergencyDashboard mode="command" />} />
        <Route path="/dashboard/emergency-head/analytics" element={<EmergencyAnalytics />} />
      </Route>
      <Route element={<RoleGuard role={['emergency_department_officer', 'emergency_officer']} />}>
        <Route path="/dashboard/emergency-officer" element={<EmergencyDashboard mode="officer" />} />
      </Route>
      <Route element={<RoleGuard role="emergency_field_worker" />}>
        <Route path="/dashboard/emergency-field-worker" element={<EmergencyDashboard mode="field" />} />
      </Route>
      <Route element={<RoleGuard role="admin" />}>
        <Route path="/dashboard/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/:section" element={<AdminPortal />} />
      </Route>
      <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
