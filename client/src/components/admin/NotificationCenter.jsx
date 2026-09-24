import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Drawer } from '../ui/Overlays.jsx';
import { Button, Badge, EmptyState, ErrorState } from '../ui/primitives.jsx';
import { SkeletonList } from '../ui/Skeleton.jsx';
import { useToast } from '../ui/Toaster.jsx';
import Icon from '../ui/Icon.jsx';
import { notificationsApi } from '../../services/notificationService.js';
import { apiMessage } from '../../services/api.js';
import { formatRelative } from '../../utils/format.js';

const typeTone = { report_status: 'info', system: 'neutral' };

/**
 * Admin notification centre backed by the real notification API
 * (in-app delivery only — no email/SMS provider exists in this project).
 */
export default function NotificationCenter({ open, onClose }) {
  const toast = useToast();
  const [state, setState] = useState({ loading: true, notifications: [], unreadCount: 0, error: '' });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const { data } = await notificationsApi.list();
      setState({ loading: false, notifications: data.notifications || [], unreadCount: data.unreadCount || 0, error: '' });
    } catch (error) {
      setState({ loading: false, notifications: [], unreadCount: 0, error: apiMessage(error) });
    }
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  async function markRead(id) {
    try {
      await notificationsApi.read(id);
      setState((current) => ({
        ...current,
        unreadCount: Math.max(0, current.unreadCount - 1),
        notifications: current.notifications.map((item) => (item._id === id ? { ...item, readAt: new Date().toISOString() } : item))
      }));
    } catch (error) { toast.error(apiMessage(error)); }
  }

  async function markAllRead() {
    try {
      await notificationsApi.readAll();
      setState((current) => ({ ...current, unreadCount: 0, notifications: current.notifications.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })) }));
      toast.success('All notifications marked as read.');
    } catch (error) { toast.error(apiMessage(error)); }
  }

  async function remove(id) {
    try {
      await notificationsApi.remove(id);
      setState((current) => {
        const removed = current.notifications.find((item) => item._id === id);
        return {
          ...current,
          notifications: current.notifications.filter((item) => item._id !== id),
          unreadCount: removed && !removed.readAt ? Math.max(0, current.unreadCount - 1) : current.unreadCount
        };
      });
    } catch (error) { toast.error(apiMessage(error)); }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Notification centre"
      subtitle={state.loading ? 'Loading your notifications…' : `${state.unreadCount} unread of ${state.notifications.length} total`}
      width="sm:max-w-md"
      footer={<>
        <Button size="sm" icon="check" onClick={markAllRead} disabled={!state.unreadCount}>Mark all read</Button>
        <Button size="sm" variant="primary" icon="refresh" onClick={load}>Refresh</Button>
      </>}
    >
      {state.loading && <SkeletonList rows={5} />}
      {!state.loading && state.error && <ErrorState message={state.error} onRetry={load} />}
      {!state.loading && !state.error && !state.notifications.length && (
        <EmptyState
          icon="bell"
          title="No notifications yet"
          hint="Emergency dispatches, complaint updates and configuration changes raised for your account appear here."
        />
      )}
      {!state.loading && !state.error && state.notifications.length > 0 && (
        <ul className="space-y-2">
          {state.notifications.map((item) => (
            <li key={item._id} className="rounded-xl border border-line p-3" style={item.readAt ? undefined : { backgroundColor: 'color-mix(in oklab, var(--color-civic-500) 8%, var(--surface))' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={typeTone[item.type] || 'neutral'}>{String(item.type || 'system').replaceAll('_', ' ')}</Badge>
                    {!item.readAt && <Badge tone="info" icon="dot">Unread</Badge>}
                    <span className="text-[11px] text-fg-subtle">{formatRelative(item.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-[13px] font-medium text-fg">{item.message}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  {!item.readAt && (
                    <Button size="sm" variant="ghost" onClick={() => markRead(item._id)}>Mark read</Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(item._id)} aria-label="Delete notification">
                    <Icon name="trash" size={15} />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[11px] text-fg-subtle">
        Delivery channel: in-app only. See <Link to="/admin/settings" onClick={onClose} className="font-semibold text-civic-600">System Settings → Notifications</Link> for the recorded configuration.
      </p>
    </Drawer>
  );
}
