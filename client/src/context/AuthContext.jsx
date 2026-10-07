import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, onIdTokenChanged, reauthenticateWithCredential, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut, updatePassword, updateProfile, EmailAuthProvider } from 'firebase/auth';
import { firebaseAuth, googleProvider } from '../config/firebase.js';
import api, { clearAuthToken, getAuthToken, setAuthToken, setSessionRefresher } from '../services/api.js';
import { disconnectSocket } from '../services/emergencySocket.js';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionGeneration = useRef(0);
  const inFlightSession = useRef(null);
  useEffect(() => {
    const invalidate = async () => {
      ++sessionGeneration.current;
      clearAuthToken();
      disconnectSocket();
      setUser(null);
      setLoading(true);
      try { if (firebaseAuth.currentUser) await establishSession(firebaseAuth.currentUser); }
      catch { /* A disabled or suspended account stays signed out of CivicSync. */ }
      finally { setLoading(false); }
    };
    window.addEventListener('civicsync:session-invalidated', invalidate);
    return () => window.removeEventListener('civicsync:session-invalidated', invalidate);
  }, []);
  useEffect(() => {
    let alive = true;
    setSessionRefresher(() => firebaseAuth.currentUser ? establishSession(firebaseAuth.currentUser) : Promise.reject(new Error('Sign in again.')));
    const unsubscribe = onIdTokenChanged(firebaseAuth, async (currentUser) => {
      if (!alive) return;
      const generation = ++sessionGeneration.current;
      setFirebaseUser(currentUser);
      if (!currentUser) {
        clearAuthToken();
        disconnectSocket();
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        await establishSession(currentUser);
      } catch {
        if (alive && generation === sessionGeneration.current) {
          clearAuthToken();
          disconnectSocket();
          setUser(null);
        }
      } finally {
        if (alive && generation === sessionGeneration.current) setLoading(false);
      }
    });
    return () => { alive = false; ++sessionGeneration.current; unsubscribe(); setSessionRefresher(null); };
  }, []);
  async function establishSession(currentUser) {
    const generation = sessionGeneration.current;
    if (inFlightSession.current?.uid === currentUser.uid && inFlightSession.current.generation === generation) return inFlightSession.current.promise;
    const promise = (async () => {
    const firebaseToken = await currentUser.getIdToken();
    const { data } = await api.post('/auth/firebase', {}, { headers: { Authorization: `Bearer ${firebaseToken}` } });
    if (sessionGeneration.current !== generation || firebaseAuth.currentUser?.uid !== currentUser.uid) return null;
    if (data.token) {
      setAuthToken(data.token);
    }
    setUser(data.user);
    return data.user;
    })();
    inFlightSession.current = { uid: currentUser.uid, generation, promise };
    try { return await promise; }
    finally { if (inFlightSession.current?.promise === promise) inFlightSession.current = null; }
  }
  async function login(email, password) { const credential = await signInWithEmailAndPassword(firebaseAuth, email, password); return establishSession(credential.user); }
  async function register(name, email, password) { const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password); await updateProfile(credential.user, { displayName: name }); return establishSession(credential.user); }
  async function googleLogin() { const credential = await signInWithPopup(firebaseAuth, googleProvider); return establishSession(credential.user); }
  async function logout() {
    const token = getAuthToken();
    ++sessionGeneration.current;
    setUser(null);
    setFirebaseUser(null);
    clearAuthToken();
    disconnectSocket();
    try {
      await signOut(firebaseAuth);
    } finally {
      await api.post('/auth/logout', {}, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
    }
  }
  async function refreshSession() { return firebaseUser ? establishSession(firebaseUser) : null; }
  async function updateUser(nextUser) { setUser(nextUser); return nextUser; }
  async function changePassword(currentPassword, newPassword) {
    if (!firebaseUser?.email) throw new Error('Password changes are available for email-based Firebase accounts only.');
    if (!currentPassword || !newPassword) throw new Error('Current password and new password are required.');
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) throw new Error('Use at least 8 characters with uppercase, lowercase, number, and special character.');
    const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
    await reauthenticateWithCredential(firebaseUser, credential);
    await updatePassword(firebaseUser, newPassword);
  }
  const forgotPassword = (email) => sendPasswordResetEmail(firebaseAuth, email);
  return <AuthContext.Provider value={{ user, currentUser: firebaseUser, firebaseUser, civicSyncUser: user, loading, login, register, googleLogin, logout, forgotPassword, refreshSession, updateUser, changePassword }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
