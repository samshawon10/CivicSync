import { createContext, useContext, useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile } from 'firebase/auth';
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
  const forgotPassword = (email) => sendPasswordResetEmail(firebaseAuth, email);
  return <AuthContext.Provider value={{ user, currentUser: firebaseUser, firebaseUser, civicSyncUser: user, loading, login, register, googleLogin, logout, forgotPassword }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
