// components/Operator.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  collection, getDocs, query, where, onSnapshot, doc, updateDoc, 
  deleteDoc, serverTimestamp, getDoc, addDoc 
} from 'firebase/firestore';
import { db, auth, signOut } from '../firebase';
import { toast } from 'react-toastify';
import RegistrationTab from './RegistrationTab';
import ProductRegistration from './ProductRegistration'; // Your existing file

const Operator = ({ styles, selectedCompany, currentUser, companyLoading }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [company, setCompany] = useState(location.state?.company || selectedCompany);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalDrivers: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
    activeUsers: 0,
    totalProducts: 0,
    lowStockProducts: 0
  });
  const [showRegistrationDropdown, setShowRegistrationDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Fetch company data if not provided
  useEffect(() => {
    const fetchCompanyData = async () => {
      if ((!company || Object.keys(company).length === 0) && currentUser?.uid) {
        try {
          console.log('OperatorDashboard: Fetching company data...');
          setLoading(true);
          
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const companyId = userData.companyId;
            const userFY = userData.current_fy;
            
            if (companyId) {
              console.log('OperatorDashboard: Found user company data:', { companyId, userFY });
              
              let companyData = null;
              
              if (userFY) {
                try {
                  const companyDocRef = doc(db, 'financial_years', userFY, 'companies', companyId);
                  const companyDoc = await getDoc(companyDocRef);
                  if (companyDoc.exists()) {
                    companyData = companyDoc.data();
                    console.log('OperatorDashboard: Found company in financial_years:', companyData);
                  }
                } catch (error) {
                  console.log('OperatorDashboard: Company not found in financial_years');
                }
              }
              
              if (!companyData) {
                const companyQuery = query(
                  collection(db, 'companies'),
                  where('companyId', '==', companyId)
                );
                const companySnapshot = await getDocs(companyQuery);
                if (!companySnapshot.empty) {
                  companyData = companySnapshot.docs[0].data();
                  console.log('OperatorDashboard: Found company in main collection:', companyData);
                }
              }
              
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
                      console.log('OperatorDashboard: Found company in FY:', fy, companyData);
                      break;
                    }
                  } catch (error) {
                    continue;
                  }
                }
              }
              
              if (companyData) {
                setCompany({ id: companyId, ...companyData });
                console.log('OperatorDashboard: Company data loaded successfully');
              } else {
                console.error('OperatorDashboard: Company not found in any collection');
                setCompany({
                  id: companyId,
                  name: 'Your Company',
                  companyId: companyId,
                  financialYear: userFY || '2026_2026'
                });
              }
            }
          }
        } catch (error) {
          console.error('OperatorDashboard: Error fetching company data:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchCompanyData();
  }, [company, currentUser]);

  // Load users, activities, and products when company is available
  useEffect(() => {
    if (company && company.id) {
      console.log('OperatorDashboard: Company available, loading data...', company);
      loadUsersData();
      loadActivities();
      loadProductStats();
    }
  }, [company?.id]);

  // Load users from Firestore
  const loadUsersData = async () => {
    if (!company?.id) {
      console.log('OperatorDashboard: Cannot load users - no company ID');
      return;
    }

    try {
      setLoading(true);
      console.log('OperatorDashboard: Loading users for company:', company.id);
      
      const usersQuery = query(
        collection(db, 'users'),
        where('companyId', '==', company.id),
        where('role', 'in', ['driver', 'customer', 'supplier'])
      );
      const usersSnapshot = await getDocs(usersQuery);
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('OperatorDashboard: Users loaded:', usersData.length);
      setUsers(usersData);
      updateStats(usersData);
    } catch (error) {
      console.error('OperatorDashboard: Error loading users data:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Load operator's activities
  const loadActivities = async () => {
    if (!company?.id) return;

    try {
      const activitiesQuery = query(
        collection(db, 'activities'),
        where('companyId', '==', company.id),
        where('performedById', '==', currentUser?.uid)
      );
      const activitiesSnapshot = await getDocs(activitiesQuery);
      const activitiesData = activitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());
      
      setActivities(activitiesData);
    } catch (error) {
      console.error('OperatorDashboard: Error loading activities:', error);
    }
  };

  // Load product statistics
  const loadProductStats = async () => {
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

      // Count low stock products
      const lowStockCount = productsData.filter(product => {
        return product.currentStock <= product.stockLowerLimit;
      }).length;

      setStats(prev => ({
        ...prev,
        totalProducts: productsData.length,
        lowStockProducts: lowStockCount
      }));
    } catch (error) {
      console.error('OperatorDashboard: Error loading product stats:', error);
    }
  };

  // Update stats based on users and products
  const updateStats = (usersData) => {
    setStats(prev => ({
      ...prev,
      totalDrivers: usersData.filter(u => u.role === 'driver').length,
      totalCustomers: usersData.filter(u => u.role === 'customer').length,
      totalSuppliers: usersData.filter(u => u.role === 'supplier').length,
      activeUsers: usersData.length
    }));
  };

  // Log activity for admin tracking
  const logActivity = async (action, target, details = {}) => {
    try {
      const activityData = {
        action,
        target,
        details,
        performedBy: currentUser?.email || 'Unknown Operator',
        performedById: currentUser?.uid,
        userRole: 'operator',
        companyId: company.id,
        companyName: company.name || 'Unknown Company',
        timestamp: new Date()
      };

      await addDoc(collection(db, 'activities'), activityData);
      loadActivities();
    } catch (error) {
      console.error('OperatorDashboard: Error logging activity:', error);
    }
  };

  const getUsersByRole = (role) => {
    return users.filter(user => user.role === role);
  };

  // Operator can delete users
  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Are you sure you want to delete ${user.name}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', user.id));
      
      await logActivity('USER_DELETED', user.role, {
        deletedUserName: user.name,
        deletedUserMobile: user.mobileNumber || user.landlineNumber,
        deletedUserRole: user.role
      });

      toast.success('✅ User deleted successfully!');
      await loadUsersData();
    } catch (error) {
      console.error('OperatorDashboard: Error deleting user:', error);
      toast.error('Failed to delete user: ' + error.message);
    }
  };

  // Operator can toggle user status
  const handleToggleUserStatus = async (user) => {
    try {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'users', user.id), {
        status: newStatus,
        updatedAt: new Date()
      });

      await logActivity('USER_STATUS_CHANGED', user.role, {
        userName: user.name,
        userMobile: user.mobileNumber || user.landlineNumber,
        oldStatus: user.status,
        newStatus: newStatus
      });

      toast.success(`✅ User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully!`);
      await loadUsersData();
    } catch (error) {
      console.error('OperatorDashboard: Error updating user status:', error);
      toast.error('Failed to update user status: ' + error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp.toDate()).toLocaleString('ja-JP');
  };

  // Stat Card Component
  const StatCard = ({ value, label, color = '#10b981', icon, onClick }) => (
    <div 
      style={{...operatorStyles.statCard, cursor: onClick ? 'pointer' : 'default'}} 
      onClick={onClick}
    >
      <div style={operatorStyles.statHeader}>
        <div style={operatorStyles.statIcon}>{icon}</div>
        <div style={{...operatorStyles.statValue, color: color }}>
          {value}
        </div>
      </div>
      <div style={operatorStyles.statLabel}>
        {label}
      </div>
    </div>
  );

  // Show loading state
  if (!company || companyLoading) {
    return (
      <div style={operatorStyles.container}>
        <div style={operatorStyles.card}>
          <div style={operatorStyles.loadingSpinner}></div>
          <h3>Loading Company Data...</h3>
          <p>Please wait while we load your company information.</p>
          <p><small>Company ID: {currentUser?.companyId || 'Loading...'}</small></p>
          {companyLoading && <p>Fetching company details...</p>}
          <button 
            onClick={() => window.location.reload()}
            style={operatorStyles.primaryButton}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const renderDashboard = () => {
    return (
      <div>
        <div style={operatorStyles.section}>
          <h3 style={operatorStyles.sectionTitle}>Quick Overview - {company.name}</h3>
          <div style={operatorStyles.statsGrid}>
            <StatCard 
              value={stats.totalDrivers}
              label="Total Drivers"
              color="#10b981"
              icon="🚚"
              onClick={() => setActiveTab('drivers')}
            />
            
            <StatCard 
              value={stats.totalCustomers}
              label="Total Customers"
              color="#3b82f6"
              icon="👥"
              onClick={() => setActiveTab('customers')}
            />
            
            <StatCard 
              value={stats.totalSuppliers}
              label="Total Suppliers"
              color="#f59e0b"
              icon="🏭"
              onClick={() => setActiveTab('suppliers')}
            />
            
            <StatCard 
              value={stats.activeUsers}
              label="Active Users"
              color="#ef4444"
              icon="✅"
            />
          </div>
        </div>

        <div style={operatorStyles.section}>
          <h3 style={operatorStyles.sectionTitle}>Inventory Overview</h3>
          <div style={operatorStyles.statsGrid}>
            <StatCard 
              value={stats.totalProducts}
              label="Total Products"
              color="#8b5cf6"
              icon="📦"
              onClick={() => setActiveTab('product-registration')}
            />

            <StatCard 
              value={stats.lowStockProducts}
              label="Low Stock Items"
              color="#f59e0b"
              icon="⚠️"
            />

            <StatCard 
              value={stats.totalSuppliers}
              label="Active Suppliers"
              color="#10b981"
              icon="🏭"
              onClick={() => setActiveTab('suppliers')}
            />

            <StatCard 
              value={users.filter(u => u.status === 'active').length}
              label="Active Users"
              color="#3b82f6"
              icon="🟢"
            />
          </div>
        </div>

        {activities.length > 0 && (
          <div style={operatorStyles.section}>
            <h3 style={operatorStyles.sectionTitle}>Your Recent Activities</h3>
            <div style={operatorStyles.activitiesList}>
              {activities.slice(0, 5).map(activity => (
                <div key={activity.id} style={operatorStyles.activityItem}>
                  <div style={operatorStyles.activityHeader}>
                    <span style={operatorStyles.activityAction}>{getActivityLabel(activity.action)}</span>
                    <span style={operatorStyles.activityTime}>{formatDate(activity.timestamp)}</span>
                  </div>
                  <div style={operatorStyles.activityDetails}>
                    {activity.details.userName && (
                      <span>User: {activity.details.userName} ({activity.details.userMobile || activity.details.landlineNumber})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {activities.length > 5 && (
              <button 
                onClick={() => setActiveTab('activities')}
                style={operatorStyles.viewAllButton}
              >
                View All Your Activities
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderUserManagement = (users, role, color) => {
    const title = role === 'customer' ? 'Customers' : 
                  role === 'driver' ? 'Drivers' : 
                  'Suppliers';
    
    return (
      <div>
        <div style={operatorStyles.userManagementHeader}>
          <div>
            <h3 style={operatorStyles.sectionTitle}>
              {title} Management - {company.name}
            </h3>
            <div style={operatorStyles.userCount}>Total: {users.length}</div>
          </div>
        </div>

        {users.length === 0 ? (
          <div style={operatorStyles.emptyState}>
            <div style={operatorStyles.emptyStateIcon}>👥</div>
            <h4>No {title} Found</h4>
            <p>Create your first {title.slice(0, -1)} to get started.</p>
            <button 
              onClick={() => {
                setActiveTab(`${role}-registration`);
                setShowRegistrationDropdown(true);
              }}
              style={{ ...operatorStyles.primaryButton, backgroundColor: color }}
            >
              Create First {title.slice(0, -1)}
            </button>
          </div>
        ) : (
          <div style={operatorStyles.userList}>
            {users.map(user => (
              <div key={user.id} style={operatorStyles.userItem}>
                <div style={operatorStyles.userInfo}>
                  <div style={operatorStyles.userMain}>
                    <div style={operatorStyles.userName}>
                      {user.name}
                      <span style={{ ...operatorStyles.roleBadge, backgroundColor: color }}>
                        {user.role}
                      </span>
                      <span style={user.status === 'active' ? operatorStyles.activeBadge : operatorStyles.inactiveBadge}>
                        {user.status}
                      </span>
                    </div>
                  </div>
                  <div style={operatorStyles.userDetails}>
                    <div style={operatorStyles.userDetail}>
                      📱 {user.mobileNumber || user.landlineNumber || 'No phone'}
                    </div>
                    {user.email && <div style={operatorStyles.userDetail}>📧 {user.email}</div>}
                    {user.vehicleNumber && (
                      <div style={operatorStyles.userDetail}>🚚 Vehicle: {user.vehicleNumber}</div>
                    )}
                    {user.licenseNumber && (
                      <div style={operatorStyles.userDetail}>📄 License: {user.licenseNumber}</div>
                    )}
                    {user.createdBy && (
                      <div style={operatorStyles.userDetail}>👤 Created by: {user.createdBy}</div>
                    )}
                  </div>
                  <div style={operatorStyles.userDate}>
                    Created: {user.createdAt ? 
                      new Date(user.createdAt.toDate()).toLocaleDateString('ja-JP') : 
                      'N/A'
                    }
                  </div>
                </div>
                <div style={operatorStyles.userActions}>
                  <button 
                    onClick={() => handleToggleUserStatus(user)}
                    style={user.status === 'active' ? operatorStyles.deactivateButton : operatorStyles.activateButton}
                  >
                    {user.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button 
                    onClick={() => handleDeleteUser(user)}
                    style={operatorStyles.deleteButton}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderActivities = () => (
    <div>
      <div style={operatorStyles.section}>
        <h3 style={operatorStyles.sectionTitle}>Your Activity Log - {company.name}</h3>
        <p style={operatorStyles.formDescription}>
          All your activities are logged here for monitoring and audit purposes.
        </p>

        {activities.length === 0 ? (
          <div style={operatorStyles.emptyState}>
            <div style={operatorStyles.emptyStateIcon}>📋</div>
            <h4>No Activities Yet</h4>
            <p>Your activities will appear here once you start managing users.</p>
          </div>
        ) : (
          <div style={operatorStyles.activitiesListFull}>
            {activities.map(activity => (
              <div key={activity.id} style={operatorStyles.activityItem}>
                <div style={operatorStyles.activityHeader}>
                  <span style={operatorStyles.activityAction}>{getActivityLabel(activity.action)}</span>
                  <span style={operatorStyles.activityTime}>{formatDate(activity.timestamp)}</span>
                </div>
                <div style={operatorStyles.activityDetails}>
                  {activity.details.userName && (
                    <span><strong>User:</strong> {activity.details.userName} ({activity.details.userMobile || activity.details.landlineNumber})</span>
                  )}
                  {activity.details.oldStatus && (
                    <span><strong>Status Change:</strong> {activity.details.oldStatus} → {activity.details.newStatus}</span>
                  )}
                  {activity.details.vehicleNumber && (
                    <span><strong>Vehicle:</strong> {activity.details.vehicleNumber}</span>
                  )}
                  {activity.details.licenseNumber && (
                    <span><strong>License:</strong> {activity.details.licenseNumber}</span>
                  )}
                  {activity.details.productName && (
                    <span><strong>Product:</strong> {activity.details.productName}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderDailyOperations = () => (
    <div>
      <div style={operatorStyles.section}>
        <h3 style={operatorStyles.sectionTitle}>Daily Operations - {company.name}</h3>
        <p style={operatorStyles.formDescription}>
          Manage daily activities and operations for your restaurant.
        </p>
        
        <div style={operatorStyles.operationsGrid}>
          <div style={operatorStyles.operationCard}>
            <div style={operatorStyles.operationIcon}>📦</div>
            <h4 style={operatorStyles.operationTitle}>Product Management</h4>
            <p style={operatorStyles.operationDescription}>Add and manage restaurant inventory products</p>
            <button 
              style={operatorStyles.operationButton}
              onClick={() => setActiveTab('product-registration')}
            >
              Manage Products
            </button>
          </div>
          
          <div style={operatorStyles.operationCard}>
            <div style={operatorStyles.operationIcon}>🛒</div>
            <h4 style={operatorStyles.operationTitle}>Order Management</h4>
            <p style={operatorStyles.operationDescription}>Create and track customer orders</p>
            <button 
              style={operatorStyles.operationButton}
              onClick={() => {/* Add order management logic */}}
            >
              Manage Orders
            </button>
          </div>
          
          <div style={operatorStyles.operationCard}>
            <div style={operatorStyles.operationIcon}>🚚</div>
            <h4 style={operatorStyles.operationTitle}>Delivery Tracking</h4>
            <p style={operatorStyles.operationDescription}>Track driver deliveries in real-time</p>
            <button style={operatorStyles.operationButton}>Track Deliveries</button>
          </div>
          
          <div style={operatorStyles.operationCard}>
            <div style={operatorStyles.operationIcon}>💰</div>
            <h4 style={operatorStyles.operationTitle}>Payment Collection</h4>
            <p style={operatorStyles.operationDescription}>Record and track payments</p>
            <button style={operatorStyles.operationButton}>Manage Payments</button>
          </div>

          <div style={operatorStyles.operationCard}>
            <div style={operatorStyles.operationIcon}>📊</div>
            <h4 style={operatorStyles.operationTitle}>Inventory Reports</h4>
            <p style={operatorStyles.operationDescription}>View inventory stock and reports</p>
            <button style={operatorStyles.operationButton}>View Reports</button>
          </div>

          <div style={operatorStyles.operationCard}>
            <div style={operatorStyles.operationIcon}>⚠️</div>
            <h4 style={operatorStyles.operationTitle}>Stock Alerts</h4>
            <p style={operatorStyles.operationDescription}>Monitor low stock items</p>
            <button 
              style={operatorStyles.operationButton}
              onClick={() => {/* Add stock alerts logic */}}
            >
              View Alerts
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Helper function to get activity labels
  const getActivityLabel = (action) => {
    const labels = {
      'USER_CREATED': '👤 User Created',
      'USER_DELETED': '🗑️ User Deleted',
      'USER_STATUS_CHANGED': '🔄 Status Changed',
      'RESTAURANT_CREATED': '🍽️ Restaurant Created',
      'SUPPLIER_CREATED': '🏭 Supplier Created',
      'DRIVER_CREATED': '🚚 Driver Created',
      'PRODUCT_CREATED': '📦 Product Created',
      'PRODUCT_UPDATED': '📝 Product Updated',
      'ORDER_CREATED': '🛒 Order Created',
      'ORDER_COMPLETED': '✅ Order Completed',
      'PAYMENT_RECEIVED': '💰 Payment Received',
      'STOCK_ALERT': '⚠️ Stock Alert'
    };
    return labels[action] || action;
  };

  // Handle registration type selection
  const renderRegistrationContent = (type) => {
    return (
      <div>
        <div style={operatorStyles.registrationHeader}>
          <h2 style={operatorStyles.registrationTitle}>
            {type === 'driver' && '🚚 Driver Registration'}
            {type === 'restaurant' && '🍽️ Restaurant Registration'}
            {type === 'supplier' && '🏭 Supplier Registration'}
          </h2>
          
          <div style={operatorStyles.registrationTypeTabs}>
            <button
              style={{
                ...operatorStyles.registrationTypeTab,
                ...(type === 'driver' && operatorStyles.activeRegistrationTypeTab)
              }}
              onClick={() => setActiveTab('driver-registration')}
            >
              🚚 Driver
            </button>
            <button
              style={{
                ...operatorStyles.registrationTypeTab,
                ...(type === 'restaurant' && operatorStyles.activeRegistrationTypeTab)
              }}
              onClick={() => setActiveTab('restaurant-registration')}
            >
              🍽️ Restaurant
            </button>
            <button
              style={{
                ...operatorStyles.registrationTypeTab,
                ...(type === 'supplier' && operatorStyles.activeRegistrationTypeTab)
              }}
              onClick={() => setActiveTab('supplier-registration')}
            >
              🏭 Supplier
            </button>
          </div>
        </div>

        <RegistrationTab 
          currentUser={currentUser}
          company={company}
          loadUsersData={loadUsersData}
          logActivity={logActivity}
          defaultType={type}
        />
      </div>
    );
  };

  return (
    <div style={operatorStyles.operatorContainer}>
      {/* Sidebar */}
      <div style={operatorStyles.sidebar}>
        <div style={operatorStyles.sidebarHeader}>
          <h2 style={operatorStyles.companyName}>{company?.name || 'Company'}</h2>
          <p style={operatorStyles.operatorName}>
            <strong>Operator:</strong> {currentUser?.email || 'Unknown User'}
          </p>
        </div>
        
        <div style={operatorStyles.sidebarMenu}>
          <button 
            style={{ 
              ...operatorStyles.sidebarButton,
              ...(activeTab === 'dashboard' && operatorStyles.activeSidebarButton)
            }}
            onClick={() => setActiveTab('dashboard')}
          >
            <span style={operatorStyles.sidebarIcon}>📊</span>
            Dashboard
          </button>
          
          <div style={operatorStyles.sidebarDropdown}>
            <button 
              style={{ 
                ...operatorStyles.sidebarButton,
                ...(activeTab.startsWith('registration') && operatorStyles.activeSidebarButton)
              }}
              onClick={() => setShowRegistrationDropdown(!showRegistrationDropdown)}
            >
              <span style={operatorStyles.sidebarIcon}>📝</span>
              Registration
              <span style={operatorStyles.dropdownArrow}>
                {showRegistrationDropdown ? '▲' : '▼'}
              </span>
            </button>
            
            {showRegistrationDropdown && (
              <div style={operatorStyles.sidebarDropdownMenu}>
                <button 
                  style={operatorStyles.sidebarDropdownItem}
                  onClick={() => {
                    setActiveTab('driver-registration');
                    setShowRegistrationDropdown(false);
                  }}
                >
                  🚚 Driver
                </button>
                <button 
                  style={operatorStyles.sidebarDropdownItem}
                  onClick={() => {
                    setActiveTab('restaurant-registration');
                    setShowRegistrationDropdown(false);
                  }}
                >
                  🍽️ Restaurant
                </button>
                <button 
                  style={operatorStyles.sidebarDropdownItem}
                  onClick={() => {
                    setActiveTab('supplier-registration');
                    setShowRegistrationDropdown(false);
                  }}
                >
                  🏭 Supplier
                </button>
                {/* PRODUCT REGISTRATION IN DROPDOWN */}
                <button 
                  style={operatorStyles.sidebarDropdownItem}
                  onClick={() => {
                    setActiveTab('product-registration');
                    setShowRegistrationDropdown(false);
                  }}
                >
                  📦 Product Registration
                </button>
              </div>
            )}
          </div>
          
          <div style={operatorStyles.sidebarDropdown}>
            <button 
              style={{ 
                ...operatorStyles.sidebarButton,
                ...(activeTab.startsWith('drivers') || 
                    activeTab.startsWith('customers') || 
                    activeTab.startsWith('suppliers') ? operatorStyles.activeSidebarButton : {})
              }}
              onClick={() => setShowUserDropdown(!showUserDropdown)}
            >
              <span style={operatorStyles.sidebarIcon}>👥</span>
              User Management
              <span style={operatorStyles.dropdownArrow}>
                {showUserDropdown ? '▲' : '▼'}
              </span>
            </button>
            
            {showUserDropdown && (
              <div style={operatorStyles.sidebarDropdownMenu}>
                <button 
                  style={operatorStyles.sidebarDropdownItem}
                  onClick={() => {
                    setActiveTab('drivers');
                    setShowUserDropdown(false);
                  }}
                >
                  🚚 Drivers ({getUsersByRole('driver').length})
                </button>
                <button 
                  style={operatorStyles.sidebarDropdownItem}
                  onClick={() => {
                    setActiveTab('customers');
                    setShowUserDropdown(false);
                  }}
                >
                  👥 Customers ({getUsersByRole('customer').length})
                </button>
                <button 
                  style={operatorStyles.sidebarDropdownItem}
                  onClick={() => {
                    setActiveTab('suppliers');
                    setShowUserDropdown(false);
                  }}
                >
                  🏭 Suppliers ({getUsersByRole('supplier').length})
                </button>
              </div>
            )}
          </div>
          
          {/* SEPARATE PRODUCT REGISTRATION BUTTON */}
          <button 
            style={{ 
              ...operatorStyles.sidebarButton,
              ...(activeTab === 'product-registration' && operatorStyles.activeSidebarButton)
            }}
            onClick={() => setActiveTab('product-registration')}
          >
            <span style={operatorStyles.sidebarIcon}>📦</span>
            Product Registration
          </button>
          
          <button 
            style={{ 
              ...operatorStyles.sidebarButton,
              ...(activeTab === 'daily-operations' && operatorStyles.activeSidebarButton)
            }}
            onClick={() => setActiveTab('daily-operations')}
          >
            <span style={operatorStyles.sidebarIcon}>⚡</span>
            Daily Operations
          </button>
          
          <button 
            style={{ 
              ...operatorStyles.sidebarButton,
              ...(activeTab === 'activities' && operatorStyles.activeSidebarButton)
            }}
            onClick={() => setActiveTab('activities')}
          >
            <span style={operatorStyles.sidebarIcon}>📋</span>
            Activities ({activities.length})
          </button>
        </div>
        
        <div style={operatorStyles.sidebarFooter}>
          <button onClick={handleSignOut} style={operatorStyles.signOutButton}>
            <span style={operatorStyles.sidebarIcon}>🚪</span>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={operatorStyles.mainContentArea}>
        <div style={operatorStyles.mainHeader}>
          <h1 style={operatorStyles.mainTitle}>
            {activeTab === 'dashboard' && '📊 Dashboard'}
            {activeTab === 'driver-registration' && '🚚 Driver Registration'}
            {activeTab === 'restaurant-registration' && '🍽️ Restaurant Registration'}
            {activeTab === 'supplier-registration' && '🏭 Supplier Registration'}
            {activeTab === 'product-registration' && '📦 Product Registration'}
            {activeTab === 'drivers' && '🚚 Drivers Management'}
            {activeTab === 'customers' && '👥 Customers Management'}
            {activeTab === 'suppliers' && '🏭 Suppliers Management'}
            {activeTab === 'daily-operations' && '⚡ Daily Operations'}
            {activeTab === 'activities' && '📋 Activity Log'}
          </h1>
          <div style={operatorStyles.headerStats}>
            <span style={operatorStyles.statBadge}>🚚 {stats.totalDrivers}</span>
            <span style={operatorStyles.statBadge}>👥 {stats.totalCustomers}</span>
            <span style={operatorStyles.statBadge}>🏭 {stats.totalSuppliers}</span>
            <span style={operatorStyles.statBadge}>📦 {stats.totalProducts}</span>
          </div>
        </div>

        <div style={operatorStyles.contentContainer}>
          {loading ? (
            <div style={operatorStyles.loadingState}>
              <div style={operatorStyles.loadingSpinner}></div>
              <p>Loading...</p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'driver-registration' && renderRegistrationContent('driver')}
              {activeTab === 'restaurant-registration' && renderRegistrationContent('restaurant')}
              {activeTab === 'supplier-registration' && renderRegistrationContent('supplier')}
              {/* USING YOUR EXISTING PRODUCTREGISTRATION.JSX */}
              {activeTab === 'product-registration' && <ProductRegistration />}
              {activeTab === 'drivers' && renderUserManagement(getUsersByRole('driver'), 'driver', '#10b981')}
              {activeTab === 'customers' && renderUserManagement(getUsersByRole('customer'), 'customer', '#8b5cf6')}
              {activeTab === 'suppliers' && renderUserManagement(getUsersByRole('supplier'), 'supplier', '#f59e0b')}
              {activeTab === 'daily-operations' && renderDailyOperations()}
              {activeTab === 'activities' && renderActivities()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Modern Blue and Black Theme Styles
const operatorStyles = {
  operatorContainer: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f8fafc'
  },
  // Sidebar Styles
  sidebar: {
    width: '280px',
    backgroundColor: '#1e293b',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
    position: 'sticky',
    top: 0,
    height: '100vh'
  },
  sidebarHeader: {
    padding: '25px 20px',
    borderBottom: '1px solid #334155',
    backgroundColor: '#0f172a'
  },
  companyName: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '5px',
    color: '#60a5fa'
  },
  operatorName: {
    fontSize: '13px',
    color: '#cbd5e1',
    margin: 0
  },
  sidebarMenu: {
    flex: 1,
    padding: '20px 0',
    overflowY: 'auto'
  },
  sidebarButton: {
    width: '100%',
    padding: '12px 20px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#cbd5e1',
    fontSize: '14px',
    fontWeight: '500',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: '#334155',
      color: 'white'
    }
  },
  activeSidebarButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    fontWeight: '600',
    borderLeft: '4px solid #60a5fa'
  },
  sidebarIcon: {
    fontSize: '16px',
    width: '20px'
  },
  sidebarDropdown: {
    position: 'relative'
  },
  dropdownArrow: {
    marginLeft: 'auto',
    fontSize: '10px'
  },
  sidebarDropdownMenu: {
    backgroundColor: '#0f172a',
    borderLeft: '3px solid #3b82f6',
    marginLeft: '10px'
  },
  sidebarDropdownItem: {
    width: '100%',
    padding: '10px 20px 10px 50px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#cbd5e1',
    fontSize: '13px',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: '#1e293b',
      color: 'white'
    }
  },
  sidebarFooter: {
    padding: '20px',
    borderTop: '1px solid #334155',
    backgroundColor: '#0f172a'
  },
  signOutButton: {
    width: '100%',
    padding: '10px 15px',
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#b91c1c'
    }
  },
  // Main Content Area
  mainContentArea: {
    flex: 1,
    padding: '25px',
    overflowY: 'auto',
    backgroundColor: '#f1f5f9'
  },
  mainHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '25px',
    paddingBottom: '15px',
    borderBottom: '2px solid #e2e8f0',
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  mainTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#1e293b',
    margin: 0
  },
  headerStats: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  statBadge: {
    backgroundColor: '#e2e8f0',
    color: '#475569',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  },
  contentContainer: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '25px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    minHeight: 'calc(100vh - 180px)'
  },
  // Common Components
  section: {
    marginBottom: '30px'
  },
  sectionTitle: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '20px',
    paddingBottom: '10px',
    borderBottom: '2px solid #3b82f6'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  statCard: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '22px',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    transition: 'all 0.2s',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      borderColor: '#3b82f6'
    }
  },
  statHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '15px',
    marginBottom: '10px'
  },
  statIcon: {
    fontSize: '28px'
  },
  statValue: {
    fontSize: '34px',
    fontWeight: 'bold'
  },
  statLabel: {
    color: '#64748b',
    fontSize: '15px',
    fontWeight: '500'
  },
  // User Management
  userManagementHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '25px',
    flexWrap: 'wrap',
    gap: '15px'
  },
  userCount: {
    color: '#64748b',
    fontSize: '15px',
    fontWeight: '500'
  },
  userList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  userItem: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '20px',
    transition: 'all 0.2s',
    '&:hover': {
      borderColor: '#3b82f6',
      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
    }
  },
  userInfo: {
    flex: 1
  },
  userMain: {
    marginBottom: '10px'
  },
  userName: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '8px'
  },
  roleBadge: {
    color: 'white',
    padding: '3px 10px',
    borderRadius: '15px',
    fontSize: '11px',
    fontWeight: '600'
  },
  activeBadge: {
    backgroundColor: '#10b981',
    color: 'white',
    padding: '3px 10px',
    borderRadius: '15px',
    fontSize: '11px',
    fontWeight: '600'
  },
  inactiveBadge: {
    backgroundColor: '#64748b',
    color: 'white',
    padding: '3px 10px',
    borderRadius: '15px',
    fontSize: '11px',
    fontWeight: '600'
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    marginBottom: '10px'
  },
  userDetail: {
    color: '#64748b',
    fontSize: '13px'
  },
  userDate: {
    color: '#94a3b8',
    fontSize: '12px'
  },
  userActions: {
    display: 'flex',
    gap: '10px',
    flexDirection: 'column',
    minWidth: '120px'
  },
  activateButton: {
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#059669'
    }
  },
  deactivateButton: {
    backgroundColor: '#f59e0b',
    color: 'white',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#d97706'
    }
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#dc2626'
    }
  },
  // Activities
  activitiesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  activitiesListFull: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    maxHeight: '600px',
    overflowY: 'auto',
    paddingRight: '10px'
  },
  activityItem: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '18px'
  },
  activityHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    flexWrap: 'wrap',
    gap: '10px'
  },
  activityAction: {
    fontWeight: '600',
    color: '#1e293b',
    fontSize: '15px'
  },
  activityTime: {
    color: '#64748b',
    fontSize: '13px'
  },
  activityDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    fontSize: '14px',
    color: '#475569'
  },
  // Daily Operations
  operationsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '25px',
    marginTop: '20px'
  },
  operationCard: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '25px',
    textAlign: 'center',
    transition: 'all 0.3s',
    '&:hover': {
      transform: 'translateY(-5px)',
      boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
      borderColor: '#3b82f6'
    }
  },
  operationIcon: {
    fontSize: '48px',
    marginBottom: '20px',
    color: '#3b82f6'
  },
  operationTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '12px'
  },
  operationDescription: {
    color: '#64748b',
    fontSize: '14px',
    marginBottom: '25px',
    lineHeight: '1.5',
    minHeight: '40px'
  },
  operationButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    width: '100%',
    '&:hover': {
      backgroundColor: '#2563eb'
    }
  },
  // Registration
  registrationHeader: {
    marginBottom: '25px'
  },
  registrationTitle: {
    fontSize: '26px',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '20px'
  },
  registrationTypeTabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '25px',
    flexWrap: 'wrap'
  },
  registrationTypeTab: {
    backgroundColor: 'white',
    border: '2px solid #e2e8f0',
    padding: '12px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '500',
    color: '#64748b',
    transition: 'all 0.2s'
  },
  activeRegistrationTypeTab: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#3b82f6'
  },
  // Common
  formDescription: {
    color: '#64748b',
    marginBottom: '25px',
    fontSize: '15px',
    lineHeight: '1.6'
  },
  emptyState: {
    textAlign: 'center',
    padding: '50px 30px',
    color: '#64748b',
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    border: '2px dashed #e2e8f0'
  },
  emptyStateIcon: {
    fontSize: '60px',
    marginBottom: '20px',
    opacity: '0.5'
  },
  viewAllButton: {
    backgroundColor: 'transparent',
    border: '2px solid #3b82f6',
    color: '#3b82f6',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
    marginTop: '15px',
    '&:hover': {
      backgroundColor: '#3b82f6',
      color: 'white'
    }
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#2563eb'
    }
  },
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px',
    backgroundColor: '#f1f5f9'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '35px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
    textAlign: 'center',
    maxWidth: '450px',
    width: '100%'
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '50px',
    color: '#64748b'
  },
  loadingSpinner: {
    width: '50px',
    height: '50px',
    border: '4px solid #f1f5f9',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px'
  },
  loadingSpinnerSmall: {
    width: '18px',
    height: '18px',
    border: '2px solid #f1f5f9',
    borderTop: '2px solid #ffffff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }
};

// CSS Injection
const OperatorWithCSS = (props) => {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const spinnerStyles = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;

      if (!document.getElementById('operator-spinner-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'operator-spinner-styles';
        styleElement.textContent = spinnerStyles;
        document.head.appendChild(styleElement);
      }
    }
  }, []);

  return <Operator {...props} />;
};

export default OperatorWithCSS;