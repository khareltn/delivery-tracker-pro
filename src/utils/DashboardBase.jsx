// src/utils/DashboardBase.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { toast } from 'react-toastify';
import LoadingScreen from '../components/LoadingScreen';

// Simple icon components
const HomeIcon = () => <span>🏠</span>;
const UserIcon = () => <span>👤</span>;
const ChartIcon = () => <span>📊</span>;
const BuildingIcon = () => <span>🏢</span>;
const UsersIcon = () => <span>👥</span>;
const TruckIcon = () => <span>🚚</span>;
const PackageIcon = () => <span>📦</span>;
const YenIcon = () => <span>💴</span>;
const MapIcon = () => <span>🗺️</span>;
const ClockIcon = () => <span>⏰</span>;
const NavigationIcon = () => <span>🧭</span>;
const RouteIcon = () => <span>🛣️</span>;
const ShoppingBagIcon = () => <span>🛍️</span>;
const MapPinIcon = () => <span>📍</span>;
const WarehouseIcon = () => <span>🏭</span>;
const ExitIcon = () => <span>🚪</span>;

const DashboardBase = ({ 
  children, 
  title = "Dashboard",
  selectedCompany,
  currentUser 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userData, setUserData] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle responsive design
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Role-based menu with proper routes
  const getMenuItems = (role) => {
    const baseItems = [
      { 
        label: 'Home', 
        path: '/', 
        icon: <HomeIcon />, 
        roles: ['admin','operator','driver','customer','supplier'] 
      },
      { 
        label: 'Profile', 
        path: '/profile', 
        icon: <UserIcon />, 
        roles: ['admin','operator','driver','customer','supplier'] 
      },
    ];

    const roleSpecificItems = {
      admin: [
        { label: 'Dashboard', path: '/admin-dashboard', icon: <ChartIcon /> },
        { label: 'Company Management', path: '/company-management', icon: <BuildingIcon /> },
        { label: 'Operators', path: '/operators', icon: <UsersIcon /> },
        { label: 'Drivers', path: '/drivers', icon: <TruckIcon /> },
        { label: 'Orders', path: '/orders', icon: <PackageIcon /> },
        { label: 'Finance', path: '/finance', icon: <YenIcon /> },
      ],
      operator: [
        { label: 'Command Center', path: '/operator', icon: <MapIcon /> },
        { label: 'Live Orders', path: '/operator-orders', icon: <ClockIcon /> },
      ],
      driver: [
        { label: 'My Deliveries', path: '/driver', icon: <NavigationIcon /> },
        { label: 'My Route', path: '/driver-route', icon: <RouteIcon /> },
      ],
      customer: [
        { label: 'My Orders', path: '/customer', icon: <ShoppingBagIcon /> },
        { label: 'Track Order', path: '/track', icon: <MapPinIcon /> },
      ],
      supplier: [
        { label: 'Inventory', path: '/supplier', icon: <WarehouseIcon /> },
      ]
    };

    const specificItems = roleSpecificItems[role] || [];
    return [...baseItems, ...specificItems];
  };

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        setLoading(true);
        
        console.log('DashboardBase: Initializing with:', { currentUser, selectedCompany });

        // Use provided user data or get from auth
        if (currentUser) {
          setUserData(currentUser);
          console.log('DashboardBase: Using provided user data:', currentUser);
        } else {
          // Fallback to auth state
          const user = auth.currentUser;
          if (!user) {
            navigate('/login');
            return;
          }

          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const userDataWithUid = { ...data, uid: user.uid };
            setUserData(userDataWithUid);
            console.log('DashboardBase: Loaded user from auth:', userDataWithUid);
          } else {
            toast.error('User profile not found');
            await signOut(auth);
            return;
          }
        }

        // Use provided company or try to load it
        if (selectedCompany) {
          setCompany(selectedCompany);
          console.log('DashboardBase: Using provided company:', selectedCompany);
        } else if (currentUser?.companyId) {
          await loadCompanyData(currentUser.companyId);
        }

      } catch (error) {
        console.error('DashboardBase: Error initializing:', error);
        toast.error('Failed to initialize dashboard');
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [navigate, currentUser, selectedCompany]);

  const loadCompanyData = async (companyId) => {
    try {
      console.log('DashboardBase: Loading company data for:', companyId);
      
      // Try main companies collection
      const companiesQuery = query(
        collection(db, 'companies'),
        where('companyId', '==', companyId)
      );
      const companiesSnapshot = await getDocs(companiesQuery);
      
      if (!companiesSnapshot.empty) {
        const companyData = companiesSnapshot.docs[0].data();
        setCompany({ 
          id: companiesSnapshot.docs[0].id, 
          ...companyData 
        });
        console.log('DashboardBase: Found company in main collection:', companyData);
        return;
      }

      // Try financial_years subcollection
      const financialYearsSnap = await getDocs(collection(db, 'financial_years'));
      for (const fyDoc of financialYearsSnap.docs) {
        const companiesQuery = query(
          collection(db, 'financial_years', fyDoc.id, 'companies'),
          where('companyId', '==', companyId)
        );
        const companiesSnapshot = await getDocs(companiesQuery);
        if (!companiesSnapshot.empty) {
          const companyData = companiesSnapshot.docs[0].data();
          setCompany({ 
            id: companiesSnapshot.docs[0].id, 
            ...companyData 
          });
          console.log('DashboardBase: Found company in financial_years:', companyData);
          return;
        }
      }

      // Create minimal company object
      const fallbackCompany = {
        id: companyId,
        name: 'Your Company',
        companyId: companyId
      };
      setCompany(fallbackCompany);
      console.log('DashboardBase: Using fallback company:', fallbackCompany);

    } catch (error) {
      console.error('DashboardBase: Error loading company:', error);
      const fallbackCompany = {
        id: companyId,
        name: 'Your Company',
        companyId: companyId
      };
      setCompany(fallbackCompany);
    }
  };

  const handleNavigation = (path) => {
    console.log('DashboardBase: Navigating to:', path);
    navigate(path);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      console.log('DashboardBase: Logging out...');
      await signOut(auth);
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      console.error('DashboardBase: Error signing out:', error);
      toast.error('Error signing out');
    }
  };

  const menuItems = userData ? getMenuItems(userData.role) : [];
  console.log('DashboardBase: Menu items for role', userData?.role, ':', menuItems);

  if (loading) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  // Inline styles
  const styles = {
    layout: {
      display: 'flex',
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    sidebar: {
      width: '280px',
      background: '#1e293b',
      color: 'white',
      position: isMobile ? 'fixed' : 'static',
      top: 0,
      left: 0,
      height: '100vh',
      overflowY: 'auto',
      zIndex: 1000,
      transition: 'transform 0.3s ease',
      transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
    },
    sidebarHeader: {
      padding: '24px 20px',
      borderBottom: '1px solid #334155',
      textAlign: 'center',
    },
    logo: {
      fontSize: '24px',
      fontWeight: '800',
      background: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      cursor: 'pointer',
      marginBottom: '8px',
    },
    companyName: {
      fontSize: '14px',
      color: '#94a3b8',
      fontWeight: '500',
    },
    navList: {
      padding: '16px 0',
    },
    navItem: {
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      borderLeft: '4px solid transparent',
      fontSize: '14px',
      fontWeight: '500',
    },
    navItemActive: {
      background: 'rgba(96, 165, 250, 0.2)',
      borderLeftColor: '#60a5fa',
      color: '#60a5fa',
    },
    navItemHover: {
      background: '#334155',
    },
    main: {
      flex: 1,
      marginLeft: isMobile ? 0 : '280px',
      transition: 'margin 0.3s ease',
      minWidth: 0,
      background: '#ffffff',
    },
    header: {
      background: 'white',
      padding: '16px 24px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 900,
    },
    headerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    },
    mobileToggle: {
      display: isMobile ? 'flex' : 'none',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#3b82f6',
      color: 'white',
      border: 'none',
      padding: '10px',
      borderRadius: '8px',
      fontSize: '16px',
      cursor: 'pointer',
      width: '40px',
      height: '40px',
    },
    pageTitle: {
      fontSize: '20px',
      fontWeight: '700',
      color: '#1e293b',
      margin: 0,
    },
    userMenu: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      cursor: 'pointer',
      padding: '8px 16px',
      borderRadius: '8px',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      transition: 'all 0.2s ease',
    },
    userAvatar: {
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontWeight: '600',
      fontSize: '14px',
    },
    userInfo: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    userName: {
      fontWeight: '600',
      color: '#1e293b',
      fontSize: '14px',
    },
    userRole: {
      fontSize: '12px',
      color: '#64748b',
      textTransform: 'capitalize',
    },
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      zIndex: 999,
      display: isMobile && sidebarOpen ? 'block' : 'none',
    },
    content: {
      padding: '24px',
      minHeight: 'calc(100vh - 80px)',
      background: '#ffffff',
    },
    logoutItem: {
      color: '#ef4444',
    },
    logoutItemHover: {
      background: 'rgba(239, 68, 68, 0.1)',
    }
  };

  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isActivePath = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div style={styles.layout}>
      {/* Mobile Overlay */}
      {isMobile && (
        <div 
          style={styles.overlay}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div 
            style={styles.logo}
            onClick={() => handleNavigation('/')}
          >
            DeliveryPro
          </div>
          <div style={styles.companyName}>
            {company?.companyName || company?.name || 'Loading...'}
          </div>
        </div>

        <div style={styles.navList}>
          {menuItems.map((item) => (
            <div
              key={item.path}
              style={{
                ...styles.navItem,
                ...(isActivePath(item.path) ? styles.navItemActive : {}),
              }}
              onMouseEnter={(e) => {
                if (!isActivePath(item.path)) {
                  e.currentTarget.style.background = styles.navItemHover.background;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActivePath(item.path)) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
              onClick={() => handleNavigation(item.path)}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
          
          {/* Logout Button */}
          <div
            style={{
              ...styles.navItem,
              ...styles.logoutItem,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = styles.logoutItemHover.background;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            onClick={handleLogout}
          >
            <ExitIcon />
            <span>Logout</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={styles.main}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <button 
              style={styles.mobileToggle}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ☰
            </button>
            <h1 style={styles.pageTitle}>{title}</h1>
          </div>

          <div 
            style={styles.userMenu}
            onClick={() => handleNavigation('/profile')}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f8fafc';
            }}
          >
            <div style={styles.userAvatar}>
              {getUserInitials(userData?.name)}
            </div>
            <div style={styles.userInfo}>
              <div style={styles.userName}>
                {userData?.name || 'User'}
              </div>
              <div style={styles.userRole}>
                {userData?.role || 'guest'}
              </div>
            </div>
          </div>
        </div>

        <div style={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default DashboardBase;