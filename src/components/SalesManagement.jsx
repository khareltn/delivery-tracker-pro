// components/SalesManagement.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';

const SalesManagement = ({ company, currentUser, customers, products, formatCurrency }) => {
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [formData, setFormData] = useState({
    customerId: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    items: [],
    totalAmount: 0,
    taxAmount: 0,
    discount: 0,
    grandTotal: 0,
    paymentStatus: 'pending',
    paymentMethod: 'cash',
    notes: ''
  });
  const [selectedProduct, setSelectedProduct] = useState({
    productId: '',
    quantity: 1,
    unitPrice: 0
  });

  useEffect(() => {
    loadSalesData();
  }, [company]);

  const loadSalesData = async () => {
    if (!company?.id) return;
    try {
      const salesQuery = query(
        collection(db, 'sales'),
        where('companyId', '==', company.id)
      );
      const snapshot = await getDocs(salesQuery);
      const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
      setSales(salesData);
    } catch (error) {
      console.error('Error loading sales:', error);
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
      unitPrice: parseFloat(product.sellPrice || 0),
      total: parseFloat(selectedProduct.quantity) * parseFloat(product.sellPrice || 0),
      taxRate: product.taxRate || 8,
      taxAmount: (parseFloat(selectedProduct.quantity) * parseFloat(product.sellPrice || 0)) * (product.taxRate || 8) / 100
    };

    const newItems = [...formData.items, item];
    const totalAmount = newItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = newItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const grandTotal = totalAmount + taxAmount - formData.discount;

    setFormData({
      ...formData,
      items: newItems,
      totalAmount,
      taxAmount,
      grandTotal
    });

    setSelectedProduct({ productId: '', quantity: 1, unitPrice: 0 });
  };

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    const totalAmount = newItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = newItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const grandTotal = totalAmount + taxAmount - formData.discount;

    setFormData({
      ...formData,
      items: newItems,
      totalAmount,
      taxAmount,
      grandTotal
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customerId || formData.items.length === 0) {
      toast.error('Please select customer and add items');
      return;
    }

    setLoading(true);
    try {
      const customer = customers.find(c => c.id === formData.customerId);
      const salesData = {
        ...formData,
        companyId: company.id,
        companyName: company.name,
        customerName: customer?.name || 'Unknown',
        createdBy: currentUser?.email,
        createdById: currentUser?.uid,
        createdAt: new Date(),
        status: 'active',
        invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      };

      await addDoc(collection(db, 'sales'), salesData);
      
      // Update product stock
      for (const item of formData.items) {
        const productRef = doc(db, 'products', item.productId);
        const productDoc = await getDoc(productRef);
        if (productDoc.exists()) {
          const productData = productDoc.data();
          const newStock = (productData.currentStock || 0) - item.quantity;
          await updateDoc(productRef, { currentStock: newStock });
        }
      }

      toast.success('✅ Sale recorded successfully!');
      setFormData({
        customerId: '',
        invoiceNumber: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        items: [],
        totalAmount: 0,
        taxAmount: 0,
        discount: 0,
        grandTotal: 0,
        paymentStatus: 'pending',
        paymentMethod: 'cash',
        notes: ''
      });
      loadSalesData();
    } catch (error) {
      console.error('Error recording sale:', error);
      toast.error('Failed to record sale');
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
      gap: '20px',
      marginBottom: '25px'
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
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      backgroundColor: '#0f172a',
      borderRadius: '8px',
      overflow: 'hidden'
    },
    tableHeader: {
      backgroundColor: '#334155',
      color: '#e2e8f0',
      padding: '12px',
      textAlign: 'left',
      fontWeight: '600'
    },
    tableCell: {
      padding: '12px',
      borderBottom: '1px solid #334155',
      color: '#cbd5e1'
    },
    badge: {
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span style={{color: '#10b981'}}>💰</span>
          売上管理 / Sales Management
        </h2>
      </div>

      <div style={styles.formGrid}>
        {/* New Sale Form */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>新規売上 / New Sale</h3>
          
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={styles.label}>顧客 / Customer *</label>
              <select 
                value={formData.customerId}
                onChange={(e) => setFormData({...formData, customerId: e.target.value})}
                style={styles.select}
                required
              >
                <option value="">顧客を選択 / Select Customer</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} • {customer.mobileNumber || customer.landlineNumber}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={styles.label}>製品を追加 / Add Product</label>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <select 
                  value={selectedProduct.productId}
                  onChange={(e) => {
                    const product = products.find(p => p.id === e.target.value);
                    setSelectedProduct({
                      ...selectedProduct,
                      productId: e.target.value,
                      unitPrice: product ? product.sellPrice : 0
                    });
                  }}
                  style={{...styles.select, flex: 2}}
                >
                  <option value="">製品を選択 / Select Product</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} • {formatCurrency(product.sellPrice)} • 在庫: {product.currentStock || 0}
                    </option>
                  ))}
                </select>
                <input 
                  type="number" 
                  min="1"
                  value={selectedProduct.quantity}
                  onChange={(e) => setSelectedProduct({...selectedProduct, quantity: e.target.value})}
                  style={{...styles.input, flex: 1}}
                  placeholder="数量"
                />
                <button 
                  type="button" 
                  style={styles.button}
                  onClick={handleAddItem}
                >
                  ➕ 追加
                </button>
              </div>
            </div>

            {/* Items List */}
            {formData.items.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={styles.label}>製品リスト / Items List</h4>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.tableHeader}>製品 / Product</th>
                      <th style={styles.tableHeader}>数量 / Qty</th>
                      <th style={styles.tableHeader}>単価 / Unit Price</th>
                      <th style={styles.tableHeader}>合計 / Total</th>
                      <th style={styles.tableHeader}>操作 / Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, index) => (
                      <tr key={index}>
                        <td style={styles.tableCell}>{item.productName}</td>
                        <td style={styles.tableCell}>{item.quantity}</td>
                        <td style={styles.tableCell}>{formatCurrency(item.unitPrice)}</td>
                        <td style={styles.tableCell}>{formatCurrency(item.total)}</td>
                        <td style={styles.tableCell}>
                          <button 
                            type="button"
                            style={{...styles.button, padding: '6px 12px', backgroundColor: '#dc2626'}}
                            onClick={() => handleRemoveItem(index)}
                          >
                            🗑️ 削除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            {formData.items.length > 0 && (
              <div style={styles.card}>
                <h4 style={styles.sectionTitle}>合計 / Summary</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={styles.label}>小計 / Subtotal:</span>
                  <span style={{color: '#e2e8f0', fontWeight: '600'}}>{formatCurrency(formData.totalAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={styles.label}>税金 / Tax:</span>
                  <span style={{color: '#e2e8f0', fontWeight: '600'}}>{formatCurrency(formData.taxAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={styles.label}>割引 / Discount:</span>
                  <input 
                    type="number"
                    value={formData.discount}
                    onChange={(e) => {
                      const discount = parseFloat(e.target.value) || 0;
                      setFormData({
                        ...formData,
                        discount,
                        grandTotal: formData.totalAmount + formData.taxAmount - discount
                      });
                    }}
                    style={{...styles.input, width: '120px'}}
                    placeholder="0"
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', paddingTop: '10px', borderTop: '1px solid #334155' }}>
                  <span style={styles.label}>合計金額 / Grand Total:</span>
                  <span style={{color: '#10b981', fontSize: '18px', fontWeight: 'bold'}}>
                    {formatCurrency(formData.grandTotal)}
                  </span>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={styles.label}>支払い方法 / Payment Method</label>
                  <select 
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                    style={styles.select}
                  >
                    <option value="cash">💵 現金 / Cash</option>
                    <option value="card">💳 カード / Card</option>
                    <option value="bank">🏦 銀行振込 / Bank Transfer</option>
                    <option value="credit">📝 掛売 / Credit</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  style={{...styles.button, width: '100%', padding: '12px'}}
                  disabled={loading}
                >
                  {loading ? '処理中...' : '✅ 売上を登録'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Recent Sales */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>最近の売上 / Recent Sales</h3>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {sales.slice(0, 10).map(sale => (
              <div key={sale.id} style={{
                padding: '15px',
                borderBottom: '1px solid #334155',
                backgroundColor: '#1e293b',
                borderRadius: '8px',
                marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{color: '#e2e8f0'}}>{sale.customerName}</strong>
                  <span style={{
                    ...styles.badge,
                    backgroundColor: sale.paymentStatus === 'paid' ? '#10b981' : '#f59e0b',
                    color: 'white'
                  }}>
                    {sale.paymentStatus}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <small style={{color: '#94a3b8'}}>請求書: {sale.invoiceNumber}</small>
                  <small style={{color: '#94a3b8'}}>
                    {new Date(sale.invoiceDate).toLocaleDateString('ja-JP')}
                  </small>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{color: '#cbd5e1'}}>{sale.items?.length || 0} 品目</span>
                  <strong style={{color: '#10b981'}}>{formatCurrency(sale.grandTotal)}</strong>
                </div>
              </div>
            ))}
            {sales.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                売上記録はありません
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesManagement;