import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthForm from '../components/AuthForm.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiMessage } from '../services/api.js';

export default function Login() {
  const [values, setValues] = useState({ email: '', password: '' }); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const { login, googleLogin, forgotPassword } = useAuth(); const navigate = useNavigate();
  async function run(action) { setError(''); setNotice(''); setBusy(true); try { await action(); navigate('/dashboard'); } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); } }
  async function resetPassword() { if (!values.email) return setError('Enter your email address first.'); setError(''); setNotice(''); try { await forgotPassword(values.email); setNotice('Password-reset email sent. Check your inbox.'); } catch (err) { setError(apiMessage(err)); } }
  return <AuthForm mode="login" values={values} onChange={(e) => setValues({ ...values, [e.target.name]: e.target.value })} onSubmit={(e) => { e.preventDefault(); run(() => login(values.email, values.password)); }} onGoogle={() => run(googleLogin)} onForgotPassword={resetPassword} busy={busy} error={error} notice={notice} />;
}
