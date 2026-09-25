import { useMemo } from 'react';
import { allNavItems } from './adminNav.js';
import GlobalSearch from '../search/GlobalSearch.jsx';

/**
 * Super Admin command palette (Ctrl/Cmd+K).
 *
 * Keeps the exact contract SuperAdminLayout already uses ({ open, onClose }) but
 * renders the platform-wide Global CivicSearch surface instead of its own
 * private search. The backend resolves an admin session to the full authorized
 * category set (server/services/civicSearchScope.js), so the product has one
 * search implementation rather than one per role.
 */
export default function CommandPalette({ open, onClose }) {
  const navCommands = useMemo(() => allNavItems.map((item) => ({
    id: item.key,
    label: item.label,
    subtitle: item.group,
    group: 'Go to',
    icon: item.icon,
    path: item.path
  })), []);
  return <GlobalSearch open={open} onClose={onClose} navCommands={navCommands} placeholder="Search CivicSync — users, cases, alerts, facilities…" />;
}

