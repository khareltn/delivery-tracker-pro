// src/components/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getDoc, doc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { toast } from 'react-toastify';

const Login = () => {
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState('email');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Helper function to find user by mobile number (kept for debugging)
  const findUserByMobileNumber = async (mobile) => {
    try {
      console.log('🔍 [MOBILE] Searching for user by mobile:', mobile);
      
      const cleanMobile = mobile.replace(/\D/g, '');
      console.log('🔍 [MOBILE] Cleaned mobile:', cleanMobile);
      
      const mobileVariations = [
        cleanMobile,                          // 09012345678
        `+81${cleanMobile.substring(1)}`,    // +819012345678
        `81${cleanMobile.substring(1)}`,     // 819012345678
        `0${cleanMobile}`,                   // 009012345678
        cleanMobile.substring(1),            // 9012345678
      ];
      
      console.log('📱 [MOBILE] Trying variations:', mobileVariations);
      
      for (const mobileVar of mobileVariations) {
        console.log(`🔍 [MOBILE] Trying variation: "${mobileVar}"`);
        
        const queries = [
          query(collection(db, 'users'), where('mobileNumber', '==', mobileVar)),
          query(collection(db, 'users'), where('phone', '==', mobileVar)),
          query(collection(db, 'users'), where('contactNumber', '==', mobileVar)),
        ];
        
        for (let i = 0; i < queries.length; i++) {
          try {
            const querySnapshot = await getDocs(queries[i]);
            console.log(`📊 [MOBILE] Query ${i + 1} found ${querySnapshot.size} users`);
            
            if (!querySnapshot.empty) {
              const userDoc = querySnapshot.docs[0];
              const userData = userDoc.data();
              console.log(`✅ [MOBILE] USER FOUND!`, userData);
              return {
                email: userData.email,
                userData: { ...userData, id: userDoc.id }
              };
            }
          } catch (queryError) {
            console.log(`❌ [MOBILE] Query ${i + 1} error:`, queryError.message);
          }
        }
      }
      
      console.log('❌ [MOBILE] No user found with any mobile variation');
      return null;
    } catch (error) {
      console.error('💥 [MOBILE] Error finding user:', error);
      return null;
    }
  };

  // Helper function to find user by email
  const findUserByEmail = async (email) => {
    try {
      console.log('🔍 [EMAIL] Searching for user by email:', email);
      
      const usersQuery = query(collection(db, 'users'), where('email', '==', email));
      const querySnapshot = await getDocs(usersQuery);
      
      console.log(`📊 [EMAIL] Found ${querySnapshot.size} users`);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        console.log('✅ [EMAIL] User found:', userData);
        return {
          email: userData.email,
          userData: { ...userData, id: userDoc.id }
        };
      }
      
      console.log('❌ [EMAIL] No user found with email:', email);
      return null;
    } catch (error) {
      console.error('💥 [EMAIL] Error:', error);
      return null;
    }
  };

  // Main login handler - FIXED VERSION
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🚀 Login attempt. Type:', loginType);
    
    if (loading) return;
    
    setLoading(true);
    setError('');

    try {
      let userEmail = '';
      let userData = null;

      // Step 1: Find user details
      if (loginType === 'mobile') {
        if (!mobileNumber || !password) {
          toast.error('Mobile number and password required');
          setLoading(false);
          return;
        }
        
        const foundUser = await findUserByMobileNumber(mobileNumber);
        
        if (!foundUser) {
          toast.error('No user found with this mobile number');
          setLoading(false);
          return;
        }
        
        userEmail = foundUser.email;
        userData = foundUser.userData;
        console.log('✅ Mobile login - Found user email:', userEmail);
      } else {
        if (!email || !password) {
          toast.error('Email and password required');
          setLoading(false);
          return;
        }
        
        const foundUser = await findUserByEmail(email);
        
        if (!foundUser) {
          toast.error('No user found with this email');
          setLoading(false);
          return;
        }
        
        userData = foundUser.userData;
        userEmail = userData.email;
        console.log('✅ Email login - Found user email:', userEmail);
      }

      // Step 2: Firebase Auth with email/password
      console.log('🔑 Attempting Firebase auth with:', userEmail);
      
      const userCredential = await signInWithEmailAndPassword(auth, userEmail, password);
      const user = userCredential.user;
      console.log('✅ Firebase auth successful! UID:', user.uid);

      // Step 3: Store user data in localStorage
      const userInfo = {
        id: userData.id,
        uid: user.uid,
        name: userData.name || userData.fullName || userEmail,
        email: userData.email,
        mobileNumber: userData.mobileNumber,
        role: userData.role || 'driver',
        companyId: userData.companyId,
        companyName: userData.companyName,
        status: userData.status || 'active'
      };

      localStorage.setItem('userData', JSON.stringify(userInfo));
      console.log('💾 User data saved to localStorage:', userInfo);

      // Step 4: Success toast
      toast.success(`Welcome back, ${userInfo.name}!`);
      
      // Step 5: Role-based redirect
      const userRole = userInfo.role;
      console.log('🎯 Redirecting based on role:', userRole);
      
      switch (userRole) {
        case 'admin':
          navigate('/management', { replace: true });
          break;
        case 'operator':
          navigate('/operator', { replace: true });
          break;
        case 'driver':
          navigate('/driver-dashboard', { replace: true });
          break;
        default:
          // Fallback for unknown roles
          toast.warning('Unknown role, redirecting to dashboard');
          navigate('/dashboard', { replace: true });
      }

    } catch (err) {
      console.error('❌ Login error:', err.code, err.message);
      
      let errorMessage = 'Login failed. Please try again.';
      
      switch (err.code) {
        case 'auth/invalid-credential':
          errorMessage = 'Invalid email or password';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No user found with this email';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Wrong password';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Email/password authentication is disabled.';
          break;
        default:
          errorMessage = err.message || 'Unknown error occurred';
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
      
      // Optional: Sign out if auth failed
      if (auth.currentUser) {
        await signOut(auth);
      }
    } finally {
      setLoading(false);
    }
  };

  // Clear form when switching login type
  useEffect(() => {
    if (loginType === 'mobile') {
      setEmail('');
    } else {
      setMobileNumber('');
    }
  }, [loginType]);

  // Auto-clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '1rem' 
    }}>
      <div style={{ 
        background: 'white', 
        padding: '2.5rem', 
        borderRadius: '1rem', 
        width: '100%', 
        maxWidth: '400px', 
        boxShadow: '0 15px 35px rgba(0,0,0,0.3)',
        position: 'relative'
      }}>
        {/* Error banner */}
        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            border: '1px solid #fecaca',
            fontSize: '0.875rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        <h1 style={{ 
          textAlign: 'center', 
          fontSize: '2rem', 
          marginBottom: '1rem', 
          color: '#1f2937', 
          fontWeight: 'bold' 
        }}>
          Delivery Tracker
        </h1>
        
        <p style={{
          textAlign: 'center',
          color: '#6b7280',
          marginBottom: '1.5rem',
          fontSize: '0.9rem'
        }}>
          {loginType === 'mobile' 
            ? 'Mobile Login (Debug Mode)' 
            : 'Sign in to your account'
          }
        </p>
        
        {/* Login Type Toggle */}
        <div style={{ 
          display: 'flex', 
          marginBottom: '1.5rem', 
          border: '1px solid #e5e7eb', 
          borderRadius: '0.5rem',
          overflow: 'hidden'
        }}>
          <button
            type="button"
            onClick={() => setLoginType('mobile')}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: loginType === 'mobile' ? '#dc2626' : 'white',
              color: loginType === 'mobile' ? 'white' : '#6b7280',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              opacity: loading ? 0.7 : 1
            }}
          >
            📱 Mobile
          </button>
          <button
            type="button"
            onClick={() => setLoginType('email')}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: loginType === 'email' ? '#3b82f6' : 'white',
              color: loginType === 'email' ? 'white' : '#6b7280',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              opacity: loading ? 0.7 : 1
            }}
          >
            ✉️ Email
          </button>
        </div>
        
        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {loginType === 'mobile' ? (
            <>
              <input
                type="tel"
                placeholder="Mobile Number (e.g., 09012345678)"
                value={mobileNumber}
                onChange={e => setMobileNumber(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.875rem', 
                  marginBottom: '1rem', 
                  borderRadius: '0.5rem', 
                  border: '1px solid #d1d5db', 
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
                required
                disabled={loading}
              />
              <small style={{ 
                color: '#6b7280', 
                fontSize: '0.75rem', 
                display: 'block', 
                marginBottom: '0.5rem',
                textAlign: 'center'
              }}>
                Format: 09012345678 or +819012345678
              </small>
            </>
          ) : (
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.875rem', 
                marginBottom: '1rem', 
                borderRadius: '0.5rem', 
                border: '1px solid #d1d5db', 
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              required
              disabled={loading}
            />
          )}
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.875rem', 
              marginBottom: '1.5rem', 
              borderRadius: '0.5rem', 
              border: '1px solid #d1d5db', 
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            required
            disabled={loading}
          />
          
          <button
            type="submit"
            disabled={loading || (!email && !mobileNumber) || !password}
            style={{
              width: '100%',
              padding: '1rem',
              background: loading ? '#9ca3af' : (loginType === 'mobile' ? '#dc2626' : '#3b82f6'),
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? (
              <>
                <span style={{ marginRight: '0.5rem' }}>⏳</span>
                Logging in...
              </>
            ) : (
              loginType === 'mobile' ? 'Login with Mobile' : 'Login'
            )}
          </button>
        </form>

        {/* Debug info for mobile login */}
        {loginType === 'mobile' && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: '#f3f4f6',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            color: '#6b7280',
            textAlign: 'center',
            border: '1px solid #e5e7eb'
          }}>
            <strong>🔧 Debug Mode:</strong> Open browser console (F12) to see detailed logs
          </div>
        )}

        {/* Links */}
        <div style={{ 
          marginTop: '1.5rem', 
          textAlign: 'center', 
          fontSize: '0.875rem' 
        }}>
          <button
            type="button"
            onClick={() => navigate('/register')}
            disabled={loading}
            style={{
              color: '#3b82f6',
              background: 'none',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
              fontSize: '0.875rem'
            }}
          >
            Don't have an account? Register
          </button>
          <br />
          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            disabled={loading}
            style={{
              color: '#3b82f6',
              background: 'none',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
              fontSize: '0.875rem',
              marginTop: '0.5rem'
            }}
          >
            Forgot Password?
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;