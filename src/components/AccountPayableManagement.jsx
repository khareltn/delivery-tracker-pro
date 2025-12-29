// components/AccountPayableManagement.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { toast } from 'react-toastify';

const AccountPayableManagement = ({ company, suppliers, formatCurrency }) => {
  const [loading, setLoading] = useState(false);
  const [payables, setPayables] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadPayables();
  }, [company]);

  const loadPayables = async () => {
    if (!company?.id) return;
    try {
      const purchasesQuery = query(
        collection(db, 'purchases'),
        where('companyId', '==', company.id),
        where('paymentStatus', '==', 'pending')
      );
      const snapshot = await getDocs(purchasesQuery);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPayables(data);
    } catch (error) {
      console.error('Error loading payables:', error);
    }
  };

  const handleMarkAsPaid = async (purchaseId) => {
    if (!window.confirm('この請求を支払い済みとしてマークしますか？')) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, 'purchases', purchaseId), {
        paymentStatus: 'paid',
        paymentDate: new Date(),
        updatedAt: new Date()
      });
      
      toast.success('✅ 支払い済みとしてマークしました');
      loadPayables();
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast.error('更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const totalPayable = payables.reduce((sum, pay) => sum + (pay.grandTotal || 0), 0);

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
    stats: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '15px',
      marginBottom: '25px'
    },
    statCard: {
      backgroundColor: '#0f172a',
      borderRadius: '10px',
      padding: '20px',
      border: '1px solid #334155',
      textAlign: 'center'
    },
    statValue: {
      fontSize: '28px',
      fontWeight: 'bold',
      margin: '10px 0'
    },
    statLabel: {
      color: '#94a3b8',
      fontSize: '14px'
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
    button: {
      padding: '6px 12px',
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      '&:hover': {
        backgroundColor: '#2563eb'
      }
    },
    statusBadge: (status) => ({
      backgroundColor: 
        status === 'delivered' ? '#10b981' : 
        status === 'shipped' ? '#3b82f6' :
        status === 'processing' ? '#f59e0b' : '#64748b',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      display: 'inline-block'
    })
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span style={{color: '#ef4444'}}>💳</span>
          買掛金管理 / Account Payable Management
        </h2>
      </div>

      {/* Stats Cards */}
      <div style={styles.stats}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>総買掛金 / Total Payable</div>
          <div style={{...styles.statValue, color: '#e2e8f0'}}>{formatCurrency(totalPayable)}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>未処理件数 / Pending Invoices</div>
          <div style={{...styles.statValue, color: '#3b82f6'}}>{payables.length}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>仕入先数 / Total Suppliers</div>
          <div style={{...styles.statValue, color: '#10b981'}}>{suppliers.length}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>直近30日 / Last 30 Days</div>
          <div style={{...styles.statValue, color: '#f59e0b'}}>
            {formatCurrency(payables
              .filter(p => {
                const orderDate = new Date(p.orderDate);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return orderDate >= thirtyDaysAgo;
              })
              .reduce((sum, p) => sum + (p.grandTotal || 0), 0)
            )}
          </div>
        </div>
      </div>

      {/* Payables Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>発注番号 / PO #</th>
              <th style={styles.tableHeader}>仕入先 / Supplier</th>
              <th style={styles.tableHeader}>発注日 / Order Date</th>
              <th style={styles.tableHeader}>納品状況 / Delivery Status</th>
              <th style={styles.tableHeader}>金額 / Amount</th>
              <th style={styles.tableHeader}>支払い / Payment</th>
              <th style={styles.tableHeader}>操作 / Actions</th>
            </tr>
          </thead>
          <tbody>
            {payables.map(payable => (
              <tr key={payable.id}>
                <td style={styles.tableCell}>
                  <strong>{payable.purchaseOrderNumber}</strong>
                </td>
                <td style={styles.tableCell}>
                  {payable.supplierName}
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {payable.supplierMobile || ''}
                  </div>
                </td>
                <td style={styles.tableCell}>
                  {new Date(payable.orderDate).toLocaleDateString('ja-JP')}
                  {payable.expectedDelivery && (
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      納品予定: {new Date(payable.expectedDelivery).toLocaleDateString('ja-JP')}
                    </div>
                  )}
                </td>
                <td style={styles.tableCell}>
                  <span style={styles.statusBadge(payable.status)}>
                    {payable.status}
                  </span>
                </td>
                <td style={styles.tableCell}>
                  <strong style={{ color: '#e2e8f0' }}>
                    {formatCurrency(payable.grandTotal)}
                  </strong>
                </td>
                <td style={styles.tableCell}>
                  {payable.paymentStatus === 'paid' ? (
                    <span style={{
                      backgroundColor: '#10b981',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      支払い済み / Paid
                    </span>
                  ) : (
                    <span style={{
                      backgroundColor: '#f59e0b',
                      color: 'black',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      未払い / Unpaid
                    </span>
                  )}
                </td>
                <td style={styles.tableCell}>
                  {payable.paymentStatus !== 'paid' && (
                    <button 
                      style={styles.button}
                      onClick={() => handleMarkAsPaid(payable.id)}
                      disabled={loading}
                    >
                      ✅ 支払い済み
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {payables.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
            買掛金はありません
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountPayableManagement;