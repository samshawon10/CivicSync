
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../../services/adminService.js';
import useAsync from '../../../hooks/useAsync.js';
import { apiMessage } from '../../../services/api.js';
import DataTable from '../../../components/ui/DataTable.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  KeyValue,
  Pagination,
  SectionHeading,
  Segmented,
  StatCard,
  StatusDot,
  Toggle
} from '../../../components/ui/primitives.jsx';
import { SkeletonKpiGrid, SkeletonList } from '../../../components/ui/Skeleton.jsx';
import { ConfirmDialog, Drawer, Modal } from '../../../components/ui/Overlays.jsx';
import { useToast } from '../../../components/ui/Toaster.jsx';
import {
  cx,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  labelize,
  statusTone
} from '../../../utils/format.js';

/* ─────────────────────────────────────── constants ── */

const SCOPE_OPTIONS = [
  { value: 'civic', label: 'Civic', icon: 'building2', hint: 'Handles citizen complaints. Needs a Department Head.' },
  { value: 'emergency', label: 'Emergency', icon: 'siren', hint: 'Handles dispatched emergency incidents. Needs an Emergency Head.' },
  { value: 'hybrid', label: 'Hybrid', icon: 'layers', hint: 'Handles both complaints and emergencies. Needs both heads.' }
];

const EMERGENCY_TYPES = ['police', 'fire', 'medical', 'accident', 'disaster', 'other'];

const ICON_PRESETS = [
  { key: 'building2', label: 'Building' },
  { key: 'hospital', label: 'Medical' },
  { key: 'siren', label: 'Emergency' },
  { key: 'flame', label: 'Fire' },
  { key: 'shield', label: 'Security' },
  { key: 'trash2', label: 'Waste' },
  { key: 'zap', label: 'Electricity' },
  { key: 'droplets', label: 'Water' },
  { key: 'leaf', label: 'Environment' },
  { key: 'car', label: 'Transport' },
  { key: 'treeDeciduous', label: 'Parks' },
  { key: 'wrench', label: 'Infrastructure' }
];

const COLOR_PRESETS = [
  '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#db2777', '#ea580c', '#65a30d', '#0f766e'
];

const ROLE_GROUP_ORDER = ['Civic Leadership', 'Civic Operations', 'Emergency Leadership', 'Emergency Operations'];

const BLANK_FORM = {
  name: '',
  code: '',
  type: '',
  description: '',
  icon: 'building2',
  color: '#2563eb',
  contactNumber: '',
  email: '',
  address: '',
  status: 'active',
  scope: 'civic',
  emergencyTypes: [],
  assignedRoles: []
};

/* ─────────────────────────────────── helpers ── */

const scopeTone = (scope) => ({ civic: 'info', emergency: 'high', hybrid: 'success' }[scope] || 'neutral');
const scopeIcon = (scope) => ({ civic: 'building2', emergency: 'siren', hybrid: 'layers' }[scope] || 'building2');

function autoCode(name) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/* ─────────────────────────── DepartmentCard (grid view) ── */

function DepartmentCard({ dept, onView, onEdit, onToggleStatus, onDelete }) {
  
  const needsLeader = (dept.scope !== 'emergency' && !dept.head?._id) || (dept.scope !== 'civic' && !dept.emergencyHead?._id);
  return (
    <article
      className="group relative flex flex-col rounded-2xl border border-line bg-surface shadow-sm transition hover:shadow-md hover:border-civic-300 dark:hover:border-civic-700 cursor-pointer overflow-hidden"
      onClick={() => onView(dept._id)}
      aria-label={`View ${dept.name}`}
    >
      {/* Colour accent bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: dept.color || '#2563eb' }} />

      <div className="flex flex-1 flex-col p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{
                backgroundColor: `color-mix(in oklab, ${dept.color || '#2563eb'} 15%, var(--surface))`,
                color: dept.color || '#2563eb'
              }}
            >
              <Icon name={dept.icon || 'building2'} size={20} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-fg">{dept.name}</p>
              {dept.code && (
                <p className="text-[11px] font-mono text-fg-subtle">{dept.code}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge tone={dept.status === 'active' ? 'success' : 'muted'}>
              {dept.status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
            <Badge tone={scopeTone(dept.scope)}>
              {labelize(dept.scope)}
            </Badge>
          </div>
        </div>

        {/* Description */}
        {dept.description && (
          <p className="mt-3 line-clamp-2 text-[13px] leading-5 text-fg-muted">{dept.description}</p>
        )}

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-fg-subtle">
          {dept.staffCount > 0 && (
            <span className="flex items-center gap-1">
              <Icon name="users" size={12} />
              {formatNumber(dept.staffCount)} staff
            </span>
          )}
          {dept.head?.name && (
            <span className="flex items-center gap-1 truncate">
              <Icon name="user" size={12} />
              {dept.head.name}
            </span>
          )}
          {dept.emergencyHead?.name && (
            <span className="flex items-center gap-1 truncate">
              <Icon name="siren" size={12} />
              {dept.emergencyHead.name}
            </span>
          )}
          {needsLeader && <Badge tone="medium" icon="alertTriangle">Leadership needed</Badge>}
          {dept.contactNumber && (
            <span className="flex items-center gap-1">
              <Icon name="phone" size={12} />
              {dept.contactNumber}
            </span>
          )}
        </div>

        {/* Emergency types */}
        {dept.emergencyTypes?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {dept.emergencyTypes.map((type) => (
              <Badge key={type} tone="high">{labelize(type)}</Badge>
            ))}
          </div>
        )}

        {/* Assigned roles summary */}
        {dept.assignedRoles?.length > 0 && (
          <p className="mt-2 text-[11px] text-fg-subtle">
            {dept.assignedRoles.length} role{dept.assignedRoles.length !== 1 ? 's' : ''} assigned
          </p>
        )}
      </div>

      {/* Footer actions */}
      <footer
        className="flex items-center justify-end gap-1.5 border-t border-line px-4 py-2.5 bg-surface-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Button size="sm" icon="pencil" onClick={() => onEdit(dept)}>Edit</Button>
        <Button
          size="sm"
          icon={dept.status === 'active' ? 'pauseCircle' : 'playCircle'}
          onClick={() => onToggleStatus(dept)}
        >
          {dept.status === 'active' ? 'Deactivate' : 'Activate'}
        </Button>
        <Button
          size="sm"
          variant="danger"
          icon="trash"
          onClick={() => onDelete(dept)}
          aria-label={`Delete ${dept.name}`}
        />
      </footer>
    </article>
  );
}

/* ─────────────────────── DepartmentFormModal (Premium Redesign) ── */

function DepartmentFormModal({ open, onClose, editTarget, availableRoles, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(BLANK_FORM);
  const [currentStep, setCurrentStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const isEdit = Boolean(editTarget && editTarget !== 'new');
  const codeWasTouched = useRef(false);

  // Populate form when target changes
  useEffect(() => {
    if (!open) return;
    codeWasTouched.current = false;
    setCurrentStep(0);
    setFormError('');
    setFieldErrors({});
    if (isEdit && editTarget) {
      setForm({
        name: editTarget.name || '',
        code: editTarget.code || '',
        type: editTarget.type || '',
        description: editTarget.description || '',
        icon: editTarget.icon || 'building2',
        color: editTarget.color || '#2563eb',
        contactNumber: editTarget.contactNumber || '',
        email: editTarget.email || '',
        address: editTarget.address || '',
        status: editTarget.status || 'active',
        scope: editTarget.scope || 'civic',
        emergencyTypes: [...(editTarget.emergencyTypes || [])],
        assignedRoles: [...(editTarget.assignedRoles || [])]
      });
      codeWasTouched.current = Boolean(editTarget.code);
    } else {
      setForm({ ...BLANK_FORM });
    }
  }, [open, editTarget, isEdit]);

  // Auto-generate code from name (only when code hasn't been manually touched)
  useEffect(() => {
    if (!codeWasTouched.current && form.name) {
      setForm((prev) => ({ ...prev, code: autoCode(prev.name) }));
    }
  }, [form.name]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field-level error on change
    if (fieldErrors[field]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }
  }

  function toggleRole(roleKey) {
    setForm((prev) => ({
      ...prev,
      assignedRoles: prev.assignedRoles.includes(roleKey)
        ? prev.assignedRoles.filter((r) => r !== roleKey)
        : [...prev.assignedRoles, roleKey]
    }));
  }

  function toggleEmergencyType(type) {
    setForm((prev) => ({
      ...prev,
      emergencyTypes: prev.emergencyTypes.includes(type)
        ? prev.emergencyTypes.filter((t) => t !== type)
        : [...prev.emergencyTypes, type]
    }));
  }

  function selectAllRoles(group) {
    const groupRoles = (availableRoles || [])
      .filter((r) => r.group === group)
      .map((r) => r.key);
    setForm((prev) => ({
      ...prev,
      assignedRoles: [...new Set([...prev.assignedRoles, ...groupRoles])]
    }));
  }

  function clearGroupRoles(group) {
    const groupRoles = new Set(
      (availableRoles || []).filter((r) => r.group === group).map((r) => r.key)
    );
    setForm((prev) => ({
      ...prev,
      assignedRoles: prev.assignedRoles.filter((r) => !groupRoles.has(r))
    }));
  }

  function stepErrorsFor(step, values = form) {
    const errors = {};
    if (step === 0) {
      const name = values.name.trim();
      if (!name) errors.name = 'Department name is required.';
      else if (name.length < 2) errors.name = 'Name must be at least 2 characters.';
      else if (name.length > 120) errors.name = 'Name must be 120 characters or fewer.';
    } else if (step === 1) {
      if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
        errors.email = 'Enter a valid email address.';
      }
      if (values.contactNumber.trim() && !/^[+()\-\s\d]{6,30}$/.test(values.contactNumber.trim())) {
        errors.contactNumber = 'Use digits, spaces and + ( ) - only (6–30 characters).';
      }
    } else if (step === 2) {
      if (values.color && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(values.color)) {
        errors.color = 'Must be a valid hex colour (e.g. #2563eb).';
      }
    } else if (step === 3) {
      if ((values.scope === 'emergency' || values.scope === 'hybrid') && values.emergencyTypes.length === 0) {
        errors.emergencyTypes = 'Emergency and hybrid departments must handle at least one emergency type.';
      }
    }
    return errors;
  }

  // Validate current step (for the Continue button)
  function validateStep(step) {
    const errors = stepErrorsFor(step);
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Validate all fields (for final save)
  function validateAll() {
    const errors = STEPS.reduce((acc, _step, index) => ({ ...acc, ...stepErrorsFor(index) }), {});
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      // Jump to the first step with an error
      if (errors.name) setCurrentStep(0);
      else if (errors.email || errors.contactNumber) setCurrentStep(1);
      else if (errors.color) setCurrentStep(2);
      else if (errors.emergencyTypes) setCurrentStep(3);
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!validateAll()) { 
      setFormError('Please review all steps and fix highlighted fields.'); 
      return; 
    }
    setBusy(true); setFormError('');
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        type: form.type.trim(),
        description: form.description.trim(),
        email: form.email.trim().toLowerCase(),
        contactNumber: form.contactNumber.trim(),
        address: form.address.trim()
      };
      if (isEdit) {
        await adminApi.updateDepartment(editTarget._id, payload);
        toast.success(`Department "${form.name}" updated.`);
      } else {
        await adminApi.createDepartment(payload);
        toast.success(`Department "${form.name}" created.`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(apiMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const STEPS = [
    { key: 'basics', label: 'Basics', shortLabel: 'Info', icon: 'fileText', description: 'Department identity and classification' },
    { key: 'contact', label: 'Contact', shortLabel: 'Contact', icon: 'phone', description: 'Public contact information' },
    { key: 'brand', label: 'Branding', shortLabel: 'Brand', icon: 'palette', description: 'Visual identity and appearance' },
    { key: 'scope', label: 'Operations', shortLabel: 'Scope', icon: 'layers', description: 'Operational scope and emergency types' },
    { key: 'roles', label: 'Permissions', shortLabel: 'Roles', icon: 'shield', description: 'Role assignments and access control' }
  ];

  // Group available roles by group for the roles step
  const roleGroups = useMemo(() => {
    if (!availableRoles?.length) return {};
    const groups = {};
    for (const role of availableRoles) {
      if (!groups[role.group]) groups[role.group] = [];
      groups[role.group].push(role);
    }
    return groups;
  }, [availableRoles]);

  // Count step errors for indicator
  const stepErrors = useMemo(() => {
    const errs = [false, false, false, false, false];
    if (fieldErrors.name) errs[0] = true;
    if (fieldErrors.email || fieldErrors.contactNumber) errs[1] = true;
    if (fieldErrors.color) errs[2] = true;
    if (fieldErrors.emergencyTypes) errs[3] = true;
    return errs;
  }, [fieldErrors]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={isEdit ? 'pencil' : 'plus'}
      title={isEdit ? editTarget?.name || 'Edit Department' : 'Create New Department'}
      subtitle={isEdit ? 'Update department configuration and assignments' : 'Set up a new civic or emergency department'}
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button variant="ghost" onClick={() => setCurrentStep((s) => s - 1)} disabled={busy}>
                <Icon name="arrowLeft" size={16} />
                Back
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button onClick={onClose} disabled={busy}>Cancel</Button>
            {currentStep < STEPS.length - 1 ? (
              <Button 
                variant="primary" 
                onClick={() => {
                  if (validateStep(currentStep)) setCurrentStep((s) => s + 1);
                  else setFormError('Please fix the errors before proceeding.');
                }}
                disabled={busy}
              >
                Continue
                <Icon name="arrowRight" size={16} />
              </Button>
            ) : (
              <Button variant="primary" loading={busy} onClick={handleSave}>
                <Icon name="check" size={16} />
                {isEdit ? 'Save Changes' : 'Create Department'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* ── Progress Stepper ── */}
        <div className="relative">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const isActive = idx === currentStep;
              const isComplete = idx < currentStep;
              const hasError = stepErrors[idx];
              return (
                <div key={step.key} className="flex flex-1 items-center">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(idx)}
                    disabled={busy}
                    className="group flex flex-col items-center gap-2 transition disabled:opacity-50"
                  >
                    <div className="relative">
                      <div
                        className={cx(
                          'grid h-11 w-11 place-items-center rounded-full border-2 transition-all duration-300',
                          isActive
                            ? 'border-civic-600 bg-civic-600 text-white shadow-lg shadow-civic-300 dark:shadow-civic-900 scale-110'
                            : isComplete
                            ? 'border-civic-500 bg-civic-500 text-white'
                            : hasError
                            ? 'border-red-500 bg-red-50 text-red-600 dark:bg-red-950/30'
                            : 'border-line bg-surface text-fg-muted group-hover:border-civic-400 group-hover:text-civic-600'
                        )}
                      >
                        {isComplete ? (
                          <Icon name="check" size={20} />
                        ) : hasError ? (
                          <Icon name="alertCircle" size={20} />
                        ) : (
                          <Icon name={step.icon} size={20} />
                        )}
                      </div>
                      {isActive && (
                        <div className="absolute inset-0 -z-10 animate-ping rounded-full bg-civic-400 opacity-30" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className={cx('text-[12px] font-bold', isActive ? 'text-civic-600' : isComplete ? 'text-civic-500' : hasError ? 'text-red-600' : 'text-fg-muted')}>
                        {step.shortLabel}
                      </p>
                    </div>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className={cx('h-0.5 flex-1 transition-colors duration-500 mx-1', idx < currentStep ? 'bg-civic-500' : 'bg-line')} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Error banner ── */}
        {formError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 flex items-start gap-2">
            <Icon name="alertTriangle" size={18} className="shrink-0 mt-0.5" />
            <p>{formError}</p>
          </div>
        )}

        {/* ── Step Content ── */}
        <div className="min-h-[420px]">
          {/* Step 0: Basics */}
          {currentStep === 0 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="mb-1 text-base font-bold text-fg">Department Identity</h3>
                <p className="text-[13px] text-fg-muted">Core information that identifies this department across the platform.</p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Department Name"
                  required
                  error={fieldErrors.name}
                  hint={!fieldErrors.name ? `${form.name.trim().length}/120 characters · must be unique` : undefined}
                  className="sm:col-span-2"
                >
                  <input
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    maxLength={120}
                    placeholder="e.g. Water & Sewerage Department"
                    aria-invalid={Boolean(fieldErrors.name)}
                    className="text-base"
                    autoFocus
                  />
                </Field>

                <Field
                  label="Department Code"
                  hint="Auto-generated from name. Used in APIs and exports."
                  error={fieldErrors.code}
                >
                  <input
                    value={form.code}
                    onChange={(e) => {
                      codeWasTouched.current = true;
                      set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 40));
                    }}
                    maxLength={40}
                    placeholder="WATER_SEWERAGE"
                    className="font-mono"
                    aria-invalid={Boolean(fieldErrors.code)}
                  />
                </Field>

                <Field label="Department Type" hint="Classification for grouping (e.g. Utility, Safety).">
                  <input
                    value={form.type}
                    onChange={(e) => set('type', e.target.value)}
                    maxLength={80}
                    placeholder="e.g. Utility, Public Safety"
                  />
                </Field>

                <Field
                  label="Description"
                  hint={`${form.description.length}/2000 — shown to citizens when selecting a department.`}
                  className="sm:col-span-2"
                >
                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    maxLength={2000}
                    placeholder="Describe the services, responsibilities, and coverage area of this department…"
                  />
                </Field>
              </div>

              {/* Status selector */}
              <div>
                <h4 className="mb-2 text-sm font-semibold text-fg">Department Status</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { value: 'active', label: 'Active', icon: 'checkCircle2', hint: 'Visible to citizens and available for report routing.', color: 'emerald' },
                    { value: 'inactive', label: 'Inactive', icon: 'pauseCircle', hint: 'Hidden from citizens. Existing records are preserved.', color: 'amber' }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={form.status === opt.value}
                      onClick={() => set('status', opt.value)}
                      className={cx(
                        'flex items-start gap-3 rounded-xl border-2 p-4 text-left transition',
                        form.status === opt.value
                          ? `border-${opt.color}-500 bg-${opt.color}-50 dark:bg-${opt.color}-950/20 shadow-md`
                          : 'border-line hover:border-civic-300 hover:bg-surface-2'
                      )}
                    >
                      <Icon 
                        name={opt.icon} 
                        size={22} 
                        className={form.status === opt.value ? `text-${opt.color}-600` : 'text-fg-muted'} 
                      />
                      <div>
                        <p className={cx('text-sm font-bold', form.status === opt.value ? 'text-fg' : 'text-fg-muted')}>
                          {opt.label}
                        </p>
                        <p className="mt-0.5 text-[12px] text-fg-subtle leading-relaxed">{opt.hint}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Contact */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="mb-1 text-base font-bold text-fg">Public Contact Information</h3>
                <p className="text-[13px] text-fg-muted">These details are displayed to citizens on department cards and reports.</p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Contact Email"
                  error={fieldErrors.email}
                  hint={!fieldErrors.email ? 'Primary email displayed to citizens.' : undefined}
                >
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    maxLength={120}
                    placeholder="dept@civicsync.gov"
                    aria-invalid={Boolean(fieldErrors.email)}
                    autoFocus
                  />
                </Field>

                <Field
                  label="Contact Number"
                  error={fieldErrors.contactNumber}
                  hint={!fieldErrors.contactNumber ? 'Phone number with country code.' : undefined}
                >
                  <input
                    value={form.contactNumber}
                    onChange={(e) => set('contactNumber', e.target.value)}
                    maxLength={30}
                    placeholder="+880 1XXX XXXXXX"
                    aria-invalid={Boolean(fieldErrors.contactNumber)}
                  />
                </Field>

                <Field label="Office Address" hint="Head office location or service center address." className="sm:col-span-2">
                  <textarea
                    rows={3}
                    value={form.address}
                    onChange={(e) => set('address', e.target.value)}
                    maxLength={300}
                    placeholder="Enter the full office address including district, division…"
                  />
                </Field>
              </div>

              {/* Contact preview card */}
              <div className="rounded-xl border border-line bg-gradient-to-br from-surface to-surface-2 p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Citizen View Preview</p>
                <div className="space-y-2">
                  {form.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="mail" size={16} className="text-civic-600" />
                      <span className="text-fg">{form.email}</span>
                    </div>
                  )}
                  {form.contactNumber && (
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="phone" size={16} className="text-civic-600" />
                      <span className="text-fg">{form.contactNumber}</span>
                    </div>
                  )}
                  {form.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <Icon name="mapPin" size={16} className="text-civic-600 mt-0.5 shrink-0" />
                      <span className="text-fg">{form.address}</span>
                    </div>
                  )}
                  {!form.email && !form.contactNumber && !form.address && (
                    <p className="text-[13px] italic text-fg-subtle">No contact information provided yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Branding */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="mb-1 text-base font-bold text-fg">Visual Identity</h3>
                <p className="text-[13px] text-fg-muted">Customize the icon and colour used on citizen-facing screens.</p>
              </div>

              {/* Icon selector */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-fg flex items-center gap-2">
                  <Icon name="image" size={16} className="text-civic-600" />
                  Department Icon
                </h4>
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
                  {ICON_PRESETS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      title={label}
                      aria-label={`Use ${label} icon`}
                      aria-pressed={form.icon === key}
                      onClick={() => set('icon', key)}
                      className={cx(
                        'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 transition-all',
                        form.icon === key 
                          ? 'border-civic-600 bg-civic-50 dark:bg-civic-950/30 scale-105 shadow-md' 
                          : 'border-line hover:border-civic-300 hover:bg-surface-2 hover:scale-105'
                      )}
                    >
                      <Icon name={key} size={24} className={form.icon === key ? 'text-civic-600' : 'text-fg-muted'} />
                    </button>
                  ))}
                </div>
                <Field label="Custom Icon Key" hint="Any valid Lucide icon name (e.g. droplets, hammer)." className="mt-3">
                  <input
                    value={form.icon}
                    onChange={(e) => set('icon', e.target.value.trim())}
                    maxLength={80}
                    placeholder="building2"
                    className="font-mono"
                  />
                </Field>
              </div>

              {/* Colour selector */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-fg flex items-center gap-2">
                  <Icon name="palette" size={16} className="text-civic-600" />
                  Brand Colour
                </h4>
                <div className="flex flex-wrap gap-3 mb-3">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      title={color}
                      aria-label={`Use colour ${color}`}
                      aria-pressed={form.color === color}
                      onClick={() => set('color', color)}
                      className={cx(
                        'h-12 w-12 rounded-xl border-[3px] transition-all',
                        form.color === color ? 'border-fg scale-110 shadow-lg' : 'border-transparent hover:scale-105 hover:border-line'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <Field label="Custom Hex Colour" error={fieldErrors.color} hint={!fieldErrors.color ? 'Format: #2563eb' : undefined}>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => set('color', e.target.value)}
                      className="h-11 w-16 cursor-pointer rounded-xl border-2 border-line p-1"
                      aria-label="Pick colour"
                    />
                    <input
                      value={form.color}
                      onChange={(e) => set('color', e.target.value)}
                      maxLength={20}
                      placeholder="#2563eb"
                      className="font-mono flex-1"
                      aria-invalid={Boolean(fieldErrors.color)}
                    />
                  </div>
                </Field>
              </div>

              {/* Live preview */}
              <div className="rounded-xl border-2 border-line overflow-hidden bg-surface">
                <div className="px-4 py-2 bg-surface-2 border-b border-line">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Live Preview</p>
                </div>
                <div className="h-2" style={{ backgroundColor: form.color }} />
                <div className="flex items-center gap-4 p-5">
                  <span
                    className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl shadow-lg"
                    style={{ backgroundColor: `color-mix(in oklab, ${form.color} 18%, var(--surface))`, color: form.color }}
                  >
                    <Icon name={form.icon || 'building2'} size={32} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-fg truncate">{form.name || 'Department Name'}</p>
                    <p className="text-[13px] text-fg-muted">{form.type || 'Department Type'}</p>
                    <p className="mt-1 text-[12px] text-fg-subtle line-clamp-2">{form.description || 'Department description will appear here…'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Scope */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="mb-1 text-base font-bold text-fg">Operational Scope</h3>
                <p className="text-[13px] text-fg-muted">Define whether this department handles civic complaints, emergencies, or both.</p>
              </div>

              {/* Scope selector */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-fg">Department Scope</h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  {SCOPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={form.scope === opt.value}
                      onClick={() => set('scope', opt.value)}
                      className={cx(
                        'flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all',
                        form.scope === opt.value
                          ? 'border-civic-600 bg-civic-50 dark:bg-civic-950/20 shadow-md scale-105'
                          : 'border-line hover:border-civic-300 hover:bg-surface-2'
                      )}
                    >
                      <Icon name={opt.icon} size={28} className={form.scope === opt.value ? 'text-civic-600' : 'text-fg-muted'} />
                      <div>
                        <p className={cx('text-sm font-bold', form.scope === opt.value ? 'text-fg' : 'text-fg-muted')}>{opt.label}</p>
                        <p className="mt-1 text-[11px] text-fg-subtle leading-relaxed">{opt.hint}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Emergency types (conditional) */}
              {(form.scope === 'emergency' || form.scope === 'hybrid') && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-fg flex items-center gap-2">
                    <Icon name="siren" size={16} className="text-red-600" />
                    Emergency Types
                    {fieldErrors.emergencyTypes && <span className="text-[11px] text-red-600 font-normal">({fieldErrors.emergencyTypes})</span>}
                  </h4>
                  <p className="mb-3 text-[13px] text-fg-muted">Select which types of emergencies this department can respond to.</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {EMERGENCY_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={form.emergencyTypes.includes(type)}
                        onClick={() => toggleEmergencyType(type)}
                        className={cx(
                          'flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm font-medium transition',
                          form.emergencyTypes.includes(type)
                            ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                            : 'border-line text-fg-muted hover:border-civic-300 hover:bg-surface-2'
                        )}
                      >
                        <div className={cx('h-4 w-4 shrink-0 rounded border-2 grid place-items-center', form.emergencyTypes.includes(type) ? 'border-red-600 bg-red-600' : 'border-line')}>
                          {form.emergencyTypes.includes(type) && <Icon name="check" size={12} className="text-white" />}
                        </div>
                        {labelize(type)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Scope info card */}
              <div className="rounded-xl border border-line bg-gradient-to-br from-surface to-surface-2 p-4">
                <div className="flex items-start gap-3">
                  <Icon name="info" size={20} className="text-civic-600 shrink-0" />
                  <div className="text-[13px] text-fg-muted space-y-1">
                    <p>
                      <strong className="text-fg">Civic departments</strong> handle citizen complaints and require a Department Head.
                    </p>
                    <p>
                      <strong className="text-fg">Emergency departments</strong> respond to dispatched incidents and require an Emergency Head.
                    </p>
                    <p>
                      <strong className="text-fg">Hybrid departments</strong> handle both and require both leadership roles.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Roles */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="mb-1 text-base font-bold text-fg flex items-center gap-2">
                  Permissions & Roles
                  <Badge tone="info" size="sm">{form.assignedRoles.length} selected</Badge>
                </h3>
                <p className="text-[13px] text-fg-muted">Assign which staff roles can be mapped to this department.</p>
              </div>

              {availableRoles?.length > 0 ? (
                <div className="space-y-4">
                  {ROLE_GROUP_ORDER.filter((group) => roleGroups[group]?.length).map((group) => {
                    const roles = roleGroups[group];
                    const selectedCount = roles.filter((r) => form.assignedRoles.includes(r.key)).length;
                    const allSelected = selectedCount === roles.length;
                    return (
                      <div key={group} className="rounded-xl border border-line p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-fg">{group}</h4>
                            <Badge tone="neutral" size="sm">{selectedCount}/{roles.length}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => selectAllRoles(group)}
                              disabled={allSelected}
                            >
                              Select all
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => clearGroupRoles(group)}
                              disabled={selectedCount === 0}
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {roles.map((role) => {
                            const isSelected = form.assignedRoles.includes(role.key);
                            return (
                              <button
                                key={role.key}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => toggleRole(role.key)}
                                className={cx(
                                  'flex items-start gap-3 rounded-lg border-2 p-3 text-left transition',
                                  isSelected
                                    ? 'border-civic-500 bg-civic-50 dark:bg-civic-950/20'
                                    : 'border-line hover:border-civic-300 hover:bg-surface-2'
                                )}
                              >
                                <div className={cx('mt-0.5 h-5 w-5 shrink-0 rounded border-2 grid place-items-center', isSelected ? 'border-civic-600 bg-civic-600' : 'border-line')}>
                                  {isSelected && <Icon name="check" size={14} className="text-white" />}
                                </div>
                                <div className="min-w-0">
                                  <p className={cx('text-sm font-semibold', isSelected ? 'text-fg' : 'text-fg-muted')}>{role.label}</p>
                                  {role.description && (
                                    <p className="mt-0.5 text-[11px] text-fg-subtle leading-relaxed">{role.description}</p>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-line bg-surface-2 p-8 text-center">
                  <Icon name="shieldOff" size={32} className="mx-auto mb-2 text-fg-subtle opacity-50" />
                  <p className="text-sm font-medium text-fg-muted">No roles available</p>
                  <p className="mt-1 text-[12px] text-fg-subtle">Role assignments can be configured later.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────────── DepartmentDetailDrawer ── */

function DepartmentDetailDrawer({ open, onClose, id, onEdit, onToggleStatus, onDelete, onAssignHead }) {
  const toast = useToast();
  const detail = useAsync(
    () => (id ? adminApi.department(id).then((r) => r.data) : Promise.resolve(null)),
    [id]
  );

  const data = detail.data;
  const dept = data?.department;
  const team = data?.team || [];
  const stats = data?.stats || {};

  const headSlots = dept
    ? [
        { key: 'head', label: 'Department Head', icon: 'userCheck', holder: dept.head, applies: dept.scope !== 'emergency' },
        { key: 'emergencyHead', label: 'Emergency Head', icon: 'siren', holder: dept.emergencyHead, applies: dept.scope !== 'civic' }
      ].filter((slot) => slot.applies || slot.holder)
    : [];
  const staleSlot = headSlots.find((slot) => !slot.applies && slot.holder);

  function handleToggle() {
    if (dept) onToggleStatus(dept);
  }

  function handleDelete() {
    if (dept) onDelete(dept);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="sm:max-w-2xl"
      title={dept?.name || (detail.loading ? 'Loading…' : 'Department Detail')}
      subtitle={dept ? `${labelize(dept.scope)} department · ${dept.code || '—'}` : ''}
      footer={dept ? (
        <div className="flex w-full flex-wrap gap-2">
          <Button icon="pencil" onClick={() => { onClose(); onEdit(dept); }}>Edit</Button>
          <Button
            icon={dept.status === 'active' ? 'pauseCircle' : 'playCircle'}
            onClick={handleToggle}
          >
            {dept.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
          {headSlots.map((slot) => (
            <Button
              key={slot.key}
              icon={slot.icon}
              onClick={() => { onClose(); onAssignHead(dept, slot.key); }}
            >
              {slot.holder ? `Change ${slot.label}` : `Assign ${slot.label}`}
            </Button>
          ))}
          <Button variant="danger" icon="trash" onClick={handleDelete} className="ml-auto">Delete</Button>
        </div>
      ) : undefined}
    >
      {detail.loading && <SkeletonList rows={6} />}
      {!detail.loading && detail.error && (
        <ErrorState message={detail.error} onRetry={detail.reload} />
      )}
      {dept && (
        <div className="space-y-5">
          {/* Colour bar + icon preview */}
          <div className="flex items-center gap-4 rounded-xl border border-line overflow-hidden">
            <div className="h-full w-1.5 self-stretch" style={{ backgroundColor: dept.color || '#2563eb' }} />
            <span
              className="my-3 grid h-12 w-12 place-items-center rounded-xl"
              style={{ backgroundColor: `color-mix(in oklab, ${dept.color || '#2563eb'} 15%, var(--surface))`, color: dept.color || '#2563eb' }}
            >
              <Icon name={dept.icon || 'building2'} size={24} />
            </span>
            <div className="min-w-0 flex-1 py-3 pr-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={dept.status === 'active' ? 'success' : 'muted'}>{labelize(dept.status)}</Badge>
                <Badge tone={scopeTone(dept.scope)}>{labelize(dept.scope)}</Badge>
              </div>
              {dept.description && (
                <p className="mt-1 text-[13px] text-fg-muted line-clamp-2">{dept.description}</p>
              )}
            </div>
          </div>

          {/* Leadership that no longer matches the scope (legacy records) */}
          {staleSlot && (
            <p className="flex items-start gap-2 rounded-xl border border-line px-3 py-2 text-[13px] status-warning">
              <Icon name="alertTriangle" size={16} className="mt-0.5 shrink-0" />
              <span>
                {`This ${dept.scope} department is led by the ${staleSlot.key === 'head' ? 'Emergency Head' : 'Department Head'}, so the ${staleSlot.label} below must be replaced or removed.`}
              </span>
            </p>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-line p-3 text-center">
              <p className="tabular text-xl font-bold text-fg">{formatNumber(stats.total || 0)}</p>
              <p className="mt-0.5 text-[11px] text-fg-subtle">Total reports</p>
            </div>
            <div className="rounded-xl border border-line p-3 text-center">
              <p className="tabular text-xl font-bold text-fg">{formatNumber(stats.active || 0)}</p>
              <p className="mt-0.5 text-[11px] text-fg-subtle">Active</p>
            </div>
            <div className="rounded-xl border border-line p-3 text-center">
              <p className="tabular text-xl font-bold text-fg">{stats.resolutionRate ?? '—'}%</p>
              <p className="mt-0.5 text-[11px] text-fg-subtle">Resolution</p>
            </div>
          </div>

          {/* Details */}
          <KeyValue
            items={[
              { label: 'Name', value: dept.name },
              { label: 'Code', value: dept.code ? <code className="font-mono text-[13px]">{dept.code}</code> : '—' },
              { label: 'Type', value: dept.type || '—' },
              { label: 'Department Head', value: dept.head?.name || (dept.scope === 'emergency' ? '—' : 'Unassigned') },
              { label: 'Emergency Head', value: dept.emergencyHead?.name || (dept.scope === 'civic' ? '—' : 'Unassigned') },
              { label: 'Contact Number', value: dept.contactNumber || '—' },
              { label: 'Email', value: dept.email || '—' },
              { label: 'Address', value: dept.address || '—' },
              { label: 'Created', value: formatDate(dept.createdAt) }
            ]}
          />

          {/* Emergency routing */}
          {dept.emergencyTypes?.length > 0 && (
            <div>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-fg-subtle">Emergency Routing</p>
              <div className="flex flex-wrap gap-1.5">
                {dept.emergencyTypes.map((type) => (
                  <Badge key={type} tone="high">{labelize(type)}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Assigned roles */}
          {dept.assignedRoles?.length > 0 && (
            <div>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-fg-subtle">Assigned Roles</p>
              <div className="flex flex-wrap gap-1.5">
                {dept.assignedRoles.map((role) => (
                  <Badge key={role} tone="info">{labelize(role)}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Staff team */}
          {team.length > 0 && (
            <div>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-fg-subtle">Staff Team ({team.length})</p>
              <ul className="space-y-2">
                {team.map((member) => (
                  <li key={member._id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--fg-subtle)' }}>
                        {String(member.name || '?').slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-fg">{member.name}</p>
                        <p className="truncate text-[11px] text-fg-subtle">{member.email}</p>
                      </div>
                    </div>
                    <Badge tone={member.status === 'active' ? 'neutral' : 'muted'}>{labelize(member.role)}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

/* ─────────────────────────── Head Assignment Modal ── */

function HeadAssignmentModal({ open, onClose, target, kind, onSaved, onRemove }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isEmergency = kind === 'emergencyHead';
  const slotLabel = isEmergency ? 'Emergency Head' : 'Department Head';
  const otherLabel = isEmergency ? 'Department Head' : 'Emergency Head';
  const holder = isEmergency ? target?.emergencyHead : target?.head;
  const applies = target
    ? (isEmergency ? ['emergency', 'hybrid'] : ['civic', 'hybrid']).includes(target.scope)
    : false;

  useEffect(() => {
    if (open) { setChoice(''); setError(''); setQuery(''); }
  }, [open, kind]);

  const candidates = useAsync(
    () => adminApi.selectUsers(query).then((r) => (r.data.users || []).filter((user) => user.role !== 'admin')),
    [query]
  );

  async function save() {
    if (!choice) { setError('Select a user to assign.'); return; }
    setBusy(true); setError('');
    try {
      const call = isEmergency ? adminApi.assignEmergencyHead : adminApi.assignHead;
      const { data } = await call(target._id, choice);
      toast.success(data?.message || `${slotLabel} ${holder ? 'changed' : 'assigned'} for "${target.name}".`);
      onSaved(target);
      onClose();
    } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); }
  }

  /** Close first so the confirmation dialog never stacks on top of this modal. */
  function remove() {
    onClose();
    onRemove(target, kind);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${holder ? 'Change' : 'Assign'} ${slotLabel}`}
      subtitle={target?.name || ''}
      icon={isEmergency ? 'siren' : 'userCheck'}
      footer={
        <>
          {holder && (
            <Button variant="danger" icon="userX" onClick={remove} disabled={busy} className="mr-auto">
              Remove {slotLabel}
            </Button>
          )}
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!choice || !applies} onClick={save}>
            {holder ? 'Change' : 'Assign'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Current {slotLabel}</p>
          {holder ? (
            <p className="mt-0.5 truncate text-[13px]">
              <span className="font-semibold text-fg">{holder.name}</span>
              {holder.email ? <span className="ml-2 text-fg-muted">{holder.email}</span> : null}
            </p>
          ) : (
            <p className="mt-0.5 text-[13px] text-fg-muted">Unassigned</p>
          )}
        </div>

        {!applies && (
          <p className="flex items-start gap-2 rounded-xl border border-line px-3 py-2 text-[13px] status-warning">
            <Icon name="alertTriangle" size={16} className="mt-0.5 shrink-0" />
            <span>
              {`A ${slotLabel} does not belong to a ${target?.scope} department. Remove the current ${slotLabel} and assign the ${otherLabel} instead.`}
            </span>
          </p>
        )}

        <Field label="Search accounts" hint="The chosen account takes the role automatically — one account holds one role.">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={applies ? 'Name or email…' : 'Not available for this scope'}
            disabled={!applies}
          />
        </Field>
        {applies && candidates.loading && <p className="text-[13px] text-fg-muted">Searching…</p>}
        {applies && !candidates.loading && candidates.data?.length === 0 && query && (
          <EmptyState icon="search" title="No accounts match" hint="Try a different name or email." />
        )}
        {applies && candidates.data?.length > 0 && (
          <ul className="space-y-1.5 max-h-60 overflow-y-auto">
            {candidates.data.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => setChoice(user.id)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition',
                    choice === user.id ? 'border-civic-500 bg-civic-50 dark:bg-civic-950/30' : 'border-line hover:bg-surface-2'
                  )}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--fg-subtle)' }}>
                    {String(user.name || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-fg">{user.name}</p>
                    <p className="truncate text-[11px] text-fg-muted">{user.email}</p>
                  </div>
                  <Badge tone={choice === user.id ? 'info' : 'neutral'} className="shrink-0">{labelize(user.role)}</Badge>
                  {choice === user.id && <Icon name="check" size={16} className="text-civic-600 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <ErrorState message={error} />}
      </div>
    </Modal>
  );
}

/* ─────────────────────────── Emergency Routing Modal ── */

function RoutingModal({ open, onClose, target, onSaved }) {
  const toast = useToast();
  const [types, setTypes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && target) setTypes([...(target.emergencyTypes || [])]);
  }, [open, target]);

  function toggle(type) {
    setTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  }

  async function save() {
    if (!types.length) { setError('Select at least one emergency type.'); return; }
    setBusy(true); setError('');
    try {
      await adminApi.updateEmergencyRouting(target._id, { emergencyTypes: types });
      toast.success(`Emergency routing updated for "${target.name}".`);
      onSaved();
      onClose();
    } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Emergency Routing"
      subtitle={target?.name || ''}
      icon="route"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={save}>Save routing</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[13px] text-fg-muted">
          Select which emergency categories this department is responsible for handling. The department will receive auto-routing for these incident types.
        </p>
        <div className="flex flex-wrap gap-2">
          {EMERGENCY_TYPES.map((type) => {
            const active = types.includes(type);
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(type)}
                className={cx('chip cursor-pointer', active ? 'status-info' : 'status-muted')}
              >
                {active && <Icon name="check" size={12} />}
                {labelize(type)}
              </button>
            );
          })}
        </div>
        {error && <ErrorState message={error} />}
      </div>
    </Modal>
  );
}

/* ─────────────────────────────── Main Section ── */

export default function DepartmentsSection() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Filters & pagination
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState('cards'); // 'cards' | 'table'

  // ── Modal / drawer state
  const [editTarget, setEditTarget] = useState(null); // null | 'new' | dept object
  const [detailId, setDetailId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteForce, setDeleteForce] = useState(false);
  const [headTarget, setHeadTarget] = useState(null); // { dept, kind: 'head'|'emergencyHead' }
  const [removeHeadTarget, setRemoveHeadTarget] = useState(null); // same shape — clearing a leadership slot
  const [routingTarget, setRoutingTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  // ── Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Data fetching
  const departments = useAsync(
    () => adminApi.departments({ search: query, scope: scopeFilter, status: statusFilter, page, limit: 12 }).then((r) => r.data),
    [query, scopeFilter, statusFilter, page]
  );

  const availableRoles = useAsync(
    () => adminApi.assignableRoles().then((r) => r.data.roles),
    []
  );

  const rows = departments.data?.departments || [];
  const pagination = departments.data?.pagination;
  const counts = departments.data?.counts || {};

  // ── Deep-link handling
  useEffect(() => {
    const focus = searchParams.get('focus');
    const create = searchParams.get('create');
    if (focus) {
      setDetailId(focus);
      setDetailOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      setSearchParams(next, { replace: true });
    }
    if (create === '1') {
      setEditTarget('new');
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers
  function openView(id) { setDetailId(id); setDetailOpen(true); }
  function openCreate() { setEditTarget('new'); }
  function openEdit(dept) { setEditTarget(dept); }
  function openAssignHead(dept, kind = 'head') { setHeadTarget({ dept, kind }); }
  function openRemoveHead(dept, kind = 'head') { setRemoveHeadTarget({ dept, kind }); }
  function openRouting(dept) { setRoutingTarget(dept); }

  function handleToggleStatus(dept) { setToggleTarget(dept); }
  function handleDelete(dept) { setDeleteTarget(dept); setDeleteForce(false); }

  async function confirmToggleStatus() {
    if (!toggleTarget) return;
    setBusy(true);
    try {
      const newStatus = toggleTarget.status === 'active' ? 'inactive' : 'active';
      await adminApi.toggleDepartmentStatus(toggleTarget._id, newStatus);
      toast.success(`"${toggleTarget.name}" is now ${newStatus}.`);
      setToggleTarget(null);
      departments.reload();
      if (detailOpen && detailId === toggleTarget._id) {
        // Reload the drawer too
        setDetailId(null);
        setTimeout(() => setDetailId(toggleTarget._id), 50);
      }
    } catch (err) { toast.error(apiMessage(err)); } finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi.deleteDepartment(deleteTarget._id, deleteForce);
      toast.success(`"${deleteTarget.name}" deleted. Staff accounts reset to citizen.`);
      setDeleteTarget(null);
      departments.reload();
      if (detailOpen) setDetailOpen(false);
    } catch (err) {
      const message = apiMessage(err);
      // If backend says "has records", offer force option
      if (err.response?.data?.counts) {
        setDeleteForce(true);
        toast.error(message + ' Click Delete again to force-delete.');
      } else {
        toast.error(message);
      }
    } finally { setBusy(false); }
  }

  /** Re-fetch the open detail drawer after a change made from another surface. */
  function refreshDetail(id) {
    if (!detailOpen || !id || detailId !== id) return;
    setDetailId(null);
    setTimeout(() => setDetailId(id), 50);
  }

  async function confirmRemoveHead() {
    if (!removeHeadTarget) return;
    const { dept, kind } = removeHeadTarget;
    const label = kind === 'emergencyHead' ? 'Emergency Head' : 'Department Head';
    setBusy(true);
    try {
      const call = kind === 'emergencyHead' ? adminApi.removeEmergencyHead : adminApi.removeHead;
      const { data } = await call(dept._id);
      toast.success(data?.message || `${label} removed from "${dept.name}".`);
      setRemoveHeadTarget(null);
      departments.reload();
      refreshDetail(dept._id);
    } catch (err) { toast.error(apiMessage(err)); } finally { setBusy(false); }
  }

  function onSaved() { departments.reload(); }

  // ── Table columns
  const columns = [
    {
      key: 'name', label: 'Department', sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
            style={{ backgroundColor: `color-mix(in oklab, ${row.color || '#2563eb'} 15%, var(--surface))`, color: row.color || '#2563eb' }}
          >
            <Icon name={row.icon || 'building2'} size={16} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-fg">{row.name}</p>
            <p className="truncate text-[11px] font-mono text-fg-subtle">{row.code || '—'}</p>
          </div>
        </div>
      )
    },
    { key: 'scope', label: 'Scope', render: (row) => <Badge tone={scopeTone(row.scope)}>{labelize(row.scope)}</Badge> },
    { key: 'status', label: 'Status', sortable: true, render: (row) => <Badge tone={statusTone(row.status)}>{labelize(row.status)}</Badge> },
    { key: 'staffCount', label: 'Staff', render: (row) => <span className="tabular text-[13px] text-fg-muted">{formatNumber(row.staffCount || 0)}</span> },
    {
      key: 'head', label: 'Leadership',
      render: (row) => {
        const leader = row.head?.name;
        const emergencyLeader = row.emergencyHead?.name;
        if (!leader && !emergencyLeader) return <span className="text-[13px] text-fg-subtle">—</span>;
        return (
          <div className="flex flex-col gap-0.5 text-[13px] text-fg-muted">
            {leader && (
              <span className="flex items-center gap-1"><Icon name="user" size={12} className="shrink-0" />{leader}</span>
            )}
            {emergencyLeader && (
              <span className="flex items-center gap-1"><Icon name="siren" size={12} className="shrink-0" />{emergencyLeader}</span>
            )}
          </div>
        );
      }
    },
    {
      key: 'emergencyTypes', label: 'Emergency types',
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
        <div className="flex flex-wrap justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" icon="eye" onClick={() => openView(row._id)}>View</Button>
          <Button size="sm" icon="pencil" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="sm" icon="siren" onClick={() => openRouting(row)}>Routing</Button>
          <Button
            size="sm"
            icon={row.status === 'active' ? 'pauseCircle' : 'playCircle'}
            onClick={() => handleToggleStatus(row)}
          >
            {row.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
          <Button size="sm" variant="danger" icon="trash" onClick={() => handleDelete(row)} aria-label={`Delete ${row.name}`} />
        </div>
      )
    }
  ];

  const anyFilter = search || scopeFilter || statusFilter;

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <SectionHeading
        title="Department Management"
        subtitle="Create, configure and manage all civic and emergency departments. Changes are reflected immediately across all citizen-facing screens."
        action={
          <Button variant="primary" icon="plus" onClick={openCreate}>
            New department
          </Button>
        }
      />

      {/* ── KPI stats ── */}
      {departments.loading && !rows.length
        ? <SkeletonKpiGrid count={4} />
        : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total departments" value={formatNumber(counts.total ?? pagination?.total ?? 0)} icon="building2" tone="info" hint="all records" />
            <StatCard label="Active" value={formatNumber(counts.active ?? 0)} icon="checkCircle" tone="success" hint="visible to citizens" />
            <StatCard label="Inactive" value={formatNumber(counts.inactive ?? 0)} icon="pauseCircle" tone="medium" hint="hidden from citizens" />
            <StatCard
              label="Total staff"
              value={formatNumber(rows.reduce((sum, d) => sum + (d.staffCount || 0), 0))}
              icon="users"
              tone="neutral"
              hint="active staff accounts"
            />
          </div>
        )}

      {/* ── Toolbar: search + filters + view toggle ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-line bg-surface px-3">
          <Icon name="search" size={15} className="shrink-0 text-fg-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search departments…"
            aria-label="Search departments"
            className="flex-1 border-0 bg-transparent py-2 text-[13px] outline-none placeholder:text-fg-subtle"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-fg-subtle hover:text-fg" aria-label="Clear search">
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Filter by status"
          className="min-w-[120px]"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={scopeFilter}
          onChange={(e) => { setScopeFilter(e.target.value); setPage(1); }}
          aria-label="Filter by scope"
          className="min-w-[120px]"
        >
          <option value="">All scopes</option>
          <option value="civic">Civic</option>
          <option value="emergency">Emergency</option>
          <option value="hybrid">Hybrid</option>
        </select>
        {anyFilter && (
          <Button size="sm" icon="close" onClick={() => { setSearch(''); setScopeFilter(''); setStatusFilter(''); setPage(1); }}>
            Clear
          </Button>
        )}
        <Segmented
          ariaLabel="View mode"
          value={view}
          onChange={setView}
          options={[
            { value: 'cards', label: 'Cards' },
            { value: 'table', label: 'Table' }
          ]}
        />
      </div>

      {/* ── Error ── */}
      {departments.error && !rows.length && (
        <ErrorState message={departments.error} onRetry={departments.reload} />
      )}

      {/* ── Empty state ── */}
      {!departments.loading && !departments.error && !rows.length && (
        <EmptyState
          icon="building2"
          title={anyFilter ? 'No departments match' : 'No departments yet'}
          hint={anyFilter ? 'Adjust the filters or search to find departments.' : 'Create the first department to get started.'}
          action={!anyFilter && <Button variant="primary" icon="plus" onClick={openCreate}>Create first department</Button>}
        />
      )}

      {/* ── Cards view ── */}
      {view === 'cards' && rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {departments.loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl border border-line bg-surface-2" />
              ))
            : rows.map((dept) => (
                <DepartmentCard
                  key={dept._id}
                  dept={dept}
                  onView={openView}
                  onEdit={openEdit}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDelete}
                />
              ))}
        </div>
      )}

      {/* ── Table view ── */}
      {view === 'table' && (
        <DataTable
          caption="Departments"
          columns={columns}
          rows={rows}
          loading={departments.loading}
          error={departments.error}
          onRetry={departments.reload}
          onRowClick={(row) => openView(row._id)}
          empty={{ icon: 'building2', title: 'No departments match', hint: 'Create a department or clear the filters.' }}
        />
      )}

      {/* ── Pagination ── */}
      {pagination && pagination.pages > 1 && (
        <Pagination
          page={pagination.page}
          pages={pagination.pages}
          total={pagination.total}
          limit={pagination.limit}
          onPage={setPage}
        />
      )}

      {/* ── Add/Edit Modal ── */}
      <DepartmentFormModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        editTarget={editTarget === 'new' ? null : editTarget}
        availableRoles={availableRoles.data}
        onSaved={onSaved}
      />

      {/* ── Detail Drawer ── */}
      <DepartmentDetailDrawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        id={detailId}
        onEdit={(dept) => { setDetailOpen(false); openEdit(dept); }}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDelete}
        onAssignHead={openAssignHead}
      />

      {/* ── Head assignment / change ── */}
      <HeadAssignmentModal
        open={Boolean(headTarget)}
        onClose={() => setHeadTarget(null)}
        target={headTarget?.dept}
        kind={headTarget?.kind}
        onSaved={(dept) => { departments.reload(); refreshDetail(dept?._id); }}
        onRemove={openRemoveHead}
      />

      {/* ── Remove head confirm ── */}
      <ConfirmDialog
        open={Boolean(removeHeadTarget)}
        onClose={() => setRemoveHeadTarget(null)}
        title={`Remove the ${removeHeadTarget?.kind === 'emergencyHead' ? 'Emergency Head' : 'Department Head'}?`}
        message={`The current leader is demoted to citizen and detached from "${removeHeadTarget?.dept?.name}". You can assign a new head straight afterwards.`}
        confirmLabel="Remove head"
        danger
        busy={busy}
        onConfirm={confirmRemoveHead}
      />

      {/* ── Emergency routing ── */}
      <RoutingModal
        open={Boolean(routingTarget)}
        onClose={() => setRoutingTarget(null)}
        target={routingTarget}
        onSaved={onSaved}
      />

      {/* ── Activate/Deactivate confirm ── */}
      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        title={toggleTarget?.status === 'active' ? `Deactivate "${toggleTarget?.name}"?` : `Activate "${toggleTarget?.name}"?`}
        message={toggleTarget?.status === 'active'
          ? 'The department will be hidden from citizen-facing pickers immediately. Existing reports and staff accounts are preserved.'
          : 'The department will become visible to citizens again and available for new report routing.'}
        confirmLabel={toggleTarget?.status === 'active' ? 'Deactivate department' : 'Activate department'}
        danger={toggleTarget?.status === 'active'}
        busy={busy}
        onConfirm={confirmToggleStatus}
      />

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}"?`}
        message={deleteForce
          ? `This department has existing reports or emergencies. Force-deleting will permanently remove the department and reset all staff accounts to citizen. This cannot be undone.`
          : 'All staff accounts in this department will be reset to citizen. Existing reports and emergencies remain in the database. This cannot be undone.'}
        confirmLabel={deleteForce ? 'Force delete anyway' : 'Delete department'}
        danger
        busy={busy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
