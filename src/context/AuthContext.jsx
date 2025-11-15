// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { getDoc, doc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [hasFY, setHasFY] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setUserRole('');
        setHasFY(false);
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        const role = userDoc.exists() ? userDoc.data().role || 'user' : 'user';

        // FY check: users/{uid}.current_fy → financial_years/{fy_id}
        const currentFY = userDoc.data()?.current_fy;
        let fyExists = false;
        if (currentFY) {
          const fyDoc = await getDoc(doc(db, 'financial_years', currentFY));
          fyExists = fyDoc.exists();
        }

        setUser(u);
        setUserRole(role);
        setHasFY(fyExists);
      } catch (err) {
        console.error('Auth error:', err);
        setUserRole('user');
        setHasFY(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []); // Sirf ek baar!

  // YE HAI — STABLE VALUE
  const value = useMemo(
    () => ({
      user,
      userRole,
      hasFY,
      loading,
    }),
    [user, userRole, hasFY, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};