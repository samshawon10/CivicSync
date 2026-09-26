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

const emergencyTypeOptions = ['police', 'fire', 'medical', 'accident', 'disaster', 'other'];
const scopeOptions = ['civic', 'emergency', 'hybrid'];
const blankDepartment = { name: '', type: '', description: '', contactNumber: '', email: '', address: '', status: 'active', scope: 'civic', emergencyTypes: [] };

export function DepartmentsSection() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState(null); // 'new', department object, or null
  const [form, setForm] = useState(blankDepartment);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [routingTarget, setRoutingTarget] = useState(null);
  const [routingTypes, setRoutingTypes] = useState([]);
  const [headTarget, setHeadTarget] = useState(null); // { department, kind: 'head' | 'emergencyHead' }
  const [headQuery, setHeadQuery] = useState('');
  const [headChoice, setHeadChoice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detail, setDetail] = useState({ open: false, id: null, loading: false, error: '', data: null });

  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);

  const departments = useAsync(
    () => adminApi.departments({ search: query, scope, status, page, limit: 15 }).then((response) => response.data),
    [query, scope, status, page]
  );
  // Complaint destinations are a fixed backend catalog. A department only
  // receives citizen complaints when its name matches one exactly, so the form
  // loads the catalog to make that consequence visible while typing.
  const destinations = useAsync(
    () => adminApi.categoryGovernance().then((response) => response.data.reportDepartments || []),
    [],
    { immediate: false }
  );
  const candidates = useAsync(
    () => adminApi.selectUsers(headQuery).then((response) => response.data.users),
    [headQuery, headTarget?.kind],
    { immediate: Boolean(headTarget) }
  );

  const rows = departments.data?.departments || [];
  const pagination = departments.data?.pagination;

  function openDetail(id) {
    if (!id) return;
    setDetail({ open: true, id, loading: true, error: '', data: null });
    adminApi.department(id)
      .then(({ data }) => setDetail({ open: true, id, loading: false, error: '', data }))
      .catch((error) => setDetail({ open: true, id, loading: false, error: apiMessage(error), data: null }));
  }

  useEffect(() => {
    const focus = searchParams.get('focus');
    if (focus) {
      openDetail(focus);
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      setSearchParams(next, { replace: true });
    }
    // `create=1` is how the dashboard's "New department" action deep-links here.
    if (searchParams.get('create') === '1') {
      openCreate();
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() { setFormError(''); setForm(blankDepartment); setEditTarget('new'); destinations.reload(); }

  function openEdit(department) {
    setFormError('');
    setForm({
      name: department.name || '', type: department.type || '', description: department.description || '',
      contactNumber: department.contactNumber || '', email: department.email || '', address: department.address || '',
      status: department.status === 'inactive' ? 'inactive' : 'active',
      scope: scopeOptions.includes(department.scope) ? department.scope : 'civic',
      emergencyTypes: [...(department.emergencyTypes || [])]
    });
    setEditTarget(department);
  }

  // Live, client-side validation that mirrors the server's `validDepartment`
  // rules, so the operator sees the problem before submitting.
  const nameError = useMemo(() => {
    const value = form.name.trim();
    if (!value) return 'A department name is required.';
    if (value.length > 120) return 'Name must be 120 characters or fewer.';
    if (rows.some((row) => row.name?.toLowerCase() === value.toLowerCase() && row._id !== editTarget?._id)) {
      return 'A department with this name already exists.';
    }
    return '';
  }, [form.name, rows, editTarget]);
  const emailError = useMemo(() => {
    const value = form.email.trim();
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
    return '';
  }, [form.email]);
  const phoneError = useMemo(() => {
    const value = form.contactNumber.trim();
    if (value && !/^[+()\-\s\d]{6,30}$/.test(value)) return 'Use digits, spaces and + ( ) - only (6–30 characters).';
    return '';
  }, [form.contactNumber]);
  const routingError = useMemo(() => (
    (form.scope === 'emergency' || form.scope === 'hybrid') && !form.emergencyTypes.length
      ? 'Emergency and hybrid departments must handle at least one emergency type.'
      : ''
  ), [form.scope, form.emergencyTypes]);
  const formInvalid = Boolean(nameError || emailError || phoneError || routingError);

  // The configured complaint destinations, offered as one-tap fill chips so an
  // operator never has to guess the exact spelling the report API requires.
  const destinationNames = useMemo(
    () => (destinations.data || []).map((row) => String(row.name || '').trim()).filter(Boolean),
    [destinations.data]
  );

  // Live consequence of the exact name citizens will file complaints under.
  const complaintRoutable = useMemo(() => {
    const value = form.name.trim().toLowerCase();
    if (!value) return null;
    return destinationNames.some((name) => name.toLowerCase() === value);
  }, [form.name, destinationNames]);

  async function saveDepartment() {
    if (formInvalid) { setFormError('Fix the highlighted fields before saving.'); return; }
    setBusy(true); setFormError('');
    try {
      if (editTarget === 'new') {
        await adminApi.createDepartment(form);
        toast.success(`Department “${form.name}” created.`);
      } else {
        await adminApi.updateDepartment(editTarget._id, form);
        toast.success(`Department “${form.name}” updated.`);
      }
      setEditTarget(null);
      departments.reload();
    } catch (error) { setFormError(apiMessage(error)); } finally { setBusy(false); }
  }

  function openRouting(department) { setRoutingTarget(department); setRoutingTypes([...(department.emergencyTypes || [])]); }

  async function saveRouting() {
    setBusy(true); setFormError('');
    try {
      await adminApi.updateEmergencyRouting(routingTarget._id, { emergencyTypes: routingTypes });
      toast.success(`Emergency routing updated for “${routingTarget.name}”.`);
      setRoutingTarget(null);
      departments.reload();
      if (detail.id === routingTarget._id) openDetail(routingTarget._id);
    } catch (error) { setFormError(apiMessage(error)); } finally { setBusy(false); }
  }

  async function saveHead() {
    setBusy(true); setFormError('');
    try {
      const call = headTarget.kind === 'head' ? adminApi.assignHead : adminApi.assignEmergencyHead;
      await call(headTarget.department._id, headChoice);
      toast.success(`Head assigned to “${headTarget.department.name}”.`);
      setHeadTarget(null); setHeadChoice(''); setHeadQuery('');
      departments.reload();
      if (detail.id === headTarget.department._id) openDetail(headTarget.department._id);
    } catch (error) { setFormError(apiMessage(error)); } finally { setBusy(false); }
  }

  async function removeDepartment() {
    setBusy(true);
    try {
      await adminApi.deleteDepartment(deleteTarget._id);
      toast.success(`Department “${deleteTarget.name}” deleted. Staff accounts were reset to citizen.`);
      setDeleteTarget(null);
      departments.reload();
    } catch (error) { toast.error(apiMessage(error)); } finally { setBusy(false); }
  }
  const scopeToneMap = { civic: 'info', emergency: 'high', hybrid: 'success' };

  const columns = [
    {
      key: 'name', label: 'Department', sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-fg">{row.name}</p>
          <p className="truncate text-[11px] text-fg-muted">{row.type || 'Civic department'}{row.email ? ` · ${row.email}` : ''}</p>
        </div>
      )
    },
    { key: 'scope', label: 'Scope', render: (row) => <Badge tone={scopeToneMap[row.scope] || 'neutral'}>{labelize(row.scope)}</Badge> },
    { key: 'status', label: 'Status', sortable: true, render: (row) => <Badge tone={statusTone(row.status)}>{labelize(row.status)}</Badge> },
    { key: 'head', label: 'Department head', render: (row) => <span className="text-[13px] text-fg-muted">{row.head?.name || 'Unassigned'}</span> },
    { key: 'emergencyHead', label: 'Emergency head', render: (row) => <span className="text-[13px] text-fg-muted">{row.emergencyHead?.name || (row.scope === 'civic' ? '—' : 'Unassigned')}</span> },
    {
      key: 'emergencyTypes', label: 'Emergency routing',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.emergencyTypes?.length
            ? row.emergencyTypes.map((type) => <Badge key={type} tone="neutral">{labelize(type)}</Badge>)
            : <span className="text-[13px] text-fg-subtle">—</span>}
        </div>
      )
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" icon="eye" onClick={() => openDetail(row._id)}>View</Button>
          <Button size="sm" icon="pencil" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="sm" icon="siren" onClick={() => openRouting(row)}>Routing</Button>
          <Button size="sm" variant="danger" icon="trash" onClick={() => setDeleteTarget(row)} aria-label={`Delete ${row.name}`} />
        </div>
      )
    }
  ];

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Civic & emergency departments"
        subtitle={`${formatNumber(pagination?.total ?? 0)} department(s). Heads are assigned per department and their account role is promoted automatically.`}
        action={<Button variant="primary" icon="plus" onClick={openCreate}>New department</Button>}
      />
      <DataTable
        caption="Departments"
        columns={columns}
        rows={rows}
        loading={departments.loading}
        error={departments.error}
        onRetry={departments.reload}
        onRowClick={(row) => openDetail(row._id)}
        empty={{ icon: 'building2', title: 'No departments match', hint: 'Create a department or clear the filters.' }}
        toolbar={
          <>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search department name…" aria-label="Search departments" className="w-56" />
            <select value={scope} onChange={(event) => { setScope(event.target.value); setPage(1); }} aria-label="Filter by scope">
              <option value="">All scopes</option>
              {scopeOptions.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
            </select>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {search || scope || status ? (
              <Button size="sm" icon="close" onClick={() => { setSearch(''); setScope(''); setStatus(''); setPage(1); }}>Clear</Button>
            ) : null}
          </>
        }
        pagination={pagination ? { page: pagination.page, pages: pagination.pages, total: pagination.total, limit: pagination.limit } : undefined}
        onPage={setPage}
      />
      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={editTarget === 'new' ? 'New department' : `Edit ${editTarget?.name || 'department'}`}
        subtitle="Departments drive complaint routing and emergency responsibility."
        size="lg"
        footer={
          <>
            <span className="mr-auto text-[12px] text-fg-subtle">
              {formInvalid ? 'Resolve the highlighted fields to continue.' : editTarget === 'new' ? 'A department head can be assigned right after creation.' : 'Renaming also re-points existing complaints.'}
            </span>
            <Button onClick={() => setEditTarget(null)} disabled={busy}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={formInvalid} onClick={saveDepartment}>
              {editTarget === 'new' ? 'Create department' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-5">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ backgroundColor: 'color-mix(in oklab, var(--color-civic-500) 14%, var(--surface))', color: 'var(--color-civic-600)' }}>
                  <Icon name="building2" size={15} />
                </span>
                <h3 className="text-[13px] font-bold uppercase tracking-wide text-fg-subtle">Identity</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required error={nameError} hint={!nameError ? `${form.name.trim().length}/120 · must be unique` : undefined} className="sm:col-span-2">
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                maxLength={120}
                placeholder="e.g. Water & Sewerage"
                aria-invalid={Boolean(nameError)}
              />
            </Field>

            {/* One-tap fill with a name the citizen report API will accept.
                This is the fastest route to a working, citizen-visible
                department, so it sits directly under the name field. */}
            {Boolean(destinationNames.length) && !complaintRoutable && (
              <div className="sm:col-span-2">
                <p className="mb-2 text-[12px] font-semibold text-fg-muted">Use a configured destination name</p>
                <div className="flex flex-wrap gap-1.5">
                  {destinationNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, name }))}
                      className="chip cursor-pointer status-info"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Honest, immediate feedback on whether citizens can actually file
                complaints to this department — the backend routes on an exact
                name match against a fixed catalog. */}
            {complaintRoutable !== null && (
              <div
                className={cx(
                  'sm:col-span-2 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12px]',
                  complaintRoutable
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                    : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
                )}
              >
                <Icon name={complaintRoutable ? 'checkCircle' : 'alertTriangle'} size={15} className="mt-0.5 shrink-0" />
                <span>
                  {complaintRoutable
                    ? 'This exact name is a configured complaint destination — citizens can file complaints to this department.'
                    : 'This name is not a configured complaint destination, so citizens will not be able to file complaints to it. Pick an existing destination name if that is intended.'}
                </span>
              </div>
            )}

            <Field label="Type" hint="Free-text classification shown to citizens.">
              <input value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} placeholder="e.g. Waste Management" maxLength={80} />
            </Field>
            <Field label="Status" hint="Inactive departments are hidden from citizen pickers.">
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <Field label="Description" className="sm:col-span-2" hint={`${form.description.length}/2000 — shown on the department record.`}>
              <textarea rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={2000} placeholder="What this department is responsible for…" />
            </Field>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ backgroundColor: 'color-mix(in oklab, var(--color-civic-500) 14%, var(--surface))', color: 'var(--color-civic-600)' }}>
                  <Icon name="phone" size={15} />
                </span>
                <h3 className="text-[13px] font-bold uppercase tracking-wide text-fg-subtle">Public contact</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Contact email" error={emailError} hint={!emailError ? 'Optional.' : undefined}>
                  <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} maxLength={120} placeholder="dept@civicsync.gov" aria-invalid={Boolean(emailError)} />
                </Field>
                <Field label="Contact number" error={phoneError} hint={!phoneError ? 'Optional.' : undefined}>
                  <input value={form.contactNumber} onChange={(event) => setForm((current) => ({ ...current, contactNumber: event.target.value }))} maxLength={30} placeholder="+880 1XXX XXXXX" aria-invalid={Boolean(phoneError)} />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} maxLength={300} placeholder="Head office address" />
                </Field>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)' }}>
              <p className="text-[13px] font-semibold text-fg">Scope</p>
              <p className="mt-0.5 text-[12px] text-fg-subtle">Determines whether the department handles emergencies and needs an emergency head.</p>
              <div className="mt-3 space-y-1.5">
                {[
                  { value: 'civic', title: 'Civic', hint: 'Handles citizen complaints. Needs a department head.' },
                  { value: 'emergency', title: 'Emergency', hint: 'Handles dispatched incidents. Needs an emergency head.' },
                  { value: 'hybrid', title: 'Hybrid', hint: 'Handles both. Needs both heads.' }
                ].map((option) => {
                  const active = form.scope === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setForm((current) => ({ ...current, scope: option.value }))}
                      className={cx('block w-full rounded-lg border px-3 py-2 text-left transition hover:bg-surface-2', active && 'border-civic-500 bg-civic-500/10')}
                      style={active ? undefined : { borderColor: 'var(--line)' }}
                    >
                      <p className={cx('text-[13px] font-semibold', active ? 'text-fg' : 'text-fg-muted')}>{option.title}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-fg-subtle">{option.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border p-4" style={{ borderColor: routingError ? '#f59e0b' : 'var(--line)' }}>
              <p className="text-[13px] font-semibold text-fg">Emergency types routed here</p>
              <p className="mt-0.5 text-[12px] text-fg-subtle">Emergency and hybrid departments must handle at least one type.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {emergencyTypeOptions.map((type) => {
                  const active = form.emergencyTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setForm((current) => ({
                        ...current,
                        emergencyTypes: active ? current.emergencyTypes.filter((value) => value !== type) : [...current.emergencyTypes, type]
                      }))}
                      className={cx('chip cursor-pointer', active ? 'status-info' : 'status-muted')}
                    >
                      {labelize(type)}
                    </button>
                  );
                })}
              </div>
              {routingError ? <p className="mt-2 text-xs font-semibold text-amber-600">{routingError}</p> : null}
            </div>

            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', backgroundColor: 'var(--surface-2)' }}>
              <p className="text-[13px] font-semibold text-fg">Preview</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <Badge tone={scopeToneMap[form.scope] || 'neutral'}>{labelize(form.scope)}</Badge>
                <Badge tone={statusTone(form.status)}>{labelize(form.status)}</Badge>
                {complaintRoutable ? <Badge tone="success" icon="checkCircle">Complaint destination</Badge> : null}
              </div>
              <dl className="mt-3 space-y-1.5 text-[12px]">
                {[
                  ['Name', form.name.trim() || '—'],
                  ['Type', form.type.trim() || '—'],
                  ['Email', form.email.trim() || '—'],
                  ['Phone', form.contactNumber.trim() || '—'],
                  ['Routing', form.emergencyTypes.length ? form.emergencyTypes.map((type) => labelize(type)).join(', ') : 'None']
                ].map(([caption, value]) => (
                  <div key={caption} className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-fg-subtle">{caption}</dt>
                    <dd className="min-w-0 truncate text-right font-medium text-fg" title={value}>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
        {formError ? <div className="mt-4"><ErrorState message={formError} /></div> : null}
      </Modal>

      <Modal
        open={Boolean(routingTarget)}
        onClose={() => setRoutingTarget(null)}
        title={`Emergency routing · ${routingTarget?.name || ''}`}
        subtitle="At least one type is required. Civic departments are promoted to hybrid when routing is saved."
        footer={
          <>
            <Button onClick={() => setRoutingTarget(null)} disabled={busy}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!routingTypes.length} onClick={saveRouting}>Save routing</Button>
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          {emergencyTypeOptions.map((type) => {
            const active = routingTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => setRoutingTypes((current) => (active ? current.filter((value) => value !== type) : [...current, type]))}
                className={cx('chip cursor-pointer', active ? 'status-info' : 'status-muted')}
              >
                {labelize(type)}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-[12px] text-fg-subtle">
          Routing only affects emergencies raised after the change; existing incidents keep their assigned department.
        </p>
        {formError ? <div className="mt-4"><ErrorState message={formError} /></div> : null}
      </Modal>
      <Modal
        open={Boolean(headTarget)}
        onClose={() => { setHeadTarget(null); setHeadChoice(''); setHeadQuery(''); }}
        title={`Assign ${headTarget?.kind === 'emergencyHead' ? 'emergency head' : 'department head'}`}
        subtitle={headTarget ? headTarget.department.name : ''}
        footer={
          <>
            <Button onClick={() => { setHeadTarget(null); setHeadChoice(''); setHeadQuery(''); }} disabled={busy}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!headChoice} onClick={saveHead}>Assign head</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Search active accounts" hint="The backend validates the candidate and promotes their role automatically.">
            <input value={headQuery} onChange={(event) => setHeadQuery(event.target.value)} placeholder="Name or email…" />
          </Field>
          {candidates.loading && <SkeletonList rows={3} />}
          {!candidates.loading && candidates.error && <ErrorState message={candidates.error} onRetry={candidates.reload} />}
          {!candidates.loading && !(candidates.data || []).length && (
            <EmptyState icon="search" title="No matching accounts" hint="Try a different name or email. Only active accounts can be assigned." />
          )}
          <div className="space-y-2">
            {(candidates.data || []).map((candidate) => (
              <label
                key={candidate.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border p-3"
                style={{ borderColor: headChoice === candidate.id ? 'var(--color-civic-600)' : 'var(--line)' }}
              >
                <input
                  type="radio"
                  name="head-candidate"
                  checked={headChoice === candidate.id}
                  onChange={() => setHeadChoice(candidate.id)}
                  style={{ width: 16, height: 16, accentColor: 'var(--color-civic-600)' }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-fg">{candidate.name}</span>
                  <span className="block truncate text-[11px] text-fg-muted">{candidate.email} · {labelize(candidate.role)}{candidate.departmentName ? ` · ${candidate.departmentName}` : ''}</span>
                </span>
                <Badge tone={statusTone(candidate.status)}>{labelize(candidate.status)}</Badge>
              </label>
            ))}
          </div>
          {formError ? <ErrorState message={formError} /> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name}?`}
        message="The department is removed, staff accounts are reset to citizen and complaint routing stops using it. Complaints already recorded keep the department name as text. This cannot be undone."
        confirmLabel="Delete department"
        danger
        busy={busy}
        onConfirm={removeDepartment}
      />
      <Drawer
        open={detail.open}
        onClose={() => setDetail({ open: false, id: null, loading: false, error: '', data: null })}
        title={detail.data?.department?.name || 'Department'}
        subtitle={detail.data ? `${labelize(detail.data.department.scope)} scope · ${labelize(detail.data.department.status)}` : (detail.loading ? 'Loading…' : '')}
        width="sm:max-w-2xl"
      >
        {detail.loading && <SkeletonList rows={5} />}
        {!detail.loading && detail.error ? <ErrorState message={detail.error} onRetry={() => openDetail(detail.id)} /> : null}
        {detail.data && (
          <div className="space-y-5">
            <KeyValue
              items={[
                { label: 'Type', value: detail.data.department.type || '—' },
                { label: 'Email', value: detail.data.department.email || '—' },
                { label: 'Contact', value: detail.data.department.contactNumber || '—' },
                { label: 'Address', value: detail.data.department.address || '—' },
                { label: 'Department head', value: detail.data.department.head?.name || 'Unassigned' },
                { label: 'Emergency head', value: detail.data.department.emergencyHead?.name || 'Unassigned' },
                { label: 'Created', value: formatDateTime(detail.data.department.createdAt) },
                {
                  label: 'Emergency routing',
                  value: detail.data.department.emergencyTypes?.length
                    ? detail.data.department.emergencyTypes.map((type) => labelize(type)).join(', ')
                    : '—'
                }
              ]}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total complaints" value={formatNumber(detail.data.stats?.total)} icon="clipboardList" tone="info" />
              <StatCard label="Pending" value={formatNumber(detail.data.stats?.pending)} icon="clock" tone="medium" />
              <StatCard label="In progress" value={formatNumber(detail.data.stats?.active)} icon="activity" tone="high" />
              <StatCard label="Resolution rate" value={`${formatNumber(detail.data.stats?.resolutionRate)}%`} icon="checkCircle" tone="success" />
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-fg">Team roster ({detail.data.team?.length || 0})</p>
                <div className="flex gap-2">
                  <Button size="sm" icon="userCheck" onClick={() => setHeadTarget({ department: detail.data.department, kind: 'head' })}>Assign head</Button>
                  <Button size="sm" icon="siren" onClick={() => setHeadTarget({ department: detail.data.department, kind: 'emergencyHead' })}>Assign emergency head</Button>
                </div>
              </div>
              {!detail.data.team?.length ? (
                <EmptyState icon="users" title="No staff assigned" hint="Staff accounts linked to this department appear here." />
              ) : (
                <ul className="space-y-2">
                  {detail.data.team.map((member) => (
                    <li key={member._id} className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-fg">{member.name}</p>
                        <p className="truncate text-[11px] text-fg-muted">{member.email}</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Badge tone={roleTone(member.role)}>{labelize(member.role)}</Badge>
                        <Badge tone={statusTone(member.status)}>{labelize(member.status)}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button icon="pencil" onClick={() => openEdit(detail.data.department)}>Edit department</Button>
              <Button icon="siren" onClick={() => openRouting(detail.data.department)}>Emergency routing</Button>
              <Button variant="danger" icon="trash" onClick={() => setDeleteTarget(detail.data.department)}>Delete</Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
