// src/components/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { toast } from 'react-toastify';

const Login = () => {
  const navigate = useNavigate(); // ← YE HONA CHAHIYE
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Email and password required');

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Welcome back!');
      
      // YE LINE PAGE AAGE LE JAYEGI
      navigate('/company-reg', { replace: true });
    } catch (err) {
      toast.error('Login failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#667eea', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', padding: '2.5rem', borderRadius: '1rem', width: '100%', maxWidth: '400px', boxShadow: '0 15px 35px rgba(0,0,0,0.3)' }}>
        <h1 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '2rem', color: '#1f2937', fontWeight: 'bold' }}>
          Login
        </h1>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.875rem', marginBottom: '1rem', borderRadius: '0.5rem', border: '1px solid #ccc', fontSize: '1rem' }}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.875rem', marginBottom: '1.5rem', borderRadius: '0.5rem', border: '1px solid #ccc', fontSize: '1rem' }}
            required
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;