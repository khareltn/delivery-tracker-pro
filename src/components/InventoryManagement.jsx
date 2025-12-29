// components/InventoryManagement.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { toast } from 'react-toastify';

const InventoryManagement = ({ company, products, formatCurrency }) => {
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [adjustment, setAdjustment] = useState({
    productId: '',
    quantity: 0,
    reason: '',
    type: 'adjustment'
  });

  useEffect(() => {
    loadInventory();
  }, [company]);

  const loadInventory = async () => {
    if (!company?.id) return;
    try {
      setLoading(true);
      const productsQuery = query(
        collection(db, 'products'),
        where('companyId', '==', company.id)
      );
      const snapshot = await getDocs(productsQuery);
      const inventoryData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.currentStock || 0) - (a.currentStock || 0));
      setInventory(inventoryData);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStockAdjustment = async () => {
    if (!adjustment.productId || adjustment.quantity === 0) {
      toast.error('Please select product and enter quantity');
      return;
    }

    try {
      const product = inventory.find(p => p.id === adjustment.productId);
      if (!product) return;

      const newStock = (product.currentStock || 0) + parseFloat(adjustment.quantity);
      
      await updateDoc(doc(db, 'products', adjustment.productId), {
        currentStock: newStock,
        lastUpdated: new Date()
      });

      // Log adjustment
      await updateDoc(doc(db, 'inventory_logs'), {
        productId: adjustment.productId,
        productName: product.name,
        previousStock: product.currentStock || 0,
        adjustment: parseFloat(adjustment.quantity),
        newStock,
        reason: adjustment.reason,
        type: adjustment.type,
        companyId: company.id,
        createdAt: new Date(),
        createdBy: 'inventory_manager'
      });

      toast.success('✅ Stock updated successfully!');
      setAdjustment({ productId: '', quantity: 0, reason: '', type: 'adjustment' });
      loadInventory();
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Failed to update stock');
    }
  };

  const filteredInventory = inventory.filter(product => {
    // Filter by status
    if (filter === 'low') {
      return (product.currentStock || 0) <= (product.stockLowerLimit || 10);
    } else if (filter === 'out') {
      return (product.currentStock || 0) === 0;
    } else if (filter === 'food') {
      return product.isFoodItem === true;
    } else if (filter === 'non-food') {
      return product.isFoodItem === false;
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        product.name?.toLowerCase().includes(term) ||
        product.mainCategory?.toLowerCase().includes(term) ||
        product.sku?.toLowerCase().includes(term)
      );
    }

    return true;
  });

  const lowStockCount = inventory.filter(p => (p.currentStock || 0) <= (p.stockLowerLimit || 10)).length;
  const outOfStockCount = inventory.filter(p => (p.currentStock || 0) === 0).length;
  const totalValue = inventory.reduce((sum, product) => {
    return sum + ((product.currentStock || 0) * (product.price || 0));
  }, 0);

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
    controls: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      flexWrap: 'wrap',
      gap: '15px'
    },
    searchInput: {
      padding: '10px 15px',
      backgroundColor: '#1e293b',
      border: '1px solid #475569',
      borderRadius: '6px',
      color: '#e2e8f0',
      fontSize: '14px',
      minWidth: '300px'
    },
    filterBar: {
      display: 'flex',
      gap: '10px',
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
    stockIndicator: (stock, limit) => ({
      backgroundColor: 
        stock === 0 ? '#dc2626' :
        stock <= (limit || 10) ? '#f59e0b' :
        stock <= (limit || 10) * 2 ? '#3b82f6' : '#10b981',
      color: stock <= (limit || 10) ? 'white' : 'black',
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
          <span style={{color: '#6366f1'}}>📦</span>
          在庫管理 / Inventory Management
        </h2>
      </div>

      {/* Stats Cards */}
      <div style={styles.stats}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>総製品数 / Total Products</div>
          <div style={{...styles.statValue, color: '#e2e8f0'}}>{inventory.length}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>在庫切れ / Out of Stock</div>
          <div style={{...styles.statValue, color: '#dc2626'}}>{outOfStockCount}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>在庫不足 / Low Stock</div>
          <div style={{...styles.statValue, color: '#f59e0b'}}>{lowStockCount}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>在庫評価額 / Inventory Value</div>
          <div style={{...styles.statValue, color: '#10b981'}}>{formatCurrency(totalValue)}</div>
        </div>
      </div>

      {/* Stock Adjustment Form */}
      <div style={{
        backgroundColor: '#0f172a',
        borderRadius: '10px',
        padding: '20px',
        marginBottom: '25px',
        border: '1px solid #334155'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#e2e8f0',
          marginBottom: '15px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>📊</span>
          在庫調整 / Stock Adjustment
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
              製品 / Product *
            </label>
            <select 
              value={adjustment.productId}
              onChange={(e) => setAdjustment({...adjustment, productId: e.target.value})}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="">製品を選択 / Select Product</option>
              {inventory.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} • 現在: {product.currentStock || 0}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
              数量調整 / Quantity Adjustment *
            </label>
            <input 
              type="number" 
              value={adjustment.quantity}
              onChange={(e) => setAdjustment({...adjustment, quantity: parseFloat(e.target.value) || 0})}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '14px'
              }}
              placeholder="正の数は追加、負の数は減少"
            />
            <small style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              例: +10 (追加), -5 (減少)
            </small>
          </div>

          <div>
            <label style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
              理由 / Reason
            </label>
            <select 
              value={adjustment.reason}
              onChange={(e) => setAdjustment({...adjustment, reason: e.target.value})}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="">理由を選択 / Select Reason</option>
              <option value="damaged">破損 / Damaged</option>
              <option value="expired">期限切れ / Expired</option>
              <option value="received">入荷 / Received</option>
              <option value="sold">販売 / Sold</option>
              <option value="adjustment">調整 / Adjustment</option>
              <option value="other">その他 / Other</option>
            </select>
          </div>

          <div>
            <label style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
              タイプ / Type
            </label>
            <select 
              value={adjustment.type}
              onChange={(e) => setAdjustment({...adjustment, type: e.target.value})}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="adjustment">調整 / Adjustment</option>
              <option value="receipt">入庫 / Receipt</option>
              <option value="issue">出庫 / Issue</option>
            </select>
          </div>
        </div>

        <button 
          style={{
            marginTop: '15px',
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
          }}
          onClick={handleStockAdjustment}
          disabled={loading}
        >
          {loading ? '処理中...' : '✅ 在庫を更新'}
        </button>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <input 
          type="text" 
          placeholder="製品名、カテゴリ、SKUで検索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        
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
              ...(filter === 'low' ? styles.filterButtonActive : {})
            }}
            onClick={() => setFilter('low')}
          >
            ⚠️ 在庫不足 / Low Stock
          </button>
          <button 
            style={{
              ...styles.filterButton,
              ...(filter === 'out' ? styles.filterButtonActive : {})
            }}
            onClick={() => setFilter('out')}
          >
            🔴 在庫切れ / Out of Stock
          </button>
          <button 
            style={{
              ...styles.filterButton,
              ...(filter === 'food' ? styles.filterButtonActive : {})
            }}
            onClick={() => setFilter('food')}
          >
            🍽️ 食品 / Food Items
          </button>
          <button 
            style={{
              ...styles.filterButton,
              ...(filter === 'non-food' ? styles.filterButtonActive : {})
            }}
            onClick={() => setFilter('non-food')}
          >
            📦 非食品 / Non-Food
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>製品名 / Product</th>
              <th style={styles.tableHeader}>カテゴリ / Category</th>
              <th style={styles.tableHeader}>SKU</th>
              <th style={styles.tableHeader}>現在在庫 / Current Stock</th>
              <th style={styles.tableHeader}>最低在庫 / Minimum Stock</th>
              <th style={styles.tableHeader}>ステータス / Status</th>
              <th style={styles.tableHeader}>仕入価格 / Cost Price</th>
              <th style={styles.tableHeader}>在庫評価額 / Stock Value</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map(product => {
              const stockValue = (product.currentStock || 0) * (product.price || 0);
              
              return (
                <tr key={product.id}>
                  <td style={styles.tableCell}>
                    <strong style={{ color: '#e2e8f0' }}>{product.name}</strong>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {product.unitSize || 'N/A'} • {product.supplierName || 'No Supplier'}
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    <div style={{ color: '#cbd5e1' }}>{product.mainCategory || 'N/A'}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {product.subCategory || 'No Sub-Category'}
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    {product.sku || 'N/A'}
                  </td>
                  <td style={styles.tableCell}>
                    <strong style={{ color: '#e2e8f0', fontSize: '16px' }}>
                      {product.currentStock || 0}
                    </strong>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {product.unit || 'units'}
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    {product.stockLowerLimit || 10}
                  </td>
                  <td style={styles.tableCell}>
                    <span style={styles.stockIndicator(product.currentStock || 0, product.stockLowerLimit)}>
                      {product.currentStock === 0 ? '在庫切れ' : 
                       (product.currentStock || 0) <= (product.stockLowerLimit || 10) ? '在庫不足' : '在庫あり'}
                    </span>
                  </td>
                  <td style={styles.tableCell}>
                    {formatCurrency(product.price || 0)}
                  </td>
                  <td style={styles.tableCell}>
                    <strong style={{ color: '#10b981' }}>
                      {formatCurrency(stockValue)}
                    </strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {filteredInventory.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
            {searchTerm ? '該当する製品が見つかりません' : '製品がありません'}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryManagement;