import { Link } from 'react-router-dom';

export default function AuthForm({ mode, values, onChange, onSubmit, onGoogle, onForgotPassword, busy, error, notice }) {
  const register = mode === 'register';
  return <main className="grid min-h-screen place-items-center bg-linear-to-br from-civic-50 via-white to-slate-100 p-5">
    <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
      <div className="mb-7"><p className="text-sm font-bold tracking-[0.2em] text-civic-600">CIVICSYNC</p><h1 className="mt-2 text-3xl font-bold text-ink">{register ? 'Create your account' : 'Welcome back'}</h1><p className="mt-2 text-sm text-slate-500">{register ? 'Join your community service hub.' : 'Sign in to manage your civic issues.'}</p></div>
      <form className="space-y-4" onSubmit={onSubmit}>
        {register && <label className="block text-sm font-medium">Full name<input name="name" value={values.name} onChange={onChange} placeholder="Test Citizen" required /></label>}
        <label className="block text-sm font-medium">Email address<input type="email" name="email" value={values.email} onChange={onChange} placeholder="citizen@example.com" required /></label>
        <label className="block text-sm font-medium">Password<input type="password" name="password" value={values.password} onChange={onChange} placeholder="At least 6 characters" minLength="6" required /></label>
        {register && <label className="block text-sm font-medium">Confirm password<input type="password" name="confirmPassword" value={values.confirmPassword} onChange={onChange} placeholder="Repeat your password" minLength="6" required /></label>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
        {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{notice}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-civic-600 py-2.5 font-semibold text-white transition hover:bg-civic-500 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Please wait…' : register ? 'Create account' : 'Log in'}</button>
        <div className="flex items-center gap-3 py-1 text-xs text-slate-400 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">OR</div>
        <button type="button" onClick={onGoogle} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"><span className="font-bold text-[#4285f4]">G</span>Continue with Google</button>
      </form>
      {!register && <button type="button" onClick={onForgotPassword} className="mt-4 w-full text-center text-sm font-semibold text-civic-600 hover:underline">Forgot password?</button>}
      <p className="mt-6 text-center text-sm text-slate-600">{register ? 'Already have an account?' : 'Need an account?'} <Link className="font-semibold text-civic-600 hover:underline" to={register ? '/login' : '/register'}>{register ? 'Log in' : 'Register'}</Link></p>
    </section>
  </main>;
}
