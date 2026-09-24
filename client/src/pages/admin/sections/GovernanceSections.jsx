import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../../services/adminService.js';
import { notificationsApi } from '../../../services/notificationService.js';
import useAsync from '../../../hooks/useAsync.js';
import { apiMessage } from '../../../services/api.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import DataTable from '../../../components/ui/DataTable.jsx';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, Field, KeyValue, Pagination, SectionHeading, StatCard, Toggle } from '../../../components/ui/primitives.jsx';
import { Modal } from '../../../components/ui/Overlays.jsx';
import { SkeletonKpiGrid, SkeletonList } from '../../../components/ui/Skeleton.jsx';
import { useToast } from '../../../components/ui/Toaster.jsx';
import { cx, formatDateTime, formatNumber, formatRelative, labelize, statusTone } from '../../../utils/format.js';
import { roleLabels } from '../../../utils/roles.js';

const resultTone = (result) => (result === 'success' ? 'success' : result === 'failure' ? 'critical' : 'neutral');

/* --------------------------------------------- Shared audit-log plumbing */

function useLogs() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const [module, setModule] = useState('');
  const [result, setResult] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);

  const logs = useAsync(
    () => adminApi.logs({ search: query, action, module, result, page, limit: 20 }).then((response) => response.data),
    [query, action, module, result, page]
  );

  return {
    search, setSearch, action, setAction, module, setModule, result, setResult, page, setPage,
    logs,
    rows: logs.data?.logs || [],
    pagination: logs.data?.pagination,
    facets: logs.data?.facets || { actions: [], modules: [], roles: [] }
  };
}

function LogToolbar({ store }) {
  const anyFilter = store.search || store.action || store.module || store.result;
  return (
    <>
      <input value={store.search} onChange={(event) => store.setSearch(event.target.value)} placeholder="Search action, target or description…" aria-label="Search logs" className="w-64" />
      <select value={store.action} onChange={(event) => { store.setAction(event.target.value); store.setPage(1); }} aria-label="Filter by action">
        <option value="">All actions</option>
        {store.facets.actions.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
      </select>
      <select value={store.module} onChange={(event) => { store.setModule(event.target.value); store.setPage(1); }} aria-label="Filter by module">
        <option value="">All modules</option>
        {store.facets.modules.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
      </select>
      <select value={store.result} onChange={(event) => { store.setResult(event.target.value); store.setPage(1); }} aria-label="Filter by result">
        <option value="">All results</option>
        <option value="success">Success</option>
        <option value="failure">Failure</option>
        <option value="info">Info</option>
      </select>
      {anyFilter ? (
        <Button size="sm" icon="close" onClick={() => { store.setSearch(''); store.setAction(''); store.setModule(''); store.setResult(''); store.setPage(1); }}>Clear</Button>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------ Activity */

export function ActivityLogsSection() {
  const store = useLogs();
  const groups = store.rows.reduce((accumulator, row) => {
    const day = new Date(row.createdAt).toLocaleDateString();
    if (!accumulator[day]) accumulator[day] = [];
    accumulator[day].push(row);
    return accumulator;
  }, {});
  return (
    <div className="space-y-5">
      <SectionHeading
        title="Activity timeline"
        subtitle={`${formatNumber(store.pagination?.total ?? 0)} event(s). Day-by-day view of everything administrators changed.`}
      />
      <div className="flex flex-wrap gap-2">
        <LogToolbar store={store} />
      </div>
      {store.logs.loading && <SkeletonList rows={8} />}
      {!store.logs.loading && store.logs.error && <ErrorState message={store.logs.error} onRetry={store.logs.reload} />}
      {!store.logs.loading && !store.logs.error && !store.rows.length && (
        <EmptyState icon="activity" title="No activity matches" hint="Adjust the filters or perform an administrative action to populate the trail." />
      )}
      {Object.entries(groups).map(([day, entries]) => (
        <div key={day}>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-fg-subtle">{day}</p>
          <ol className="space-y-3 border-l-2 pl-4" style={{ borderColor: 'var(--line)' }}>
            {entries.map((entry) => (
              <li key={entry._id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.result === 'failure' ? '#ef4444' : entry.result === 'success' ? '#10b981' : 'var(--line-strong)' }} aria-hidden="true" />
                <div className="rounded-xl border p-3.5" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-fg">{labelize(entry.action)}</p>
                    <div className="flex items-center gap-2">
                      <Badge tone={resultTone(entry.result)}>{labelize(entry.result || 'info')}</Badge>
                      <span className="tabular text-[11px] text-fg-subtle">{new Date(entry.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <p className="mt-1 text-[12px] text-fg-muted">{entry.description || '—'}</p>
                  <p className="mt-1 text-[11px] text-fg-subtle">
                    {entry.admin?.name || 'Administrator'} · {roleLabels[entry.actorRole] || labelize(entry.actorRole || 'role not recorded')} · {labelize(entry.targetType)}
                    {entry.targetName ? ` · ${entry.targetName}` : ''} · {formatRelative(entry.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <Pagination
        page={store.pagination?.page || 1}
        pages={store.pagination?.pages || 1}
        total={store.pagination?.total || 0}
        limit={store.pagination?.limit || 20}
        onPage={store.setPage}
      />
    </div>
  );
}
/* ---------------------------------------------------------------- Audit */

export function AuditLogsSection() {
  const store = useLogs();
  const [searchParams, setSearchParams] = useSearchParams();
  const [focused, setFocused] = useState(null);

  useEffect(() => {
    const focus = searchParams.get('focus');
    if (!focus || !store.logs.data) return;
    setFocused(store.rows.find((row) => String(row._id) === focus) || null);
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
  }, [store.logs.data, store.rows, searchParams, setSearchParams]);

  const columns = [
    {
      key: 'createdAt', label: 'Timestamp', sortable: true, width: '170px',
      render: (row) => <span className="tabular text-[13px] text-fg-muted">{formatDateTime(row.createdAt)}</span>
    },
    {
      key: 'admin', label: 'Actor',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-fg">{row.admin?.name || 'Removed account'}</p>
          <p className="truncate text-[11px] text-fg-muted">{row.admin?.email || '—'}</p>
        </div>
      )
    },
    { key: 'actorRole', label: 'Role at action', render: (row) => <Badge tone="neutral">{roleLabels[row.actorRole] || 'Not recorded'}</Badge> },
    { key: 'action', label: 'Action', sortable: true, render: (row) => <span className="text-[13px] font-medium text-fg">{labelize(row.action)}</span> },
    { key: 'targetType', label: 'Module', render: (row) => <Badge tone="info">{labelize(row.targetType)}</Badge> },
    { key: 'targetName', label: 'Target', render: (row) => <span className="block max-w-[180px] truncate text-[13px] text-fg-muted" title={row.targetName}>{row.targetName || '—'}</span> },
    { key: 'description', label: 'Detail', render: (row) => <span className="block max-w-[260px] truncate text-[12px] text-fg-muted" title={row.description}>{row.description || '—'}</span> },
    { key: 'result', label: 'Result', render: (row) => <Badge tone={resultTone(row.result)}>{labelize(row.result || 'info')}</Badge> }
  ];

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Audit logs"
        subtitle={`${formatNumber(store.pagination?.total ?? 0)} record(s). Actor, module, resource and result for every administrative action.`}
      />
      <div className="flex flex-wrap gap-2">
        <LogToolbar store={store} />
      </div>
      <DataTable
        caption="Audit logs"
        columns={columns}
        rows={store.rows}
        loading={store.logs.loading}
        error={store.logs.error}
        onRetry={store.logs.reload}
        rowKey={(row) => row._id}
        onRowClick={(row) => setFocused(row)}
        empty={{ icon: 'scroll', title: 'No audit records match', hint: 'Adjust the filters — every admin mutation writes here with its outcome.' }}
        toolbar={
          <p className="text-[12px] text-fg-subtle">
            Legacy rows may show “Not recorded” for the actor role; the backend stores a role snapshot on every new write.
          </p>
        }
        pagination={store.pagination ? { page: store.pagination.page, pages: store.pagination.pages, total: store.pagination.total, limit: store.pagination.limit } : undefined}
        onPage={store.setPage}
      />
      <Modal open={Boolean(focused)} onClose={() => setFocused(null)} title="Audit event" subtitle="Immutable action metadata captured by the backend.">
        {focused ? (
          <div className="space-y-4">
            <KeyValue
              items={[
                { label: 'Timestamp', value: formatDateTime(focused.createdAt) },
                { label: 'Actor', value: focused.admin?.name || 'Removed account' },
                { label: 'Role at action', value: roleLabels[focused.actorRole] || 'Not recorded' },
                { label: 'Result', value: <Badge tone={resultTone(focused.result)}>{labelize(focused.result || 'info')}</Badge> },
                { label: 'Action', value: labelize(focused.action) },
                { label: 'Module', value: labelize(focused.targetType) },
                { label: 'Target', value: focused.targetName || '—' },
                { label: 'Target ID', value: String(focused.targetId || '—') }
              ]}
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Description</p>
              <p className="mt-1 text-[13px] text-fg">{focused.description || '—'}</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
/* -------------------------------------------------------------- Settings */

const numberFields = {
  security: ['activityRetentionDays'],
  emergency: ['escalationMinutes', 'responseSlaMinutes', 'criticalSlaMinutes', 'highSlaMinutes', 'mediumSlaMinutes', 'lowSlaMinutes', 'duplicateRadiusMeters'],
  map: ['defaultLatitude', 'defaultLongitude', 'defaultZoom']
};

export function SettingsSection() {
  const toast = useToast();
  const settingsRequest = useAsync(() => adminApi.settings().then((response) => response.data), []);
  const [form, setForm] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (settingsRequest.data?.settings) {
      setForm(structuredClone(settingsRequest.data.settings));
      setBaseline(structuredClone(settingsRequest.data.settings));
    }
  }, [settingsRequest.data]);

  function updateField(section, field, rawValue, isNumber) {
    setForm((current) => {
      if (!current) return current;
      const value = isNumber ? (rawValue === '' ? '' : Number(rawValue)) : rawValue;
      return { ...current, [section]: { ...current[section], [field]: value } };
    });
  }

  async function save() {
    setBusy(true); setError('');
    try {
      const { data } = await adminApi.updateSettings(form);
      toast.success(data.changed?.length ? `Settings saved. Updated: ${data.changed.join(', ')}.` : 'Settings saved with no field changes.');
      setBaseline(structuredClone(data.settings || form));
      settingsRequest.reload();
    } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); }
  }

  const dirty = Boolean(form && baseline && JSON.stringify(form) !== JSON.stringify(baseline));

  function renderFields(section, fields) {
    if (!form?.[section]) return null;
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const value = form[section][field];
          if (typeof value === 'boolean') {
            return <Toggle key={field} checked={value} onChange={(next) => updateField(section, field, next, false)} label={labelize(field)} />;
          }
          const isNumber = (numberFields[section] || []).includes(field);
          return (
            <Field key={field} label={labelize(field)}>
              {field === 'language' ? (
                <select value={value} onChange={(event) => updateField(section, field, event.target.value, false)}>
                  <option value="en">English</option>
                  <option value="bn">বাংলা (Bengali)</option>
                </select>
              ) : field === 'defaultSeverity' ? (
                <select value={value} onChange={(event) => updateField(section, field, event.target.value, false)}>
                  {['low', 'medium', 'high', 'critical'].map((option) => <option key={option} value={option}>{labelize(option)}</option>)}
                </select>
              ) : (
                <input
                  type={isNumber ? 'number' : field === 'contactEmail' ? 'email' : 'text'}
                  value={value}
                  step="any"
                  onChange={(event) => updateField(section, field, event.target.value, isNumber)}
                />
              )}
            </Field>
          );
        })}
      </div>
    );
  }
  if (settingsRequest.loading) return <SkeletonList rows={6} />;
  if (settingsRequest.error) return <ErrorState message={settingsRequest.error} onRetry={settingsRequest.reload} />;
  if (!form) return <EmptyState icon="settings" title="No settings found" hint="The settings document has not been created yet." />;

  const sections = [
    { key: 'general', title: 'General', icon: 'settings', fields: ['portalName', 'timezone', 'language', 'contactEmail'] },
    { key: 'notifications', title: 'Notifications', icon: 'bell', fields: ['emailDigest', 'criticalAlerts', 'inApp'] },
    { key: 'security', title: 'Security', icon: 'shieldCheck', fields: ['sessionNotice', 'activityRetentionDays'] },
    { key: 'emergency', title: 'Emergency', icon: 'siren', fields: ['defaultSeverity', 'escalationMinutes', 'responseSlaMinutes', 'criticalSlaMinutes', 'highSlaMinutes', 'mediumSlaMinutes', 'lowSlaMinutes', 'duplicateRadiusMeters', 'autoClassifyAdvisory'] },
    { key: 'map', title: 'Map defaults', icon: 'map', fields: ['defaultLatitude', 'defaultLongitude', 'defaultZoom', 'clusterMarkers'] },
    { key: 'features', title: 'Feature flags', icon: 'sliders', fields: ['emergency', 'womenSafety', 'safetyHeatmap', 'aiClassification', 'emergencyBroadcast', 'analytics'] }
  ];

  return (
    <div className="space-y-5">
      <SectionHeading
        title="System settings"
        subtitle="Whitelisted platform configuration. Secrets are never exposed here."
        action={<Button variant="primary" icon="check" loading={busy} disabled={!dirty} onClick={save}>Save changes</Button>}
      />
      {error ? <ErrorState message={error} /> : null}
      {sections.map((section) => (
        <Card key={section.key}>
          <CardHeader
            icon={section.icon}
            title={section.title}
            subtitle={section.key === 'features' ? 'Backend-stored flags; supported server consumers apply them without bypassing authorization.' : undefined}
          />
          <CardBody>{renderFields(section.key, section.fields)}</CardBody>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- Profile + notifs */

export function ProfileSection() {
  const { user } = useAuth();

  return (
    <div className="space-y-5">
      <SectionHeading title="Admin profile" subtitle="Your account, session security and how your activity is audited." />
      <Card>
        <CardHeader icon="user" title={user?.name || 'Administrator'} subtitle={user?.email || ''} />
        <CardBody>
          <KeyValue
            items={[
              { label: 'Role', value: user?.role ? roleLabels[user.role] || labelize(user.role) : '—' },
              { label: 'Department', value: user?.departmentName || '—' },
              { label: 'Status', value: user?.status ? labelize(user.status) : '—' },
              { label: 'Phone', value: user?.phone || '—' }
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon="shieldCheck" title="Session security" subtitle="Password and session management stay with Firebase auth — this console never handles credentials." />
        <CardBody>
          <p className="text-[13px] text-fg-muted">
            Every action you take here is written to the audit trail with your account as the actor. Use the Audit
            Logs page to review recent administrative actions taken under this account.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

export function NotificationsSection() {
  const toast = useToast();
  const feed = useAsync(() => notificationsApi.list().then((response) => response.data), []);
  const [busy, setBusy] = useState(false);
  const items = feed.data?.notifications || [];
  const unread = feed.data?.unreadCount ?? items.filter((item) => !item.readAt).length;

  async function markAll() {
    setBusy(true);
    try {
      await notificationsApi.readAll();
      toast.success('All notifications marked as read.');
      feed.reload();
    } catch (err) { toast.error(apiMessage(err)); } finally { setBusy(false); }
  }

  async function markOne(id) {
    try {
      await notificationsApi.read(id);
      feed.reload();
    } catch (err) { toast.error(apiMessage(err)); }
  }

  async function removeOne(id) {
    try {
      await notificationsApi.remove(id);
      feed.reload();
    } catch (err) { toast.error(apiMessage(err)); }
  }

  if (feed.loading) return <SkeletonList rows={6} />;
  if (feed.error) return <ErrorState message={feed.error} onRetry={feed.reload} />;

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Notifications"
        subtitle={`${formatNumber(unread)} unread · your in-app feed with read-state management.`}
        action={<Button icon="check" loading={busy} disabled={!items.some((item) => !item.readAt)} onClick={markAll}>Mark all read</Button>}
      />
      {!items.length ? (
        <EmptyState icon="bell" title="All caught up" hint="New safety broadcasts and platform updates will appear here." />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item._id} className={cx('rounded-xl border p-3.5', !item.readAt && 'border-civic-300 bg-civic-50')} style={{ borderColor: item.readAt ? 'var(--line)' : undefined }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-fg">{item.title || labelize(item.type || 'notification')}</p>
                  <p className="mt-0.5 text-[13px] text-fg-muted">{item.message || item.body || '—'}</p>
                  <p className="mt-1 text-[11px] text-fg-subtle">{formatRelative(item.createdAt)} · {formatDateTime(item.createdAt)}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {!item.readAt ? <Button size="sm" icon="check" onClick={() => markOne(item._id)}>Mark read</Button> : null}
                  <Button size="sm" icon="trash" onClick={() => removeOne(item._id)}>Delete</Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
