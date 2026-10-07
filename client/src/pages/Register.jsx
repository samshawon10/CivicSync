import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthForm from '../components/AuthForm.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authErrorMessage } from '../utils/authErrorMessage.js';

export default function Register() {
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const actionInProgress = useRef(false);
  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();

  async function run(action) {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setError('');
    setBusy(true);
    try {
      await action();
      navigate('/dashboard');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      actionInProgress.current = false;
      setBusy(false);
    }
  }

  function updateValues(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  }

  function submit(event) {
    event.preventDefault();
    run(() => register(values.name.trim(), values.email.trim(), values.password));
  }

  return (
    <AuthForm
      mode="register"
      values={values}
      onChange={updateValues}
      onSubmit={submit}
      onGoogle={() => run(googleLogin)}
      busy={busy}
      error={error}
    />
  );
}
