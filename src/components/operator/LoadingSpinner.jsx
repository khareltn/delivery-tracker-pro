import React from 'react';
import { styles } from './operatorStyles';

const LoadingSpinner = () => (
  <div style={styles.loadingContainer}>
    <div style={styles.spinner} />
    <span style={{ marginTop: '20px', color: '#3498db', fontWeight: '500' }}>
      Loading dashboard data...
    </span>
  </div>
);

export default LoadingSpinner;