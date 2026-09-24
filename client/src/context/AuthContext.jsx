import { createContext, useContext, useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, reauthenticateWithCredential, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut, updatePassword, updateProfile, EmailAuthProvider } from 'firebase/auth';
import { firebaseAuth, googleProvider } from '../config/firebase.js';
import api from '../services/api.js';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      if (!alive) return;
      setFirebaseUser(currentUser);
      if (!currentUser) { setUser(null); setLoading(false); return; }
      try { await establishSession(currentUser); } catch { if (alive) setUser(null); } finally { if (alive) setLoading(false); }
    });
    return () => { alive = false; unsubscribe(); };
  }, []);
  async function establishSession(currentUser) {
    const firebaseToken = await currentUser.getIdToken();
    const { data } = await api.post('/auth/firebase', {}, { headers: { Authorization: `Bearer ${firebaseToken}` } });
    setUser(data.user);
    return data.user;
  }
  async function login(email, password) { const credential = await signInWithEmailAndPassword(firebaseAuth, email, password); return establishSession(credential.user); }
  async function register(name, email, password) { const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password); await updateProfile(credential.user, { displayName: name }); return establishSession(credential.user); }
  async function googleLogin() { const credential = await signInWithPopup(firebaseAuth, googleProvider); return establishSession(credential.user); }
  async function logout() { try { await api.post('/auth/logout'); } finally { await signOut(firebaseAuth); setUser(null); setFirebaseUser(null); } }
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
