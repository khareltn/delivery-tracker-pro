// src/components/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'react-toastify';

const Login = () => {
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState('email');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Helper function to find user by mobile number - FIXED VERSION
  const findUserByMobileNumber = async (mobile) => {
    try {
      console.log('🔍 [MOBILE] Searching for user by mobile:', mobile);
      
      // Clean the mobile number (remove non-digits)
      const cleanMobile = mobile.replace(/\D/g, '');
      console.log('🔍 [MOBILE] Cleaned mobile:', cleanMobile);
      
      // Try different mobile number formats
      const mobileVariations = [
        cleanMobile,                          // 09012345678
        `+81${cleanMobile.substring(1)}`,    // +819012345678
        `81${cleanMobile.substring(1)}`,     // 819012345678
        `0${cleanMobile}`,                   // 009012345678 (if missing leading 0)
        cleanMobile.substring(1),            // 9012345678 (without leading 0)
      ];
      
      console.log('📱 [MOBILE] Trying variations:', mobileVariations);
      
      // Try each mobile number variation
      for (const mobileVar of mobileVariations) {
        console.log(`🔍 [MOBILE] Trying variation: "${mobileVar}"`);
        
        // Try different query combinations
        const queries = [
          // Query 1: Just by mobile number
          query(
            collection(db, 'users'),
            where('mobileNumber', '==', mobileVar)
          ),
          // Query 2: Mobile with role driver
          query(
            collection(db, 'users'),
            where('mobileNumber', '==', mobileVar),
            where('role', '==', 'driver')
          ),
          // Query 3: Mobile with status active
          query(
            collection(db, 'users'),
            where('mobileNumber', '==', mobileVar),
            where('status', '==', 'active')
          ),
          // Query 4: Try phone field (alternative name)
          query(
            collection(db, 'users'),
            where('phone', '==', mobileVar)
          ),
          // Query 5: Try contactNumber field
          query(
            collection(db, 'users'),
            where('contactNumber', '==', mobileVar)
          )
        ];
        
        for (let i = 0; i < queries.length; i++) {
          console.log(`🔍 [MOBILE] Trying query ${i + 1} with "${mobileVar}"`);
          try {
            const querySnapshot = await getDocs(queries[i]);
            console.log(`📊 [MOBILE] Query ${i + 1} found ${querySnapshot.size} users`);
            
            if (!querySnapshot.empty) {
              const userDoc = querySnapshot.docs[0];
              const userData = userDoc.data();
              console.log(`✅ [MOBILE] USER FOUND!`, userData);
              console.log(`✅ [MOBILE] Mobile field value: "${userData.mobileNumber || userData.phone || userData.contactNumber}"`);
              
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
      
      // If still not found, list ALL users to debug
      console.log('🔄 [MOBILE] Listing ALL users to check mobile fields...');
      const allUsersQuery = query(collection(db, 'users'));
      const allUsers = await getDocs(allUsersQuery);
      console.log('📋 [MOBILE] ALL USERS IN FIRESTORE:');
      allUsers.forEach(doc => {
        const data = doc.data();
        console.log(`- ID: ${doc.id}`);
        console.log(`  Email: ${data.email}`);
        console.log(`  Mobile: ${data.mobileNumber || data.phone || data.contactNumber || 'NO MOBILE FIELD'}`);
        console.log(`  Role: ${data.role}`);
        console.log(`  Status: ${data.status || 'NO STATUS'}`);
        console.log('---');
      });
      
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
      
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', email)
      );
      
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🚀 Login attempt. Type:', loginType);
    
    setLoading(true);
    
    try {
      let userEmail = '';
      let userData = null;

      if (loginType === 'mobile') {
        if (!mobileNumber || !password) {
          toast.error('Mobile number and password required');
          setLoading(false);
          return;
        }
        
        const cleanMobile = mobileNumber.replace(/\D/g, '');
        console.log('📱 Processing mobile login for:', cleanMobile);
        
        const foundUser = await findUserByMobileNumber(cleanMobile);
        
        if (!foundUser) {
          toast.error('No user found with this mobile number. Check console for details.');
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
      }

      console.log('🔑 Attempting Firebase auth with:', userEmail);
      
      // Authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, userEmail, password);
      const user = userCredential.user;
      console.log('✅ Firebase auth successful! UID:', user.uid);

      // Store user data
      localStorage.setItem('userData', JSON.stringify({
        id: userData.id,
        uid: userData.uid || user.uid,
        name: userData.name,
        email: userData.email,
        mobileNumber: userData.mobileNumber,
        role: userData.role || 'driver',
        companyId: userData.companyId,
        companyName: userData.companyName,
        ...(userData.role === 'driver' && {
          vehicleNumber: userData.vehicleNumber,
          licenseNumber: userData.licenseNumber
        })
      }));

      toast.success(`Welcome ${userData.name || userEmail}!`);
      
      // Redirect
      const userRole = userData.role || 'driver';
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
          navigate('/dashboard', { replace: true });
      }

    } catch (err) {
      console.error('❌ Login error:', err);
      
      if (err.code === 'auth/invalid-credential') {
        toast.error('Invalid credentials');
      } else if (err.code === 'auth/user-not-found') {
        toast.error('User not in Firebase Authentication');
      } else if (err.code === 'auth/wrong-password') {
        toast.error('Wrong password');
      } else {
        toast.error(`Login failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Clear form fields when switching
  useEffect(() => {
    if (loginType === 'mobile') {
      setEmail('');
    } else {
      setMobileNumber('');
    }
  }, [loginType]);

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
        boxShadow: '0 15px 35px rgba(0,0,0,0.3)'
      }}>
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
          color: loginType === 'mobile' ? '#dc2626' : '#6b7280',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          fontWeight: loginType === 'mobile' ? 'bold' : 'normal'
        }}>
          {loginType === 'mobile' 
            ? '⚠️ DEBUG: Mobile login - Check browser console' 
            : 'Login with email or mobile'}
        </p>
        
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
            style={{
              flex: 1,
              padding: '0.75rem',
              background: loginType === 'mobile' ? '#dc2626' : 'white',
              color: loginType === 'mobile' ? 'white' : '#6b7280',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            📱 Mobile (Debug)
          </button>
          <button
            type="button"
            onClick={() => setLoginType('email')}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: loginType === 'email' ? '#3b82f6' : 'white',
              color: loginType === 'email' ? 'white' : '#6b7280',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            ✉️ Email
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          {loginType === 'mobile' ? (
            <div>
              <input
                type="tel"
                placeholder="Try: 09012345678 or +819012345678"
                value={mobileNumber}
                onChange={e => setMobileNumber(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.875rem', 
                  marginBottom: '0.5rem', 
                  borderRadius: '0.5rem', 
                  border: '1px solid #dc2626', 
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
                required
                disabled={loading}
              />
              <div style={{ 
                fontSize: '0.75rem', 
                color: '#dc2626', 
                marginBottom: '1rem',
                textAlign: 'center',
                fontStyle: 'italic'
              }}>
                Open browser console (F12) to see debug info
              </div>
            </div>
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
                border: '1px solid #ccc', 
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
              border: '1px solid #ccc', 
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            required
            disabled={loading}
          />
          
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              background: loading ? '#9ca3af' : (loginType === 'mobile' ? '#dc2626' : '#3b82f6'),
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Logging in...' : (loginType === 'mobile' ? 'Test Mobile Login' : 'Login')}
          </button>
        </form>

        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: loginType === 'mobile' ? '#fee2e2' : '#f3f4f6',
          borderRadius: '0.5rem',
          fontSize: '12px',
          color: loginType === 'mobile' ? '#dc2626' : '#6b7280',
          textAlign: 'center'
        }}>
          {loginType === 'mobile' ? (
            <>
              <p><strong>🔧 MOBILE LOGIN DEBUG MODE</strong></p>
              <p>1. Open browser console (F12)</p>
              <p>2. Check what mobile numbers are in Firestore</p>
              <p>3. Try different formats: 090..., +81..., 81...</p>
            </>
          ) : (
            <p>Login with your registered email address</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;