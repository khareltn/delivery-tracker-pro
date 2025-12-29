// components/DeliveryManagement.jsx
import React, { useState } from 'react';
import { toast } from 'react-toastify';

const DeliveryManagement = ({ 
  company, 
  currentUser, 
  drivers, 
  deliveries, 
  onCreateDelivery, 
  onAssignDelivery, 
  onUpdateStatus,
  loadDeliveries,
  logActivity 
}) => {
  const [newDelivery, setNewDelivery] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    customerLocation: null,
    deliveryFee: 500,
    items: [],
    notes: ''
  });
  const [selectedDriver, setSelectedDriver] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateDelivery = async (e) => {
    e.preventDefault();
    if (!newDelivery.customerName || !newDelivery.customerAddress) {
      toast.error('Customer name and address are required');
      return;
    }

    try {
      setLoading(true);
      await onCreateDelivery(newDelivery);
      setNewDelivery({
        customerName: '',
        customerPhone: '',
        customerAddress: '',
        customerLocation: null,
        deliveryFee: 500,
        items: [],
        notes: ''
      });
      toast.success('✅ Delivery created successfully!');
    } catch (error) {
      toast.error('Failed to create delivery');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (deliveryId) => {
    if (!selectedDriver) {
      toast.error('Please select a driver first');
      return;
    }
    await onAssignDelivery(deliveryId, selectedDriver);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'assigned': return '#3b82f6';
      case 'picked_up': return '#8b5cf6';
      case 'in_transit': return '#10b981';
      case 'delivered': return '#059669';
      default: return '#64748b';
    }
  };

  return (
    <div>
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Create New Delivery</h3>
        
        <form onSubmit={handleCreateDelivery} style={styles.form}>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Customer Name *</label>
              <input
                type="text"
                value={newDelivery.customerName}
                onChange={(e) => setNewDelivery({...newDelivery, customerName: e.target.value})}
                style={styles.input}
                placeholder="Enter customer name"
                required
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Customer Phone</label>
              <input
                type="tel"
                value={newDelivery.customerPhone}
                onChange={(e) => setNewDelivery({...newDelivery, customerPhone: e.target.value})}
                style={styles.input}
                placeholder="Enter phone number"
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Delivery Address *</label>
              <textarea
                value={newDelivery.customerAddress}
                onChange={(e) => setNewDelivery({...newDelivery, customerAddress: e.target.value})}
                style={{...styles.input, minHeight: '80px'}}
                placeholder="Enter full delivery address"
                required
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Delivery Fee (¥)</label>
              <input
                type="number"
                value={newDelivery.deliveryFee}
                onChange={(e) => setNewDelivery({...newDelivery, deliveryFee: parseInt(e.target.value) || 0})}
                style={styles.input}
                placeholder="500"
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Notes</label>
              <textarea
                value={newDelivery.notes}
                onChange={(e) => setNewDelivery({...newDelivery, notes: e.target.value})}
                style={{...styles.input, minHeight: '80px'}}
                placeholder="Any special instructions..."
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            style={styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Creating...' : '📦 Create Delivery'}
          </button>
        </form>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Manage Deliveries</h3>
        
        <div style={styles.filterSection}>
          <div style={styles.driverSelector}>
            <label style={styles.label}>Assign to Driver:</label>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              style={styles.select}
            >
              <option value="">Select a driver</option>
              {drivers.filter(d => d.status === 'active').map(driver => (
                <option key={driver.id} value={driver.id}>
                  🚚 {driver.name} - {driver.vehicleNumber || 'No vehicle'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.deliveriesList}>
          {deliveries.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📦</div>
              <h4>No Deliveries Found</h4>
              <p>Create your first delivery to get started.</p>
            </div>
          ) : (
            deliveries.map(delivery => (
              <div key={delivery.id} style={styles.deliveryCard}>
                <div style={styles.deliveryHeader}>
                  <div>
                    <h4 style={styles.deliveryTitle}>
                      Delivery #{delivery.id.slice(-6)}
                    </h4>
                    <div style={styles.deliveryMeta}>
                      <span>👤 {delivery.customerName}</span>
                      <span>📞 {delivery.customerPhone || 'No phone'}</span>
                      <span>📍 {delivery.customerAddress.substring(0, 50)}...</span>
                    </div>
                  </div>
                  <div>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: getStatusColor(delivery.status)
                    }}>
                      {delivery.status.replace('_', ' ')}
                    </span>
                    {delivery.driverName && (
                      <div style={styles.driverBadge}>🚚 {delivery.driverName}</div>
                    )}
                  </div>
                </div>
                
                <div style={styles.deliveryDetails}>
                  <div style={styles.detailItem}>
                    <strong>Created:</strong> {new Date(delivery.createdAt?.toDate?.() || delivery.createdAt).toLocaleString('ja-JP')}
                  </div>
                  <div style={styles.detailItem}>
                    <strong>Fee:</strong> ¥{delivery.deliveryFee || '0'}
                  </div>
                  {delivery.notes && (
                    <div style={styles.detailItem}>
                      <strong>Notes:</strong> {delivery.notes}
                    </div>
                  )}
                </div>
                
                <div style={styles.deliveryActions}>
                  {delivery.status === 'pending' && (
                    <button
                      onClick={() => handleAssign(delivery.id)}
                      style={styles.assignButton}
                      disabled={!selectedDriver}
                    >
                      📋 Assign to Driver
                    </button>
                  )}
                  
                  {delivery.status === 'assigned' && (
                    <button
                      onClick={() => onUpdateStatus(delivery.id, 'picked_up')}
                      style={styles.actionButton}
                    >
                      📦 Mark as Picked Up
                    </button>
                  )}
                  
                  {delivery.status === 'picked_up' && (
                    <button
                      onClick={() => onUpdateStatus(delivery.id, 'in_transit')}
                      style={styles.actionButton}
                    >
                      🚚 Mark as In Transit
                    </button>
                  )}
                  
                  {delivery.status === 'in_transit' && (
                    <button
                      onClick={() => onUpdateStatus(delivery.id, 'delivered')}
                      style={styles.actionButton}
                    >
                      ✅ Mark as Delivered
                    </button>
                  )}
                  
                  <button
                    onClick={() => toast.info(`Viewing delivery #${delivery.id.slice(-6)} details`)}
                    style={styles.viewButton}
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  section: {
    marginBottom: '30px'
  },
  sectionTitle: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '20px',
    paddingBottom: '10px',
    borderBottom: '2px solid #3b82f6'
  },
  form: {
    backgroundColor: '#f8fafc',
    padding: '25px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '25px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    marginBottom: '8px',
    fontWeight: '500',
    color: '#374151',
    fontSize: '14px'
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    '&:focus': {
      outline: 'none',
      borderColor: '#3b82f6',
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
    }
  },
  submitButton: {
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#059669'
    },
    '&:disabled': {
      backgroundColor: '#9ca3af',
      cursor: 'not-allowed'
    }
  },
  filterSection: {
    marginBottom: '25px',
    padding: '20px',
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    border: '1px solid #e2e8f0'
  },
  driverSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    flexWrap: 'wrap'
  },
  select: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    minWidth: '250px',
    fontFamily: 'inherit',
    '&:focus': {
      outline: 'none',
      borderColor: '#3b82f6'
    }
  },
  deliveriesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  deliveryCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '20px',
    transition: 'all 0.2s',
    '&:hover': {
      borderColor: '#3b82f6',
      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
    }
  },
  deliveryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '15px',
    flexWrap: 'wrap',
    gap: '10px'
  },
  deliveryTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '8px'
  },
  deliveryMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    color: '#64748b',
    fontSize: '13px'
  },
  statusBadge: {
    color: 'white',
    padding: '5px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    display: 'inline-block',
    marginBottom: '5px'
  },
  driverBadge: {
    backgroundColor: '#e2e8f0',
    color: '#475569',
    padding: '4px 10px',
    borderRadius: '15px',
    fontSize: '12px',
    fontWeight: '500',
    textAlign: 'center'
  },
  deliveryDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px',
    marginBottom: '15px',
    fontSize: '14px',
    color: '#4b5563'
  },
  detailItem: {
    display: 'flex',
    gap: '5px'
  },
  deliveryActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  assignButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#2563eb'
    },
    '&:disabled': {
      backgroundColor: '#9ca3af',
      cursor: 'not-allowed'
    }
  },
  actionButton: {
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#059669'
    }
  },
  viewButton: {
    backgroundColor: 'transparent',
    border: '1px solid #3b82f6',
    color: '#3b82f6',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: '#3b82f6',
      color: 'white'
    }
  },
  emptyState: {
    textAlign: 'center',
    padding: '50px 30px',
    color: '#64748b',
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    border: '2px dashed #e2e8f0'
  },
  emptyIcon: {
    fontSize: '50px',
    marginBottom: '15px',
    opacity: '0.5'
  }
};

export default DeliveryManagement;