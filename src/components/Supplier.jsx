import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, getDocs, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'react-toastify';
import LoadingScreen from './LoadingScreen';

const SupplierDashboard = ({ styles }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', sku: '', quantity: 0, price: 0, category: 'general' });

  const categories = ['general', 'electronics', 'clothing', 'food', 'equipment'];

  // Load supplier data
  const loadData = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const uid = auth.currentUser.uid;

      // Profile
      const userQ = query(collection(db, 'users'), where('uid', '==', uid));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty) throw new Error('Profile not found');
      const userData = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
      setProfile(userData);

      // Company
      if (userData.companyId) {
        const compQ = query(collection(db, 'companies_2025'), where('id', '==', userData.companyId));
        const compSnap = await getDocs(compQ);
        if (!compSnap.empty) setCompany(compSnap.docs[0].data());
      }

      // Inventory
      const invQ = query(
        collection(db, 'inventory'),
        where('companyId', '==', userData.companyId),
        where('supplierId', '==', uid)
      );
      const invSnap = await getDocs(invQ);
      const invData = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setInventory(invData);

      // Orders
      const ordersQ = query(
        collection(db, 'orders'),
        where('supplierId', '==', uid),
        where('status', 'in', ['pending', 'processing'])
      );
      const ordersSnap = await getDocs(ordersQ);
      const ordersData = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(ordersData);

    } catch (err) {
      toast.error('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Realtime listeners
  useEffect(() => {
    if (!profile?.companyId) return;

    const invQ = query(
      collection(db, 'inventory'),
      where('companyId', '==', profile.companyId),
      where('supplierId', '==', auth.currentUser.uid)
    );
    const unsubInv = onSnapshot(invQ, (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const ordersQ = query(
      collection(db, 'orders'),
      where('supplierId', '==', auth.currentUser.uid)
    );
    const unsubOrders = onSnapshot(ordersQ, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    loadData();
    return () => {
      unsubInv();
      unsubOrders();
    };
  }, [profile?.companyId, loadData]);

  // Add/Update Inventory Item
  const handleSaveItem = async (e) => {
    e.preventDefault();
    const itemData = { ...newItem, companyId: profile.companyId, supplierId: auth.currentUser.uid, updatedAt: serverTimestamp() };

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'inventory', editingItem.id), itemData);
        toast.success('Item updated');
      } else {
        await addDoc(collection(db, 'inventory'), itemData);
        toast.success('Item added');
      }
      setShowAddItem(false);
      setNewItem({ name: '', sku: '', quantity: 0, price: 0, category: 'general' });
      setEditingItem(null);
    } catch (err) {
      toast.error('Failed to save item');
    }
  };

  // Delete Item
  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await deleteDoc(doc(db, 'inventory', itemId));
      toast.success('Item deleted');
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  // Update Quantity
  const updateQuantity = async (itemId, newQty) => {
    try {
      await updateDoc(doc(db, 'inventory', itemId), { 
        quantity: newQty, 
        updatedAt: serverTimestamp() 
      });
      toast.success('Stock updated');
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.sku.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (amt) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amt || 0);

  if (loading) return <LoadingScreen styles={styles} message="Loading supplier dashboard..." />;

  return (
    <>
      <style jsx>{`
        .container { padding: 15px; background: #f8fafc; min-height: 100vh; }
        @media (min-width: 768px) { .container { padding: 30px; display: grid; grid-template-columns: 1fr 400px; gap: 30px; } }
        .header { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); marginBottom: 24px; text-align: center; }
        .welcome { font-size: 24px; font-weight: 700; color: #1f2937; marginBottom: 8px; }
        .company { font-size: 14px; color: #6b7280; }
        .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 24px 0; }
        @media (min-width: 768px) { .stats { grid-template-columns: repeat(4, 1fr); } }
        .stat-card { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .stat-value { font-size: 28px; font-weight: 700; color: #f59e0b; }
        .stat-label { font-size: 14px; color: #6b7280; marginTop: 4px; }
        .section { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); marginBottom: 24px; }
        .section-title { font-size: 20px; font-weight: 600; marginBottom: 20px; color: #1f2937; }
        .search-bar { width: 100%; padding: 14px 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 16px; marginBottom: 20px; }
        .search-bar:focus { outline: none; border-color: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.1); }
        .inventory-table { width: 100%; border-collapse: collapse; }
        .inventory-row { border-bottom: 1px solid #e5e7eb; }
        .inventory-row:hover { background: #f9fafb; }
        .inventory-cell { padding: 16px; vertical-align: middle; }
        .inventory-name { font-weight: 600; color: #1f2937; }
        .inventory-sku { font-size: 14px; color: #6b7280; }
        .inventory-quantity { font-weight: 600; }
        .low-stock { color: #ef4444; }
        .out-stock { color: #dc2626; background: #fef2f2; padding: 4px 8px; border-radius: 6px; }
        .inventory-actions { display: flex; gap: 8px; align-items: center; }
        .btn { 
          padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; 
          border: none; font-size: 14px; transition: all 0.2s;
        }
        .btn-primary { background: #f59e0b; color: white; }
        .btn-primary:hover { background: #d97706; }
        .btn-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; }
        .btn-danger:hover { background: #fecaca; }
        .btn-sm { padding: 4px 8px; font-size: 12px; }
        .quantity-input { width: 80px; padding: 6px; border: 1px solid #d1d5db; border-radius: 6px; text-align: center; }
        .order-item { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; marginBottom: 12px; }
        .order-status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; color: white; }
        .empty { text-align: center; padding: 60px 20px; color: #6b7280; }
        .modal { 
          position: fixed; inset: 0; background: rgba(0,0,0,0.5); 
          display: flex; align-items: center; justify-content: center; z-index: 1000; 
        }
        .modal-content { 
          background: white; border-radius: 16px; padding: 24px; max-width: 500px; 
          width: 90%; max-height: 90vh; overflow-y: auto; 
        }
        .form-grid { display: grid; gap: 16px; }
        @media (min-width: 768px) { .form-grid { grid-template-columns: 1fr 1fr; } }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-weight: 600; color: #374151; }
        .form-input { padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 16px; }
        .modal-buttons { display: flex; gap: 12px; justify-content: flex-end; marginTop: 20px; }
      `}</style>

      <div className="container">
        {/* Header */}
        <div className="header">
          <h1 className="welcome">Supplier Dashboard</h1>
          {company && <p className="company">{company.name}</p>}
          <button onClick={() => setShowAddItem(true)} className="btn btn-primary">
            + Add New Item
          </button>
        </div>

        {/* Stats */}
        <div className="stats">
          <div className="stat-card">
            <div className="stat-value">{filteredInventory.length}</div>
            <div className="stat-label">Total Items</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {filteredInventory.filter(i => i.quantity > 0).length}
            </div>
            <div className="stat-label">In Stock</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {filteredInventory.filter(i => i.quantity <= 5 && i.quantity > 0).length}
            </div>
            <div className="stat-label">Low Stock</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{orders.length}</div>
            <div className="stat-label">Pending Orders</div>
          </div>
        </div>

        {/* Left: Inventory */}
        <div>
          <div className="section">
            <div className="section-title">
              Inventory 
              <span style={{ fontSize: '14px', color: '#6b7280' }}>
                ({filteredInventory.length} items)
              </span>
            </div>
            <input
              className="search-bar"
              type="text"
              placeholder="Search items by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {filteredInventory.length === 0 ? (
              <div className="empty">
                <p>No items found</p>
                <button onClick={() => setShowAddItem(true)} className="btn btn-primary">
                  Add First Item
                </button>
              </div>
            ) : (
              <table className="inventory-table">
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th className="inventory-cell">Item</th>
                    <th className="inventory-cell">SKU</th>
                    <th className="inventory-cell">Stock</th>
                    <th className="inventory-cell">Price</th>
                    <th className="inventory-cell">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => (
                    <tr key={item.id} className="inventory-row">
                      <td className="inventory-cell">
                        <div className="inventory-name">{item.name}</div>
                        <div className="inventory-sku">Category: {item.category}</div>
                      </td>
                      <td className="inventory-cell">{item.sku}</td>
                      <td className="inventory-cell">
                        <div className="inventory-quantity">
                          {item.quantity === 0 ? (
                            <span className="out-stock">Out of Stock</span>
                          ) : item.quantity <= 5 ? (
                            <span className="low-stock">{item.quantity} left</span>
                          ) : (
                            `${item.quantity} units`
                          )}
                        </div>
                      </td>
                      <td className="inventory-cell">{formatCurrency(item.price)}</td>
                      <td className="inventory-cell">
                        <div className="inventory-actions">
                          <input
                            className="quantity-input"
                            type="number"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                          />
                          <button 
                            className="btn btn-sm" 
                            onClick={() => {
                              setEditingItem(item);
                              setNewItem({ name: item.name, sku: item.sku, quantity: item.quantity, price: item.price, category: item.category });
                              setShowAddItem(true);
                            }}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn btn-sm btn-danger" 
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Orders */}
        <div>
          <div className="section">
            <h2 className="section-title">Pending Orders</h2>
            {orders.length === 0 ? (
              <div className="empty">
                <p>No pending orders</p>
              </div>
            ) : (
              orders.map(order => (
                <div key={order.id} className="order-item">
                  <div>
                    <strong>Order #{order.id.slice(-6)}</strong><br/>
                    <span>Customer: {order.customerName}</span><br/>
                    <span>Total: {formatCurrency(order.total)}</span>
                  </div>
                  <span className={`order-status ${order.status}`} style={{
                    backgroundColor: order.status === 'pending' ? '#f59e0b' : '#3b82f6'
                  }}>
                    {order.status.toUpperCase()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add/Edit Item Modal */}
        {(showAddItem || editingItem) && (
          <div className="modal" onClick={() => setShowAddItem(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
              <form onSubmit={handleSaveItem} className="form-grid">
                <div className="form-group">
                  <label className="form-label">Item Name</label>
                  <input
                    className="form-input"
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="Product name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">SKU</label>
                  <input
                    className="form-input"
                    type="text"
                    value={newItem.sku}
                    onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                    placeholder="ABC-123"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Price (¥)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) })}
                    placeholder="1000"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })}
                    placeholder="50"
                    required
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="modal-buttons">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setShowAddItem(false);
                      setEditingItem(null);
                      setNewItem({ name: '', sku: '', quantity: 0, price: 0, category: 'general' });
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingItem ? 'Update Item' : 'Add Item'}
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

export default SupplierDashboard;