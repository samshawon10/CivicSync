/**
 * Single source of truth for Super Admin navigation.
 * The sidebar, the command palette and the section router all read this file,
 * so a new page only has to be registered once.
 */
export const adminNav = [
  {
    group: 'Overview',
    items: [
      { key: 'dashboard', label: 'Overview', path: '/admin/dashboard', icon: 'dashboard' },
      { key: 'command-center', label: 'Command Center', path: '/admin/command-center', icon: 'command' }
    ]
  },
  {
    group: 'Operations',
    items: [
      { key: 'emergencies', label: 'Emergency Command', path: '/admin/emergencies', icon: 'siren' },
      { key: 'complaints', label: 'Complaints', path: '/admin/complaints', icon: 'clipboardList' },
      { key: 'alerts', label: 'Alerts & Broadcast', path: '/admin/alerts', icon: 'megaphone' }
    ]
  },
  {
    group: 'People',
    items: [
      { key: 'users', label: 'Users', path: '/admin/users', icon: 'users' },
      { key: 'roles', label: 'Roles & Permissions', path: '/admin/roles', icon: 'shieldCheck' },
      { key: 'departments', label: 'Departments', path: '/admin/departments', icon: 'building2' },
      { key: 'response-teams', label: 'Response Teams', path: '/admin/response-teams', icon: 'route' }
    ]
  },
  {
    group: 'Safety',
    items: [
      { key: 'safety-intelligence', label: 'Safety Intelligence', path: '/admin/safety-intelligence', icon: 'gauge' },
      { key: 'emergency-map', label: 'Emergency Map', path: '/admin/emergency-map', icon: 'map' },
      { key: 'safety-heatmap', label: 'Safety Heatmap', path: '/admin/safety-heatmap', icon: 'activity' }
    ]
  },
  {
    group: 'Resources',
    items: [
      { key: 'facilities', label: 'Facilities', path: '/admin/facilities', icon: 'hospital' },
      { key: 'categories', label: 'Emergency Categories', path: '/admin/categories', icon: 'layers' },
      { key: 'service-config', label: 'Service Configuration', path: '/admin/service-config', icon: 'sliders' }
    ]
  },
  {
    group: 'Analytics',
    items: [
      { key: 'analytics', label: 'System Analytics', path: '/admin/analytics', icon: 'chartBar' },
      { key: 'emergency-analytics', label: 'Emergency Analytics', path: '/admin/emergency-analytics', icon: 'siren' },
      { key: 'department-analytics', label: 'Operations Analytics', path: '/admin/department-analytics', icon: 'briefcase' },
      { key: 'safety-analytics', label: 'Safety Analytics', path: '/admin/safety-analytics', icon: 'shield' }
    ]
  },
  {
    group: 'Governance',
    items: [
      { key: 'audit-logs', label: 'Audit Logs', path: '/admin/audit-logs', icon: 'scroll' },
      { key: 'activity-logs', label: 'Activity Logs', path: '/admin/activity-logs', icon: 'activity' },
      { key: 'security-center', label: 'Security Center', path: '/admin/security-center', icon: 'shieldAlert' },
      { key: 'system-health', label: 'System Health', path: '/admin/system-health', icon: 'server' }
    ]
  },
  {
    group: 'System',
    items: [
      { key: 'settings', label: 'System Settings', path: '/admin/settings', icon: 'settings' },
      { key: 'feature-flags', label: 'Feature Flags', path: '/admin/feature-flags', icon: 'sliders' },
      { key: 'profile', label: 'Admin Profile', path: '/admin/profile', icon: 'user' }
    ]
  }
];

/** Sections kept for backwards compatibility with the previous portal URLs. */
export const legacySections = {
  reports: 'complaints',
  notifications: 'notifications',
  profile: 'profile',
  help: 'help'
};

export const navItems = adminNav.flatMap((group) => group.items.map((item) => ({ ...item, group: group.group })));

const hiddenNavItems = [
  { key: 'notifications', label: 'Notifications', path: '/admin/notifications', icon: 'bell', group: 'Account' }
];

export const allNavItems = [...navItems, ...hiddenNavItems];

export function navItemFor(section) {
  const resolved = legacySections[section] || section;
  return allNavItems.find((item) => item.key === resolved) || null;
}

export const breadcrumbFor = (section) => {
  const item = navItemFor(section);
  if (!item) return { group: 'Administration', label: 'Overview' };
  return { group: item.group, label: item.label };
};
