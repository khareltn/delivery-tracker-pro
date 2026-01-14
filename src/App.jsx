// src/App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { getDoc, doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { toast } from 'react-toastify';

// COMPONENTS
import Login from './components/Login';
import FinancialYearSetup from './components/FinancialYearSetup';
import CompanyRegistration from './components/CompanyRegistration';
import CompanyManagement from './components/CompanyManagement';
import AdminDashboard from './components/AdminDashboard';
import Operator from './components/Operator';
import CustomerDashboard from './components/Customer';
import DriverWithCSS from './components/Driver';
import SupplierDashboard from './components/Supplier';

// Helper: Check if any Financial Year document exists
const checkFinancialYearExists = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'financial_years'));
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking financial years:', error);
    return false;
  }
};

// Helper: Fetch company data for non-admin users
const getCompanyData = async (companyId, fyId) => {
  if (!companyId || !fyId) return null;
  try {
    const companyDoc = await getDoc(doc(db, 'financial_years', fyId, 'companies', companyId));
    if (companyDoc.exists()) {
      return { id: companyId, ...companyDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching company data:', error);
    return null;
  }
};

function App() {
  const [currentFY, setCurrentFY] = useState(''); // e.g. "2026_2026"
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [userCompanyId, setUserCompanyId] = useState('');
  const [userCompany, setUserCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fyExists, setFyExists] = useState(null); // true if any FY exists in DB
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setUserRole('');
        setUserCompanyId('');
        setUserCompany(null);
        setCurrentFY('');
        setFyExists(null);
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userDocRef);

        let role = 'user';
        let companyId = '';
        let fyId = '';

        if (userSnap.exists()) {
          const data = userSnap.data();
          role = data.role || 'user';
          companyId = data.companyId || '';
          fyId = data.current_fy || '';
        } else {
          // Create new user document
          await setDoc(userDocRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            role: 'user',
            companyId: '',
            current_fy: '',
            createdAt: new Date(),
            displayName: currentUser.displayName || currentUser.email,
          });
        }

        // Load company data for non-admin users
        if (companyId && role !== 'admin') {
          const company = await getCompanyData(companyId, fyId);
          setUserCompany(company);
        }

        setUser(currentUser);
        setUserRole(role);
        setUserCompanyId(companyId);
        setCurrentFY(fyId);

        // For admin: determine if any FY exists in the database
        if (role === 'admin') {
          const hasFY = await checkFinancialYearExists();
          setFyExists(hasFY);
        } else {
          setFyExists(true); // non-admin doesn't need this check
        }
      } catch (err) {
        console.error('Auth state error:', err);
        toast.error('Authentication error');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // REDIRECT LOGIC - NO LOOPS GUARANTEED
  const getRedirectPath = () => {
    if (!user) return '/login';

    // Non-admin roles
    if (userRole !== 'admin') {
      switch (userRole) {
        case 'operator':
          return '/operator';
        case 'driver':
          return '/driver';
        case 'customer':
          return '/customer';
        case 'supplier':
          return '/supplier';
        default:
          return '/dashboard';
      }
    }

  // ADMIN ONLY
const currentPath = window.location.pathname;

// Allow these admin pages without redirect
if (
  currentPath === '/fy-setup' ||
  currentPath === '/company-registration' ||
  currentPath.startsWith('/company-registration') ||
  currentPath === '/management' ||
  currentPath === '/dashboard'
) {
  return null;
}

    // No FY configured for this user OR no FY in DB → FY setup
    if (!currentFY || fyExists === false) {
      return '/fy-setup';
    }

    // FY exists → always redirect to company registration
    return '/management';
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '4rem' }}>Loading application...</div>;
  }

  return (
    <div className="App" style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Debug banner (remove in production if desired) */}
      {process.env.NODE_ENV === 'development' && user && (
        <div style={{ background: '#e8f5e8', padding: '8px', textAlign: 'center', fontSize: '12px' }}>
          Role: {userRole} | Current FY: {currentFY || 'None'} | FY Exists in DB: {fyExists?.toString()}
        </div>
      )}

      <Routes>
        {/* Public */}
        <Route path="/login" element={user ? <Navigate to={getRedirectPath()} replace /> : <Login />} />

        {/* FY Setup */}
        <Route
          path="/fy-setup"
          element={
            user && userRole === 'admin' ? (
              <FinancialYearSetup
                onComplete={(newFy) => {
                  setCurrentFY(newFy);
                  setDoc(doc(db, 'users', user.uid), { current_fy: newFy }, { merge: true }).then(() => {
                    setFyExists(true);
                    navigate('/company-registration');
                  });
                }}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Company Registration - ALWAYS available for admin */}
        <Route
          path="/company-registration"
          element={user && userRole === 'admin' ? <CompanyRegistration /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/company-registration/edit/:companyId"
          element={user && userRole === 'admin' ? <CompanyRegistration /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/company-registration/view/:companyId"
          element={user && userRole === 'admin' ? <CompanyRegistration /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/company-reg"
          element={user && userRole === 'admin' ? <CompanyRegistration /> : <Navigate to="/login" replace />}
        />

        {/* Management & Dashboard - require FY */}
        <Route
          path="/management"
          element={
            user && userRole === 'admin' && currentFY ? <CompanyManagement fy={currentFY} /> : <Navigate to={getRedirectPath()} replace />
          }
        />
        <Route
          path="/dashboard"
          element={
            user && userRole === 'admin' && currentFY ? <AdminDashboard fy={currentFY} /> : <Navigate to={getRedirectPath()} replace />
          }
        />

        {/* Role-specific dashboards */}
        <Route
          path="/operator"
          element={
            <ProtectedRoute user={user} userRole={userRole} userCompanyId={userCompanyId} currentFY={currentFY} allowedRoles={['operator']}>
              <Operator selectedCompany={userCompany} currentUser={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer"
          element={
            <ProtectedRoute user={user} userRole={userRole} userCompanyId={userCompanyId} currentFY={currentFY} allowedRoles={['customer']}>
              <CustomerDashboard fy={currentFY} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver"
          element={
            <ProtectedRoute user={user} userRole={userRole} userCompanyId={userCompanyId} currentFY={currentFY} allowedRoles={['driver']}>
              <DriverWithCSS fy={currentFY} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supplier"
          element={
            <ProtectedRoute user={user} userRole={userRole} userCompanyId={userCompanyId} currentFY={currentFY} allowedRoles={['supplier']}>
              <SupplierDashboard fy={currentFY} />
            </ProtectedRoute>
          }
        />

        {/* Default */}
        <Route path="/" element={<Navigate to={getRedirectPath()} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

// Protected route for non-admin roles
const ProtectedRoute = ({ children, user, userRole, userCompanyId, currentFY, allowedRoles = [] }) => {
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) return <div style={{ textAlign: 'center', padding: '4rem' }}>Access Denied</div>;
  if (userRole !== 'admin' && (!userCompanyId || !currentFY)) return <div style={{ textAlign: 'center', padding: '4rem' }}>Account not configured. Contact admin.</div>;
  return children;
};

export default App;