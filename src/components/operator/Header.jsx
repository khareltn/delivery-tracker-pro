import React from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { toast } from 'react-toastify';
import { styles } from './operatorStyles';

const Header = ({ company }) => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  return (
    <div style={styles.header}>
      <div style={styles.headerContent}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '5px' }}>
              🚚 Operator Dashboard
            </h1>
            <div style={{ opacity: 0.9, fontSize: '14px' }}>
              {company.name || 'Loading...'} • {company.financialYear || 'FY 2025-2026'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="header-btn" onClick={() => navigate('/profile')}>👤 Profile</button>
            <button className="header-btn" onClick={handleSignOut}>🚪 Logout</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;