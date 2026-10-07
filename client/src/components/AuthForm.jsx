import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Moon, Sun } from 'lucide-react';
import Icon from './ui/Icon.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const services = [
  { icon: 'mapPin', label: 'Civic issue reporting' },
  { icon: 'building', label: 'Department coordination' },
  { icon: 'siren', label: 'Emergency response' }
];

const formStagger = {
  hidden: {},
  visible: { transition: { delayChildren: 0.08, staggerChildren: 0.055 } }
};

const formItem = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } }
};

function BrandMark({ compact = false }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 rounded-lg ${compact ? 'text-fg' : 'text-white'}`} aria-label="CivicSync home">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-civic-600 text-white shadow-lg shadow-civic-950/15">
        <Icon name="building" size={21} />
      </span>
      <span className="text-xl font-extrabold tracking-tight">
        Civic<span className={compact ? 'text-civic-600' : 'text-civic-300'}>Sync</span>
      </span>
    </Link>
  );
}

function CivicIllustration() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="relative mx-auto w-full max-w-[560px]" aria-hidden="true">
      <div className="absolute -inset-x-10 -inset-y-8 rounded-[2.5rem] bg-civic-400/10 blur-3xl" />
      <svg viewBox="0 0 620 380" fill="none" className="relative w-full drop-shadow-2xl">
        <defs>
          <pattern id="auth-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0V28" stroke="white" strokeOpacity=".07" />
          </pattern>
          <linearGradient id="auth-ground" x1="84" y1="290" x2="529" y2="120" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1D4ED8" stopOpacity=".34" />
            <stop offset="1" stopColor="#38BDF8" stopOpacity=".12" />
          </linearGradient>
        </defs>
        <rect x="24" y="14" width="572" height="352" rx="26" fill="url(#auth-grid)" />
        <path d="M61 274.5 188 222l112 31.5 124-95 133 36v105l-127 39-131-28-114 41-124-31v-46Z" fill="url(#auth-ground)" stroke="white" strokeOpacity=".2" />
        <path d="m92 289 98-40 110 31 125-91 111 29M119 329l105-41 77 22 120-88 100 26M161 203l35 9m81 25 23 7m122-94 18 6" stroke="#93C5FD" strokeOpacity=".54" strokeWidth="2" strokeDasharray="5 7" />
        <path d="M232 250v-56l49-29 49 29v56m-88-56h78m-67 56v-32h18v32m17 0v-32h18v32m-94 0h96" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M247 194v-16l34-20 34 20v16" stroke="#93C5FD" strokeWidth="3" strokeLinejoin="round" />
        <path d="M260 179h42m-21-21v-17" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <circle cx="281" cy="136" r="9" fill="#38BDF8" />
        <circle cx="435" cy="158" r="20" fill="#2563EB" fillOpacity=".32" stroke="#BFDBFE" strokeOpacity=".8" />
        <path d="M435 149v10m0 6h.01" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <motion.circle
          cx="190"
          cy="223"
          r="6"
          fill="#38BDF8"
          stroke="white"
          strokeWidth="3"
          animate={reduceMotion ? undefined : { opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <circle cx="525" cy="195" r="6" fill="#38BDF8" stroke="white" strokeWidth="3" />
        <rect x="72" y="83" width="117" height="53" rx="12" fill="#152B48" stroke="white" strokeOpacity=".16" />
        <circle cx="91" cy="101" r="5" fill="#34D399" />
        <path d="M104 100h62M88 116h68" stroke="white" strokeOpacity=".68" strokeWidth="3" strokeLinecap="round" />
        <rect x="421" y="265" width="128" height="54" rx="12" fill="#152B48" stroke="white" strokeOpacity=".16" />
        <path d="m441 289 7 7 13-15m11 2h56m-67 15h67" stroke="#93C5FD" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const dark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      aria-pressed={dark}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-fg-muted transition hover:border-line-strong hover:bg-surface-2"
    >
      {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span>{dark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}

function PasswordField({ id, label, value, onChange, placeholder, autoComplete, error, onBlur }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-fg">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-fg-subtle" aria-hidden="true">
          <Icon name="lock" size={17} />
        </span>
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-12 rounded-xl pl-11 pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-1.5 my-auto grid h-10 w-10 place-items-center rounded-lg text-fg-subtle transition hover:bg-surface-2 hover:text-fg"
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

function PasswordStrength({ password }) {
  if (!password) return null;
  const variety = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  const score = password.length < 6 ? 1 : password.length < 10 ? Math.min(3, Math.max(2, variety)) : Math.min(4, 2 + variety);
  const label = score === 1 ? 'Too short' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
  const color = score === 1 ? 'bg-red-500' : score === 2 ? 'bg-amber-500' : score === 3 ? 'bg-civic-500' : 'bg-emerald-500';
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => <span key={segment} className={`h-1 flex-1 rounded-full ${segment <= score ? color : 'bg-line'}`} />)}
      </div>
      <p className="mt-1 text-xs text-fg-muted">Password strength: <span className="font-semibold text-fg">{label}</span><span className="sr-only">. Use at least 6 characters to create an account.</span></p>
    </div>
  );
}

function GoogleMark() {
  return <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" /><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3C9.2 39.5 16 44 24 44Z" /><path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20.1 20.1 0 0 0 0 17.8l6.8-5.3Z" /><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4 16 4 9.2 8.5 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z" /></svg>;
}

export default function AuthForm({ mode, values, onChange, onSubmit, onGoogle, onForgotPassword, busy, resetBusy, error, notice }) {
  const register = mode === 'register';
  const reduceMotion = useReducedMotion();
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const emailInvalid = values.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email);
  const confirmInvalid = register && values.confirmPassword.length > 0 && values.password !== values.confirmPassword;

  function updateField(event) {
    const { name } = event.target;
    setFieldErrors((current) => ({ ...current, [name]: '' }));
    setFormError('');
    onChange(event);
  }

  function submit(event) {
    event.preventDefault();
    setFormError('');
    const nextErrors = {};
    if (register && !values.name.trim()) nextErrors.name = 'Enter your full name.';
    if (!values.email.trim()) nextErrors.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) nextErrors.email = 'Please enter a valid email address.';
    if (!values.password) nextErrors.password = 'Enter your password.';
    else if (register && values.password.length < 6) nextErrors.password = 'Password must be at least 6 characters.';
    if (register && !values.confirmPassword) nextErrors.confirmPassword = 'Confirm your password.';
    else if (register && values.password !== values.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setFormError('Please review the highlighted fields.');
      return;
    }
    onSubmit(event);
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="grid min-h-screen overflow-x-hidden bg-app lg:grid-cols-[minmax(0,1fr)_minmax(480px,0.94fr)]">
        <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-[#0c1b30] px-10 py-9 text-white lg:flex xl:px-16 xl:py-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_8%,rgba(37,99,235,0.24),transparent_42%),radial-gradient(ellipse_at_90%_92%,rgba(14,116,144,0.18),transparent_38%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:40px_40px]" />
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="relative z-10">
            <BrandMark />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }} className="relative z-10 mx-auto w-full max-w-[650px] py-10">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-3 py-1.5 text-xs font-semibold tracking-wide text-blue-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              A more connected community
            </p>
            <h1 className="max-w-xl text-4xl font-bold leading-[1.12] tracking-tight xl:text-5xl">
              {register ? 'Make your community better.' : 'Connect. Report. Improve.'}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300 xl:text-lg xl:leading-8">
              {register
                ? 'Report issues, stay informed, and help your community respond faster.'
                : 'CivicSync connects citizens with local departments and emergency services to help communities respond and improve together.'}
            </p>
            <div className="mt-8">
              <CivicIllustration />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {services.map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[.045] px-3 py-3 text-xs font-semibold leading-5 text-slate-200">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-civic-500/20 text-blue-200"><Icon name={icon} size={16} /></span>
                  {label}
                </div>
              ))}
            </div>
          </motion.div>

          <div className="relative z-10 flex items-center gap-2 text-xs text-slate-400">
            <LockKeyhole size={14} aria-hidden="true" />
            A secure space for better public services
          </div>
        </section>

        <section className="flex min-h-screen flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-10 xl:px-16">
          <header className="flex items-center justify-between gap-3">
            <div className="lg:hidden"><BrandMark compact /></div>
            <div className="hidden lg:block" />
            <ThemeToggle />
          </header>

          <div className="flex flex-1 items-center justify-center py-8 sm:py-10">
            <motion.section
              key={mode}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.32, delay: 0.04, ease: 'easeOut' }}
              className="w-full max-w-[440px]"
              aria-labelledby="auth-heading"
            >
              <div className="mb-7">
                <p className="text-sm font-semibold text-civic-600">{register ? 'GET STARTED' : 'CIVICSYNC ACCOUNT'}</p>
                <h2 id="auth-heading" className="mt-2 text-3xl font-bold tracking-tight text-fg sm:text-[2rem]">
                  {register ? 'Create your CivicSync account' : 'Welcome back'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-fg-muted">
                  {register ? 'Join CivicSync and make your voice count.' : 'Sign in to continue to CivicSync.'}
                </p>
              </div>

              <motion.form
                noValidate
                onSubmit={submit}
                className="space-y-4.5"
                variants={formStagger}
                initial="hidden"
                animate="visible"
              >
                {register && (
                  <motion.div variants={formItem}>
                    <label htmlFor="name" className="mb-2 block text-sm font-semibold text-fg">Full name</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-fg-subtle" aria-hidden="true"><Icon name="user" size={17} /></span>
                      <input id="name" name="name" type="text" value={values.name} onChange={updateField} placeholder="Your full name" autoComplete="name" aria-invalid={fieldErrors.name ? 'true' : undefined} aria-describedby={fieldErrors.name ? 'name-error' : undefined} className="h-12 rounded-xl pl-11" />
                    </div>
                    {fieldErrors.name && <p id="name-error" className="mt-1.5 text-xs font-medium text-red-700 dark:text-red-300">{fieldErrors.name}</p>}
                  </motion.div>
                )}

                <motion.div variants={formItem}>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-fg">Email address</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-fg-subtle" aria-hidden="true"><Icon name="mail" size={17} /></span>
                    <input id="email" name="email" type="email" value={values.email} onChange={updateField} placeholder="you@example.com" autoComplete="email" aria-invalid={fieldErrors.email || emailInvalid ? 'true' : undefined} aria-describedby={fieldErrors.email || emailInvalid ? 'email-error' : undefined} className="h-12 rounded-xl pl-11" />
                  </div>
                  {(fieldErrors.email || emailInvalid) && <p id="email-error" className="mt-1.5 text-xs font-medium text-red-700 dark:text-red-300">{fieldErrors.email || 'Please enter a valid email address.'}</p>}
                </motion.div>

                <motion.div variants={formItem}>
                  <PasswordField id="password" label="Password" value={values.password} onChange={updateField} placeholder={register ? 'At least 6 characters' : 'Enter your password'} autoComplete={register ? 'new-password' : 'current-password'} error={fieldErrors.password} />
                  {register && <PasswordStrength password={values.password} />}
                </motion.div>

                {register && (
                  <motion.div variants={formItem}>
                    <PasswordField id="confirmPassword" label="Confirm password" value={values.confirmPassword} onChange={updateField} placeholder="Enter your password again" autoComplete="new-password" error={fieldErrors.confirmPassword || (confirmInvalid ? 'Passwords do not match.' : '')} />
                  </motion.div>
                )}

                {!register && onForgotPassword && (
                  <motion.div variants={formItem} className="flex justify-end">
                    <button type="button" onClick={onForgotPassword} disabled={busy || resetBusy} className="rounded-md text-sm font-semibold text-civic-600 transition hover:text-civic-700 hover:underline dark:text-civic-300">
                      {resetBusy ? 'Sending reset link…' : 'Forgot password?'}
                    </button>
                  </motion.div>
                )}

                <AnimatePresence initial={false} mode="wait">
                  {(formError || error) && (
                    <motion.div
                      key={formError || error}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -3 }}
                      transition={{ duration: 0.16 }}
                      className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-200"
                      role="alert"
                    >
                      <Icon name="alertCircle" size={18} className="mt-0.5" />
                      <span>{formError || error}</span>
                    </motion.div>
                  )}
                  {notice && (
                    <motion.p
                      key={notice}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.16 }}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200"
                      role="status"
                    >
                      {notice}
                    </motion.p>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={busy}
                  whileHover={busy || reduceMotion ? undefined : { y: -1 }}
                  whileTap={busy || reduceMotion ? undefined : { scale: 0.99 }}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-civic-600 px-4 text-sm font-bold text-white shadow-sm shadow-civic-600/20 transition-colors hover:bg-civic-700 focus-visible:ring-offset-2 disabled:cursor-wait"
                >
                  {busy ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" aria-hidden="true" />
                      {register ? 'Creating your account…' : 'Signing you in…'}
                    </>
                  ) : (
                    <>{register ? 'Create Account' : 'Sign In'} <ArrowRight size={17} aria-hidden="true" /></>
                  )}
                </motion.button>

                {onGoogle && (
                  <>
                    <motion.div variants={formItem} className="flex items-center gap-3 py-1 text-xs font-semibold tracking-[.12em] text-fg-subtle" aria-hidden="true">
                      <span className="h-px flex-1 bg-line" />OR<span className="h-px flex-1 bg-line" />
                    </motion.div>
                    <motion.button type="button" onClick={onGoogle} disabled={busy} whileHover={busy || reduceMotion ? undefined : { y: -1 }} whileTap={busy || reduceMotion ? undefined : { scale: 0.99 }} className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-fg transition-colors hover:bg-surface-2 disabled:cursor-wait">
                      <GoogleMark />Continue with Google
                    </motion.button>
                  </>
                )}
              </motion.form>

              <p className="mt-6 text-center text-sm text-fg-muted">
                {register ? 'Already have an account?' : "Don't have an account?"}{' '}
                <Link className="inline-flex items-center gap-1 rounded-sm font-bold text-civic-600 hover:underline dark:text-civic-300" to={register ? '/login' : '/register'}>
                  {register ? 'Sign in' : 'Create an account'}
                </Link>
              </p>
              <p className="mt-8 flex items-center justify-center gap-2 text-xs text-fg-subtle">
                <Check size={14} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                Secure access to your community services
              </p>
            </motion.section>
          </div>

          <footer className="text-center text-xs text-fg-subtle">© {new Date().getFullYear()} CivicSync</footer>
        </section>
      </main>
    </MotionConfig>
  );
}
