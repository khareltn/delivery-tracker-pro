import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, getDocs, query, where, onSnapshot, doc, updateDoc, deleteDoc, addDoc, setDoc
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = ({ fy: propFy }) => {
  const navigate = useNavigate();
  const authCtx = useAuth();
  const logout = authCtx?.logout || (() => Promise.resolve());

  const [fy, setFy] = useState(propFy || '');
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    orders: 0, revenue: 0, operators: 0, drivers: 0, customers: 0, suppliers: 0
  });
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [userType, setUserType] = useState('operator');
  const [userForm, setUserForm] = useState({ name: '', email: '', phone: '', password: '', role: 'operator' });
  const [userLoading, setUserLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  useEffect(() => {
  if (propFy) {
    setFy(propFy);
    sessionStorage.setItem('selectedFY', propFy);
  } else {
    const saved = sessionStorage.getItem('selectedFY');
    if (saved) {
      setFy(saved);
    }
  }
}, [propFy]);

  const loadData = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const uid = auth.currentUser.uid;
      const compQ = query(collection(db, 'financial_years', fy, 'companies'), where('ownerId', '==', uid));
      const compSnap = await getDocs(compQ);
      const compData = compSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCompanies(compData);
      if (compData.length > 0) setSelectedCompany(compData[0]);

      const companyIds = compData.map(c => c.companyId || c.id);
      if (companyIds.length > 0) {
        const usersQ = query(collection(db, 'users'), where('companyId', 'in', companyIds));
        const usersSnap = await getDocs(usersQ);
        const usersData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setUsers(usersData);
        setStats(prev => ({
          ...prev,
          operators: usersData.filter(u => u.role === 'operator').length,
          drivers:   usersData.filter(u => u.role === 'driver').length,
          customers: usersData.filter(u => u.role === 'customer').length,
          suppliers: usersData.filter(u => u.role === 'supplier').length
        }));
      }
    } catch (err) {
      toast.error('Failed to load data: ' + err.message);
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
    }
  }, [fy]);

  useEffect(() => { loadData(); }, [fy, loadData]);

  const editCompany = comp => navigate('/company-reg', { state: { company: comp, fy } });
  const deleteCompany = async id => {
    if (!window.confirm('Delete this company?')) return;
    try {
      await deleteDoc(doc(db, 'financial_years', fy, 'companies', id));
      toast.success('Company deleted');
      loadData();
    } catch (err) { toast.error('Delete failed: ' + err.message); }
  };

  const handleAddUser = async e => {
    e.preventDefault();
    if (!selectedCompany) { toast.error('No company selected'); return; }
    setUserLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, userForm.email, userForm.password);
      const uid = cred.user.uid;
      await setDoc(doc(db, 'users', uid), {
        uid, email: userForm.email, role: userType,
        companyId: selectedCompany.companyId || selectedCompany.id,
        fyId: fy, createdAt: new Date(),
        displayName: userForm.name, phone: userForm.phone
      });
      const roleCol = userType === 'customer' ? 'customers' : userType === 'supplier' ? 'suppliers' : 'operators';
      await setDoc(doc(db, 'financial_years', fy, roleCol, uid), {
        userId: uid, companyId: selectedCompany.companyId || selectedCompany.id,
        name: userForm.name, email: userForm.email, phone: userForm.phone,
        role: userType, createdBy: auth.currentUser.uid, createdAt: new Date(), status: 'active',
        ...(userType === 'operator' && { permissions: ['view_orders', 'assign_drivers', 'manage_deliveries'], assignedTasks: [] }),
        ...(userType === 'driver' && { vehicleInfo: {}, licenseNumber: '', deliveryStats: { completed: 0, inProgress: 0 } }),
        ...(userType === 'customer' && { address: '', billingInfo: {}, orderHistory: [] }),
        ...(userType === 'supplier' && { products: [], deliverySchedule: {}, paymentTerms: 'net-30', rating: 0 })
      });
      toast.success(`${userForm.name} added as ${userType}! Login credentials created.`);
      setUserForm({ name: '', email: '', phone: '', password: '', role: userType });
      setShowAddUser(false); loadData();
    } catch (err) {
      console.error('Add user error:', err);
      if (err.code === 'auth/email-already-in-use') toast.error('Email already exists. Please use a different email.');
      else if (err.code === 'auth/weak-password') toast.error('Password should be at least 6 characters.');
      else toast.error('Failed to create user: ' + err.message);
    } finally { setUserLoading(false); }
  };

  const deleteUser = async (userId, userName) => {
    if (!window.confirm(`Delete user "${userName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      for (const role of ['operators', 'drivers', 'customers', 'suppliers'])
        try { await deleteDoc(doc(db, 'financial_years', fy, role, userId)); } catch {}
      toast.success('User deleted successfully!'); loadData();
    } catch (err) { toast.error('Delete failed: ' + err.message); }
  };

  const formatJPY = amt => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amt || 0);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const StatCard = ({ value, label, color = '#10b981', icon }) => (
    <div style={adminStyles.statCard}>
      <div style={adminStyles.statHeader}>
        <div style={adminStyles.statIcon}>{icon}</div>
        <div style={{...adminStyles.statValue, color: color }}>
          {value}
        </div>
      </div>
      <div style={adminStyles.statLabel}>
        {label}
      </div>
    </div>
  );

  const renderDashboard = () => {
    return (
      <div>
        <div style={adminStyles.section}>
          <h3 style={adminStyles.sectionTitle}>Overview - Financial Year: {fy}</h3>
          <div style={adminStyles.statsGrid}>
            <StatCard 
              value={stats.orders}
              label="Total Orders"
              color="#10b981"
              icon="📦"
            />
            
            <StatCard 
              value={formatJPY(stats.revenue)}
              label="Revenue"
              color="#3b82f6"
              icon="💰"
            />
            
            <StatCard 
              value={stats.operators}
              label="Operators"
              color="#f59e0b"
              icon="👨‍💼"
            />
            
            <StatCard 
              value={stats.drivers}
              label="Drivers"
              color="#ef4444"
              icon="🚚"
            />
          </div>
          <div style={adminStyles.statsGrid}>
            <StatCard 
              value={stats.customers}
              label="Customers"
              color="#8b5cf6"
              icon="👥"
            />
            
            <StatCard 
              value={stats.suppliers}
              label="Suppliers"
              color="#06b6d4"
              icon="🏭"
            />
          </div>
        </div>

        <div style={adminStyles.section}>
          <h3 style={adminStyles.sectionTitle}>Quick Actions</h3>
          <div style={adminStyles.quickActions}>
            <button 
              onClick={() => setActiveTab('companies')}
              style={adminStyles.quickActionButton}
            >
              <span style={adminStyles.quickActionIcon}>🏢</span>
              <span>Manage Companies</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('users')}
              style={adminStyles.quickActionButton}
            >
              <span style={adminStyles.quickActionIcon}>👥</span>
              <span>Manage Users</span>
            </button>
            
            <button 
              onClick={() => setShowAddUser(true)}
              style={adminStyles.quickActionButton}
            >
              <span style={adminStyles.quickActionIcon}>➕</span>
              <span>Add New User</span>
            </button>
            
            <button 
              onClick={() => navigate('/company-reg', { state: { fy } })}
              style={adminStyles.quickActionButton}
            >
              <span style={adminStyles.quickActionIcon}>🏢</span>
              <span>Register Company</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCompanies = () => {
    return (
      <div>
        <div style={adminStyles.userManagementHeader}>
          <div>
            <h3 style={adminStyles.sectionTitle}>
              Company Management
            </h3>
            <div style={adminStyles.userCount}>Total Companies: {companies.length}</div>
          </div>
          
          <button 
            onClick={() => navigate('/company-reg', { state: { fy } })}
            style={adminStyles.addButton}
          >
            + Add Company
          </button>
        </div>

        {companies.length === 0 ? (
          <div style={adminStyles.emptyState}>
            <div style={adminStyles.emptyStateIcon}>🏢</div>
            <h4>No Companies Found</h4>
            <p>Register your first company to get started.</p>
            <button 
              onClick={() => navigate('/company-reg', { state: { fy } })}
              style={adminStyles.primaryButton}
            >
              Register First Company
            </button>
          </div>
        ) : (
          <div style={adminStyles.userList}>
            {companies.map(company => (
              <div key={company.id} style={adminStyles.userItem}>
                <div style={adminStyles.userInfo}>
                  <div style={adminStyles.userMain}>
                    <div style={adminStyles.userName}>
                      {company.name}
                      <span style={{ ...adminStyles.roleBadge, backgroundColor: '#3b82f6' }}>
                        Company
                      </span>
                    </div>
                  </div>
                  <div style={adminStyles.userDetails}>
                    <div style={adminStyles.userDetail}>📧 {company.email}</div>
                    <div style={adminStyles.userDetail}>📞 {company.phone}</div>
                    {company.companyId && (
                      <div style={adminStyles.userDetail}>🆔 ID: {company.companyId}</div>
                    )}
                    {company.address && (
                      <div style={adminStyles.userDetail}>📍 {company.address}</div>
                    )}
                  </div>
                  <div style={adminStyles.userDate}>
                    Created: {company.createdAt ? 
                      new Date(company.createdAt.toDate()).toLocaleDateString('ja-JP') : 
                      'N/A'
                    }
                  </div>
                </div>
                <div style={adminStyles.userActions}>
                  <button 
                    onClick={() => editCompany(company)}
                    style={adminStyles.editButton}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => deleteCompany(company.id)}
                    style={adminStyles.deleteButton}
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

  const renderUsers = () => {
    return (
      <div>
        <div style={adminStyles.userManagementHeader}>
          <div>
            <h3 style={adminStyles.sectionTitle}>
              User Management
            </h3>
            <div style={adminStyles.userCount}>Total Users: {users.length}</div>
          </div>
          
          <button 
            onClick={() => setShowAddUser(true)}
            style={adminStyles.addButton}
          >
            + Add User
          </button>
        </div>

        {users.length === 0 ? (
          <div style={adminStyles.emptyState}>
            <div style={adminStyles.emptyStateIcon}>👥</div>
            <h4>No Users Found</h4>
            <p>Create your first user to get started.</p>
            <button 
              onClick={() => setShowAddUser(true)}
              style={adminStyles.primaryButton}
            >
              Create First User
            </button>
          </div>
        ) : (
          <div style={adminStyles.userList}>
            {users.map(user => {
              let color = '#3b82f6';
              if (user.role === 'driver') color = '#10b981';
              if (user.role === 'customer') color = '#8b5cf6';
              if (user.role === 'supplier') color = '#f59e0b';
              
              return (
                <div key={user.id} style={adminStyles.userItem}>
                  <div style={adminStyles.userInfo}>
                    <div style={adminStyles.userMain}>
                      <div style={adminStyles.userName}>
                        {user.displayName || user.name || 'No Name'}
                        <span style={{ ...adminStyles.roleBadge, backgroundColor: color }}>
                          {user.role}
                        </span>
                        <span style={user.status === 'active' ? adminStyles.activeBadge : adminStyles.inactiveBadge}>
                          {user.status || 'active'}
                        </span>
                      </div>
                    </div>
                    <div style={adminStyles.userDetails}>
                      <div style={adminStyles.userDetail}>📧 {user.email}</div>
                      {user.phone && <div style={adminStyles.userDetail}>📞 {user.phone}</div>}
                      {user.companyId && (
                        <div style={adminStyles.userDetail}>🏢 Company ID: {user.companyId}</div>
                      )}
                    </div>
                    <div style={adminStyles.userDate}>
                      Created: {user.createdAt ? 
                        new Date(user.createdAt.toDate()).toLocaleDateString('ja-JP') : 
                        'N/A'
                      }
                    </div>
                  </div>
                  <div style={adminStyles.userActions}>
                    <button 
                      onClick={() => deleteUser(user.id, user.displayName || user.name)}
                      style={adminStyles.deleteButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={adminStyles.container}>
        <div style={adminStyles.card}>
          <div style={adminStyles.loadingSpinner}></div>
          <h3>Loading Admin Dashboard...</h3>
          <p>Please wait while we load your data.</p>
          <p><small>Financial Year: {fy}</small></p>
          <button 
            onClick={() => window.location.reload()}
            style={adminStyles.primaryButton}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={adminStyles.operatorContainer}>
      {/* Sidebar */}
      <div style={adminStyles.sidebar}>
        <div style={adminStyles.sidebarHeader}>
          <h2 style={adminStyles.companyName}>Admin Dashboard</h2>
          <p style={adminStyles.operatorName}>
            <strong>Financial Year:</strong> {fy}
          </p>
          <select 
           value={fy || ''} 
           onChange={e => {
           const newFy = e.target.value;
           setFy(newFy);
           // Yeh line add kar – FY ko yaad rakhega refresh ke baad bhi
           sessionStorage.setItem('selectedFY', newFy);
          }}
          style={adminStyles.fySelect}
           >
            <option value="2025_2025">FY 2025 (Apr 2025 - Mar 2026)</option>
            <option value="2026_2026">FY 2026 (Apr 2026 - Mar 2027)</option>
          </select>
        </div>
        
        <div style={adminStyles.sidebarMenu}>
          <button 
            style={{ 
              ...adminStyles.sidebarButton,
              ...(activeTab === 'dashboard' && adminStyles.activeSidebarButton)
            }}
            onClick={() => setActiveTab('dashboard')}
          >
            <span style={adminStyles.sidebarIcon}>📊</span>
            Dashboard
          </button>
          
          <div style={adminStyles.sidebarDropdown}>
            <button 
              style={{ 
                ...adminStyles.sidebarButton,
                ...(activeTab === 'companies' && adminStyles.activeSidebarButton)
              }}
              onClick={() => {
                setActiveTab('companies');
                setShowCompanyDropdown(false);
              }}
            >
              <span style={adminStyles.sidebarIcon}>🏢</span>
              Companies ({companies.length})
            </button>
          </div>
          
          <div style={adminStyles.sidebarDropdown}>
            <button 
              style={{ 
                ...adminStyles.sidebarButton,
                ...(activeTab === 'users' && adminStyles.activeSidebarButton)
              }}
              onClick={() => {
                setActiveTab('users');
                setShowUserDropdown(false);
              }}
            >
              <span style={adminStyles.sidebarIcon}>👥</span>
              Users ({users.length})
              <span style={adminStyles.dropdownArrow}>
                {showUserDropdown ? '▲' : '▼'}
              </span>
            </button>
            
            {showUserDropdown && (
              <div style={adminStyles.sidebarDropdownMenu}>
                <button 
                  style={adminStyles.sidebarDropdownItem}
                  onClick={() => {
                    setActiveTab('users');
                    setShowUserDropdown(false);
                  }}
                >
                  👥 All Users ({users.length})
                </button>
                <button 
                  style={adminStyles.sidebarDropdownItem}
                  onClick={() => {
                    const operators = users.filter(u => u.role === 'operator');
                    setActiveTab('users');
                    setShowUserDropdown(false);
                  }}
                >
                  👨‍💼 Operators ({stats.operators})
                </button>
                <button 
                  style={adminStyles.sidebarDropdownItem}
                  onClick={() => {
                    const drivers = users.filter(u => u.role === 'driver');
                    setActiveTab('users');
                    setShowUserDropdown(false);
                  }}
                >
                  🚚 Drivers ({stats.drivers})
                </button>
                <button 
                  style={adminStyles.sidebarDropdownItem}
                  onClick={() => {
                    const customers = users.filter(u => u.role === 'customer');
                    setActiveTab('users');
                    setShowUserDropdown(false);
                  }}
                >
                  👥 Customers ({stats.customers})
                </button>
                <button 
                  style={adminStyles.sidebarDropdownItem}
                  onClick={() => {
                    const suppliers = users.filter(u => u.role === 'supplier');
                    setActiveTab('users');
                    setShowUserDropdown(false);
                  }}
                >
                  🏭 Suppliers ({stats.suppliers})
                </button>
              </div>
            )}
          </div>
          
          <button 
            style={adminStyles.sidebarButton}
            onClick={() => navigate('/company-reg', { state: { fy } })}
          >
            <span style={adminStyles.sidebarIcon}>🏢</span>
            Register Company
          </button>
        </div>
        
        <div style={adminStyles.sidebarFooter}>
          <button onClick={handleLogout} style={adminStyles.signOutButton}>
            <span style={adminStyles.sidebarIcon}>🚪</span>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={adminStyles.mainContentArea}>
        <div style={adminStyles.mainHeader}>
          <h1 style={adminStyles.mainTitle}>
            {activeTab === 'dashboard' && '📊 Admin Dashboard'}
            {activeTab === 'companies' && '🏢 Company Management'}
            {activeTab === 'users' && '👥 User Management'}
          </h1>
          <div style={adminStyles.headerStats}>
            <span style={adminStyles.statBadge}>🏢 {companies.length}</span>
            <span style={adminStyles.statBadge}>👥 {users.length}</span>
            <span style={adminStyles.statBadge}>💰 {formatJPY(stats.revenue)}</span>
          </div>
        </div>

        <div style={adminStyles.contentContainer}>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'companies' && renderCompanies()}
          {activeTab === 'users' && renderUsers()}
        </div>
      </div>

      {/* ADD USER MODAL */}
      {showAddUser && (
        <div style={adminStyles.modalOverlay}>
          <div style={adminStyles.modalContent}>
            <h2 style={adminStyles.modalTitle}>Add New User</h2>
            <p style={adminStyles.modalSubtitle}>
              Company: <strong>{selectedCompany?.name || 'Select a company'}</strong>
            </p>
            
            <form onSubmit={handleAddUser}>
              <div style={adminStyles.modalForm}>
                <div style={adminStyles.inputGroup}>
                  <label style={adminStyles.label}>User Type *</label>
                  <select 
                    value={userType} 
                    onChange={e => setUserType(e.target.value)}
                    style={adminStyles.select}
                    required
                  >
                    <option value="operator">Operator</option>
                    <option value="driver">Driver</option>
                    <option value="customer">Customer</option>
                    <option value="supplier">Supplier</option>
                  </select>
                </div>

                <div style={adminStyles.inputGroup}>
                  <label style={adminStyles.label}>Select Company *</label>
                  <select 
                    value={selectedCompany?.id || ''}
                    onChange={e => {
                      const company = companies.find(c => c.id === e.target.value);
                      setSelectedCompany(company);
                    }}
                    style={adminStyles.select}
                    required
                  >
                    <option value="">Select a company</option>
                    {companies.map(company => (
                      <option key={company.id} value={company.id}>
                        {company.name} ({company.companyId})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={adminStyles.inputGroup}>
                  <label style={adminStyles.label}>Full Name *</label>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={userForm.name}
                    onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))}
                    style={adminStyles.input}
                    required
                    disabled={userLoading}
                  />
                </div>

                <div style={adminStyles.inputGroup}>
                  <label style={adminStyles.label}>Email *</label>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={userForm.email}
                    onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))}
                    style={adminStyles.input}
                    required
                    disabled={userLoading}
                  />
                </div>

                <div style={adminStyles.inputGroup}>
                  <label style={adminStyles.label}>Phone *</label>
                  <input
                    type="tel"
                    placeholder="Enter phone number"
                    value={userForm.phone}
                    onChange={e => setUserForm(p => ({ ...p, phone: e.target.value }))}
                    style={adminStyles.input}
                    required
                    disabled={userLoading}
                  />
                </div>

                <div style={adminStyles.inputGroup}>
                  <label style={adminStyles.label}>Password *</label>
                  <input
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={userForm.password}
                    onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))}
                    style={adminStyles.input}
                    required
                    minLength="6"
                    disabled={userLoading}
                  />
                </div>

                <div style={adminStyles.modalButtons}>
                  <button 
                    type="submit" 
                    disabled={userLoading}
                    style={adminStyles.submitButton}
                  >
                    {userLoading ? 'Creating...' : `Add ${userType.charAt(0).toUpperCase() + userType.slice(1)}`}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowAddUser(false)}
                    style={adminStyles.cancelButton}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Modern Blue and Black Theme Styles (Matching Operator Dashboard)
const adminStyles = {
  operatorContainer: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f8fafc'
  },
  // Sidebar Styles
  sidebar: {
    width: '250px',
    backgroundColor: '#1e293b',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '2px 0 10px rgba(0,0,0,0.1)'
  },
  sidebarHeader: {
    padding: '25px 20px',
    borderBottom: '1px solid #334155'
  },
  companyName: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#60a5fa'
  },
  operatorName: {
    fontSize: '13px',
    color: '#cbd5e1',
    margin: '0 0 15px 0'
  },
  fySelect: {
    width: '100%',
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: 'white',
    fontSize: '12px'
  },
  sidebarMenu: {
    flex: 1,
    padding: '20px 0'
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
    fontWeight: '600'
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
    borderLeft: '3px solid #3b82f6'
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
    borderTop: '1px solid #334155'
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
    overflowY: 'auto'
  },
  mainHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '25px',
    paddingBottom: '15px',
    borderBottom: '2px solid #e2e8f0'
  },
  mainTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#1e293b',
    margin: 0
  },
  headerStats: {
    display: 'flex',
    gap: '10px'
  },
  statBadge: {
    backgroundColor: '#e2e8f0',
    color: '#475569',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '500'
  },
  contentContainer: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '25px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    minHeight: 'calc(100vh - 150px)'
  },
  // Dashboard Components
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
    transition: 'transform 0.2s',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
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
  quickActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px'
  },
  quickActionButton: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '20px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    '&:hover': {
      borderColor: '#3b82f6',
      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.1)'
    }
  },
  quickActionIcon: {
    fontSize: '32px'
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
  addButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#2563eb'
    }
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
    flexDirection: 'column'
  },
  editButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#2563eb'
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
  // Common
  emptyState: {
    textAlign: 'center',
    padding: '50px 30px',
    color: '#64748b'
  },
  emptyStateIcon: {
    fontSize: '60px',
    marginBottom: '20px',
    opacity: '0.5'
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
  // Loading States
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px'
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
  loadingSpinner: {
    width: '50px',
    height: '50px',
    border: '4px solid #f1f5f9',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px'
  },
  // Modal Styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '30px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  modalTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '10px'
  },
  modalSubtitle: {
    color: '#64748b',
    marginBottom: '25px',
    fontSize: '15px'
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontWeight: '500',
    color: '#374151',
    fontSize: '14px'
  },
  input: {
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box'
  },
  select: {
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box'
  },
  modalButtons: {
    display: 'flex',
    gap: '15px',
    marginTop: '10px'
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    padding: '14px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover:not(:disabled)': {
      backgroundColor: '#059669'
    },
    '&:disabled': {
      backgroundColor: '#9ca3af',
      cursor: 'not-allowed'
    }
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    padding: '14px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#4b5563'
    }
  }
};

// CSS Injection
const AdminDashboardWithCSS = (props) => {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const spinnerStyles = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;

      if (!document.getElementById('admin-spinner-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'admin-spinner-styles';
        styleElement.textContent = spinnerStyles;
        document.head.appendChild(styleElement);
      }
    }
  }, []);

  return <AdminDashboard {...props} />;
};

export default AdminDashboardWithCSS;