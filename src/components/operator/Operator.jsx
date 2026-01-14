// src/components/operator/Operator.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { toast } from 'react-toastify';

import Header from './Header';
import Sidebar from './Sidebar';
import LoadingSpinner from './LoadingSpinner';
import DashboardContent from './DashboardContent';

import DeliveryTrackingMap from '../DeliveryTrackingMap';
import DeliveryManagement from '../DeliveryManagement';
import DriverAssignments from '../DriverAssignments';
import SalesManagement from '../SalesManagement';
import AccountReceivableManagement from '../AccountReceivableManagement';
import PurchaseManagement from '../PurchaseManagement';
import AccountPayableManagement from '../AccountPayableManagement';
import InventoryManagement from '../InventoryManagement';
import LedgerTab from '../LedgerTab';
import InvoicePrinting from '../InvoicePrinting';
import CategoryManagement from '../CategoryManagement';

import { styles } from './operatorStyles';
import { useOperatorData } from './useOperatorData';

const Operator = ({ selectedCompany, currentUser }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState('dashboard');

  const {
    company,
    drivers,
    customers,
    suppliers,
    deliveries,
    products,
    activities,
    stats,
    loading,
    formatCurrency,
    formatDate,
    getStatusColor,
    getActivityLabel
  } = useOperatorData(selectedCompany, currentUser);

  // Spinner animation
  useEffect(() => {
    const styleSheet = document.styleSheets[0];
    const keyframes = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
    if (!Array.from(styleSheet.cssRules).some(rule => rule.name === 'spin')) {
      styleSheet.insertRule(keyframes, styleSheet.cssRules.length);
    }
  }, []);

  const getStatusBadgeStyle = (status) => ({
    ...styles.statusBadge,
    backgroundColor: getStatusColor(status),
    color: ['#ff9800', '#2196f3', '#00bcd4'].includes(getStatusColor(status)) ? '#000' : '#fff'
  });

  return (
    <div style={styles.container}>
      <div style={{ padding: '20px' }}>
        <Header company={company} />

        <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

          <div style={{ flex: 1 }}>
            <div style={styles.contentArea}>
              {loading ? (
                <LoadingSpinner />
              ) : (
                <>
                  {activeTab === 'dashboard' && (
                    <DashboardContent
                      stats={stats}
                      activities={activities}
                      deliveries={deliveries}
                      company={company}
                      formatDate={formatDate}
                      getStatusBadgeStyle={getStatusBadgeStyle}
                      getActivityLabel={getActivityLabel}
                      setActiveTab={setActiveTab}
                    />
                  )}

                  {activeTab === 'category-management' && <CategoryManagement company={company} currentUser={currentUser} />}
                  {activeTab === 'ledger' && <LedgerTab company={company} currentUser={currentUser} customers={customers} suppliers={suppliers} drivers={drivers} products={products} formatCurrency={formatCurrency} />}
                  {activeTab === 'customer-price-list' && <div style={styles.card}><h2>Customer Price List (Coming Soon)</h2></div>}
                  {activeTab === 'supplier-price-list' && <div style={styles.card}><h2>Supplier Price List (Coming Soon)</h2></div>}
                  {activeTab === 'sales-management' && <SalesManagement company={company} currentUser={currentUser} customers={customers} products={products} formatCurrency={formatCurrency} />}
                  {activeTab === 'account-receivable' && <AccountReceivableManagement company={company} currentUser={currentUser} customers={customers} formatCurrency={formatCurrency} />}
                  {activeTab === 'purchase-management' && <PurchaseManagement company={company} currentUser={currentUser} suppliers={suppliers} products={products} formatCurrency={formatCurrency} />}
                  {activeTab === 'account-payable' && <AccountPayableManagement company={company} currentUser={currentUser} suppliers={suppliers} formatCurrency={formatCurrency} />}
                  {activeTab === 'inventory-management' && <InventoryManagement company={company} currentUser={currentUser} products={products} formatCurrency={formatCurrency} />}
                  {activeTab === 'delivery-management' && <DeliveryManagement deliveries={deliveries} drivers={drivers} formatDate={formatDate} />}
                  {activeTab === 'driver-assignments' && <DriverAssignments deliveries={deliveries.filter(d => ['pending', 'assigned'].includes(d.status))} drivers={drivers} />}
                  {activeTab === 'delivery-tracking' && <DeliveryTrackingMap deliveries={deliveries.filter(d => ['assigned', 'picked_up', 'in_transit'].includes(d.status))} drivers={drivers} />}
                  {activeTab === 'invoice' && <InvoicePrinting company={company} currentUser={currentUser} customers={customers} products={products} formatCurrency={formatCurrency} formatDate={formatDate} />}
                </>
              )}
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          © {new Date().getFullYear()} {company.name || 'Logistics System'} • Operator Dashboard • Last updated: {formatDate(new Date())}
        </div>
      </div>
    </div>
  );
};

export default Operator;