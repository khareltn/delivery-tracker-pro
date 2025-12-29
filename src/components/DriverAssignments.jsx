// components/DriverAssignments.jsx
import React, { useState } from 'react';

const DriverAssignments = ({ company, drivers, deliveries, onAssignDelivery }) => {
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState('');

  const pendingDeliveries = deliveries.filter(d => d.status === 'pending');
  const activeDrivers = drivers.filter(d => d.status === 'active' && d.isOnline);

  const handleAssign = async () => {
    if (!selectedDriver || !selectedDelivery) {
      alert('Please select both a driver and a delivery');
      return;
    }
    
    await onAssignDelivery(selectedDelivery, selectedDriver);
    setSelectedDriver('');
    setSelectedDelivery('');
  };

  return (
    <div>
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Driver Assignments - {company.name}</h3>
        <p style={styles.description}>
          Assign pending deliveries to available drivers. Drivers must be online to receive assignments.
        </p>
      </div>

      <div style={styles.grid}>
        {/* Available Drivers Section */}
        <div style={styles.card}>
          <h4 style={styles.cardTitle}>🚚 Available Drivers</h4>
          <p style={styles.cardSubtitle}>Online & Active Drivers</p>
          
          {activeDrivers.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>😴</div>
              <p>No drivers are currently online</p>
            </div>
          ) : (
            <div style={styles.list}>
              {activeDrivers.map(driver => (
                <div 
                  key={driver.id}
                  style={{
                    ...styles.listItem,
                    ...(selectedDriver === driver.id && styles.selectedItem)
                  }}
                  onClick={() => setSelectedDriver(driver.id)}
                >
                  <div style={styles.itemHeader}>
                    <div style={styles.itemIcon}>🚚</div>
                    <div>
                      <div style={styles.itemTitle}>{driver.name}</div>
                      <div style={styles.itemSubtitle}>
                        {driver.vehicleNumber || 'No vehicle'} • {driver.mobileNumber || 'No phone'}
                      </div>
                    </div>
                  </div>
                  <div style={styles.itemStatus}>
                    <span style={styles.onlineDot}></span>
                    Online
                    {driver.isTracking && <span style={styles.trackingBadge}>📦 Tracking</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div style={styles.stats}>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Total Drivers:</span>
              <span style={styles.statValue}>{drivers.length}</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Online:</span>
              <span style={styles.statValue}>{activeDrivers.length}</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Active Deliveries:</span>
              <span style={styles.statValue}>
                {deliveries.filter(d => ['picked_up', 'in_transit'].includes(d.status)).length}
              </span>
            </div>
          </div>
        </div>

        {/* Pending Deliveries Section */}
        <div style={styles.card}>
          <h4 style={styles.cardTitle}>📦 Pending Deliveries</h4>
          <p style={styles.cardSubtitle}>Deliveries waiting for assignment</p>
          
          {pendingDeliveries.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>✅</div>
              <p>No pending deliveries</p>
            </div>
          ) : (
            <div style={styles.list}>
              {pendingDeliveries.map(delivery => (
                <div 
                  key={delivery.id}
                  style={{
                    ...styles.listItem,
                    ...(selectedDelivery === delivery.id && styles.selectedItem)
                  }}
                  onClick={() => setSelectedDelivery(delivery.id)}
                >
                  <div style={styles.itemHeader}>
                    <div style={styles.itemIcon}>📦</div>
                    <div>
                      <div style={styles.itemTitle}>Delivery #{delivery.id.slice(-6)}</div>
                      <div style={styles.itemSubtitle}>
                        👤 {delivery.customerName}
                      </div>
                      <div style={styles.itemAddress}>
                        📍 {delivery.customerAddress.substring(0, 60)}...
                      </div>
                    </div>
                  </div>
                  <div style={styles.itemMeta}>
                    <span style={styles.metaItem}>💰 ¥{delivery.deliveryFee || '0'}</span>
                    <span style={styles.metaItem}>
                      🕒 {new Date(delivery.createdAt?.toDate?.() || delivery.createdAt).toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div style={styles.stats}>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Total Deliveries:</span>
              <span style={styles.statValue}>{deliveries.length}</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Pending:</span>
              <span style={styles.statValue}>{pendingDeliveries.length}</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Assigned:</span>
              <span style={styles.statValue}>
                {deliveries.filter(d => d.status === 'assigned').length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Controls */}
      <div style={styles.assignmentControls}>
        <div style={styles.selectionSummary}>
          {selectedDriver && (
            <div style={styles.selectedInfo}>
              <span style={styles.infoLabel}>Selected Driver:</span>
              <span style={styles.infoValue}>
                🚚 {drivers.find(d => d.id === selectedDriver)?.name}
              </span>
            </div>
          )}
          {selectedDelivery && (
            <div style={styles.selectedInfo}>
              <span style={styles.infoLabel}>Selected Delivery:</span>
              <span style={styles.infoValue}>
                📦 Delivery #{deliveries.find(d => d.id === selectedDelivery)?.id.slice(-6)}
              </span>
            </div>
          )}
        </div>
        
        <button
          onClick={handleAssign}
          style={{
            ...styles.assignButton,
            ...((!selectedDriver || !selectedDelivery) && styles.disabledButton)
          }}
          disabled={!selectedDriver || !selectedDelivery}
        >
          📋 Assign Delivery to Driver
        </button>
      </div>
    </div>
  );
};

const styles = {
  section: {
    marginBottom: '25px'
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '10px'
  },
  description: {
    color: '#64748b',
    fontSize: '15px',
    lineHeight: '1.5'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '25px',
    marginBottom: '30px'
  },
  card: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '25px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '5px'
  },
  cardSubtitle: {
    color: '#64748b',
    fontSize: '14px',
    marginBottom: '20px'
  },
  list: {
    maxHeight: '400px',
    overflowY: 'auto',
    marginBottom: '20px'
  },
  listItem: {
    padding: '15px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    marginBottom: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': {
      borderColor: '#3b82f6',
      backgroundColor: '#f0f9ff'
    }
  },
  selectedItem: {
    borderColor: '#3b82f6',
    backgroundColor: '#f0f9ff',
    boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.1)'
  },
  itemHeader: {
    display: 'flex',
    gap: '12px',
    marginBottom: '8px'
  },
  itemIcon: {
    fontSize: '24px'
  },
  itemTitle: {
    fontWeight: '600',
    color: '#1e293b',
    fontSize: '15px'
  },
  itemSubtitle: {
    color: '#64748b',
    fontSize: '13px',
    marginTop: '2px'
  },
  itemAddress: {
    color: '#94a3b8',
    fontSize: '12px',
    marginTop: '4px'
  },
  itemStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#10b981',
    fontWeight: '500'
  },
  onlineDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#10b981',
    borderRadius: '50%'
  },
  trackingBadge: {
    marginLeft: 'auto',
    backgroundColor: '#e2e8f0',
    color: '#475569',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px'
  },
  itemMeta: {
    display: 'flex',
    gap: '15px',
    marginTop: '8px'
  },
  metaItem: {
    color: '#64748b',
    fontSize: '12px'
  },
  stats: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: '15px',
    borderTop: '1px solid #e2e8f0'
  },
  statItem: {
    textAlign: 'center'
  },
  statLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: '12px',
    marginBottom: '4px'
  },
  statValue: {
    display: 'block',
    fontWeight: 'bold',
    color: '#1e293b',
    fontSize: '18px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#94a3b8'
  },
  emptyIcon: {
    fontSize: '40px',
    marginBottom: '10px',
    opacity: '0.5'
  },
  assignmentControls: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '25px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
  },
  selectionSummary: {
    display: 'flex',
    gap: '30px',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  selectedInfo: {
    backgroundColor: '#f8fafc',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    minWidth: '250px'
  },
  infoLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: '12px',
    marginBottom: '5px'
  },
  infoValue: {
    display: 'block',
    fontWeight: '600',
    color: '#1e293b',
    fontSize: '16px'
  },
  assignButton: {
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    padding: '15px 30px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    width: '100%',
    '&:hover': {
      backgroundColor: '#059669'
    }
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
    '&:hover': {
      backgroundColor: '#9ca3af'
    }
  }
};

export default DriverAssignments;