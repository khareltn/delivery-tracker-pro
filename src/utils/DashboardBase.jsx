import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { toast } from 'react-toastify';
import LoadingScreen from '../components/LoadingScreen';

const DashboardBase = ({ children, title = "Dashboard" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userData, setUserData] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  // Role-based menu
  const getMenuItems = (role) => {
    const base = [
      { label: 'Home', path: '/', icon: 'Home', roles: ['admin','operator','driver','customer','supplier'] },
      { label: 'Profile', path: '/profile', icon: 'User', roles: ['admin','operator','driver','customer','supplier'] },
    ];

    const menus = {
      admin: [
        ...base,
        { label: 'Dashboard', path: '/admin-dashboard', icon: 'Chart', roles: ['admin'] },
        { label: 'Company', path: '/company-management', icon: 'Building', roles: ['admin'] },
        { label: 'Operators', path: '/operators', icon: 'Users', roles: ['admin'] },
        { label: 'Drivers', path: '/drivers', icon: 'Truck', roles: ['admin'] },
        { label: 'Orders', path: '/orders', icon: 'Package', roles: ['admin'] },
        { label: 'Finance', path: '/finance', icon: 'Yen', roles: ['admin'] },
      ],
      operator: [
        ...base,
        { label: 'Command Center', path: '/operator-dashboard', icon: 'Map', roles: ['operator'] },
        { label: 'Live Orders', path: '/operator-orders', icon: 'Clock', roles: ['operator'] },
      ],
      driver: [
        ...base,
        { label: 'My Deliveries', path: '/driver', icon: 'Navigation', roles: ['driver'] },
        { label: 'Route', path: '/driver-route', icon: 'Route', roles: ['driver'] },
      ],
      customer: [
        ...base,
        { label: 'My Orders', path: '/customer', icon: 'ShoppingBag', roles: ['customer'] },
        { label: 'Track', path: '/track', icon: 'MapPin', roles: ['customer'] },
      ],
      supplier: [
        ...base,
        { label: 'Inventory', path: '/supplier-inventory', icon: 'Warehouse', roles: ['supplier'] },
      ]
    };
    return menus[role] || base;
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) throw new Error('Profile missing');
        const data = userDoc.data();
        setUserData({ ...data, uid: user.uid });

        if (data.companyId) {
          const compDoc = await getDoc(doc(db, 'companies_2025', data.companyId));
          if (compDoc.exists()) setCompany(compDoc.data());
        }
      } catch (err) {
        toast.error('Session expired');
        signOut(auth);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = () => {
    signOut(auth);
    toast.success('Logged out safely');
    navigate('/login');
  };

  const menuItems = userData ? getMenuItems(userData.role) : [];

  if (loading) return <LoadingScreen message="Initializing dashboard..." />;

  return (
    <>
      <style jsx>{`
        .layout {
          display: flex;
          min-height: 100vh;
          background: #f8fafc;
          font-family: 'Inter', sans-serif;
        }
        .sidebar {
          width: 280px;
          background: #1e293b;
          color: white;
          position: fixed;
          top: 0;
          left: 0;
          height: 100%;
          overflow-y: auto;
          z-index: 1000;
          transition: transform 0.3s ease;
        }
        .sidebar.closed {
          transform: translateX(-100%);
        }
        .sidebar-header {
          padding: 24px 20px;
          border-bottom: 1px solid #334155;
          text-align: center;
        }
        .logo {
          font-size: 24px;
          font-weight: 800;
          background: linear-gradient(to right, #60a5fa, #3b82f6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .company-name {
          font-size: 14px;
          opacity: 0.8;
          marginTop: 8px;
        }
        .nav-list {
          padding: 16px 0;
        }
        .nav-item {
          padding: 14px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }
        .nav-item:hover {
          background: #334155;
        }
        .nav-item.active {
          background: #3b82f6;
          border-left: 4px solid #60a5fa;
        }
        .nav-icon {
          font-size: 20px;
        }
        .main {
          flex: 1;
          marginLeft: 280px;
          transition: margin 0.3s ease;
        }
        .main.full {
          marginLeft: 0;
        }
        .header {
          background: white;
          padding: 16px 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 900;
        }
        .page-title {
          font-size: 22px;
          font-weight: 700;
          color: #1e293b;
        }
        .user-menu {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 12px;
          background: #f1f5f9;
          transition: all 0.2s;
        }
        .user-menu:hover {
          background: #e2e8f0;
        }
        .user-name {
          font-weight: 600;
          color: #1e293b;
        }
        .user-role {
          font-size: 12px;
          color: #64748b;
          text-transform: capitalize;
        }
        .mobile-toggle {
          display: none;
          background: #1e293b;
          color: white;
          border: none;
          padding: 12px;
          font-size: 20px;
          cursor: pointer;
        }
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 999;
          display: none;
        }
        .overlay.show {
          display: block;
        }
        .offline-badge {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #ef4444;
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          z-index: 10000;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @media (max-width: 768px) {
          .sidebar { transform: translateX(-100%); }
          .sidebar.open { transform: translateX(0); }
          .main { marginLeft: 0 !important; }
          .mobile-toggle { display: block; }
          .header { padding: 16px; }
        }
      `}</style>

      {/* Mobile Overlay */}
      <div className={`overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)}></div>

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo">DeliveryPro</div>
          <div className="company-name">{company?.name || 'No Company'}</div>
        </div>
        <div className="nav-list">
          {menuItems.map((item) => item.roles.includes(userData?.role) && (
            <div
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => {
                navigate(item.path);
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
          <div className="nav-item" onClick={handleLogout}>
            <span className="nav-icon">Exit</span>
            <span>Logout</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`main ${sidebarOpen ? '' : 'full'}`}>
        <div className="header">
          <button className="mobile-toggle" onClick={() => setSidebarOpen(true)}>
            Menu
          </button>
          <div className="page-title">{title}</div>
          <div className="user-menu" onClick={() => navigate('/profile')}>
            <span role="img" aria-label="user">User</span>
            <div>
              <div className="user-name">{userData?.name || 'User'}</div>
              <div className="user-role">{userData?.role || 'guest'}</div>
            </div>
          </div>
        </div>
        <div style={{ padding: '24px' }}>
          {children}
        </div>
      </div>

      {/* Offline Indicator */}
      {!navigator.onLine && (
        <div className="offline-badge">
          Offline Mode
        </div>
      )}
    </>
  );
};

export default DashboardBase;