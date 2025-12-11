// src/App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { getDoc, doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { toast } from 'react-toastify';

// COMPONENTS
import Login from './components/Login';
import FinancialYearSetup from './components/FinancialYearSetup';
import CompanyRegistration from './components/CompanyRegistration';
import CompanyManagement from './components/CompanyManagement';
import AdminDashboard from './components/AdminDashboard';
import OperatorDashboard from './components/Operator';
import CustomerDashboard from './components/Customer';
import DriverDashboard from './components/Driver';
import SupplierDashboard from './components/Supplier';

// UPDATED CHECK DATABASE EXISTS FUNCTION
const checkDatabaseExists = async (currentFY = '') => {
  try {
    console.log('Checking database existence for FY:', currentFY);
    
    // Check if any financial years exist
    const fySnapshot = await getDocs(collection(db, 'financial_years'));
    const hasFinancialYear = !fySnapshot.empty;
    
    let hasCompany = false;

    // If we have a specific FY, check for companies in that FY's subcollection
    if (currentFY) {
      try {
        const companiesQuery = query(
          collection(db, 'financial_years', currentFY, 'companies')
        );
        const companiesSnapshot = await getDocs(companiesQuery);
        hasCompany = !companiesSnapshot.empty;
        console.log(`Checked companies in FY ${currentFY}:`, companiesSnapshot.docs.length, 'companies found');
        
        // Log company details for debugging
        companiesSnapshot.forEach(doc => {
          console.log('Company found:', doc.data().name, 'ID:', doc.data().companyId);
        });
      } catch (error) {
        console.log(`No companies subcollection found for FY ${currentFY}, checking main collection...`);
        // Fallback to main companies collection
        const companiesSnapshot = await getDocs(collection(db, 'companies'));
        hasCompany = !companiesSnapshot.empty;
      }
    } 
    // Fallback: check main companies collection
    else {
      const companiesSnapshot = await getDocs(collection(db, 'companies'));
      hasCompany = !companiesSnapshot.empty;
      console.log('Checked main companies collection:', companiesSnapshot.docs.length, 'companies found');
    }

    console.log('Database check result:', { hasFinancialYear, hasCompany, currentFY });
    return { hasFinancialYear, hasCompany };
  } catch (error) {
    console.error('Error checking database:', error);
    return { hasFinancialYear: false, hasCompany: false };
  }
};

// GET COMPANY DATA FUNCTION - IMPROVED
const getCompanyData = async (companyId, financialYear) => {
  try {
    if (!companyId) return null;
    
    console.log('Fetching company data for:', { companyId, financialYear });
    
    // If we have financialYear, try financial_years subcollection first
    if (financialYear) {
      try {
        const companyDocRef = doc(db, 'financial_years', financialYear, 'companies', companyId);
        const companyDoc = await getDoc(companyDocRef);
        
        if (companyDoc.exists()) {
          const companyData = companyDoc.data();
          console.log('Found company in financial_years subcollection:', companyData);
          return { id: companyId, ...companyData };
        }
      } catch (error) {
        console.log('Company not found in financial_years subcollection, trying main collection...');
      }
    }
    
    // Fallback to main companies collection
    const companyQuery = query(
      collection(db, 'companies'),
      where('companyId', '==', companyId)
    );
    const companySnapshot = await getDocs(companyQuery);
    
    if (!companySnapshot.empty) {
      const companyData = companySnapshot.docs[0].data();
      console.log('Found company in main collection:', companyData);
      return { id: companyId, ...companyData };
    }
    
    console.log('Company not found in any collection');
    return null;
  } catch (error) {
    console.error('Error fetching company data:', error);
    return null;
  }
};

// ERROR PAGE COMPONENT
const ErrorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const message = searchParams.get('message') || 'An error occurred';

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Configuration Error</h2>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>{message}</p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button 
          onClick={() => navigate('/')}
          style={{
            padding: '10px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Go Home
        </button>
        <button 
          onClick={() => signOut(auth)}
          style={{
            padding: '10px 20px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

// MAIN APP
function App() {
  const [currentFY, setCurrentFY] = useState('');
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [userCompanyId, setUserCompanyId] = useState('');
  const [userCompany, setUserCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbExists, setDbExists] = useState(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const navigate = useNavigate();

  // Enhanced Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setUserRole('');
        setUserCompanyId('');
        setUserCompany(null);
        setCurrentFY('');
        setLoading(false);
        setDbExists(null);
        setCompanyLoading(false);
        return;
      }

      try {
        if (!db) {
          console.error('Firestore db is not initialized');
          throw new Error('Database not available');
        }

        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        let role = 'user';
        let companyId = '';
        let userFY = '';
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          role = userData.role || 'user';
          companyId = userData.companyId || '';
          userFY = userData.current_fy || '';
          
          console.log('User data loaded:', { 
            uid: currentUser.uid,
            role, 
            companyId, 
            userFY,
            email: currentUser.email 
          });
          
          // For non-admin users, try to infer FY from company if missing
          if (!userFY && companyId && role !== 'admin') {
            console.log('Attempting to infer FY from company data...');
            
            // Try to get FY from main companies collection first
            const companiesQuery = query(
              collection(db, 'companies'),
              where('companyId', '==', companyId)
            );
            const companySnap = await getDocs(companiesQuery);
            
            if (!companySnap.empty) {
              userFY = companySnap.docs[0].data().financialYear;
              console.log('Found FY from companies collection:', userFY);
            } else {
              // Fallback: search in financial_years subcollections
              const financialYearsSnap = await getDocs(collection(db, 'financial_years'));
              for (const fyDoc of financialYearsSnap.docs) {
                const fy = fyDoc.id;
                const companyQuery = query(
                  collection(db, 'financial_years', fy, 'companies'),
                  where('companyId', '==', companyId)
                );
                const companyInFYSnap = await getDocs(companyQuery);
                if (!companyInFYSnap.empty) {
                  userFY = fy;
                  console.log('Found FY from financial_years subcollection:', userFY);
                  break;
                }
              }
            }
            
            // Update user document with the found FY
            if (userFY) {
              await setDoc(userDocRef, { current_fy: userFY }, { merge: true });
              console.log('Updated user FY to:', userFY);
            }
          }

          // FETCH COMPANY DATA FOR NON-ADMIN USERS
          if (companyId && role !== 'admin') {
            console.log('Fetching company data for user...');
            setCompanyLoading(true);
            const companyData = await getCompanyData(companyId, userFY);
            setUserCompany(companyData);
            console.log('Company data set:', companyData);
            setCompanyLoading(false);
          }
        } else {
          // Create new user document with default role
          console.log('Creating new user document for:', currentUser.uid);
          await setDoc(userDocRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            role: 'user',
            companyId: '',
            current_fy: '',
            createdAt: new Date(),
            displayName: currentUser.displayName || currentUser.email
          });
        }
        
        setUser(currentUser);
        setUserRole(role);
        setUserCompanyId(companyId);
        setCurrentFY(userFY);

        // Check database existence based on role
        if (role === 'admin') {
          console.log('Checking database existence for admin...');
          const { hasFinancialYear, hasCompany } = await checkDatabaseExists(userFY);
          setDbExists(hasFinancialYear && hasCompany);
          console.log('Database exists:', hasFinancialYear && hasCompany);
        } else {
          // For non-admin users, check if they have company context
          const hasCompanyContext = !!companyId;
          setDbExists(hasCompanyContext);
          console.log('Non-admin user company context:', hasCompanyContext);
        }
      } catch (err) {
        console.error('Auth error:', err);
        toast.error('Authentication error: ' + err.message);
        setUserRole('user');
        setUserCompanyId('');
        setUserCompany(null);
        setCurrentFY('');
        setDbExists(false);
        setCompanyLoading(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Get redirect path based on user role and state
  const getRedirectPath = () => {
    if (!user) return '/login';
    
    const currentPath = window.location.pathname;
    console.log('Determining redirect path for:', { 
      userRole, 
      dbExists, 
      userCompanyId, 
      currentFY,
      currentPath 
    });
    
    // If already on the correct page, don't redirect
    if (currentPath === '/login') return '/dashboard';
    
    switch (userRole) {
      case 'admin':
        if (currentPath === '/dashboard') return null;
        if (dbExists === false) {
          console.log('Admin redirect: Database setup required -> /fy-setup');
          return '/fy-setup';
        }
        if (dbExists === true && currentPath !== '/management') {
          console.log('Admin redirect: Database exists -> /management');
          return '/management';
        }
        console.log('Admin redirect: Default -> /dashboard');
        return '/dashboard';
        
      case 'operator':
        if (currentPath === '/operator') {
          console.log('Already on operator dashboard, no redirect needed');
          return null;
        }
        console.log('Operator redirect: -> /operator');
        return '/operator';
        
      case 'driver':
        if (currentPath === '/driver') return null;
        console.log('Driver redirect: -> /driver');
        return '/driver';
        
      case 'customer':
        if (currentPath === '/customer') return null;
        console.log('Customer redirect: -> /customer');
        return '/customer';
        
      case 'supplier':
        if (currentPath === '/supplier') return null;
        console.log('Supplier redirect: -> /supplier');
        return '/supplier';
        
      default:
        if (currentPath === '/dashboard') return null;
        console.log('Default redirect: -> /dashboard');
        return '/dashboard';
    }
  };

  if (loading) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '3rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <div>Loading...</div>
        {user && (
          <div style={{ marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
            Setting up your dashboard...
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="App" style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Database Setup Status Banner */}
      {user && userRole === 'admin' && dbExists === false && (
        <div style={{
          background: '#ffeb3b',
          padding: '10px',
          textAlign: 'center',
          borderBottom: '2px solid #ffc107',
          fontSize: '14px'
        }}>
          <strong>Database Setup Required:</strong> Please complete Financial Year and Company setup
        </div>
      )}

      {/* User Context Banner (for debugging) */}
      {user && process.env.NODE_ENV === 'development' && (
        <div style={{
          background: '#e8f5e8',
          padding: '5px',
          textAlign: 'center',
          borderBottom: '1px solid #c8e6c9',
          fontSize: '12px',
          color: '#2e7d32'
        }}>
          Debug: {userRole} | Company: {userCompanyId || 'None'} | FY: {currentFY || 'None'} | DB Exists: {dbExists === null ? 'Checking...' : dbExists ? 'Yes' : 'No'} | Company Data: {userCompany ? 'Loaded' : 'Loading...'}
        </div>
      )}

      <Routes>
        {/* PUBLIC ROUTE */}
        <Route 
          path="/login" 
          element={
            user ? <Navigate to={getRedirectPath()} replace /> : <Login />
          } 
        />

        {/* ERROR PAGE */}
        <Route 
          path="/error" 
          element={<ErrorPage />} 
        />

        {/* ADMIN SETUP FLOW */}
        <Route
          path="/fy-setup"
          element={
            <AdminRoute user={user} userRole={userRole} dbExists={dbExists}>
              <FinancialYearSetup onComplete={(newFy) => {
                setCurrentFY(newFy);
                // Update user's current_fy in Firestore
                if (user) {
                  setDoc(doc(db, 'users', user.uid), { current_fy: newFy }, { merge: true });
                }
                // Refresh database existence check
                if (userRole === 'admin') {
                  checkDatabaseExists(newFy).then(({ hasFinancialYear, hasCompany }) => {
                    setDbExists(hasFinancialYear && hasCompany);
                  });
                }
              }} />
            </AdminRoute>
          }
        />

        {/* COMPANY REGISTRATION ROUTES */}
        <Route
          path="/company-registration"
          element={
            <AdminRoute user={user} userRole={userRole} dbExists={dbExists}>
              <CompanyRegistration />
            </AdminRoute>
          }
        />

        <Route
          path="/company-registration/edit/:companyId"
          element={
            <AdminRoute user={user} userRole={userRole} dbExists={dbExists}>
              <CompanyRegistration />
            </AdminRoute>
          }
        />

        <Route
          path="/company-registration/view/:companyId"
          element={
            <AdminRoute user={user} userRole={userRole} dbExists={dbExists}>
              <CompanyRegistration />
            </AdminRoute>
          }
        />

        {/* Keep for backward compatibility */}
        <Route
          path="/company-reg"
          element={
            <AdminRoute user={user} userRole={userRole} dbExists={dbExists}>
              <CompanyRegistration />
            </AdminRoute>
          }
        />

        {/* COMPANY MANAGEMENT */}
        <Route
          path="/management"
          element={
            <AdminRoute user={user} userRole={userRole} dbExists={dbExists}>
              <CompanyManagement fy={currentFY} />
            </AdminRoute>
          }
        />

        {/* ADMIN DASHBOARD */}
        <Route
          path="/dashboard"
          element={
            <AdminRoute user={user} userRole={userRole} dbExists={dbExists}>
              <AdminDashboard fy={currentFY} />
            </AdminRoute>
          }
        />

        {/* OPERATOR DASHBOARD */}
        <Route
          path="/operator"
          element={
            <ProtectedRoute 
              user={user} 
              userRole={userRole} 
              userCompanyId={userCompanyId}
              currentFY={currentFY}
              allowedRoles={['operator']}
            >
              <OperatorDashboard 
                selectedCompany={userCompany}
                currentUser={user}
                companyLoading={companyLoading}
              />
            </ProtectedRoute>
          }
        />

        {/* CUSTOMER DASHBOARD */}
        <Route
          path="/customer"
          element={
            <ProtectedRoute 
              user={user} 
              userRole={userRole} 
              userCompanyId={userCompanyId}
              currentFY={currentFY}
              allowedRoles={['customer']}
            >
              <CustomerDashboard fy={currentFY} />
            </ProtectedRoute>
          }
        />

        {/* DRIVER DASHBOARD */}
        <Route
          path="/driver"
          element={
            <ProtectedRoute 
              user={user} 
              userRole={userRole} 
              userCompanyId={userCompanyId}
              currentFY={currentFY}
              allowedRoles={['driver']}
            >
              <DriverDashboard fy={currentFY} />
            </ProtectedRoute>
          }
        />

        {/* SUPPLIER DASHBOARD */}
        <Route
          path="/supplier"
          element={
            <ProtectedRoute 
              user={user} 
              userRole={userRole} 
              userCompanyId={userCompanyId}
              currentFY={currentFY}
              allowedRoles={['supplier']}
            >
              <SupplierDashboard fy={currentFY} />
            </ProtectedRoute>
          }
        />

        {/* DEFAULT ROUTE */}
        <Route 
          path="/" 
          element={
            <Navigate to={user ? getRedirectPath() : '/login'} replace />
          } 
        />
        
        {/* CATCH ALL ROUTE */}
        <Route 
          path="*" 
          element={<Navigate to="/" replace />} 
        />
      </Routes>
    </div>
  );
}

// PROTECTED ROUTE COMPONENT
const ProtectedRoute = ({ 
  children, 
  user, 
  userRole, 
  userCompanyId, 
  currentFY, 
  allowedRoles = [] 
}) => {
  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>Authentication Required</h2>
        <p>Please log in to access this page.</p>
      </div>
    );
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>Access Denied</h2>
        <p>You don't have permission to access this page.</p>
        <p>Your role: <strong>{userRole}</strong> | Required: {allowedRoles.join(', ')}</p>
        <button 
          onClick={() => signOut(auth)}
          style={{
            padding: '10px 20px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  // Check if non-admin users have required company context
  if (userRole !== 'admin' && (!userCompanyId || !currentFY)) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>Account Configuration Required</h2>
        <p>Your account is missing company assignment or financial year context.</p>
        <p>Please contact your administrator to complete the setup.</p>
        <div style={{ marginTop: '2rem' }}>
          <button 
            onClick={() => signOut(auth)}
            style={{
              padding: '10px 20px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return children;
};

// ADMIN ROUTE COMPONENT
const AdminRoute = ({ children, user, userRole, dbExists }) => {
  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>Authentication Required</h2>
        <p>Please log in to access this page.</p>
      </div>
    );
  }

  if (userRole !== 'admin') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>Access Denied</h2>
        <p>Admin access required.</p>
        <p>Your role: <strong>{userRole}</strong></p>
        <button 
          onClick={() => signOut(auth)}
          style={{
            padding: '10px 20px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  // Show loading while checking database
  if (dbExists === null) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Checking database setup...</div>;
  }

  return children;
};

export default App;