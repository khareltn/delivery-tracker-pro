// src/components/operator/useOperatorData.js
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-toastify';

export const useOperatorData = (selectedCompany, currentUser) => {
  const location = useLocation();

  const [company, setCompany] = useState(location.state?.company || selectedCompany || {});
  const [users, setUsers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [products, setProducts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalDrivers: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
    totalProducts: 0,
    pendingDeliveries: 0,
    activeDeliveries: 0,
    completedToday: 0
  });

  // Helpers
  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0
    }).format(amount || 0);
  }, []);

  const formatDate = useCallback((timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const getStatusColor = useCallback((status) => {
    const colors = {
      pending: '#ff9800',
      assigned: '#2196f3',
      picked_up: '#673ab7',
      in_transit: '#00bcd4',
      delivered: '#4caf50',
      cancelled: '#f44336'
    };
    return colors[status] || '#9e9e9e';
  }, []);

  const getActivityLabel = useCallback((action) => {
    const labels = {
      USER_CREATED: '👤 User Created',
      USER_UPDATED: '📝 User Updated',
      USER_DELETED: '🗑️ User Deleted',
      USER_STATUS_CHANGED: '🔄 User Status Changed',
      DELIVERY_CREATED: '📦 Delivery Created',
      DELIVERY_ASSIGNED: '👨‍✈️ Delivery Assigned',
      DELIVERY_STATUS_CHANGED: '🔄 Delivery Status Changed',
      DELIVERY_UPDATED: '✏️ Delivery Updated',
      DELIVERY_DELETED: '🗑️ Delivery Deleted',
      PRODUCT_CREATED: '📦 Product Created',
      PRODUCT_UPDATED: '✏️ Product Updated',
      PRODUCT_DELETED: '🗑️ Product Deleted',
      STOCK_UPDATED: '📊 Stock Updated',
      COMPANY_UPDATED: '🏢 Company Updated',
      LOGIN: '🔐 Login',
      LOGOUT: '🚪 Logout',
      SETTINGS_UPDATED: '⚙️ Settings Updated'
    };
    return labels[action] || `📋 ${action.replace(/_/g, ' ')}`;
  }, []);

  // Load company data
  const loadCompanyData = useCallback(async () => {
    if ((Object.keys(company).length === 0) && currentUser?.uid) {
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        const companyId = userData.companyId;
        const userFY = userData.fyId;

        if (!companyId) return;

        let companyData = null;

        if (userFY) {
          const ref = doc(db, 'financial_years', userFY, 'companies', companyId);
          const snap = await getDoc(ref);
          if (snap.exists()) companyData = snap.data();
        }

        if (!companyData) {
          const q = query(collection(db, 'companies'), where('companyId', '==', companyId));
          const snap = await getDocs(q);
          if (!snap.empty) companyData = snap.docs[0].data();
        }

        if (!companyData) {
          const fySnap = await getDocs(collection(db, 'financial_years'));
          for (const fyDoc of fySnap.docs) {
            const q = query(collection(db, 'financial_years', fyDoc.id, 'companies'), where('companyId', '==', companyId));
            const snap = await getDocs(q);
            if (!snap.empty) {
              companyData = snap.docs[0].data();
              break;
            }
          }
        }

        if (companyData) {
          setCompany({ id: companyId, ...companyData });
        } else {
          setCompany({ id: companyId, name: 'Your Company', financialYear: userFY || '2025-2026' });
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load company');
      }
    }
  }, [company, currentUser]);

  const loadUsersData = useCallback(async () => {
    if (!company?.id) return;
    const q = query(collection(db, 'users'), where('companyId', '==', company.id));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    setUsers(data);
    setDrivers(data.filter(u => u.role === 'driver'));
    setCustomers(data.filter(u => ['customer', 'restaurant'].includes(u.role)));
    setSuppliers(data.filter(u => u.role === 'supplier'));

    setStats(prev => ({
      ...prev,
      totalDrivers: data.filter(u => u.role === 'driver').length,
      totalCustomers: data.filter(u => ['customer', 'restaurant'].includes(u.role)).length,
      totalSuppliers: data.filter(u => u.role === 'supplier').length
    }));
  }, [company]);

  const loadDeliveriesData = useCallback(async () => {
    if (!company?.id) return;
    const q = query(collection(db, 'deliveries'), where('companyId', '==', company.id));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setDeliveries(data);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pending = data.filter(d => ['pending', 'assigned'].includes(d.status)).length;
    const active = data.filter(d => ['picked_up', 'in_transit'].includes(d.status)).length;
    const completedToday = data.filter(d => {
      if (d.status !== 'delivered') return false;
      const delDate = d.deliveryTime?.toDate() || new Date(d.deliveryTime || 0);
      return delDate >= today;
    }).length;

    setStats(prev => ({ ...prev, pendingDeliveries: pending, activeDeliveries: active, completedToday }));
  }, [company]);

  const loadProductsData = useCallback(async () => {
    if (!company?.id) return;
    const q = query(collection(db, 'products'), where('companyId', '==', company.id));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setProducts(data);
    setStats(prev => ({ ...prev, totalProducts: data.length }));
  }, [company]);

  const loadActivities = useCallback(async () => {
    if (!company?.id || !currentUser?.uid) return;
    const q = query(
      collection(db, 'activities'),
      where('companyId', '==', company.id),
      where('performedById', '==', currentUser.uid)
    );
    const snap = await getDocs(q);
    const data = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
    setActivities(data);
  }, [company, currentUser]);

  // Real-time listeners
  useEffect(() => {
    if (!company?.id) return;

    const unsubUsers = onSnapshot(query(collection(db, 'users'), where('companyId', '==', company.id)), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(data);
      setDrivers(data.filter(u => u.role === 'driver'));
      setCustomers(data.filter(u => ['customer', 'restaurant'].includes(u.role)));
      setSuppliers(data.filter(u => u.role === 'supplier'));
    });

    const unsubDeliveries = onSnapshot(query(collection(db, 'deliveries'), where('companyId', '==', company.id)), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDeliveries(data);
    });

    return () => {
      unsubUsers();
      unsubDeliveries();
    };
  }, [company]);

  // Initial data load
  useEffect(() => {
    loadCompanyData();
  }, [loadCompanyData]);

  useEffect(() => {
    if (company?.id) {
      loadUsersData();
      loadDeliveriesData();
      loadProductsData();
      loadActivities();
      setLoading(false);
    }
  }, [company, loadUsersData, loadDeliveriesData, loadProductsData, loadActivities]);

  return {
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
    getActivityLabel,
    loadActivities // optional refresh
  };
};