// components/AccountReceivableManagement.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { toast } from 'react-toastify';

const AccountReceivableManagement = ({ company, currentUser, customers, formatCurrency }) => {
  const [loading, setLoading] = useState(false);
  const [receivables, setReceivables] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadReceivables();
  }, [company]);

  const loadReceivables = async () => {
    if (!company?.id) return;
    try {
      const salesQuery = query(
        collection(db, 'sales'),
        where('companyId', '==', company.id),
        where('paymentStatus', '==', 'pending')
      );
      const snapshot = await getDocs(salesQuery);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReceivables(data);
    } catch (error) {
      console.error('Error loading receivables:', error);
    }
  };

  const handleMarkAsPaid = async (saleId) => {
    if (!window.confirm('この売上を支払い済みとしてマークしますか？')) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, 'sales', saleId), {
        paymentStatus: 'paid',
        paymentDate: new Date(),
        updatedAt: new Date()
      });
      
      toast.success('✅ 支払い済みとしてマークしました');
      loadReceivables();
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast.error('更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const filteredReceivables = receivables.filter(rec => {
    if (filter === 'overdue') {
      const dueDate = new Date(rec.invoiceDate);
      dueDate.setDate(dueDate.getDate() + 30); // 30 days credit
      return new Date() > dueDate;
    }
    return true;
  });

  const totalReceivable = receivables.reduce((sum, rec) => sum + (rec.grandTotal || 0), 0);
  const overdueAmount = receivables.filter(rec => {
    const dueDate = new Date(rec.invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);
    return new Date() > dueDate;
  }).reduce((sum, rec) => sum + (rec.grandTotal || 0), 0);

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
    filterBar: {
      display: 'flex',
      gap: '10px',
      marginBottom: '20px',
      flexWrap: 'wrap'
    },
    filterButton: {
      padding: '8px 16px',
      backgroundColor: '#334155',
      color: '#cbd5e1',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      '&:hover': {
        backgroundColor: '#475569'
      }
    },
    filterButtonActive: {
      backgroundColor: '#3b82f6',
      color: 'white'
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
    overdueBadge: {
      backgroundColor: '#dc2626',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600'
    },
    dueSoonBadge: {
      backgroundColor: '#f59e0b',
      color: 'black',
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600'
    }
  };

  const isOverdue = (invoiceDate) => {
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);
    return new Date() > dueDate;
  };

  const isDueSoon = (invoiceDate) => {
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);
    const daysUntilDue = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
    return daysUntilDue <= 7 && daysUntilDue > 0;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span style={{color: '#f59e0b'}}>📄</span>
          売掛金管理 / Account Receivable Management
        </h2>
      </div>

      {/* Stats Cards */}
      <div style={styles.stats}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>総売掛金 / Total Receivable</div>
          <div style={{...styles.statValue, color: '#e2e8f0'}}>{formatCurrency(totalReceivable)}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>延滞額 / Overdue Amount</div>
          <div style={{...styles.statValue, color: '#dc2626'}}>{formatCurrency(overdueAmount)}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>未処理件数 / Pending Invoices</div>
          <div style={{...styles.statValue, color: '#3b82f6'}}>{receivables.length}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>顧客数 / Total Customers</div>
          <div style={{...styles.statValue, color: '#10b981'}}>{customers.length}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={styles.filterBar}>
        <button 
          style={{
            ...styles.filterButton,
            ...(filter === 'all' ? styles.filterButtonActive : {})
          }}
          onClick={() => setFilter('all')}
        >
          すべて / All
        </button>
        <button 
          style={{
            ...styles.filterButton,
            ...(filter === 'overdue' ? styles.filterButtonActive : {})
          }}
          onClick={() => setFilter('overdue')}
        >
          延滞 / Overdue
        </button>
        <button 
          style={styles.filterButton}
          onClick={() => setFilter('dueSoon')}
        >
          期限間近 / Due Soon
        </button>
      </div>

      {/* Receivables Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>請求書番号 / Invoice #</th>
              <th style={styles.tableHeader}>顧客 / Customer</th>
              <th style={styles.tableHeader}>請求日 / Invoice Date</th>
              <th style={styles.tableHeader}>金額 / Amount</th>
              <th style={styles.tableHeader}>ステータス / Status</th>
              <th style={styles.tableHeader}>操作 / Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReceivables.map(receivable => {
              const dueDate = new Date(receivable.invoiceDate);
              dueDate.setDate(dueDate.getDate() + 30);
              
              return (
                <tr key={receivable.id}>
                  <td style={styles.tableCell}>
                    <strong>{receivable.invoiceNumber}</strong>
                  </td>
                  <td style={styles.tableCell}>
                    {receivable.customerName}
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {receivable.customerMobile || ''}
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    {new Date(receivable.invoiceDate).toLocaleDateString('ja-JP')}
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      期限: {dueDate.toLocaleDateString('ja-JP')}
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    <strong style={{ color: '#e2e8f0' }}>
                      {formatCurrency(receivable.grandTotal)}
                    </strong>
                  </td>
                  <td style={styles.tableCell}>
                    {isOverdue(receivable.invoiceDate) ? (
                      <span style={styles.overdueBadge}>延滞 / Overdue</span>
                    ) : isDueSoon(receivable.invoiceDate) ? (
                      <span style={styles.dueSoonBadge}>期限間近 / Due Soon</span>
                    ) : (
                      <span style={{
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        処理中 / Pending
                      </span>
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    <button 
                      style={styles.button}
                      onClick={() => handleMarkAsPaid(receivable.id)}
                      disabled={loading}
                    >
                      ✅ 支払い済み
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {filteredReceivables.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
            {filter === 'all' ? '売掛金はありません' : '該当する売掛金はありません'}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountReceivableManagement;