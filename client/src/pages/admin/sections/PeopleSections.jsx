import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../../services/adminService.js';
import useAsync from '../../../hooks/useAsync.js';
import { apiMessage } from '../../../services/api.js';
import DataTable from '../../../components/ui/DataTable.jsx';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, Field, KeyValue, SectionHeading, StatCard } from '../../../components/ui/primitives.jsx';
import { SkeletonKpiGrid, SkeletonList } from '../../../components/ui/Skeleton.jsx';
import { ConfirmDialog, Drawer, Modal } from '../../../components/ui/Overlays.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import { useToast } from '../../../components/ui/Toaster.jsx';
import { cx, formatDate, formatDateTime, formatNumber, formatRelative, labelize, statusTone } from '../../../utils/format.js';
import { roles as allRoles, roleLabels } from '../../../utils/roles.js';

const roleTone = (role) => (role === 'admin' ? 'info' : role === 'citizen' ? 'neutral' : String(role || '').startsWith('emergency') ? 'high' : 'success');

const assignableRoles = [
  { value: 'citizen', label: 'Citizen' },
  { value: 'department_officer', label: 'Department Officer' },
  { value: 'officer', label: 'Officer' },
  { value: 'field_worker', label: 'Field Worker' },
  { value: 'emergency_department_officer', label: 'Emergency Dept. Officer' },
  { value: 'emergency_officer', label: 'Emergency Officer' },
  { value: 'emergency_field_worker', label: 'Emergency Field Worker' },
  { value: 'admin', label: 'Super Admin' }
];

/* ------------------------------------------------------------------ Users */

export function UsersSection() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [roleTarget, setRoleTarget] = useState(null);
  const [roleForm, setRoleForm] = useState({ role: 'citizen', departmentId: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detail, setDetail] = useState({ open: false, id: null, loading: false, error: '', data: null });

  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);

  const users = useAsync(
    () => adminApi.users({ search: query, role, status, page, limit: 15 }).then((r) => r.data),
    [query, role, status, page]
  );
  const departments = useAsync(() => adminApi.departments({ limit: 50 }).then((r) => r.data.departments), []);

  const rows = users.data?.users || [];
  const pagination = users.data?.pagination;

  function openDetail(id) {
    if (!id) return;
    setDetail({ open: true, id, loading: true, error: '', data: null });
    adminApi.user(id)
      .then(({ data }) => setDetail({ open: true, id, loading: false, error: '', data }))
      .catch((error) => setDetail({ open: true, id, loading: false, error: apiMessage(error), data: null }));
  }

  useEffect(() => {
    const focus = searchParams.get('user');
    if (focus) {
      openDetail(focus);
      const next = new URLSearchParams(searchParams);
      next.delete('user');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next react-hooks/exhaustive-deps
  }, []);

  function openRole(user) { setFormError(''); setRoleForm({ role: user.role, departmentId: user.department?._id || user.department || '' }); setRoleTarget(user); }

  async function saveRole() {
    setBusy(true); setFormError('');
    try {
      await adminApi.updateUserRole(roleTarget.id, { role: roleForm.role, departmentId: roleForm.departmentId || undefined });
      toast.success(`${roleTarget.name} is now ${assignableRoles.find((r) => r.value === roleForm.role)?.label || roleForm.role}.`);
      setRoleTarget(null);
      users.reload();
    } catch (error) { setFormError(apiMessage(error)); } finally { setBusy(false); }
  }

  async function toggleStatus() {
    setBusy(true);
    try {
      const next = suspendTarget.status === 'active' ? 'suspended' : 'active';
      await adminApi.updateUserStatus(suspendTarget.id, next);
      toast.success(`${suspendTarget.name} ${next === 'active' ? 'reactivated' : 'suspended'}.`);
      setSuspendTarget(null);
      users.reload();
      if (detail.id === suspendTarget.id) openDetail(suspendTarget.id);
    } catch (error) { toast.error(apiMessage(error)); } finally { setBusy(false); }
  }

  async function removeUser() {
    setBusy(true);
    try {
      await adminApi.deleteUser(deleteTarget.id);
      toast.success(`${deleteTarget.name} deleted.`);
      setDeleteTarget(null);
      users.reload();
    } catch (error) { toast.error(apiMessage(error)); } finally { setBusy(false); }
  }
  const columns = [
    {
      key: 'name', label: 'Account', sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--fg-subtle)' }}>
            {String(row.name || '?').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-fg">{row.name}</p>
            <p className="truncate text-[11px] text-fg-muted">{row.email}</p>
          </div>
        </div>
      )
    },
    { key: 'role', label: 'Role', sortable: true, render: (row) => <Badge tone={roleTone(row.role)}>{labelize(row.role)}</Badge> },
    { key: 'departmentName', label: 'Department', sortable: true, render: (row) => <span className="text-[13px] text-fg-muted">{row.departmentName || '—'}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (row) => <Badge tone={statusTone(row.status)}>{labelize(row.status)}</Badge> },
    { key: 'createdAt', label: 'Joined', sortable: true, render: (row) => <span className="text-[13px] text-fg-muted">{formatDate(row.createdAt)}</span> },
    {
      key: 'actions', label: '', align: 'right',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" icon="eye" onClick={() => openDetail(row.id)}>View</Button>
          <Button size="sm" icon="shield" onClick={() => openRole(row)}>Role</Button>
          <Button size="sm" icon={row.status === 'active' ? 'lock' : 'check'} onClick={() => setSuspendTarget(row)}>
            {row.status === 'active' ? 'Suspend' : 'Activate'}
          </Button>
          <Button size="sm" variant="danger" icon="trash" onClick={() => setDeleteTarget(row)} aria-label={`Delete ${row.name}`} />
        </div>
      )
    }
  ];

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Platform accounts"
        subtitle={`${formatNumber(pagination?.total ?? 0)} account(s) match the current filters. Accounts are created through citizen and staff registration.`}
        action={<Button icon="download" onClick={() => window.open(adminApi.exportUrl('users'), '_blank')}>Export CSV</Button>}
      />
      <DataTable
        caption="Platform accounts"
        columns={columns}
        rows={rows}
        loading={users.loading}
        error={users.error}
        onRetry={users.reload}
        onRowClick={(row) => openDetail(row.id)}
        empty={{ icon: 'users', title: 'No accounts match', hint: 'Adjust the search or filters to widen the results.' }}
        toolbar={
          <>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or phone…" aria-label="Search accounts" className="w-56" />
            <select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} aria-label="Filter by role">
              <option value="">All roles</option>
              {allRoles.map((value) => <option key={value} value={value}>{roleLabels[value]}</option>)}
            </select>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            {search || role || status ? (
              <Button size="sm" icon="close" onClick={() => { setSearch(''); setRole(''); setStatus(''); setPage(1); }}>Clear</Button>
            ) : null}
          </>
        }
        pagination={pagination ? { page: pagination.page, pages: pagination.pages, total: pagination.total, limit: pagination.limit } : undefined}
        onPage={setPage}
      />
      <Modal
        open={Boolean(roleTarget)}
        onClose={() => setRoleTarget(null)}
        title="Change role & department"
        subtitle={roleTarget ? `${roleTarget.name} · ${roleTarget.email}` : ''}
        icon="shieldCheck"
        footer={
          <>
            <Button onClick={() => setRoleTarget(null)} disabled={busy}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={saveRole}>Save role</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Role" hint="Department head roles are assigned from the Departments screen, not here." required>
            <select value={roleForm.role} onChange={(event) => setRoleForm((form) => ({ ...form, role: event.target.value }))}>
              {assignableRoles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Department" hint="Required for civic and emergency staff roles so queue routing works.">
            <select value={roleForm.departmentId} onChange={(event) => setRoleForm((form) => ({ ...form, departmentId: event.target.value }))}>
              <option value="">No department</option>
              {(departments.data || []).map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
            </select>
          </Field>
          {formError ? <ErrorState message={formError} /> : null}
          <p className="text-[12px] text-fg-subtle">Role changes are written to the audit trail with your actor role and the outcome.</p>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(suspendTarget)}
        onClose={() => setSuspendTarget(null)}
        title={suspendTarget?.status === 'active' ? `Suspend ${suspendTarget?.name}?` : `Reactivate ${suspendTarget?.name}?`}
        message={suspendTarget?.status === 'active'
          ? 'The account will be blocked from CivicSync until it is reactivated. Existing records are preserved.'
          : 'The account regains access to CivicSync immediately.'}
        confirmLabel={suspendTarget?.status === 'active' ? 'Suspend account' : 'Reactivate account'}
        danger={suspendTarget?.status === 'active'}
        busy={busy}
        onConfirm={toggleStatus}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name}?`}
        message="This permanently removes the account record. Complaints and emergencies it created remain in the database. This cannot be undone."
        confirmLabel="Delete account"
        danger
        busy={busy}
        onConfirm={removeUser}
      />

      <Drawer
        open={detail.open}
        onClose={() => setDetail({ open: false, id: null, loading: false, error: '', data: null })}
        title={detail.data?.user?.name || 'Account detail'}
        subtitle={detail.data?.user?.email || (detail.loading ? 'Loading…' : '')}
      >
        {detail.loading && <SkeletonList rows={5} />}
        {!detail.loading && detail.error ? <ErrorState message={detail.error} onRetry={() => openDetail(detail.id)} /> : null}
        {detail.data && (
          <div className="space-y-5">
            <KeyValue
              items={[
                { label: 'Role', value: <Badge tone={roleTone(detail.data.user.role)}>{labelize(detail.data.user.role)}</Badge> },
                { label: 'Status', value: <Badge tone={statusTone(detail.data.user.status)}>{labelize(detail.data.user.status)}</Badge> },
                { label: 'Phone', value: detail.data.user.phone || '—' },
                { label: 'Department', value: detail.data.user.departmentName || '—' },
                { label: 'Registered', value: formatDateTime(detail.data.user.createdAt) },
                { label: 'Account ID', value: String(detail.data.user.id) }
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Complaints filed" value={formatNumber(detail.data.stats?.complaints)} icon="clipboardList" tone="info" />
              <StatCard label="Emergencies raised" value={formatNumber(detail.data.stats?.emergencies)} icon="siren" tone="critical" />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-semibold text-fg">Recent activity targeting this account</p>
              {!detail.data.activity?.length ? (
                <EmptyState icon="activity" title="No recorded activity" hint="Role changes, status updates and other administrative actions will appear here." />
              ) : null}
              <ul className="space-y-2">
                {(detail.data.activity || []).map((entry) => (
                  <li key={entry._id} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                    <p className="text-[13px] font-semibold text-fg">{labelize(entry.action)}</p>
                    <p className="text-[12px] text-fg-muted">{entry.description || '—'}</p>
                    <p className="mt-0.5 text-[11px] text-fg-subtle">{entry.admin?.name || 'Administrator'} · {formatRelative(entry.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button icon="shield" onClick={() => openRole(detail.data.user)}>Change role</Button>
              <Button icon={detail.data.user.status === 'active' ? 'lock' : 'check'} onClick={() => setSuspendTarget(detail.data.user)}>
                {detail.data.user.status === 'active' ? 'Suspend' : 'Activate'}
              </Button>
              <Button variant="danger" icon="trash" onClick={() => setDeleteTarget(detail.data.user)}>Delete</Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
/* --------------------------------------------------- Roles & permissions */

export function RolesPermissionsSection() {
  const permissions = useAsync(() => adminApi.permissions().then((response) => response.data), []);
  const data = permissions.data;

  if (permissions.loading) {
    return (
      <div className="space-y-5">
        <SkeletonKpiGrid count={4} />
        <SkeletonList rows={6} />
      </div>
    );
  }
  if (permissions.error) return <ErrorState message={permissions.error} onRetry={permissions.reload} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Capability matrix"
        subtitle={`${formatNumber(data.totalUsers)} accounts across ${data.roles.length} roles. Every cell maps to a server-side check — the frontend is never the security boundary.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {data.roles.map((role) => (
          <article key={role.key} className="civic-card p-4">
            <div className="flex items-center justify-between gap-2">
              <Badge tone={roleTone(role.key)}>{role.group}</Badge>
              <span className="tabular text-lg font-bold text-fg">{formatNumber(role.count)}</span>
            </div>
            <p className="mt-2 text-[13px] font-semibold text-fg">{role.label}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">{role.description}</p>
            <p className="mt-2 truncate text-[11px] text-fg-subtle"><code className="font-mono">{role.key}</code></p>
          </article>
        ))}
      </div>

      <Card>
        <CardHeader
          icon="shieldCheck"
          title="Resource × action matrix"
          subtitle="Hover a chip for the exact roles and enforcement note served by the backend."
        />
        <CardBody className="space-y-4">
          {data.resources.map((resource) => (
            <div key={resource.key} className="rounded-xl border p-4" style={{ borderColor: 'var(--line)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-fg">{resource.label}</p>
                <Badge tone="neutral">{resource.key}</Badge>
              </div>
              <p className="mt-1 break-all text-[11px] text-fg-subtle">Enforced by <code className="font-mono">{resource.enforcement}</code></p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.actions.map((action) => {
                  const rule = resource.actions?.[action];
                  const holders = rule?.roles || [];
                  const tip = holders.length
                    ? `${labelize(action)}: ${holders.map((key) => roleLabels[key] || key).join(', ')}${rule?.note ? ` — ${rule.note}` : ''}`
                    : `${labelize(action)}: no role${rule?.note ? ` — ${rule.note}` : ''}`;
                  return (
                    <span key={action} title={tip} className={cx('chip', holders.length ? 'status-success' : 'status-muted')}>
                      {labelize(action)} · {holders.length ? `${holders.length} role${holders.length === 1 ? '' : 's'}` : 'none'}
                      {rule?.scoped ? ' · scoped' : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[12px] text-fg-subtle">
            “Scoped” means the role only sees records assigned to them or their department. Head roles are assigned from the Departments screen.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
/* ----------------------------------------------------------- Departments */
// The full Departments Management UI has been moved to its own module for
// maintainability. This re-export keeps all existing imports working.
export { default as DepartmentsSection } from './DepartmentsSection.jsx';
