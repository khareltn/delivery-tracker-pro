import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { toast } from 'react-toastify';

const Register = ({ styles }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'customer',
    phone: ''
  });
  const [loading, setLoading] = useState(false);

  const roles = [
    { value: 'admin', label: 'Administrator', icon: 'Crown', color: '#8b5cf6' },
    { value: 'operator', label: 'Operator', icon: 'Gear', color: '#ea580c' },
    { value: 'driver', label: 'Driver', icon: 'Truck', color: '#10b981' },
    { value: 'customer', label: 'Customer', icon: 'User', color: '#3b82f6' },
    { value: 'supplier', label: 'Supplier', icon: 'Factory', color: '#f59e0b' }
  ];

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, password, confirmPassword, role, phone } = form;

    if (!name || !email || !password || !phone) {
      return toast.error('All fields are required');
    }
    if (password !== confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save user profile
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name,
        email,
        phone,
        role,
        status: 'active',
        createdAt: new Date(),
        companyId: null // Will be set after company registration (admin/operator)
      });

      toast.success('Account created successfully!');
      setTimeout(() => {
        if (role === 'admin' || role === 'operator') {
          navigate('/financial-year-setup');
        } else {
          navigate('/login');
        }
      }, 1200);
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'Email already registered',
        'auth/invalid-email': 'Invalid email address',
        'auth/weak-password': 'Password too weak',
        'auth/network-request-failed': 'Check your connection'
      };
      toast.error(messages[err.code] || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style jsx>{`
        .container {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .card {
          background: white;
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.2);
          width: 100%;
          max-width: 460px;
        }
        .header {
          text-align: center;
          marginBottom: 32px;
        }
        .title {
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
          marginBottom: 8px;
        }
        .subtitle {
          color: #6b7280;
          font-size: 15px;
        }
        .form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .label {
          font-weight: 600;
          color: #374151;
          font-size: 14px;
        }
        .input, .select {
          padding: 14px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          font-size: 16px;
          transition: all 0.2s;
        }
        .input:focus, .select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }
        .role-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          marginTop: 8px;
        }
        @media (max-width: 480px) {
          .role-grid { grid-template-columns: 1fr 1fr; }
        }
        .role-option {
          padding: 16px;
          border: 2px solid #e5e7eb;
          border-radius: 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: #f9fafb;
        }
        .role-option.selected {
          border-color: #667eea;
          background: #f0f4ff;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102,126,234,0.15);
        }
        .role-icon {
          font-size: 28px;
          marginBottom: 8px;
        }
        .role-label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }
        .btn {
          padding: 16px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          background: #667eea;
          color: white;
          marginTop: 12px;
        }
        .btn:hover:not(:disabled) {
          background: #5a6fd8;
          transform: translateY(-1px);
        }
        .btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        .login-link {
          text-align: center;
          marginTop: 24px;
          font-size: 14px;
        }
        .link {
          color: #667eea;
          text-decoration: none;
          font-weight: 600;
        }
        .link:hover {
          text-decoration: underline;
        }
        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #e5e7eb;
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          display: inline-block;
          marginRight: 10px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="container">
        <div className="card">
          <div className="header">
            <h1 className="title">Create Account</h1>
            <p className="subtitle">Join your delivery team today</p>
          </div>

          <form onSubmit={handleSubmit} className="form">
            <div className="input-group">
              <label className="label">Full Name</label>
              <input
                className="input"
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Tanaka Taro"
                required
              />
            </div>

            <div className="input-group">
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="taro@example.com"
                required
              />
            </div>

            <div className="input-group">
              <label className="label">Phone</label>
              <input
                className="input"
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="090-1234-5678"
                required
              />
            </div>

            <div className="input-group">
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                minLength="6"
              />
            </div>

            <div className="input-group">
              <label className="label">Confirm Password</label>
              <input
                className="input"
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="input-group">
              <label className="label">Select Role</label>
              <div className="role-grid">
                {roles.map(r => (
                  <div
                    key={r.value}
                    className={`role-option ${form.role === r.value ? 'selected' : ''}`}
                    onClick={() => setForm({ ...form, role: r.value })}
                  >
                    <div className="role-icon">{r.icon}</div>
                    <div className="role-label">{r.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="login-link">
            Already have an account?{' '}
            <a href="/login" className="link">
              Sign In
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;