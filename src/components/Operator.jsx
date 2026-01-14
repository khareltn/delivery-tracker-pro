// components/Operator.jsx - CORRECTED VERSION
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  collection, getDocs, query, where, onSnapshot, 
  doc, updateDoc, deleteDoc, getDoc, addDoc 
} from 'firebase/firestore';
import { db, auth, signOut } from '../firebase';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import existing components
import DeliveryTrackingMap from './DeliveryTrackingMap';
import DeliveryManagement from './DeliveryManagement';
import DriverAssignments from './DriverAssignments';

// Import new components for Daily Operations
import SalesManagement from './SalesManagement';
import AccountReceivableManagement from './AccountReceivableManagement';
import PurchaseManagement from './PurchaseManagement';
import AccountPayableManagement from './AccountPayableManagement';
import InventoryManagement from './InventoryManagement';

// Import Ledger components
import LedgerTab from './LedgerTab';
import InvoicePrinting from './InvoicePrinting';

// Import Category Management
import CategoryManagement from './CategoryManagement';
// Add this after all imports in Operator.jsx
console.log('=== OPERATOR COMPONENT IMPORT DEBUG ===');
try {
  console.log('✅ Operator component loaded');
  console.log('DeliveryTrackingMap:', typeof DeliveryTrackingMap);
  console.log('DeliveryManagement:', typeof DeliveryManagement);
  console.log('DriverAssignments:', typeof DriverAssignments);
  console.log('SalesManagement:', typeof SalesManagement);
  console.log('AccountReceivableManagement:', typeof AccountReceivableManagement);
  console.log('PurchaseManagement:', typeof PurchaseManagement);
  console.log('AccountPayableManagement:', typeof AccountPayableManagement);
  console.log('InventoryManagement:', typeof InventoryManagement);
  console.log('LedgerTab:', typeof LedgerTab);
  console.log('InvoicePrinting:', typeof InvoicePrinting);
  console.log('CategoryManagement:', typeof CategoryManagement);
} catch (error) {
  console.error('❌ Error checking imports:', error);
}

// CSS Styles (EXACTLY THE SAME)
const styles = {
  container: {
    backgroundColor: '#f5f7fa',
    minHeight: '100vh',
    fontFamily: "'Roboto', 'Segoe UI', sans-serif"
  },
  header: {
    background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
    color: 'white',
    borderRadius: '10px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
    marginBottom: '20px'
  },
  headerContent: {
    padding: '20px 25px'
  },
  sidebar: {
    backgroundColor: '#2c3e50',
    borderRadius: '10px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    minHeight: 'calc(100vh - 180px)',
    overflow: 'hidden'
  },
  sidebarSection: {
    marginBottom: '25px'
  },
  sidebarTitle: {
    color: '#95a5a6',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    padding: '15px 20px 5px',
    marginBottom: '10px',
    borderBottom: '1px solid #34495e'
  },
  tabButton: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '12px 20px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#bdc3c7',
    fontSize: '14px',
    fontWeight: '500',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    borderLeft: '4px solid transparent',
    '&:hover': {
      backgroundColor: '#34495e',
      color: '#ecf0f1'
    }
  },
  tabButtonActive: {
    backgroundColor: '#34495e',
    color: '#ffffff',
    borderLeft: '4px solid #3498db'
  },
  tabIcon: {
    marginRight: '12px',
    fontSize: '18px',
    width: '24px',
    textAlign: 'center'
  },
  contentArea: {
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    minHeight: 'calc(100vh - 180px)',
    padding: '25px'
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '400px'
  },
  spinner: {
    border: '4px solid rgba(0, 0, 0, 0.1)',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    borderLeftColor: '#3498db',
    animation: 'spin 1s linear infinite'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '15px',
    marginBottom: '25px'
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
    border: '1px solid #e1e8ed',
    transition: 'transform 0.2s',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
    }
  },
  statIcon: {
    fontSize: '24px',
    marginBottom: '10px',
    display: 'inline-block',
    padding: '10px',
    borderRadius: '8px',
    backgroundColor: 'rgba(52, 152, 219, 0.1)'
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: '5px'
  },
  statLabel: {
    fontSize: '14px',
    color: '#7f8c8d',
    fontWeight: '500'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    border: '1px solid #e1e8ed',
    marginBottom: '20px'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '1px solid #e1e8ed'
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#2c3e50',
    margin: 0
  },
  activityItem: {
    padding: '15px 0',
    borderBottom: '1px solid #f1f1f1',
    '&:last-child': {
      borderBottom: 'none'
    }
  },
  activityText: {
    color: '#34495e',
    marginBottom: '5px',
    fontSize: '14px'
  },
  activityTime: {
    fontSize: '12px',
    color: '#95a5a6'
  },
  deliveryItem: {
    padding: '12px 0',
    borderBottom: '1px solid #f1f1f1',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  deliveryInfo: {
    flex: 1
  },
  deliveryName: {
    fontWeight: '500',
    color: '#2c3e50',
    marginBottom: '3px'
  },
  deliveryAddress: {
    fontSize: '12px',
    color: '#7f8c8d',
    marginBottom: '5px'
  },
  deliveryTime: {
    fontSize: '11px',
    color: '#95a5a6'
  },
  statusBadge: {
    padding: '5px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  quickActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '15px',
    marginBottom: '25px'
  },
  quickActionButton: {
    backgroundColor: 'white',
    border: '1px solid #e1e8ed',
    borderRadius: '8px',
    padding: '20px 15px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    '&:hover': {
      transform: 'translateY(-3px)',
      boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
      borderColor: '#3498db'
    }
  },
  quickActionIcon: {
    fontSize: '24px',
    marginBottom: '10px',
    color: '#3498db'
  },
  quickActionText: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#2c3e50',
    textAlign: 'center'
  },
  systemInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    padding: '15px',
    border: '1px solid #e1e8ed'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #e1e8ed',
    '&:last-child': {
      borderBottom: 'none'
    }
  },
  infoLabel: {
    color: '#7f8c8d',
    fontSize: '13px'
  },
  infoValue: {
    color: '#2c3e50',
    fontSize: '13px',
    fontWeight: '500'
  },
  footer: {
    textAlign: 'center',
    color: '#95a5a6',
    fontSize: '12px',
    padding: '20px 0',
    borderTop: '1px solid #e1e8ed',
    marginTop: '30px'
  }
};

// Animation for spinner (EXACTLY THE SAME)
const styleSheet = document.styleSheets[0];
styleSheet.insertRule(`
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`, styleSheet.cssRules.length);

const Operator = ({ selectedCompany, currentUser, companyLoading }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // ============ STATE MANAGEMENT ============
  const [company, setCompany] = useState(location.state?.company || selectedCompany || {});
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [activities, setActivities] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Stats state
  const [stats, setStats] = useState({
    totalDrivers: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
    totalProducts: 0,
    pendingDeliveries: 0,
    activeDeliveries: 0,
    completedToday: 0,
    totalSalesToday: 0,
    pendingPayments: 0
  });

  // ============ DATA LOADING FUNCTIONS ============
  
  const loadCompanyData = useCallback(async () => {
    if ((!company || Object.keys(company).length === 0) && currentUser?.uid) {
      try {
        console.log('Loading company data...');
        setLoading(true);
        
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) {
          console.error('User document not found');
          return;
        }
        
        const userData = userDoc.data();
        const companyId = userData.companyId;
        const userFY = userData.fyId;
        
        if (!companyId) {
          console.error('No company ID found');
          return;
        }
        
        let companyData = null;
        
        // Try to find company in financial_years collection
        if (userFY) {
          try {
            const companyDocRef = doc(db, 'financial_years', userFY, 'companies', companyId);
            const companyDoc = await getDoc(companyDocRef);
            if (companyDoc.exists()) {
              companyData = companyDoc.data();
            }
          } catch (error) {
            console.log('Company not found in financial_years');
          }
        }
        
        // Search in main companies collection
        if (!companyData) {
          const companyQuery = query(
            collection(db, 'companies'),
            where('companyId', '==', companyId)
          );
          const companySnapshot = await getDocs(companyQuery);
          if (!companySnapshot.empty) {
            companyData = companySnapshot.docs[0].data();
          }
        }
        
        // Search through all financial years
        if (!companyData) {
          const financialYearsSnap = await getDocs(collection(db, 'financial_years'));
          for (const fyDoc of financialYearsSnap.docs) {
            const fy = fyDoc.id;
            try {
              const companyQuery = query(
                collection(db, 'financial_years', fy, 'companies'),
                where('companyId', '==', companyId)
              );
              const companySnapshot = await getDocs(companyQuery);
              if (!companySnapshot.empty) {
                companyData = companySnapshot.docs[0].data();
                break;
              }
            } catch (error) {
              continue;
            }
          }
        }
        
        if (companyData) {
          setCompany({ id: companyId, ...companyData });
        } else {
          setCompany({ 
            id: companyId, 
            name: 'Your Company', 
            companyId: companyId, 
            financialYear: userFY || '2026_2026' 
          });
        }
        
      } catch (error) {
        console.error('Error fetching company data:', error);
        toast.error('Failed to load company data');
      } finally {
        setLoading(false);
      }
    }
  }, [company, currentUser]);

  const loadUsersData = useCallback(async () => {
    if (!company?.id) return;
    
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('companyId', '==', company.id),
        where('role', 'in', ['driver', 'customer', 'supplier', 'restaurant'])
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      const usersData = usersSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      setUsers(usersData);
      
      // Separate by role
      const driversData = usersData.filter(u => u.role === 'driver');
      const customersData = usersData.filter(u => u.role === 'customer' || u.role === 'restaurant');
      const suppliersData = usersData.filter(u => u.role === 'supplier');
      
      setDrivers(driversData);
      setCustomers(customersData);
      setSuppliers(suppliersData);
      
      setStats(prev => ({
        ...prev,
        totalDrivers: driversData.length,
        totalCustomers: customersData.length,
        totalSuppliers: suppliersData.length,
        activeUsers: usersData.length
      }));
      
    } catch (error) {
      console.error('Error loading users data:', error);
      toast.error('Failed to load users data');
    }
  }, [company]);

  const loadDeliveriesData = useCallback(async () => {
    if (!company?.id) return;
    
    try {
      const deliveriesQuery = query(
        collection(db, 'deliveries'),
        where('companyId', '==', company.id)
      );
      
      const deliveriesSnapshot = await getDocs(deliveriesQuery);
      const deliveriesData = deliveriesSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      setDeliveries(deliveriesData);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const pendingDeliveries = deliveriesData.filter(d => 
        ['pending', 'assigned'].includes(d.status)
      ).length;
      
      const activeDeliveries = deliveriesData.filter(d => 
        ['picked_up', 'in_transit'].includes(d.status)
      ).length;
      
      const completedToday = deliveriesData.filter(d => {
        if (d.status !== 'delivered') return false;
        const deliveryDate = d.deliveryTime?.toDate ? 
          d.deliveryTime.toDate() : new Date(d.deliveryTime || 0);
        return deliveryDate >= today;
      }).length;
      
      setStats(prev => ({
        ...prev,
        pendingDeliveries,
        activeDeliveries,
        completedToday
      }));
      
    } catch (error) {
      console.error('Error loading deliveries:', error);
      toast.error('Failed to load deliveries');
    }
  }, [company]);

  const loadProductsData = useCallback(async () => {
    if (!company?.id) return;
    
    try {
      const productsQuery = query(
        collection(db, 'products'),
        where('companyId', '==', company.id)
      );
      
      const productsSnapshot = await getDocs(productsQuery);
      const productsData = productsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      setProducts(productsData);
      setStats(prev => ({
        ...prev,
        totalProducts: productsData.length
      }));
      
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    }
  }, [company]);

  const loadActivities = useCallback(async () => {
    if (!company?.id || !currentUser?.uid) return;
    
    try {
      const activitiesQuery = query(
        collection(db, 'activities'),
        where('companyId', '==', company.id),
        where('performedById', '==', currentUser.uid)
      );
      
      const activitiesSnapshot = await getDocs(activitiesQuery);
      const activitiesData = activitiesSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
          const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
          return dateB - dateA;
        });
      
      setActivities(activitiesData);
      
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  }, [company, currentUser]);

  // ============ REAL-TIME LISTENERS ============
  useEffect(() => {
    if (!company?.id) return;
    
    const usersQuery = query(
      collection(db, 'users'),
      where('companyId', '==', company.id)
    );
    
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const updatedUsers = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setUsers(updatedUsers);
      setDrivers(updatedUsers.filter(u => u.role === 'driver'));
      setCustomers(updatedUsers.filter(u => u.role === 'customer' || u.role === 'restaurant'));
      setSuppliers(updatedUsers.filter(u => u.role === 'supplier'));
    });
    
    const deliveriesQuery = query(
      collection(db, 'deliveries'),
      where('companyId', '==', company.id)
    );
    
    const unsubscribeDeliveries = onSnapshot(deliveriesQuery, (snapshot) => {
      const updatedDeliveries = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setDeliveries(updatedDeliveries);
    });
    
    return () => {
      unsubscribeUsers();
      unsubscribeDeliveries();
    };
  }, [company]);

  // ============ INITIAL LOADING ============
  useEffect(() => {
    loadCompanyData();
  }, [loadCompanyData]);

  useEffect(() => {
    if (company && company.id) {
      loadUsersData();
      loadDeliveriesData();
      loadProductsData();
      loadActivities();
    }
  }, [company, loadUsersData, loadDeliveriesData, loadProductsData, loadActivities]);

  // ============ HELPER FUNCTIONS ============
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ja-JP', { 
      year: 'numeric',
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#ff9800',
      'assigned': '#2196f3',
      'picked_up': '#673ab7',
      'in_transit': '#00bcd4',
      'delivered': '#4caf50',
      'cancelled': '#f44336',
      'active': '#4caf50',
      'inactive': '#9e9e9e'
    };
    return colors[status] || '#9e9e9e';
  };

  const getStatusBadgeStyle = (status) => {
    const color = getStatusColor(status);
    return {
      ...styles.statusBadge,
      backgroundColor: color,
      color: ['#ff9800', '#2196f3', '#00bcd4'].includes(color) ? '#000' : '#fff'
    };
  };

  const getActivityLabel = (action) => {
    const labels = {
      'USER_CREATED': '👤 User Created',
      'USER_UPDATED': '📝 User Updated',
      'USER_DELETED': '🗑️ User Deleted',
      'USER_STATUS_CHANGED': '🔄 User Status Changed',
      'DELIVERY_CREATED': '📦 Delivery Created',
      'DELIVERY_ASSIGNED': '👨‍✈️ Delivery Assigned',
      'DELIVERY_STATUS_CHANGED': '🔄 Delivery Status Changed',
      'DELIVERY_UPDATED': '✏️ Delivery Updated',
      'DELIVERY_DELETED': '🗑️ Delivery Deleted',
      'PRODUCT_CREATED': '📦 Product Created',
      'PRODUCT_UPDATED': '✏️ Product Updated',
      'PRODUCT_DELETED': '🗑️ Product Deleted',
      'STOCK_UPDATED': '📊 Stock Updated',
      'COMPANY_UPDATED': '🏢 Company Updated',
      'LOGIN': '🔐 Login',
      'LOGOUT': '🚪 Logout',
      'SETTINGS_UPDATED': '⚙️ Settings Updated',
      'REPORT_GENERATED': '📄 Report Generated'
    };
    return labels[action] || `📋 ${action.replace(/_/g, ' ')}`;
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  // ============ RENDER FUNCTIONS ============
  
  const renderLoading = () => (
    <div style={styles.loadingContainer}>
      <div style={styles.spinner}></div>
      <span style={{ marginLeft: '15px', color: '#3498db', fontWeight: '500' }}>
        Loading dashboard data...
      </span>
    </div>
  );

  const renderStatsCards = () => {
    const statCards = [
      { title: 'Total Drivers', value: stats.totalDrivers, icon: '👨‍✈️', color: '#3498db' },
      { title: 'Total Customers', value: stats.totalCustomers, icon: '👥', color: '#2ecc71' },
      { title: 'Total Suppliers', value: stats.totalSuppliers, icon: '🏢', color: '#9b59b6' },
      { title: 'Total Products', value: stats.totalProducts, icon: '📦', color: '#e74c3c' },
      { title: 'Pending Deliveries', value: stats.pendingDeliveries, icon: '⏳', color: '#f39c12' },
      { title: 'Active Deliveries', value: stats.activeDeliveries, icon: '🚚', color: '#1abc9c' },
    ];

    return (
      <div style={styles.statsGrid}>
        {statCards.map((stat, index) => (
          <div key={index} style={styles.statCard}>
            <div style={{...styles.statIcon, color: stat.color}}>
              {stat.icon}
            </div>
            <div style={{...styles.statValue, color: stat.color}}>
              {stat.value}
            </div>
            <div style={styles.statLabel}>
              {stat.title}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderDashboard = () => (
    <div>
      {/* Stats Cards */}
      {renderStatsCards()}
      
      {/* Quick Actions */}
      <div style={styles.quickActions}>
        <div 
          style={styles.quickActionButton}
          onClick={() => setActiveTab('ledger')}
        >
          <div style={{...styles.quickActionIcon, color: '#3498db'}}>📝</div>
          <div style={styles.quickActionText}>Register New</div>
        </div>
        <div 
          style={styles.quickActionButton}
          onClick={() => setActiveTab('invoice')}
        >
          <div style={{...styles.quickActionIcon, color: '#2ecc71'}}>🧾</div>
          <div style={styles.quickActionText}>Create Invoice</div>
        </div>
        <div 
          style={styles.quickActionButton}
          onClick={() => setActiveTab('sales-management')}
        >
          <div style={{...styles.quickActionIcon, color: '#9b59b6'}}>💰</div>
          <div style={styles.quickActionText}>Record Sale</div>
        </div>
        <div 
          style={styles.quickActionButton}
          onClick={() => setActiveTab('purchase-management')}
        >
          <div style={{...styles.quickActionIcon, color: '#e74c3c'}}>🛒</div>
          <div style={styles.quickActionText}>New Purchase</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Left Column */}
        <div style={{ flex: 2 }}>
          {/* Recent Activities */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Recent Activities</h3>
              <button 
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3498db',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                onClick={loadActivities}
              >
                ↻ Refresh
              </button>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {activities.slice(0, 8).map(activity => (
                <div key={activity.id} style={styles.activityItem}>
                  <div style={styles.activityText}>
                    <strong>{getActivityLabel(activity.action)}</strong>
                  </div>
                  <div style={styles.activityText}>
                    {activity.details?.description || 'No description'}
                  </div>
                  <div style={styles.activityTime}>
                    By: {activity.performedBy || 'Unknown'} • {formatDate(activity.timestamp)}
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#95a5a6' }}>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>📊</div>
                  <p>No activities recorded yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ flex: 1 }}>
          {/* Recent Deliveries */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Recent Deliveries</h3>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {deliveries.slice(0, 5).map(delivery => (
                <div key={delivery.id} style={styles.deliveryItem}>
                  <div style={styles.deliveryInfo}>
                    <div style={styles.deliveryName}>
                      {delivery.customerName || 'Unknown Customer'}
                    </div>
                    <div style={styles.deliveryAddress}>
                      {delivery.customerAddress?.slice(0, 25)}...
                    </div>
                    <div style={styles.deliveryTime}>
                      {formatDate(delivery.createdAt)}
                    </div>
                  </div>
                  <div>
                    <span style={getStatusBadgeStyle(delivery.status)}>
                      {delivery.status}
                    </span>
                  </div>
                </div>
              ))}
              
              {deliveries.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: '#95a5a6' }}>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>📦</div>
                  <p>No deliveries yet</p>
                </div>
              )}
            </div>
          </div>

          {/* System Info */}
          <div style={styles.systemInfo}>
            <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '16px' }}>
              System Information
            </h4>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Company:</span>
              <span style={styles.infoValue}>{company.name || 'Loading...'}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Financial Year:</span>
              <span style={styles.infoValue}>{company.financialYear || '2026'}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Last Updated:</span>
              <span style={styles.infoValue}>{formatDate(new Date())}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ============ MAIN RENDER ============
  return (
    <div style={styles.container}>
      <div style={{ padding: '20px' }}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '5px' }}>
                  🚚 Operator Dashboard
                </h1>
                <div style={{ opacity: 0.9, fontSize: '14px' }}>
                  {company.name || 'Company Loading...'} • {company.financialYear || 'FY 2026'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onClick={() => navigate('/profile')}
                >
                  👤 Profile
                </button>
                <button 
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onClick={handleSignOut}
                >
                  🚪 Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content with Sidebar */}
        <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
          {/* Left Sidebar - Vertical Tabs */}
          <div style={{ width: '250px' }}>
            <div style={styles.sidebar}>
              {/* Dashboard */}
              <div style={styles.sidebarSection}>
                <div style={styles.sidebarTitle}>MAIN</div>
                <button
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === 'dashboard' ? styles.tabButtonActive : {})
                  }}
                  onClick={() => setActiveTab('dashboard')}
                >
                  <span style={styles.tabIcon}>📊</span>
                  Dashboard
                </button>
              </div>

              {/* Category Management */}
              <div style={styles.sidebarSection}>
                <div style={styles.sidebarTitle}>CATEGORY MANAGEMENT</div>
                <button
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === 'category-management' ? styles.tabButtonActive : {})
                  }}
                  onClick={() => setActiveTab('category-management')}
                >
                  <span style={styles.tabIcon}>📁</span>
                  Category Management
                </button>
              </div>

              {/* Ledger */}
              <div style={styles.sidebarSection}>
                <div style={styles.sidebarTitle}>LEDGER</div>
                <button
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === 'ledger' ? styles.tabButtonActive : {})
                  }}
                  onClick={() => setActiveTab('ledger')}
                >
                  <span style={styles.tabIcon}>📝</span>
                  Master Registration
                </button>
                <button
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === 'customer-price-list' ? styles.tabButtonActive : {})
                  }}
                  onClick={() => setActiveTab('customer-price-list')}
                >
                  <span style={styles.tabIcon}>💰</span>
                  Customer Price List
                </button>
                <button
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === 'supplier-price-list' ? styles.tabButtonActive : {})
                  }}
                  onClick={() => setActiveTab('supplier-price-list')}
                >
                  <span style={styles.tabIcon}>🏢</span>
                  Supplier Price List
                </button>
              </div>

              {/* Daily Operations */}
              <div style={styles.sidebarSection}>
                <div style={styles.sidebarTitle}>DAILY OPERATIONS</div>
                <button
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === 'sales-management' ? styles.tabButtonActive : {})
                  }}
                  onClick={() => setActiveTab('sales-management')}
                >
                  <span style={styles.tabIcon}>💰</span>
                  Sales Management
                </button>
                <button
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === 'account-receivable' ? styles.tabButtonActive : {})
                  }}
                  onClick={() => setActiveTab('account-receivable')}
                >
                  <span style={styles.tabIcon}>📄</span>
                  Account Receivable
                </button>
                <button
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === 'purchase-management' ? styles.tabButtonActive : {})
                  }}
                  onClick={() => setActiveTab('purchase-management')}
                >
                  <span style={styles.tabIcon}>🛒</span>
                  Purchase Management
                </button>
                <button
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === 'account-payable' ? styles.tabButtonActive : {})
                  }}
                  onClick={() => setActiveTab('account-payable')}
                >
                  <span style={styles.tabIcon}>💳</span>
                  Account Payable
                </button>
                <button
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === 'inventory-management' ? styles.tabButtonActive : {})
                  }}
                  onClick={() => setActiveTab('inventory-management')}
                >
                  <span style={styles.tabIcon}>📦</span>
                  Inventory Management
                </button>
              </div>

              {/* Operations */}
              <div style={styles.sidebarSection}>
                <div style={styles.sidebarTitle}>OPERATIONS</div>
                <button
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === 'delivery-management' ? styles.tabButtonActive : {})
                  }}
                  onClick={() => setActiveTab('delivery-management')}
                >
                  <span style={styles.tabIcon}>🚚</span>
                  Delivery Management
                </button>
                <button
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === 'driver-assignments' ? styles.tabButtonActive : {})
                  }}
                  onClick={() => setActiveTab('driver-assignments')}
                >
                  <span style={styles.tabIcon}>👨‍✈️</span>
                  Driver Assignments
                </button>
                <button
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === 'delivery-tracking' ? styles.tabButtonActive : {})
                  }}
                  onClick={() => setActiveTab('delivery-tracking')}
                >
                  <span style={styles.tabIcon}>🗺️</span>
                  Delivery Tracking
                </button>
              </div>

              {/* Documents */}
              <div style={styles.sidebarSection}>
                <div style={styles.sidebarTitle}>DOCUMENTS</div>
                <button
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === 'invoice' ? styles.tabButtonActive : {})
                  }}
                  onClick={() => setActiveTab('invoice')}
                >
                  <span style={styles.tabIcon}>🧾</span>
                  Invoice Printing
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1 }}>
            <div style={styles.contentArea}>
              {loading ? renderLoading() : (
                <div>
                  {/* Dashboard Tab */}
                  {activeTab === 'dashboard' && renderDashboard()}

                  {/* Category Management Tab */}
                  {activeTab === 'category-management' && (
                    <CategoryManagement 
                      company={company}
                      currentUser={currentUser}
                    />
                  )}

                  {/* Ledger Tab */}
                  {activeTab === 'ledger' && (
                    <LedgerTab 
                      company={company}
                      currentUser={currentUser}
                      customers={customers}
                      suppliers={suppliers}
                      drivers={drivers}
                      products={products}
                      formatCurrency={formatCurrency}
                    />
                  )}

                  {/* Customer Price List */}
                  {activeTab === 'customer-price-list' && (
                    <div style={styles.card}>
                      <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>Customer Product Price List</h2>
                      <div style={{ textAlign: 'center', padding: '50px', color: '#95a5a6' }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>💰</div>
                        <p style={{ fontSize: '16px' }}>Customer price list functionality coming soon</p>
                      </div>
                    </div>
                  )}

                  {/* Supplier Price List */}
                  {activeTab === 'supplier-price-list' && (
                    <div style={styles.card}>
                      <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>Supplier Product Price List</h2>
                      <div style={{ textAlign: 'center', padding: '50px', color: '#95a5a6' }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🏢</div>
                        <p style={{ fontSize: '16px' }}>Supplier price list functionality coming soon</p>
                      </div>
                    </div>
                  )}

                  {/* Daily Operations - Sales Management */}
                  {activeTab === 'sales-management' && (
                    <SalesManagement 
                      company={company}
                      currentUser={currentUser}
                      customers={customers}
                      products={products}
                      formatCurrency={formatCurrency}
                    />
                  )}

                  {/* Account Receivable */}
                  {activeTab === 'account-receivable' && (
                    <AccountReceivableManagement 
                      company={company}
                      currentUser={currentUser}
                      customers={customers}
                      formatCurrency={formatCurrency}
                    />
                  )}

                  {/* Purchase Management */}
                  {activeTab === 'purchase-management' && (
                    <PurchaseManagement 
                      company={company}
                      currentUser={currentUser}
                      suppliers={suppliers}
                      products={products}
                      formatCurrency={formatCurrency}
                    />
                  )}

                  {/* Account Payable */}
                  {activeTab === 'account-payable' && (
                    <AccountPayableManagement 
                      company={company}
                      currentUser={currentUser}
                      suppliers={suppliers}
                      formatCurrency={formatCurrency}
                    />
                  )}

                  {/* Inventory Management */}
                  {activeTab === 'inventory-management' && (
                    <InventoryManagement 
                      company={company}
                      currentUser={currentUser}
                      products={products}
                      formatCurrency={formatCurrency}
                    />
                  )}

                  {/* Operations Tabs */}
                  {activeTab === 'delivery-management' && (
                    <DeliveryManagement 
                      deliveries={deliveries}
                      drivers={drivers}
                      formatDate={formatDate}
                      getStatusColor={getStatusColor}
                    />
                  )}

                  {activeTab === 'driver-assignments' && (
                    <DriverAssignments 
                      deliveries={deliveries.filter(d => d.status === 'pending' || d.status === 'assigned')}
                      drivers={drivers}
                    />
                  )}

                  {activeTab === 'delivery-tracking' && (
                    <DeliveryTrackingMap 
                      deliveries={deliveries.filter(d => ['assigned', 'picked_up', 'in_transit'].includes(d.status))}
                      drivers={drivers}
                    />
                  )}

                  {/* Invoice Printing */}
                  {activeTab === 'invoice' && (
                    <InvoicePrinting 
                      company={company}
                      currentUser={currentUser}
                      customers={customers}
                      products={products}
                      formatCurrency={formatCurrency}
                      formatDate={formatDate}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          © {new Date().getFullYear()} {company.name || 'Logistics System'} • 
          Operator Dashboard • 
          Last updated: {formatDate(new Date())}
        </div>
      </div>
    </div>
  );
};

// ⭐ FIXED: Changed to simple export - removed OperatorWithCSS duplication
export default Operator;