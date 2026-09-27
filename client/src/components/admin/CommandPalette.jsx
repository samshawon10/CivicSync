import { useMemo } from 'react';
import { allNavItems } from './adminNav.js';
import GlobalSearch from '../search/GlobalSearch.jsx';

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

