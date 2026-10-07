import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthForm from '../components/AuthForm.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authErrorMessage } from '../utils/authErrorMessage.js';

export default function Login() {
  const [values, setValues] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const actionInProgress = useRef(false);
  const resetInProgress = useRef(false);
  const { login, googleLogin, forgotPassword } = useAuth();
  const navigate = useNavigate();

  async function run(action) {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setError('');
    setNotice('');
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

  async function resetPassword() {
    if (resetInProgress.current || busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      setError(values.email ? 'Please enter a valid email address first.' : 'Enter your email address first.');
      return;
    }
    resetInProgress.current = true;
    setError('');
    setNotice('');
    setResetBusy(true);
    try {
      await forgotPassword(values.email.trim());
      setNotice('Password-reset email sent. Check your inbox.');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      resetInProgress.current = false;
      setResetBusy(false);
    }
  }

  function updateValues(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
    setNotice('');
  }

  return (
    <AuthForm
      mode="login"
      values={values}
      onChange={updateValues}
      onSubmit={(event) => {
        event.preventDefault();
        run(() => login(values.email.trim(), values.password));
      }}
      onGoogle={() => run(googleLogin)}
      onForgotPassword={resetPassword}
      busy={busy}
      resetBusy={resetBusy}
      error={error}
      notice={notice}
    />
  );
}
