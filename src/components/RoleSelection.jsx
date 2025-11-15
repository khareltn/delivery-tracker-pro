import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import LoadingScreen from './LoadingScreen';
import { toast } from 'react-toastify';

const RoleSelection = ({ styles }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  const roles = [
    { 
      value: 'admin', 
      label: 'Administrator', 
      icon: 'Crown', 
      color: '#8b5cf6',
      desc: 'Full control: manage company, users, orders'
    },
    { 
      value: 'operator', 
      label: 'Operator', 
      icon: 'Gear', 
      color: '#ea580c',
      desc: 'Assign drivers, monitor live deliveries'
    },
    { 
      value: 'driver', 
      label: 'Driver', 
      icon: 'Truck', 
      color: '#10b981',
      desc: 'GPS tracking, delivery updates'
    },
    { 
      value: 'customer', 
      label: 'Customer', 
      icon: 'User', 
      color: '#3b82f6',
      desc: 'Track your orders in real-time'
    },
    { 
      value: 'supplier', 
      label: 'Supplier', 
      icon: 'Factory', 
      color: '#f59e0b',
      desc: 'Manage inventory & shipments'
    }
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          toast.error('User profile not found');
          auth.signOut();
          navigate('/login');
          return;
        }

        const data = userDoc.data();
        setUserData({ ...data, uid: user.uid });

        // Auto-redirect if role already selected
        if (data.role && data.companyId) {
          redirectByRole(data.role);
        }
      } catch (err) {
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const redirectByRole = (role) => {
    const routes = {
      admin: '/admin-dashboard',
      operator: '/operator-dashboard',
      driver: '/driver',
      customer: '/customer',
      supplier: '/supplier'
    };
    navigate(routes[role] || '/login');
  };

  const handleRoleSelect = async (role) => {
    if (!userData?.uid) return;

    try {
      await setDoc(doc(db, 'users', userData.uid), { role }, { merge: true });
      toast.success(`Welcome, ${role.toUpperCase()}!`);
      
      setTimeout(() => {
        if (role === 'admin' || role === 'operator') {
          navigate('/financial-year-setup');
        } else {
          redirectByRole(role);
        }
      }, 800);
    } catch (err) {
      toast.error('Failed to save role');
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading your profile..." />;
  }

  return (
    <>
      <style jsx>{`
        .container {
          min-height: 100vh;
          background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          color: white;
        }
        .header {
          text-align: center;
          marginBottom: 40px;
          max-width: 500px;
        }
        .title {
          font-size: 32px;
          font-weight: 800;
          marginBottom: 16px;
          background: linear-gradient(to right, #fbbf24, #f59e0b);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .subtitle {
          font-size: 18px;
          opacity: 0.9;
          line-height: 1.6;
        }
        .roles-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          max-width: 1000px;
          width: 100%;
        }
        .role-card {
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(12px);
          border-radius: 24px;
          padding: 28px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          border: 2px solid transparent;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .role-card:hover {
          transform: translateY(-12px);
          background: rgba(255, 255, 255, 0.2);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .role-card.selected {
          border-color: #fbbf24;
          background: rgba(251, 191, 36, 0.15);
        }
        .icon {
          font-size: 56px;
          marginBottom: 16px;
        }
        .role-title {
          font-size: 22px;
          font-weight: 700;
          marginBottom: 12px;
        }
        .role-desc {
          font-size: 15px;
          opacity: 0.9;
          line-height: 1.6;
        }
        .footer {
          marginTop: 48px;
          text-align: center;
          opacity: 0.8;
          font-size: 14px;
        }
        .logout {
          marginTop: 20px;
          padding: 12px 32px;
          background: rgba(255,255,255,0.15);
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }
        @media (max-width: 640px) {
          .title { font-size: 28px; }
          .roles-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="container">
        <div className="header">
          <h1 className="title">Choose Your Role</h1>
          <p className="subtitle">
            Welcome back, <strong>{userData?.name || userData?.email}</strong>!<br/>
            Select how you want to use the system today.
          </p>
        </div>

        <div className="roles-grid">
          {roles.map((role) => (
            <div
              key={role.value}
              className="role-card"
              onClick={() => handleRoleSelect(role.value)}
            >
              <div className="icon">{role.icon}</div>
              <div className="role-title">{role.label}</div>
              <div className="role-desc">{role.desc}</div>
            </div>
          ))}
        </div>

        <div className="footer">
          <button className="logout" onClick={() => auth.signOut()}>
            Not {userData?.name}? Sign Out
          </button>
        </div>
      </div>
    </>
  );
};

export default RoleSelection;