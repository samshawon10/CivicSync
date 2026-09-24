import PageHead from '../../components/ui/PageHead.jsx';
import NotFound from '../NotFound.jsx';
import { useLocation, useSearchParams } from 'react-router-dom';
import SuperAdminLayout from '../../components/admin/SuperAdminLayout.jsx';
import { AdminRealtimeProvider } from '../../context/AdminRealtimeContext.jsx';
import { breadcrumbFor, legacySections } from '../../components/admin/adminNav.js';
import OverviewSection from './sections/OverviewSection.jsx';
import { DepartmentsSection, RolesPermissionsSection, UsersSection } from './sections/PeopleSections.jsx';
import { AlertsSection, ComplaintsSection, EmergenciesSection } from './sections/OperationsSections.jsx';
import { CategoriesSection, FacilitiesSection, ResponseTeamsSection, ServiceConfigSection } from './sections/ResourceSections.jsx';
import { AnalyticsSection, EmergencyMapSection, SafetyHeatmapSection, SafetyIntelligenceSection } from './sections/IntelligenceSections.jsx';
import { ActivityLogsSection, AuditLogsSection, NotificationsSection, ProfileSection, SettingsSection } from './sections/GovernanceSections.jsx';
import { FeatureFlagsSection, SecurityCenterSection, SystemHealthSection } from './sections/SystemSections.jsx';

/**
 * Super Admin section registry. Each entry renders inside the shared
 * SuperAdminLayout, so every page inherits the same shell, chrome, command
 * palette, skeleton system and design language.
 */
const registry = {
  dashboard: { Component: OverviewSection, title: 'Overview', subtitle: 'System-wide operational picture across citizens, complaints, emergencies and safety resources.' },
  'command-center': { Component: OverviewSection, title: 'Command Center', subtitle: 'Live governance command center: what is happening, where, who is responsible and what needs attention.' },
  emergencies: { Component: EmergenciesSection, title: 'Emergency Command overview', subtitle: 'Governance view of every incident. Dispatch and lifecycle actions stay on the operational command centre.' },
  complaints: { Component: ComplaintsSection, title: 'Complaints', subtitle: 'Civic complaints across all departments, with governance overrides and CSV export.' },
  alerts: { Component: AlertsSection, title: 'Alerts & Broadcast', subtitle: 'Publish, expire and review public safety broadcasts delivered to citizen notification feeds.' },
  users: { Component: UsersSection, title: 'Users', subtitle: 'Accounts, roles, departments and account status across the whole platform.' },
  roles: { Component: RolesPermissionsSection, title: 'Roles & Permissions', subtitle: 'The capability matrix this backend actually enforces, with live account counts per role.' },
  departments: { Component: DepartmentsSection, title: 'Departments', subtitle: 'Civic and emergency departments, their heads, routing and status.' },
  'response-teams': { Component: ResponseTeamsSection, title: 'Response Teams', subtitle: 'Team rosters, availability and live assignment utilisation.' },
  'safety-intelligence': { Component: SafetyIntelligenceSection, title: 'Safety Intelligence', subtitle: 'Aggregated, anonymised intelligence from real citizen reports — never a statement of objective risk.' },
  'emergency-map': { Component: EmergencyMapSection, title: 'Emergency Map', subtitle: 'Active incidents, responders, facilities and reported incident density on one GIS view.' },
  'safety-heatmap': { Component: SafetyHeatmapSection, title: 'Safety Heatmap', subtitle: 'Reported incident density by period and category. Restricted incidents are never plotted.' },
  facilities: { Component: FacilitiesSection, title: 'Facilities', subtitle: 'Manage real emergency, safety, healthcare and civic service locations used by the public map and nearest-help search.' },
  categories: { Component: CategoriesSection, title: 'Emergency Categories', subtitle: 'Configured and built-in categories joined with real usage counts.' },
  'response-time': { Component: CategoriesSection, title: 'Response Time Management', subtitle: 'Configure response targets, warning thresholds and measured response-time rules using the existing emergency category records.' },
  'service-config': { Component: ServiceConfigSection, title: 'Service Configuration', subtitle: 'Emergency routing per department and the report categories citizens can choose.' },
  analytics: { Component: AnalyticsSection, title: 'System Analytics', subtitle: 'Platform growth, role distribution and complaint throughput.' },
  'emergency-analytics': { Component: AnalyticsSection, title: 'Emergency Analytics', subtitle: 'Incident volume, severity and response-time metrics from the emergency collection.' },
  'department-analytics': { Component: AnalyticsSection, title: 'Operations Analytics', subtitle: 'Department workload, response-team utilisation and responder workload.' },
  'safety-analytics': { Component: AnalyticsSection, title: 'Safety Analytics', subtitle: 'Safety domains derived from aggregated incident reports.' },
  'audit-logs': { Component: AuditLogsSection, title: 'Audit Logs', subtitle: 'Every administrative action with actor, module, resource and result.' },
  'activity-logs': { Component: ActivityLogsSection, title: 'Activity Logs', subtitle: 'Timeline of platform events raised by governance actions.' },
  'security-center': { Component: SecurityCenterSection, title: 'Security Center', subtitle: 'Security-relevant evidence from the real audit trail, with unmonitored capabilities labelled explicitly.' },
  'system-health': { Component: SystemHealthSection, title: 'System Health', subtitle: 'Runtime probes for API, database, authentication, realtime, notifications and storage; unprobed services remain unknown.' },
  settings: { Component: SettingsSection, title: 'System Settings', subtitle: 'Whitelisted platform configuration. Secrets are never exposed or editable here.' },
  'feature-flags': { Component: FeatureFlagsSection, title: 'Feature Flags', subtitle: 'Backend-stored flags for the existing CivicSync feature surfaces.' },
  profile: { Component: ProfileSection, title: 'Admin Profile', subtitle: 'Your account, session security and recent administrative activity.' },
  notifications: { Component: NotificationsSection, title: 'Notifications', subtitle: 'Your in-app notification feed with read-state management.' }
};

export default function AdminPortal() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sectionKey = location.pathname.replace('/admin/', '') || 'dashboard';
  const key = legacySections[sectionKey] || sectionKey;
  const entry = registry[key];
  if (!entry) return <NotFound />;
  const Component = entry.Component;

  return (
    <AdminRealtimeProvider>
      <PageHead title={entry.title} description={entry.subtitle} />
      <SuperAdminLayout section={key} title={entry.title} subtitle={entry.subtitle} breadcrumb={breadcrumbFor(key)}>
        <Component searchParams={searchParams} />
      </SuperAdminLayout>
    </AdminRealtimeProvider>
  );
}
