
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import { reportsApi } from '../../services/reportService.js';
import { subscribeToDepartmentCatalogue } from '../../services/emergencySocket.js';
import { apiMessage } from '../../services/api.js';

/* ── icon → emoji fallback (same map as ReportForm) ── */
const ICON_EMOJI = {
  building2: '🏛️', hospital: '🏥', siren: '🚨', flame: '🔥', shield: '🛡️',
  trash2: '🗑️', zap: '⚡', droplets: '💧', leaf: '🌿', car: '🚗',
  treeDeciduous: '🌳', wrench: '🔧'
};
const deptEmoji = (icon) => ICON_EMOJI[icon] || '🏛️';

/* ── skeleton card ── */
function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700" />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-slate-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
        <div className="mt-3 h-3 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-1.5 h-3 w-4/5 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-4 flex gap-2">
          <div className="h-8 w-24 rounded-lg bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
    </div>
  );
}

/* ── single department card ── */
function DepartmentCard({ dept, searchQuery }) {
  const navigate = useNavigate();

  // Highlight matching text in name/description
  function highlight(text) {
    if (!searchQuery || !text) return text;
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part)
        ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/60 text-inherit rounded px-0.5">{part}</mark>
        : part
    );
  }

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm transition hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600"
      aria-label={dept.name}
    >
      {/* Colour accent bar */}
      <div className="h-1.5 w-full flex-shrink-0" style={{ backgroundColor: dept.color || '#2563eb' }} />

      <div className="flex flex-1 flex-col p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl"
            style={{
              backgroundColor: `color-mix(in oklab, ${dept.color || '#2563eb'} 14%, white)`,
              color: dept.color || '#2563eb'
            }}
          >
            {deptEmoji(dept.icon)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">
              {highlight(dept.name)}
            </h2>
            {dept.code && (
              <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">{dept.code}</p>
            )}
          </div>
        </div>

        {/* Description */}
        {dept.description ? (
          <p className="mt-3 line-clamp-3 text-sm leading-5 text-slate-600 dark:text-slate-400">
            {highlight(dept.description)}
          </p>
        ) : (
          <p className="mt-3 text-sm italic text-slate-400 dark:text-slate-600">
            No description provided.
          </p>
        )}

        {/* Contact info */}
        {(dept.contactNumber || dept.email) && (
          <div className="mt-3 space-y-1 text-[12px] text-slate-500 dark:text-slate-400">
            {dept.contactNumber && (
              <div className="flex items-center gap-1.5">
                <span>📞</span>
                <span>{dept.contactNumber}</span>
              </div>
            )}
            {dept.email && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span>✉️</span>
                <a href={`mailto:${dept.email}`} className="truncate hover:underline text-civic-600 dark:text-civic-400">
                  {dept.email}
                </a>
              </div>
            )}
            {dept.address && (
              <div className="flex items-start gap-1.5">
                <span className="mt-0.5">📍</span>
                <span className="line-clamp-2">{dept.address}</span>
              </div>
            )}
          </div>
        )}

        {/* Spacer + CTA */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => navigate(`/dashboard/citizen/reports/new?department=${encodeURIComponent(dept.name)}`)}
            className="rounded-lg bg-civic-600 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-civic-700 active:bg-civic-800"
          >
            Submit a report →
          </button>
          {dept.scope === 'emergency' || dept.scope === 'hybrid' ? (
            <Link
              to="/dashboard/citizen/emergency/new"
              className="rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-sm font-semibold text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              🚨 Emergency
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/* ── main page ── */
export default function CitizenDepartments() {
  const [allDepts, setAllDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [justUpdated, setJustUpdated] = useState(false);
  const mounted = useRef(true);

  const loadDepts = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await reportsApi.departments();
      if (!mounted.current) return;
      setAllDepts(data.departments || []);
    } catch (err) {
      if (mounted.current) setError(apiMessage(err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadDepts();
    return () => { mounted.current = false; };
  }, [loadDepts]);

  // Real-time: reload silently when admin changes the department catalogue
  useEffect(() => {
    const unsubscribe = subscribeToDepartmentCatalogue(() => {
      loadDepts({ silent: true });
      setJustUpdated(true);
      setTimeout(() => { if (mounted.current) setJustUpdated(false); }, 4000);
    });
    return unsubscribe;
  }, [loadDepts]);

  // Filter by search
  const filtered = allDepts.filter((dept) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return dept.name.toLowerCase().includes(q) || (dept.description || '').toLowerCase().includes(q);
  });

  return (
    <CitizenLayout title="Departments">
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-extrabold text-ink dark:text-slate-100">City Departments</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Choose a department to submit a civic complaint or service request.
          </p>
        </div>

        {/* Real-time update banner */}
        {justUpdated && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Department list updated by administration.
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 shadow-sm">
          <span className="text-slate-400">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search departments…"
            aria-label="Search departments"
            className="flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" aria-label="Clear search">
              ✕
            </button>
          )}
        </div>

        {/* Count */}
        {!loading && !error && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filtered.length} active department{filtered.length !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ''}
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
            <p className="font-semibold">Could not load departments</p>
            <p className="mt-0.5">{error}</p>
            <button onClick={() => loadDepts()} className="mt-2 font-bold underline">
              Try again
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-10 text-center">
            <p className="text-4xl">🏛️</p>
            <p className="mt-3 font-bold text-slate-700 dark:text-slate-300">
              {search ? 'No departments match your search' : 'No departments available'}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {search
                ? 'Try a different search term or clear the search.'
                : 'No active departments have been configured yet. Please check back later.'}
            </p>
            {search && (
              <button onClick={() => setSearch('')} className="mt-3 font-bold text-civic-600 dark:text-civic-400 hover:underline">
                Clear search
              </button>
            )}
          </div>
        )}

        {/* Department cards */}
        {!loading && !error && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((dept) => (
              <DepartmentCard key={dept._id || dept.name} dept={dept} searchQuery={search} />
            ))}
          </div>
        )}
      </div>
    </CitizenLayout>
  );
}
