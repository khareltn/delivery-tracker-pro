// src/components/AdminDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, getDocs, query, where, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, addDoc 
} from 'firebase/firestore';
import { db, auth, getCurrentFinancialYear } from '../firebase';
import { toast } from 'react-toastify';

const AdminDashboard = ({ fy: propFy }) => {
  const navigate = useNavigate();
  const [fy, setFy] = useState(propFy || `2025_2025`);
  const [companies, setCompanies] = useState([]);
  const [operators, setOperators] = useState([]);
  const [stats, setStats] = useState({ orders: 0, revenue: 0, drivers: 0, customers: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddOperator, setShowAddOperator] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // Operator Form State
  const [operatorForm, setOperatorForm] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'operator'
  });
  const [operatorLoading, setOperatorLoading] = useState(false);

  // Load all data
  const loadData = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const uid = auth.currentUser.uid;

      // Get admin's profile
      const userQ = query(collection(db, 'users'), where('uid', '==', uid));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty) throw new Error('Profile not found');
      const userData = userSnap.docs[0].data();

      // Companies owned by admin
      const compQ = query(collection(db, `${fy}/companies`), where('ownerId', '==', uid));
      const compSnap = await getDocs(compQ);
      const compData = compSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCompanies(compData);
      if (compData.length > 0) setSelectedCompany(compData[0]);

      // Operators under admin's companies
      const opQ = query(collection(db, `${fy}/operators`), where('companyId', 'in', compData.map(c => c.id)));
      const opSnap = await getDocs(opQ);
      setOperators(opSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Orders & Revenue
      const ordersQ = query(collection(db, `${fy}/orders`), where('companyId', 'in', compData.map(c => c.id)));
      const ordersSnap = await getDocs(ordersQ);
      const orders = ordersSnap.docs.map(d => d.data());
      setStats({
        orders: orders.length,
        revenue: orders.reduce((sum, o) => sum + (o.total || 0), 0),
        drivers: operators.filter(o => o.role === 'driver').length,
        customers: new Set(orders.map(o => o.customerId)).size
      });

    } catch (err) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [fy]);

  useEffect(() => {
    loadData();
    const unsub = onSnapshot(collection(db, `${fy}/companies`), () => loadData());
    return () => unsub();
  }, [fy, loadData]);

  // Edit Company
  const editCompany = (comp) => {
    navigate('/company-reg', { state: { company: comp, fy } });
  };

  // Delete Company
  const deleteCompany = async (id) => {
    if (!window.confirm('Delete this company?')) return;
    try {
      await deleteDoc(doc(db, `${fy}/companies`, id));
      toast.success('Company deleted');
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  // Add Operator — SAB ANDAR HI
  const handleAddOperator = async (e) => {
    e.preventDefault();
    if (!selectedCompany) {
      toast.error('No company selected');
      return;
    }

    setOperatorLoading(true);
    try {
      await addDoc(collection(db, `${fy}/operators`), {
        ...operatorForm,
        companyId: selectedCompany.id,
        createdBy: auth.currentUser.uid,
        createdAt: new Date(),
        status: 'active'
      });

      toast.success(`${operatorForm.name} added as Operator!`);
      setOperatorForm({ name: '', phone: '', email: '', role: 'operator' });
      setShowAddOperator(false);
    } catch (err) {
      toast.error('Failed: ' + err.message);
    } finally {
      setOperatorLoading(false);
    }
  };

  // Format
  const formatJPY = (amt) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amt || 0);

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading Admin Panel...</div>;

  return (
    <>
      <style jsx>{`
        .container { padding: 15px; background: #f8fafc; min-height: 100vh; }
        @media (min-width: 768px) { .container { padding: 20px; } }
        .header { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; text-align: center; }
        .title { font-size: 22px; font-weight: 700; color: #1f2937; }
        .fy-select { padding: 8px 16px; border-radius: 8px; border: 1px solid #d1d5db; font-weight: bold; margin-top: 8px; }
        .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 20px 0; }
        @media (min-width: 768px) { .stats { grid-template-columns: repeat(4, 1fr); } }
        .stat { background: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .stat-value { font-size: 24px; font-weight: 700; color: #ea580c; }
        .section { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .section-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #1f2937; display: flex; justify-content: space-between; align-items: center; }
        .company-item { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
        .btn { padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .btn-edit { background: #3b82f6; color: white; }
        .btn-delete { background: #ef4444; color: white; }
        .btn-add { background: #ea580c; color: white; }
        .empty { text-align: center; padding: 40px; color: #6b7280; }
        .input { padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; width: 100%; margin-bottom: 12px; font-size: 16px; }
        .modal-btn { flex: 1; padding: 12px; font-weight: 600; border-radius: 8px; }
      `}</style>

      <div className="container">
        {/* HEADER */}
        <div className="header">
          <h1 className="title">Admin Command Center</h1>
          <select className="fy-select" value={fy} onChange={e => setFy(e.target.value)}>
            <option value="2025_2025">FY 2025 (Apr 2025 - Mar 2026)</option>
            <option value="2026_2026">FY 2026 (Apr 2026 - Mar 2027)</option>
          </select>
        </div>

        {/* STATS */}
        <div className="stats">
          <div className="stat">
            <div className="stat-value">{stats.orders}</div>
            <div>Total Orders</div>
          </div>
          <div className="stat">
            <div className="stat-value">{formatJPY(stats.revenue)}</div>
            <div>Revenue</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.drivers}</div>
            <div>Drivers</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.customers}</div>
            <div>Customers</div>
          </div>
        </div>

        {/* COMPANIES */}
        <div className="section">
          <div className="section-title">
            <span>Companies</span>
            <button className="btn btn-add" onClick={() => navigate('/company-reg', { state: { fy } })}>
              + Add Company
            </button>
          </div>
          {companies.length === 0 ? (
            <div className="empty">No companies registered</div>
          ) : (
            companies.map(comp => (
              <div key={comp.id} className="company-item">
                <div>
                  <strong>{comp.name}</strong><br/>
                  {comp.email} • {comp.phone}
                </div>
                <div>
                  <button className="btn btn-edit" onClick={() => editCompany(comp)}>Edit</button>
                  <button className="btn btn-delete" onClick={() => deleteCompany(comp.id)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* OPERATORS */}
        <div className="section">
          <div className="section-title">
            <span>Operators & Drivers</span>
            <button className="btn btn-add" onClick={() => setShowAddOperator(true)}>
              + Add Operator
            </button>
          </div>
          {operators.length === 0 ? (
            <div className="empty">No operators yet</div>
          ) : (
            operators.map(op => (
              <div key={op.id} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                <strong>{op.name}</strong> • {op.email} • {op.phone}<br/>
                <small style={{ color: '#6b7280' }}>Role: {op.role} • Status: {op.status}</small>
              </div>
            ))
          )}
        </div>

        {/* ADD OPERATOR MODAL — SAB ANDAR HI */}
        {showAddOperator && selectedCompany && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}>
            <div style={{
              background: 'white', padding: '2rem', borderRadius: '16px', width: '90%', maxWidth: '500px'
            }}>
              <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '700' }}>Add New Operator</h2>
              <p style={{ marginBottom: '1rem', color: '#6b7280' }}>Company: <strong>{selectedCompany.name}</strong></p>
              <form onSubmit={handleAddOperator}>
                <input
                  className="input"
                  placeholder="Full Name *"
                  value={operatorForm.name}
                  onChange={e => setOperatorForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
                <input
                  className="input"
                  placeholder="Phone *"
                  value={operatorForm.phone}
                  onChange={e => setOperatorForm(prev => ({ ...prev, phone: e.target.value }))}
                  required
                />
                <input
                  className="input"
                  placeholder="Email *"
                  type="email"
                  value={operatorForm.email}
                  onChange={e => setOperatorForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="submit" disabled={operatorLoading} className="modal-btn" style={{ background: '#10b981', color: 'white' }}>
                    {operatorLoading ? 'Adding...' : 'Add Operator'}
                  </button>
                  <button type="button" onClick={() => setShowAddOperator(false)} className="modal-btn" style={{ background: '#6b7280', color: 'white' }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminDashboard;