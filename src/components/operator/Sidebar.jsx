// components/Operator/Sidebar.jsx
import React from 'react';
import { styles } from './operatorStyles';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const tabButtonStyle = (tabName) => ({
    ...styles.tabButton,
    ...(activeTab === tabName ? styles.tabButtonActive : {}),
  });

  return (
    <div style={{ width: '250px' }}>
      <div style={styles.sidebar}>

        {/* MAIN */}
        <div style={styles.sidebarSection}>
          <div style={styles.sidebarTitle}>MAIN</div>
          <button style={tabButtonStyle('dashboard')} onClick={() => setActiveTab('dashboard')}>
            <span style={styles.tabIcon}>📊</span>
            Dashboard
          </button>
        </div>

        {/* CATEGORY MANAGEMENT */}
        <div style={styles.sidebarSection}>
          <div style={styles.sidebarTitle}>CATEGORY MANAGEMENT</div>
          <button style={tabButtonStyle('category-management')} onClick={() => setActiveTab('category-management')}>
            <span style={styles.tabIcon}>📁</span>
            Category Management
          </button>
        </div>

        {/* LEDGER */}
        <div style={styles.sidebarSection}>
          <div style={styles.sidebarTitle}>LEDGER</div>
          <button style={tabButtonStyle('ledger')} onClick={() => setActiveTab('ledger')}>
            <span style={styles.tabIcon}>📝</span>
            Master Registration
          </button>
          <button style={tabButtonStyle('customer-price-list')} onClick={() => setActiveTab('customer-price-list')}>
            <span style={styles.tabIcon}>💰</span>
            Customer Price List
          </button>
          <button style={tabButtonStyle('supplier-price-list')} onClick={() => setActiveTab('supplier-price-list')}>
            <span style={styles.tabIcon}>🏢</span>
            Supplier Price List
          </button>
        </div>

        {/* DAILY OPERATIONS */}
        <div style={styles.sidebarSection}>
          <div style={styles.sidebarTitle}>DAILY OPERATIONS</div>
          <button style={tabButtonStyle('sales-management')} onClick={() => setActiveTab('sales-management')}>
            <span style={styles.tabIcon}>💰</span>
            Sales Management
          </button>
          <button style={tabButtonStyle('account-receivable')} onClick={() => setActiveTab('account-receivable')}>
            <span style={styles.tabIcon}>📄</span>
            Account Receivable
          </button>
          <button style={tabButtonStyle('purchase-management')} onClick={() => setActiveTab('purchase-management')}>
            <span style={styles.tabIcon}>🛒</span>
            Purchase Management
          </button>
          <button style={tabButtonStyle('account-payable')} onClick={() => setActiveTab('account-payable')}>
            <span style={styles.tabIcon}>💳</span>
            Account Payable
          </button>
          <button style={tabButtonStyle('inventory-management')} onClick={() => setActiveTab('inventory-management')}>
            <span style={styles.tabIcon}>📦</span>
            Inventory Management
          </button>
        </div>

        {/* OPERATIONS */}
        <div style={styles.sidebarSection}>
          <div style={styles.sidebarTitle}>OPERATIONS</div>
          <button style={tabButtonStyle('delivery-management')} onClick={() => setActiveTab('delivery-management')}>
            <span style={styles.tabIcon}>🚚</span>
            Delivery Management
          </button>
          <button style={tabButtonStyle('driver-assignments')} onClick={() => setActiveTab('driver-assignments')}>
            <span style={styles.tabIcon}>👨‍✈️</span>
            Driver Assignments
          </button>
          <button style={tabButtonStyle('delivery-tracking')} onClick={() => setActiveTab('delivery-tracking')}>
            <span style={styles.tabIcon}>🗺️</span>
            Delivery Tracking
          </button>
        </div>

        {/* DOCUMENTS */}
        <div style={styles.sidebarSection}>
          <div style={styles.sidebarTitle}>DOCUMENTS</div>
          <button style={tabButtonStyle('invoice')} onClick={() => setActiveTab('invoice')}>
            <span style={styles.tabIcon}>🧾</span>
            Invoice Printing
          </button>
        </div>

      </div>
    </div>
  );
};

export default Sidebar;