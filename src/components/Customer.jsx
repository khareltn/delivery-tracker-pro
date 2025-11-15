import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'react-toastify';
import LoadingScreen from './LoadingScreen';

const CustomerDashboard = ({ styles }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);

  const loadCustomerData = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const userId = auth.currentUser.uid;

      const userQ = query(collection(db, 'users'), where('uid', '==', userId));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty) throw new Error('Profile not found');
      const userData = userSnap.docs[0].data();
      setProfile(userData);

      const compQ = query(collection(db, `companies_2025`), where('id', '==', userData.companyId));
      const compSnap = await getDocs(compQ);
      if (!compSnap.empty) {
        setCompany(compSnap.docs[0].data());
      }

      const ordersQ = query(
        collection(db, 'orders'),
        where('customerId', '==', userId),
        where('companyId', '==', userData.companyId)
      );
      const ordersSnap = await getDocs(ordersQ);
      const ordersData = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(ordersData.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0)));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    const ordersQ = query(
      collection(db, 'orders'),
      where('customerId', '==', userId)
    );

    const unsubscribe = onSnapshot(ordersQ, (snap) => {
      const updated = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(updated.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0)));
    }, (err) => {
      console.error(err);
      toast.warn('Realtime updates paused');
    });

    loadCustomerData();
    return () => unsubscribe();
  }, [loadCustomerData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount || 0);
  };

  const formatDate = (ts) => {
    return ts?.toDate?.()?.toLocaleString('ja-JP') || 'N/A';
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b',
      processing: '#3b82f6',
      shipped: '#10b981',
      delivered: '#059669',
      cancelled: '#dc2626'
    };
    return colors[status] || '#6b7280';
  };

  if (loading) {
    return <LoadingScreen styles={styles} />;
  }

  if (!profile) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>Profile not found. Please contact admin.</p>
        <button onClick={() => auth.signOut().then(() => navigate('/customer-login'))} className="btn">
          Logout
        </button>
      </div>
    );
  }

  return (
    <>
      <style jsx>{`
        .container { padding: 15px; background: #f8fafc; min-height: 100vh; }
        @media (min-width: 768px) { .container { padding: 30px; } }
        .header { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .welcome { font-size: 20px; font-weight: 700; color: #1f2937; margin: 0 0 8px; }
        .company { font-size: 14px; color: #6b7280; }
        .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 20px 0; }
        @media (min-width: 768px) { .stats { grid-template-columns: repeat(4, 1fr); } }
        .stat-card { background: white; border-radius: 12px; padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .stat-value { font-size: 24px; font-weight: 700; color: #1f2937; }
        .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .section { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .section-title { font-size: 18px; font-weight: 600; margin: 0 0 16px; color: #1f2937; }
        .order-list { display: flex; flex-direction: column; gap: 12px; }
        .order-item { 
          border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; 
          display: flex; flex-direction: column; gap: 8px;
        }
        @media (min-width: 768px) { 
          .order-item { flex-direction: row; justify-content: space-between; align-items: center; }
        }
        .order-info h4 { margin: 0; font-size: 16px; font-weight: 600; }
        .order-meta { font-size: 13px; color: #6b7280; }
        .status-badge { 
          padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; 
          color: white; display: inline-block;
        }
        .empty { text-align: center; padding: 40px; color: #6b7280; }
        .btn { 
          padding: 10px 16px; border-radius: 8px; font-weight: 500; cursor: pointer; 
          background: #3b82f6; color: white; border: none; font-size: 14px;
        }
        .btn:hover { background: #2563eb; }
        .logout { background: #dc2626; margin-top: 20px; }
        .logout:hover { background: #b91c1c; }
        .mt-5 { margin-top: 20px; }
      `}</style>

      <div className="container">
        <div className="header">
          <h1 className="welcome">Welcome, {profile.name}!</h1>
          {company && <p className="company">{company.name}</p>}
          <button 
            onClick={() => auth.signOut().then(() => navigate('/customer-login'))} 
            className="btn logout"
            style={{ width: 'fit-content', alignSelf: 'flex-end' }}
          >
            Logout
          </button>
        </div>

        <div className="stats">
          <div className="stat-card">
            <div className="stat-value">{orders.length}</div>
            <div className="stat-label">Total Orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{orders.filter(o => o.status === 'delivered').length}</div>
            <div className="stat-label">Delivered</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{orders.filter(o => o.status === 'pending').length}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {formatCurrency(orders.reduce((sum, o) => sum + (o.total || 0), 0))}
            </div>
            <div className="stat-label">Total Spent</div>
          </div>
        </div>

        <div className="section">
          <h2 className="section-title">Your Orders</h2>
          {orders.length === 0 ? (
            <div className="empty">
              <p>No orders yet.</p>
              <button onClick={() => toast.info('Contact your supplier to place an order')} className="btn">
                Contact Supplier
              </button>
            </div>
          ) : (
            <div className="order-list mt-5">
              {orders.map(order => (
                <div key={order.id} className="order-item">
                  <div className="order-info">
                    <h4>Order #{order.id.slice(-6)}</h4>
                    <div className="order-meta">
                      Placed: {formatDate(order.createdAt)} • Items: {order.items?.length || 0}
                    </div>
                    <div className="order-meta">
                      Total: {formatCurrency(order.total)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span 
                      className="status-badge" 
                      style={{ backgroundColor: getStatusColor(order.status) }}
                    >
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section">
          <h2 className="section-title">Profile</h2>
          <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
            <p><strong>Email:</strong> {profile.email}</p>
            {profile.phone && <p><strong>Phone:</strong> {profile.phone}</p>}
            {profile.address && <p><strong>Address:</strong> {profile.address}</p>}
          </div>
        </div>
      </div>
    </>
  );
};

export default CustomerDashboard;