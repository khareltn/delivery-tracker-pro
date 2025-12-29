// components/PurchaseManagement.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { toast } from 'react-toastify';

const PurchaseManagement = ({ company, currentUser, suppliers, products, formatCurrency }) => {
  const [loading, setLoading] = useState(false);
  const [purchases, setPurchases] = useState([]);
  const [formData, setFormData] = useState({
    supplierId: '',
    purchaseOrderNumber: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    items: [],
    totalAmount: 0,
    taxAmount: 0,
    shippingCost: 0,
    grandTotal: 0,
    status: 'ordered',
    paymentStatus: 'pending',
    notes: ''
  });
  const [selectedProduct, setSelectedProduct] = useState({
    productId: '',
    quantity: 1,
    unitPrice: 0
  });

  useEffect(() => {
    loadPurchases();
  }, [company]);

  const loadPurchases = async () => {
    if (!company?.id) return;
    try {
      const purchasesQuery = query(
        collection(db, 'purchases'),
        where('companyId', '==', company.id)
      );
      const snapshot = await getDocs(purchasesQuery);
      const purchasesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
      setPurchases(purchasesData);
    } catch (error) {
      console.error('Error loading purchases:', error);
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct.productId) {
      toast.error('Please select a product');
      return;
    }
    const product = products.find(p => p.id === selectedProduct.productId);
    if (!product) return;

    const item = {
      productId: product.id,
      productName: product.name,
      quantity: parseFloat(selectedProduct.quantity),
      unitPrice: parseFloat(selectedProduct.unitPrice || product.price || 0),
      total: parseFloat(selectedProduct.quantity) * parseFloat(selectedProduct.unitPrice || product.price || 0)
    };

    const newItems = [...formData.items, item];
    const totalAmount = newItems.reduce((sum, item) => sum + item.total, 0);
    const grandTotal = totalAmount + formData.shippingCost;

    setFormData({
      ...formData,
      items: newItems,
      totalAmount,
      grandTotal
    });

    setSelectedProduct({ productId: '', quantity: 1, unitPrice: 0 });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplierId || formData.items.length === 0) {
      toast.error('Please select supplier and add items');
      return;
    }

    setLoading(true);
    try {
      const supplier = suppliers.find(s => s.id === formData.supplierId);
      const purchaseData = {
        ...formData,
        companyId: company.id,
        companyName: company.name,
        supplierName: supplier?.name || 'Unknown',
        createdBy: currentUser?.email,
        createdById: currentUser?.uid,
        createdAt: new Date(),
        purchaseOrderNumber: `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      };

      await addDoc(collection(db, 'purchases'), purchaseData);
      
      toast.success('✅ Purchase order created successfully!');
      setFormData({
        supplierId: '',
        purchaseOrderNumber: '',
        orderDate: new Date().toISOString().split('T')[0],
        expectedDelivery: '',
        items: [],
        totalAmount: 0,
        taxAmount: 0,
        shippingCost: 0,
        grandTotal: 0,
        status: 'ordered',
        paymentStatus: 'pending',
        notes: ''
      });
      loadPurchases();
    } catch (error) {
      console.error('Error creating purchase order:', error);
      toast.error('Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
    },
    header: {
      marginBottom: '25px',
      borderBottom: '2px solid #334155',
      paddingBottom: '15px'
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#e2e8f0',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '20px'
    },
    card: {
      backgroundColor: '#0f172a',
      borderRadius: '10px',
      padding: '20px',
      border: '1px solid #334155'
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#e2e8f0',
      marginBottom: '15px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    label: {
      color: '#cbd5e1',
      fontSize: '14px',
      marginBottom: '8px',
      display: 'block'
    },
    input: {
      width: '100%',
      padding: '10px',
      backgroundColor: '#1e293b',
      border: '1px solid #475569',
      borderRadius: '6px',
      color: '#e2e8f0',
      fontSize: '14px'
    },
    select: {
      width: '100%',
      padding: '10px',
      backgroundColor: '#1e293b',
      border: '1px solid #475569',
      borderRadius: '6px',
      color: '#e2e8f0',
      fontSize: '14px',
      cursor: 'pointer'
    },
    button: {
      padding: '10px 20px',
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      '&:hover': {
        backgroundColor: '#2563eb'
      }
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span style={{color: '#8b5cf6'}}>🛒</span>
          購買管理 / Purchase Management
        </h2>
      </div>

      <div style={styles.formGrid}>
        {/* New Purchase Order */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>新規発注 / New Purchase Order</h3>
          
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={styles.label}>仕入先 / Supplier *</label>
              <select 
                value={formData.supplierId}
                onChange={(e) => setFormData({...formData, supplierId: e.target.value})}
                style={styles.select}
                required
              >
                <option value="">仕入先を選択 / Select Supplier</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} • {supplier.mobileNumber || supplier.landlineNumber}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={styles.label}>発注日 / Order Date</label>
                <input 
                  type="date" 
                  value={formData.orderDate}
                  onChange={(e) => setFormData({...formData, orderDate: e.target.value})}
                  style={styles.input}
                  required
                />
              </div>
              <div>
                <label style={styles.label}>納品予定日 / Expected Delivery</label>
                <input 
                  type="date" 
                  value={formData.expectedDelivery}
                  onChange={(e) => setFormData({...formData, expectedDelivery: e.target.value})}
                  style={styles.input}
                />
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={styles.label}>製品を追加 / Add Product</label>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <select 
                  value={selectedProduct.productId}
                  onChange={(e) => {
                    const product = products.find(p => p.id === e.target.value);
                    setSelectedProduct({
                      ...selectedProduct,
                      productId: e.target.value,
                      unitPrice: product ? product.price : 0
                    });
                  }}
                  style={{...styles.select, flex: 2}}
                >
                  <option value="">製品を選択 / Select Product</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} • 標準単価: {formatCurrency(product.price)}
                    </option>
                  ))}
                </select>
                <input 
                  type="number" 
                  min="1"
                  value={selectedProduct.quantity}
                  onChange={(e) => setSelectedProduct({...selectedProduct, quantity: e.target.value})}
                  style={{...styles.input, flex: 1}}
                  placeholder="数量 / Qty"
                />
                <input 
                  type="number" 
                  min="0"
                  value={selectedProduct.unitPrice}
                  onChange={(e) => setSelectedProduct({...selectedProduct, unitPrice: e.target.value})}
                  style={{...styles.input, flex: 1}}
                  placeholder="単価 / Price"
                />
              </div>
              <button 
                type="button" 
                style={{...styles.button, width: '100%'}}
                onClick={handleAddItem}
              >
                ➕ 製品を追加 / Add Product
              </button>
            </div>

            {/* Items List */}
            {formData.items.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={styles.label}>発注製品リスト / Order Items</h4>
                <div style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: '#1e293b', borderRadius: '6px', padding: '10px' }}>
                  {formData.items.map((item, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px',
                      borderBottom: '1px solid #334155',
                      '&:last-child': { borderBottom: 'none' }
                    }}>
                      <div>
                        <div style={{ color: '#e2e8f0' }}>{item.productName}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {item.quantity} × {formatCurrency(item.unitPrice)}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#10b981', fontWeight: '600' }}>
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {formData.items.length > 0 && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <label style={styles.label}>配送料 / Shipping Cost</label>
                    <input 
                      type="number" 
                      value={formData.shippingCost}
                      onChange={(e) => {
                        const shipping = parseFloat(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          shippingCost: shipping,
                          grandTotal: formData.totalAmount + shipping
                        });
                      }}
                      style={styles.input}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label style={styles.label}>ステータス / Status</label>
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      style={styles.select}
                    >
                      <option value="ordered">📋 発注済み / Ordered</option>
                      <option value="processing">🔄 処理中 / Processing</option>
                      <option value="shipped">🚚 発送済み / Shipped</option>
                      <option value="delivered">✅ 納品済み / Delivered</option>
                    </select>
                  </div>
                </div>

                <div style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '8px',
                  padding: '15px',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={styles.label}>小計 / Subtotal:</span>
                    <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{formatCurrency(formData.totalAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={styles.label}>配送料 / Shipping:</span>
                    <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{formatCurrency(formData.shippingCost)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #334155' }}>
                    <span style={styles.label}>合計金額 / Grand Total:</span>
                    <span style={{ color: '#10b981', fontSize: '18px', fontWeight: 'bold' }}>
                      {formatCurrency(formData.grandTotal)}
                    </span>
                  </div>
                </div>

                <button 
                  type="submit" 
                  style={{...styles.button, width: '100%', padding: '12px'}}
                  disabled={loading}
                >
                  {loading ? '処理中...' : '✅ 発注を登録'}
                </button>
              </>
            )}
          </form>
        </div>

        {/* Recent Purchase Orders */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>最近の発注 / Recent Purchases</h3>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {purchases.slice(0, 10).map(purchase => (
              <div key={purchase.id} style={{
                padding: '15px',
                borderBottom: '1px solid #334155',
                backgroundColor: '#1e293b',
                borderRadius: '8px',
                marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ color: '#e2e8f0' }}>{purchase.supplierName}</strong>
                  <span style={{
                    backgroundColor: 
                      purchase.status === 'delivered' ? '#10b981' : 
                      purchase.status === 'shipped' ? '#3b82f6' :
                      purchase.status === 'processing' ? '#f59e0b' : '#64748b',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {purchase.status}
                  </span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <small style={{ color: '#94a3b8' }}>発注番号: {purchase.purchaseOrderNumber}</small>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <small style={{ color: '#94a3b8' }}>
                      発注日: {new Date(purchase.orderDate).toLocaleDateString('ja-JP')}
                    </small>
                    {purchase.expectedDelivery && (
                      <small style={{ color: purchase.status === 'delivered' ? '#10b981' : '#f59e0b' }}>
                        納品予定: {new Date(purchase.expectedDelivery).toLocaleDateString('ja-JP')}
                      </small>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#cbd5e1' }}>{purchase.items?.length || 0} 品目</span>
                  <strong style={{ color: '#10b981' }}>{formatCurrency(purchase.grandTotal)}</strong>
                </div>
              </div>
            ))}
            {purchases.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                発注記録はありません
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseManagement;