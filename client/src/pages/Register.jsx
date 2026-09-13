import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthForm from '../components/AuthForm.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiMessage } from '../services/api.js';

export default function Register() {
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const { register, googleLogin } = useAuth(); const navigate = useNavigate();
  async function run(action) { setError(''); setBusy(true); try { await action(); navigate('/dashboard'); } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); } }
  function submit(e) { e.preventDefault(); if (values.password !== values.confirmPassword) return setError('Passwords do not match.'); run(() => register(values.name, values.email, values.password)); }
  return <AuthForm mode="register" values={values} onChange={(e) => setValues({ ...values, [e.target.name]: e.target.value })} onSubmit={submit} onGoogle={() => run(googleLogin)} busy={busy} error={error} />;
}
