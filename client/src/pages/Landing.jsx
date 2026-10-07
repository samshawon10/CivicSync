import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import {
  Activity, ArrowDown, ArrowRight, Bell, Building2, Check, CheckCircle2, ChevronRight,
  Bookmark, ClipboardCheck, ClipboardList, Clock3, FileText, Heart, Layers3, MapPin,
  Menu, MessageCircle, Moon, Radio, Route, ShieldCheck, Siren, Sun, Users, Workflow,
  Wrench, X, Zap
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import PageHead from '../components/ui/PageHead.jsx';
import Icon from '../components/ui/Icon.jsx';

const navLinks = [
  ['Home', '#home'],
  ['Features', '#features'],
  ['Community', '#community'],
  ['How it works', '#how-it-works'],
  ['Emergency', '#emergency'],
  ['About', '#why-civicsync']
];

const challenges = [
  { icon: FileText, title: 'Reporting feels fragmented', copy: 'People need a clear, consistent way to share a local issue with the service responsible for it.' },
  { icon: Clock3, title: 'Progress is hard to follow', copy: 'Without useful updates, citizens may not know whether a report has been received or what happens next.' },
  { icon: Workflow, title: 'Coordination takes effort', copy: 'Departments and field teams need structured assignments and shared visibility to move work forward.' },
  { icon: Siren, title: 'Urgent needs a clear route', copy: 'Emergency requests need a dedicated path to the teams responsible for coordinating a response.' }
];

const features = [
  { icon: MapPin, title: 'Citizen reporting', copy: 'Submit civic concerns with useful details and location information.' },
  { icon: Activity, title: 'Report progress', copy: 'Follow report updates and milestones from your account.' },
  { icon: Building2, title: 'Department coordination', copy: 'Department teams review, organize, and coordinate cases.' },
  { icon: Users, title: 'Team management', copy: 'Team Leaders organize operational teams and assignments.' },
  { icon: ClipboardCheck, title: 'Field operations', copy: 'Workers receive assigned tasks and record field progress.' },
  { icon: Siren, title: 'Emergency response', copy: 'Dedicated emergency roles coordinate incident response.' },
  { icon: Bell, title: 'Notifications', copy: 'Stay informed about important activity and status changes.' },
  { icon: Layers3, title: 'Community discussions', copy: 'Share local context, browse topics, and take part in citizen-led discussions.' }
];

const roles = [
  { icon: Users, title: 'Citizen', copy: 'Report issues, track progress, and stay informed.' },
  { icon: Building2, title: 'Department Head', copy: 'Oversee departmental cases and operational progress.' },
  { icon: ClipboardList, title: 'Department Officer', copy: 'Coordinate cases and assigned operational work.' },
  { icon: Workflow, title: 'Team Leader', copy: 'Organize field teams, assign tasks, and follow progress.' },
  { icon: Wrench, title: 'Worker', copy: 'Receive field tasks and report work progress.' },
  { icon: Siren, title: 'Emergency Head', copy: 'Coordinate emergency incidents and response routing.' },
  { icon: Radio, title: 'Emergency Department Officer', copy: 'Coordinate emergency department operations.' },
  { icon: Activity, title: 'Emergency Officer', copy: 'Manage emergency operations and response assignments.' },
  { icon: Zap, title: 'Emergency Field Worker', copy: 'Receive and carry out emergency field assignments.' }
];

const steps = [
  ['01', 'Report', 'A citizen submits a civic issue with relevant details.'],
  ['02', 'Route', 'The issue is reviewed and reaches the responsible department.'],
  ['03', 'Assign', 'Department leadership coordinates the operational workflow.'],
  ['04', 'Respond', 'Team Leaders and workers carry out assigned field work.'],
  ['05', 'Resolve', 'Progress is recorded as the issue moves toward resolution.']
];

const benefits = [
  { icon: Activity, title: 'Better visibility', copy: 'A clear view of report progress helps citizens understand what is happening next.' },
  { icon: ShieldCheck, title: 'Clear accountability', copy: 'Cases move through defined roles, with updates recorded along the way.' },
  { icon: Users, title: 'Coordinated field work', copy: 'Structured teams and assignments help connect department planning with field operations.' },
  { icon: Siren, title: 'Dedicated emergency routing', copy: 'Emergency reports follow their own operational chain and role-based workflow.' },
  { icon: Workflow, title: 'One connected experience', copy: 'Citizens and service teams use one platform for civic operations.' }
];

function Brand({ footer = false }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 rounded-lg ${footer ? 'text-white' : 'text-fg'}`} aria-label="CivicSync home">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-civic-600 text-white">
        <Icon name="building" size={20} />
      </span>
      <span className="text-lg font-extrabold tracking-tight">
        Civic<span className={footer ? 'text-civic-300' : 'text-civic-600'}>Sync</span>
      </span>
    </Link>
  );
}

function ThemeToggle({ mobile = false }) {
  const { resolved, toggle } = useTheme();
  const dark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      aria-pressed={dark}
      title={`Switch to ${dark ? 'light' : 'dark'} mode`}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-civic-500 ${mobile ? 'w-full px-3' : 'w-10 px-2'}`}
    >
      {dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
      {mobile && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
      {!mobile && <span className="sr-only">{dark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  );
}

function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = (event) => {
      if (event.matches) setOpen(false);
    };
    desktopQuery.addEventListener?.('change', closeOnDesktop);
    return () => desktopQuery.removeEventListener?.('change', closeOnDesktop);
  }, []);

  const closeMenu = () => setOpen(false);

  return (
    <motion.header
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.25 }}
      className={`sticky top-0 z-50 border-b transition-colors duration-200 ${scrolled ? 'border-line bg-surface/95 shadow-sm backdrop-blur-md' : 'border-transparent bg-surface/90 backdrop-blur-md'}`}
    >
      <nav className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-5 px-5 sm:px-7 lg:px-10" aria-label="Main navigation">
        <Brand />
        <div className="hidden items-center gap-7 lg:flex">
          {navLinks.map(([label, href]) => (
            <a key={href} href={href} className="rounded-sm text-sm font-semibold text-fg-muted transition-colors hover:text-civic-600 dark:hover:text-civic-300">{label}</a>
          ))}
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <Link to="/login" className="rounded-lg px-3 py-2.5 text-sm font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg">Sign in</Link>
          <Link to="/register" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-civic-600 px-4 text-sm font-bold text-white transition-colors hover:bg-civic-700">
            Create account <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-line text-fg transition-colors hover:bg-surface-2 lg:hidden"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          {open ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
        </button>
      </nav>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="mobile-navigation"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-line bg-surface lg:hidden"
          >
            <div className="space-y-1 px-5 py-4">
              {navLinks.map(([label, href]) => (
                <a key={href} href={href} onClick={closeMenu} className="block rounded-lg px-3 py-3 text-sm font-semibold text-fg-muted hover:bg-surface-2 hover:text-fg">{label}</a>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <ThemeToggle mobile />
                <Link to="/login" onClick={closeMenu} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-line px-3 text-sm font-bold text-fg">Sign in</Link>
                <Link to="/register" onClick={closeMenu} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-civic-600 px-4 text-sm font-bold text-white hover:bg-civic-700">
                  Create account <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

function SectionHeading({ eyebrow, title, copy, center = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.35 }}
      className={`max-w-3xl ${center ? 'mx-auto text-center' : ''}`}
    >
      <p className="text-xs font-bold tracking-[.16em] text-civic-600 dark:text-civic-300">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-fg sm:text-4xl">{title}</h2>
      {copy && <p className="mt-4 text-base leading-7 text-fg-muted">{copy}</p>}
    </motion.div>
  );
}

function RevealCard({ children, className = '', index = 0 }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.045, 0.18) }}
      whileHover={{ y: -3 }}
      className={className}
    >
      {children}
    </motion.article>
  );
}

function HeroVisual() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="relative mx-auto w-full max-w-[590px]" aria-label="Illustrative CivicSync report and response dashboard" role="img">
      <div className="absolute -inset-5 rounded-[2rem] bg-civic-500/10 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-3 shadow-2xl shadow-slate-900/10 sm:p-4">
        <div className="flex items-center justify-between gap-3 border-b border-line px-1 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-civic-50 text-civic-700 dark:bg-civic-500/15 dark:text-civic-300"><Building2 size={18} /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-fg">Civic operations</p>
              <p className="text-xs text-fg-subtle">Illustrative product preview</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[10px] font-bold text-fg-muted">Platform overview</span>
        </div>

        <div className="relative mt-3 h-[220px] overflow-hidden rounded-xl border border-line bg-surface-2 sm:h-[275px]">
          <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:28px_28px]" aria-hidden="true" />
          <svg viewBox="0 0 560 280" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <motion.path
              d="M34 208C107 198 115 104 201 128s93 84 160 25 96-76 164-82"
              fill="none"
              stroke="#60A5FA"
              strokeWidth="3"
              strokeDasharray="7 8"
              initial={reduceMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: reduceMotion ? 0 : 1.1, ease: 'easeOut' }}
            />
            <path d="M60 58c92 22 132 12 187 80s117 89 252 91" fill="none" stroke="#34D399" strokeWidth="2" strokeDasharray="5 8" opacity=".8" />
            {[[113, 147], [292, 171], [451, 91]].map(([cx, cy], index) => (
              <motion.circle
                key={`${cx}-${cy}`}
                cx={cx}
                cy={cy}
                r="12"
                fill="none"
                stroke={index === 1 ? '#0F766E' : '#2563EB'}
                strokeWidth="2"
                animate={reduceMotion ? undefined : { r: [12, 22], opacity: [0.45, 0] }}
                transition={{ duration: 2.8, delay: index * 0.55, repeat: Infinity, ease: 'easeOut' }}
              />
            ))}
            <circle cx="113" cy="147" r="11" fill="#2563EB" stroke="white" strokeWidth="4" />
            <circle cx="292" cy="171" r="10" fill="#0F766E" stroke="white" strokeWidth="4" />
            <circle cx="451" cy="91" r="10" fill="#D97706" stroke="white" strokeWidth="4" />
          </svg>
          <div className="absolute left-3 top-3 max-w-[170px] rounded-lg border border-line bg-surface p-2.5 shadow-lg sm:left-5 sm:top-5 sm:max-w-[190px]">
            <p className="text-[9px] font-bold tracking-wide text-fg-subtle">CIVIC REPORT</p>
            <p className="mt-1 text-xs font-bold text-fg">Street light issue</p>
            <p className="mt-1 flex items-center gap-1 text-[10px] text-fg-muted"><MapPin size={11} /> Location attached</p>
          </div>
          <div className="absolute bottom-3 right-3 rounded-lg border border-line bg-surface p-2.5 shadow-lg sm:bottom-5 sm:right-5">
            <p className="text-[9px] font-bold tracking-wide text-fg-subtle">FIELD TASK</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-fg"><Route size={13} className="text-civic-600" /> Assigned to a field team</p>
          </div>
          <span className="absolute left-[47%] top-[49%] grid h-8 w-8 place-items-center rounded-full bg-civic-600 text-white shadow-lg shadow-civic-600/30"><Building2 size={15} /></span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            [ClipboardList, 'Reports', 'Submitted details'],
            [Workflow, 'Assignments', 'Team coordination'],
            [CheckCircle2, 'Progress', 'Status updates']
          ].map(([Icon, title, copy]) => (
            <div key={title} className="min-w-0 rounded-xl border border-line bg-surface-2 p-2.5 sm:p-3">
              <Icon size={16} className="text-civic-600 dark:text-civic-300" aria-hidden="true" />
              <p className="mt-2 truncate text-xs font-bold text-fg">{title}</p>
              <p className="mt-0.5 hidden truncate text-[10px] text-fg-subtle sm:block">{copy}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-5 -left-3 hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-lg sm:flex">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><Radio size={16} /></span>
        <span><span className="block text-[10px] font-bold text-fg">Emergency workflow</span><span className="block text-[10px] text-fg-subtle">Dedicated response roles</span></span>
      </div>
    </div>
  );
}

function WorkflowChain({ title, steps: chain, emergency = false }) {
  return (
    <div className={`rounded-2xl border p-5 sm:p-6 ${emergency ? 'border-red-200 bg-red-50/80 dark:border-red-900/70 dark:bg-red-950/20' : 'border-line bg-surface'}`}>
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${emergency ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'bg-civic-50 text-civic-700 dark:bg-civic-500/15 dark:text-civic-300'}`}>
          {emergency ? <Siren size={19} /> : <Workflow size={19} />}
        </span>
        <div>
          <h3 className="font-bold text-fg">{title}</h3>
          <p className="text-xs text-fg-muted">{emergency ? 'Dedicated emergency operations' : 'A coordinated civic issue workflow'}</p>
        </div>
      </div>
      <ol className={`mt-5 grid gap-2 sm:grid-cols-3 ${emergency ? 'lg:grid-cols-5' : 'lg:grid-cols-6'}`}>
        {chain.map((step, index) => (
          <motion.li
            key={step}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.24, delay: index * 0.035 }}
            className="relative flex min-h-14 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-fg"
          >
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${emergency ? 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200' : 'bg-civic-100 text-civic-800 dark:bg-civic-500/20 dark:text-civic-200'}`}>{index + 1}</span>
            <span>{step}</span>
            {index < chain.length - 1 && <ChevronRight size={14} className="ml-auto shrink-0 text-fg-subtle" aria-hidden="true" />}
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface p-3 shadow-2xl shadow-slate-950/10 sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-civic-600 text-white"><Icon name="building" size={16} /></span>
          <div><p className="text-xs font-bold text-fg">CivicSync workspace</p><p className="text-[10px] text-fg-subtle">Illustrative dashboard preview</p></div>
        </div>
        <span className="rounded-full border border-line px-2.5 py-1 text-[10px] font-semibold text-fg-muted">Operations view</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_.8fr]">
        <div className="relative min-h-[220px] overflow-hidden rounded-xl border border-line bg-surface-2 p-4 sm:min-h-[268px]">
          <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:30px_30px]" aria-hidden="true" />
          <p className="relative text-[10px] font-bold tracking-wide text-fg-muted">ISSUE MAP · EXAMPLE VIEW</p>
          <svg viewBox="0 0 440 180" className="absolute inset-x-0 top-12 h-[155px] w-full" aria-hidden="true">
            <path d="M27 127c66-10 63-72 128-54s73 69 125 29 73-36 130-62" fill="none" stroke="#60A5FA" strokeWidth="3" strokeDasharray="6 7" />
            <circle cx="84" cy="105" r="8" fill="#2563EB" stroke="#dbeafe" strokeWidth="3" />
            <circle cx="225" cy="112" r="8" fill="#0F766E" stroke="#ccfbf1" strokeWidth="3" />
            <circle cx="345" cy="72" r="8" fill="#D97706" stroke="#fef3c7" strokeWidth="3" />
          </svg>
          <div className="absolute bottom-3 left-3 rounded-lg border border-line bg-surface px-3 py-2 shadow-sm">
            <p className="text-[9px] font-semibold text-fg-subtle">EXAMPLE REPORT</p>
            <p className="mt-1 text-xs font-bold text-fg">Road maintenance</p>
            <p className="mt-1 text-[10px] text-civic-700 dark:text-civic-300">Status update available</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-rows-2">
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-fg">Task progress</p>
              <ClipboardCheck size={16} className="text-civic-700 dark:text-civic-300" />
            </div>
            <div className="mt-4 space-y-3">
              {['Department review', 'Team assignment', 'Field update'].map((label, index) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span className={`grid h-5 w-5 place-items-center rounded-full ${index < 2 ? 'bg-civic-100 text-civic-800 dark:bg-civic-500/20 dark:text-civic-200' : 'border border-line-strong text-fg-subtle'}`}>{index < 2 ? <Check size={12} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>
                  <span className="text-[11px] text-fg-muted">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900/70 dark:bg-red-950/20">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-300"><Siren size={16} /><p className="text-xs font-bold">Emergency status</p></div>
            <p className="mt-3 text-xs leading-5 text-fg-muted">Dedicated incident routing and response assignments.</p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3 text-[10px] text-fg-subtle">
        <span className="inline-flex items-center gap-1.5"><MapPin size={12} /> Issue location</span>
        <span className="inline-flex items-center gap-1.5"><Building2 size={12} /> Department assignment</span>
        <span className="inline-flex items-center gap-1.5"><Wrench size={12} /> Field progress</span>
      </div>
    </div>
  );
}

function CommunityPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xl shadow-slate-900/5">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-civic-50 text-civic-700 dark:bg-civic-500/15 dark:text-civic-300"><Users size={17} /></span>
          <div><p className="text-sm font-bold text-fg">CivicSync Community</p><p className="text-xs text-fg-subtle">Illustrative community feed</p></div>
        </div>
        <span className="rounded-full border border-line px-2.5 py-1 text-[10px] font-semibold text-fg-muted">Citizen-generated</span>
      </div>
      <div className="border-b border-line px-4 pt-3 sm:px-5">
        <div className="flex gap-5 text-xs font-semibold">
          <span className="border-b-2 border-civic-600 pb-3 text-civic-700 dark:text-civic-300">For You</span>
          <span className="inline-flex items-center gap-1.5 pb-3 text-fg-muted"><Users size={13} /> Following</span>
          <span className="inline-flex items-center gap-1.5 pb-3 text-fg-muted"><Bookmark size={13} /> Saved</span>
        </div>
      </div>
      <div className="space-y-3 bg-surface-2 p-3 sm:p-4">
        <article className="rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-civic-50 px-2.5 py-1 text-[10px] font-bold text-civic-800 dark:bg-civic-500/15 dark:text-civic-200">LOCAL ISSUES</span>
            <span className="text-[10px] text-fg-subtle">Example post</span>
          </div>
          <p className="mt-3 text-sm font-bold text-fg">Share useful context with your community</p>
          <p className="mt-1.5 text-xs leading-5 text-fg-muted">Choose a topic, add an area if helpful, and start a discussion. A community post does not create an official civic report.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-fg-muted"><Heart size={14} /> Helpful</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-fg-muted"><MessageCircle size={14} /> Comments</span>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-fg-muted"><Bookmark size={14} /> Save</span>
          </div>
        </article>
        <div className="flex flex-wrap gap-2" aria-label="Community topics">
          {['Local issues', 'Safety', 'Community help', 'Lost & Found', 'Events', 'Discussions'].map((topic) => (
            <span key={topic} className="rounded-full border border-line bg-surface px-2.5 py-1.5 text-[10px] font-medium text-fg-muted">{topic}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Footer() {
  const footerLinks = [
    { heading: 'Explore', links: [['Features', '#features'], ['Community', '#community'], ['How it works', '#how-it-works'], ['Emergency response', '#emergency'], ['Why CivicSync', '#why-civicsync']] },
    { heading: 'Get started', links: [['Sign in', '/login'], ['Create an account', '/register'], ['Report an issue', '/dashboard/citizen/reports/new'], ['Community space', '/dashboard/citizen/community'], ['Request emergency help', '/dashboard/citizen/emergency/new']] }
  ];

  return (
    <footer className="relative overflow-hidden bg-[#0c1b30] text-slate-300">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-civic-400/60 to-transparent" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-7 sm:py-14 lg:grid-cols-[1.25fr_.75fr_.9fr] lg:gap-16 lg:px-10 lg:py-16">
        <div className="max-w-md">
          <Brand footer />
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">One connected platform for citizens, departments, field teams, and emergency response.</p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-xs font-medium text-slate-300">
            <ShieldCheck size={14} className="text-civic-300" aria-hidden="true" />
            Built around clear, role-based service workflows
          </p>
        </div>
        {footerLinks.map(({ heading, links }) => (
          <nav key={heading} aria-label={heading}>
            <h2 className="text-sm font-bold text-white">{heading}</h2>
            <ul className="mt-4 space-y-3">
              {links.map(([label, href]) => (
                <li key={label}>
                  {href.startsWith('/')
                    ? <Link to={href} className="inline-flex min-h-6 items-center text-sm text-slate-400 transition-colors hover:text-white focus-visible:text-white">{label}</Link>
                    : <a href={href} className="inline-flex min-h-6 items-center text-sm text-slate-400 transition-colors hover:text-white focus-visible:text-white">{label}</a>}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 text-xs text-slate-400 sm:px-7 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <span>© {new Date().getFullYear()} CivicSync. All rights reserved.</span>
          <p className="max-w-2xl leading-5 text-slate-400">Connecting citizens and service teams through clearer civic workflows.</p>
          <a href="#home" className="inline-flex min-h-8 items-center gap-1 self-start rounded-md transition-colors hover:text-white focus-visible:text-white lg:self-auto">Back to top <ArrowDown size={12} className="rotate-180" aria-hidden="true" /></a>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <MotionConfig reducedMotion="user">
      <div id="home" className="min-h-screen overflow-x-clip bg-app text-fg transition-colors duration-200">
        <PageHead title="Civic services, connected" description="CivicSync connects citizens, departments, field teams, and emergency response through one civic services platform." />
        <Navbar />
        <main>
          <section className="relative overflow-hidden border-b border-line bg-surface">
            <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-position:center_top] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" aria-hidden="true" />
            <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-7 sm:py-20 lg:grid-cols-[1fr_1fr] lg:gap-12 lg:px-10 lg:py-24">
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold tracking-wide text-civic-700 shadow-sm dark:text-civic-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-civic-500" /> SMARTER CIVIC SERVICES
                </p>
                <h1 className="mt-6 max-w-[660px] text-[clamp(2.4rem,5vw,4.5rem)] font-extrabold leading-[1.07] tracking-[-.045em] text-fg">
                  Connect citizens.<br />
                  <span className="text-civic-600 dark:text-civic-300">Coordinate services.</span><br />
                  Improve communities.
                </h1>
                <p className="mt-6 max-w-xl text-base leading-7 text-fg-muted sm:text-lg sm:leading-8">
                  CivicSync helps citizens report problems, departments coordinate field operations, and emergency teams respond through one connected platform.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link to="/dashboard/citizen/reports/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-civic-600 px-5 text-sm font-bold text-white shadow-sm shadow-civic-700/15 transition hover:bg-civic-700">
                    Report an issue <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                  <a href="#features" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-5 text-sm font-bold text-fg transition hover:bg-surface-2">
                    Explore CivicSync <ChevronRight size={16} aria-hidden="true" />
                  </a>
                </div>
                <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-5">
                  {[
                    [MapPin, 'Citizen reporting'],
                    [Building2, 'Department coordination'],
                    [Wrench, 'Field operations'],
                    [Siren, 'Emergency response']
                  ].map(([Icon, label]) => (
                    <span key={label} className="inline-flex items-center gap-2 text-xs font-semibold text-fg-muted">
                      <Icon size={15} className="text-civic-600 dark:text-civic-300" aria-hidden="true" />{label}
                    </span>
                  ))}
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }}>
                <HeroVisual />
              </motion.div>
            </div>
          </section>

          <section className="bg-surface-2">
            <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-7 sm:py-20 lg:grid-cols-[.85fr_1.15fr] lg:px-10">
              <SectionHeading eyebrow="THE CHALLENGE" title="Turning civic problems into coordinated action" copy="When reports and updates are spread across different channels, it can be difficult for people and service teams to share context and see progress." />
              <div className="grid gap-3 sm:grid-cols-2">
                {challenges.map(({ icon: Icon, title, copy }, index) => (
                  <RevealCard key={title} index={index} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-civic-50 text-civic-700 dark:bg-civic-500/15 dark:text-civic-300"><Icon size={19} aria-hidden="true" /></span>
                    <h3 className="mt-4 text-base font-bold text-fg">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-fg-muted">{copy}</p>
                  </RevealCard>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-surface">
            <div className="mx-auto max-w-7xl px-5 py-16 sm:px-7 sm:py-20 lg:px-10">
              <SectionHeading eyebrow="ONE CONNECTED PLATFORM" title="A clear path from report to response" copy="CivicSync connects citizen reports with department coordination, field assignments, and a dedicated emergency workflow." center />
              <div className="mt-10 space-y-4">
                <WorkflowChain title="Civic issue workflow" steps={['Citizen', 'Department Head', 'Department Officer', 'Team Leader', 'Worker', 'Resolution']} />
                <WorkflowChain title="Emergency response workflow" steps={['Citizen SOS', 'Emergency Head', 'Emergency Officer', 'Emergency Field Worker', 'Response']} emergency />
              </div>
            </div>
          </section>

          <section id="features" className="scroll-mt-24 bg-surface-2">
            <div className="mx-auto max-w-7xl px-5 py-16 sm:px-7 sm:py-20 lg:px-10">
              <SectionHeading eyebrow="CIVICSYNC CAPABILITIES" title="Civic operations, in one place" copy="Purpose-built tools connect reporting, coordination, field work, and public updates." center />
              <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {features.map(({ icon: Icon, title, copy }, index) => (
                  <RevealCard key={title} index={index} className="rounded-2xl border border-line bg-surface p-5 shadow-sm transition-colors hover:border-civic-300">
                    <Icon size={20} className="text-civic-600 dark:text-civic-300" aria-hidden="true" />
                    <h3 className="mt-4 text-sm font-bold text-fg">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-fg-muted">{copy}</p>
                  </RevealCard>
                ))}
              </div>
            </div>
          </section>

          <section id="community" className="scroll-mt-24 bg-surface">
            <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-7 sm:py-20 lg:grid-cols-[.85fr_1.15fr] lg:px-10">
              <div>
                <SectionHeading
                  eyebrow="CIVICSYNC COMMUNITY"
                  title="Local voices, shared context"
                  copy="A dedicated space for citizens to share local updates and take part in discussions, alongside—but separate from—official civic reports."
                />
                <ul className="mt-6 space-y-3">
                  {[
                    [MessageCircle, 'Browse topics, follow discussions, and save posts for later.'],
                    [Heart, 'React and reply with comments to keep conversations useful.'],
                    [MapPin, 'Add an area when useful; exact coordinates are not published from the feed.']
                  ].map(([Icon, copy]) => (
                    <li key={copy} className="flex items-start gap-3 text-sm leading-6 text-fg-muted">
                      <Icon size={17} className="mt-0.5 shrink-0 text-civic-600 dark:text-civic-300" aria-hidden="true" />
                      <span>{copy}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 max-w-lg border-l-2 border-civic-500 pl-3 text-xs leading-5 text-fg-subtle">Community posts are citizen-generated and do not become official reports unless submitted through the reporting flow.</p>
                <Link to="/dashboard/citizen/community" className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-4 text-sm font-bold text-fg transition hover:bg-surface-2">
                  Explore the community <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.32 }}
              >
                <CommunityPreview />
              </motion.div>
            </div>
          </section>

          <section className="bg-surface">
            <div className="mx-auto max-w-7xl px-5 py-16 sm:px-7 sm:py-20 lg:px-10">
              <SectionHeading eyebrow="ROLE-BASED EXPERIENCE" title="Built for everyone involved" copy="Each role has a defined place in CivicSync’s civic and emergency workflows." center />
              <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {roles.map(({ icon: Icon, title, copy }, index) => (
                  <RevealCard key={title} index={index} className="flex gap-3.5 rounded-2xl border border-line bg-surface p-5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-civic-50 text-civic-700 dark:bg-civic-500/15 dark:text-civic-300"><Icon size={18} aria-hidden="true" /></span>
                    <div><h3 className="text-sm font-bold text-fg">{title}</h3><p className="mt-1.5 text-sm leading-5 text-fg-muted">{copy}</p></div>
                  </RevealCard>
                ))}
              </div>
            </div>
          </section>

          <section id="how-it-works" className="scroll-mt-24 bg-surface-2 py-16 text-fg transition-colors duration-200 sm:py-20">
            <div className="mx-auto max-w-7xl px-5 sm:px-7 lg:px-10">
              <SectionHeading eyebrow="HOW IT WORKS" title="From report to resolution" copy="A structured workflow keeps each step connected, from the first report through field progress." center />
              <ol className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-5">
                {steps.map(([number, title, copy], index) => (
                  <motion.li
                    key={number}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.3, delay: index * 0.06 }}
                    className="relative border-l border-line-strong pl-5 lg:border-l-0 lg:border-t lg:pl-0 lg:pt-5"
                  >
                    <span className="absolute -left-[5px] top-0 h-2.5 w-2.5 rounded-full bg-civic-500 ring-4 ring-surface-2 lg:-top-[5px] lg:left-0" />
                    <span className="text-xs font-bold tracking-widest text-civic-700 dark:text-civic-300">{number} / 05</span>
                    <h3 className="mt-2 text-lg font-bold text-fg">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-fg-muted">{copy}</p>
                  </motion.li>
                ))}
              </ol>
            </div>
          </section>

          <section id="emergency" className="scroll-mt-24 bg-red-50/80 dark:bg-red-950/15">
            <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-7 sm:py-20 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:px-10">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-surface px-3 py-1.5 text-xs font-bold tracking-wide text-red-800 dark:border-red-900 dark:text-red-300"><Siren size={14} /> DEDICATED EMERGENCY WORKFLOW</p>
                <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-fg sm:text-4xl">When every second matters</h2>
                <p className="mt-4 max-w-lg text-base leading-7 text-fg-muted">CivicSync provides a dedicated emergency workflow for routing incidents to the teams responsible for coordinating a response.</p>
                <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-fg-muted">
                  {['SOS request', 'Emergency routing', 'Response tracking'].map((label) => <span key={label} className="rounded-full border border-line bg-surface px-3 py-2">{label}</span>)}
                </div>
                <Link to="/dashboard/citizen/emergency/new" className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-bold text-white transition hover:bg-red-800">
                  Emergency response <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <div className="rounded-2xl border border-red-200 bg-surface p-5 shadow-sm dark:border-red-900/70 sm:p-6">
                <div className="flex items-start gap-3 border-b border-line pb-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"><Siren size={19} /></span>
                  <div><p className="text-sm font-bold text-fg">Emergency response chain</p><p className="mt-1 text-xs leading-5 text-fg-muted">An illustrative view of the dedicated emergency roles.</p></div>
                </div>
                <ol className="mt-5 space-y-3">
                  {['Citizen SOS', 'Emergency Head', 'Emergency Officer', 'Emergency Field Worker'].map((role, index) => (
                    <li key={role} className="flex items-center gap-3">
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${index === 0 ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200' : 'bg-surface-2 text-fg-muted'}`}>{index + 1}</span>
                      <span className="text-sm font-semibold text-fg">{role}</span>
                      {index === 0 && <span className="ml-auto rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-800 dark:bg-red-950/60 dark:text-red-200">SOS</span>}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          <section className="bg-surface">
            <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-7 sm:py-20 lg:grid-cols-[.8fr_1.2fr] lg:px-10">
              <div>
                <SectionHeading eyebrow="PRODUCT PREVIEW" title="A shared view of civic work" copy="Explore how report locations, department assignments, field progress, and emergency status can come together in one workspace." />
                <p className="mt-5 inline-flex items-center gap-2 text-xs text-fg-subtle"><span className="h-2 w-2 rounded-full bg-civic-500" />Illustrative preview — not live service data</p>
              </div>
              <DashboardPreview />
            </div>
          </section>

          <section id="why-civicsync" className="scroll-mt-24 bg-surface-2">
            <div className="mx-auto max-w-7xl px-5 py-16 sm:px-7 sm:py-20 lg:px-10">
              <SectionHeading eyebrow="WHY CIVICSYNC" title="Designed around practical public service" copy="A connected experience can make everyday service workflows easier to follow and coordinate." center />
              <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {benefits.map(({ icon: Icon, title, copy }, index) => (
                  <RevealCard key={title} index={index} className="rounded-2xl border border-line bg-surface p-5">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-civic-50 text-civic-700 dark:bg-civic-500/15 dark:text-civic-300"><Icon size={18} /></span>
                    <h3 className="mt-4 text-sm font-bold text-fg">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-fg-muted">{copy}</p>
                  </RevealCard>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-surface">
            <div className="mx-auto max-w-5xl px-5 py-16 text-center sm:px-7 sm:py-20">
              <p className="text-xs font-bold tracking-[.16em] text-civic-600 dark:text-civic-300">GET CONNECTED</p>
              <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-fg sm:text-4xl">Make civic services more connected.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-fg-muted">Report issues, coordinate response, and stay informed with CivicSync.</p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Link to="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-civic-600 px-5 text-sm font-bold text-white transition hover:bg-civic-700">Get started <ArrowRight size={16} /></Link>
                <Link to="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line-strong bg-surface px-5 text-sm font-bold text-fg transition hover:bg-surface-2">Sign in</Link>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </MotionConfig>
  );
}
