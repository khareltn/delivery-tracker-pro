//src\context\AuthContext.jsx//
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState();
  const [loading, setLoading] = useState(true);

  // CORE AUTH HELPERS
  const login    = (email, pwd) => signInWithEmailAndPassword(auth, email, pwd);
  const signup   = (email, pwd) => createUserWithEmailAndPassword(auth, email, pwd);
  const logout   = () => signOut(auth);                // ←  THIS WAS MISSING
  const resetPwd = email  => auth.sendPasswordResetEmail(email);

  // ON-MOUNT LISTENER
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (user) {
        // merge basic firestore profile if you want
        const userRef = doc(db, 'users', user.uid);
        const snap    = await getDoc(userRef);
        if (!snap.exists())
          await setDoc(userRef, { email: user.email, createdAt: serverTimestamp() }, { merge: true });
      }
      setCurrentUser(user);
      setLoading(false);
    });
    return unsub;
  }, []);

  const value = { currentUser, login, signup, logout, resetPwd, loading };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};