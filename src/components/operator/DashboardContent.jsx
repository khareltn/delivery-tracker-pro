// src/components/operator/DashboardContent.jsx
import React from 'react';
import { styles } from './operatorStyles';

const DashboardContent = ({
  stats,
  activities,
  deliveries,
  company,
  formatDate,
  getStatusBadgeStyle,
  setActiveTab
}) => {
  const statCards = [
    { title: 'Total Drivers', value: stats.totalDrivers, icon: '👨‍✈️', color: '#3498db' },
    { title: 'Total Customers', value: stats.totalCustomers, icon: '👥', color: '#2ecc71' },
    { title: 'Total Suppliers', value: stats.totalSuppliers, icon: '🏢', color: '#9b59b6' },
    { title: 'Total Products', value: stats.totalProducts, icon: '📦', color: '#e74c3c' },
    { title: 'Pending Deliveries', value: stats.pendingDeliveries, icon: '⏳', color: '#f39c12' },
    { title: 'Active Deliveries', value: stats.activeDeliveries, icon: '🚚', color: '#1abc9c' },
  ];

  const getActivityLabel = (action) => {
    const labels = {
      'USER_CREATED': '👤 User Created',
      'USER_UPDATED': '📝 User Updated',
      'USER_DELETED': '🗑️ User Deleted',
      'DELIVERY_CREATED': '📦 Delivery Created',
      'DELIVERY_ASSIGNED': '👨‍✈️ Delivery Assigned',
      'DELIVERY_STATUS_CHANGED': '🔄 Status Changed',
      'LOGIN': '🔐 Login',
      'LOGOUT': '🚪 Logout',
    };
    return labels[action] || `📋 ${action.replace(/_/g, ' ')}`;
  };

  return (
    <div>
      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        {statCards.map((stat, index) => (
          <div key={index} style={styles.statCard}>
            <div style={{...styles.statIcon, color: stat.color, backgroundColor: `${stat.color}20`}}>
              {stat.icon}
            </div>
            <div style={{...styles.statValue, color: stat.color}}>
              {stat.value}
            </div>
            <div style={styles.statLabel}>{stat.title}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={styles.quickActions}>
        <div style={styles.quickActionButton} onClick={() => setActiveTab('ledger')}>
          <div style={{...styles.quickActionIcon, color: '#3498db'}}>📝</div>
          <div style={styles.quickActionText}>Register New</div>
        </div>
        <div style={styles.quickActionButton} onClick={() => setActiveTab('invoice')}>
          <div style={{...styles.quickActionIcon, color: '#2ecc71'}}>🧾</div>
          <div style={styles.quickActionText}>Create Invoice</div>
        </div>
        <div style={styles.quickActionButton} onClick={() => setActiveTab('sales-management')}>
          <div style={{...styles.quickActionIcon, color: '#9b59b6'}}>💰</div>
          <div style={styles.quickActionText}>Record Sale</div>
        </div>
        <div style={styles.quickActionButton} onClick={() => setActiveTab('purchase-management')}>
          <div style={{...styles.quickActionIcon, color: '#e74c3c'}}>🛒</div>
          <div style={styles.quickActionText}>New Purchase</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Left: Recent Activities */}
        <div style={{ flex: 2 }}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Recent Activities</h3>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {activities.length > 0 ? (
                activities.slice(0, 8).map(activity => (
                  <div key={activity.id} style={styles.activityItem}>
                    <div style={styles.activityText}>
                      <strong>{getActivityLabel(activity.action)}</strong>
                    </div>
                    <div style={styles.activityText}>
                      {activity.details?.description || 'No description'}
                    </div>
                    <div style={styles.activityTime}>
                      By: {activity.performedBy || 'Unknown'} • {formatDate(activity.timestamp)}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#95a5a6' }}>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>📊</div>
                  <p>No activities recorded yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Recent Deliveries + System Info */}
        <div style={{ flex: 1 }}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Recent Deliveries</h3>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {deliveries.length > 0 ? (
                deliveries.slice(0, 5).map(delivery => (
                  <div key={delivery.id} style={styles.deliveryItem}>
                    <div style={styles.deliveryInfo}>
                      <div style={styles.deliveryName}>{delivery.customerName || 'Unknown'}</div>
                      <div style={styles.deliveryAddress}>
                        {delivery.customerAddress?.slice(0, 25)}...
                      </div>
                      <div style={styles.deliveryTime}>{formatDate(delivery.createdAt)}</div>
                    </div>
                    <span style={getStatusBadgeStyle(delivery.status)}>
                      {delivery.status?.toUpperCase()}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', color: '#95a5a6' }}>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>📦</div>
                  <p>No deliveries yet</p>
                </div>
              )}
            </div>
          </div>

          {/* System Info */}
          <div style={styles.systemInfo}>
            <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '16px' }}>
              System Information
            </h4>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Company:</span>
              <span style={styles.infoValue}>{company.name || 'Loading...'}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Financial Year:</span>
              <span style={styles.infoValue}>{company.financialYear || '2025-2026'}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Last Updated:</span>
              <span style={styles.infoValue}>{formatDate(new Date())}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardContent;