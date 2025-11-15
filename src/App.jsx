// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { toast } from 'react-toastify';

// COMPONENTS
import Login from './components/Login';
import CompanyRegistration from './components/CompanyRegistration';
import FinancialYearSetup from './components/FinancialYearSetup';
import AdminDashboard from './components/AdminDashboard';
import OperatorDashboard from './components/Operator';
import Customer from './components/Customer';
import DriverApp from './components/Driver';

// YE HAI TUMHARA LOGIC — BILKUL SAME
const ProtectedRoute = ({ children, allowedRoles = [], requireFY = false }) => {
  const { user, userRole, hasFY, loading } = useAuth();

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.2rem' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin: FY pending?
  if (requireFY && userRole === 'admin' && !hasFY) {
    return <Navigate to="/fy-setup" replace />;
  }

  // Role not allowed
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    toast.error('Access Denied');
    return <Navigate to={`/${userRole}`} replace />;
  }

  return children;
};

function App() {
  // YE LINE HATA DI — LOOP KA VILLAIN
  // const { userRole, hasFY } = useAuth();

  return (
    <div className="App" style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <Routes>
        {/* PUBLIC */}
        <Route path="/login" element={<Login />} />

        {/* COMPANY REG — SABKE LIYE */}
        <Route
          path="/company-reg"
          element={
            <ProtectedRoute allowedRoles={['admin', 'operator', 'customer', 'driver']}>
              <CompanyRegistration />
            </ProtectedRoute>
          }
        />

        {/* FY SETUP */}
        <Route
          path="/fy-setup"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <FinancialYearSetup />
            </ProtectedRoute>
          }
        />

        {/* DASHBOARDS */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']} requireFY={true}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator"
          element={
            <ProtectedRoute allowedRoles={['operator']} requireFY={true}>
              <OperatorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer"
          element={
            <ProtectedRoute allowedRoles={['customer']} requireFY={true}>
              <Customer />
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver"
          element={
            <ProtectedRoute allowedRoles={['driver']} requireFY={true}>
              <DriverApp />
            </ProtectedRoute>
          }
        />

        {/* DEFAULT */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}

export default App;