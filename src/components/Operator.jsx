import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, getDocs, query, where, onSnapshot, doc, updateDoc, serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'react-toastify';
import LoadingScreen from './LoadingScreen';

const OperatorDashboard = ({ styles }) => {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [company, setCompany] = useState(null);
  const [profile, setProfile] = useState(null);

  // Load operator data
  const loadData = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const uid = auth.currentUser.uid;

      // Profile
      const userQ = query(collection(db, 'users'), where('uid', '==', uid));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty) throw new Error('Profile not found');
      const userData = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
      setProfile(userData);

      // Company
      const compQ = query(collection(db, 'companies_2025'), where('id', '==', userData.companyId));
      const compSnap = await getDocs(compQ);
      if (!compSnap.empty) setCompany(compSnap.docs[0].data());

      // Orders (pending → delivered)
      const ordersQ = query(
        collection(db, 'orders'),
        where('companyId', '==', userData.companyId)
      );
      const ordersSnap = await getDocs(ordersQ);
      const ordersData = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(ordersData.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0)));

      // Active deliveries
      const delQ = query(
        collection(db, 'deliveries'),
        where('companyId', '==', userData.companyId),
        where('status', 'in', ['assigned', 'picked_up', 'in_transit'])
      );
      const delSnap = await getDocs(delQ);
      setDeliveries(delSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Drivers
      const driversQ = query(
        collection(db, 'users'),
        where('companyId', '==', userData.companyId),
        where('role', '==', 'driver')
      );
      const driversSnap = await getDocs(driversQ);
      setDrivers(driversSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (err) {
      toast.error('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Realtime listeners
  useEffect(() => {
    if (!profile?.companyId) return;

    const unsubOrders = onSnapshot(
      query(collection(db, 'orders'), where('companyId', '==', profile.companyId)),
      (snap) => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubDeliveries = onSnapshot(
      query(collection(db, 'deliveries'), where('companyId', '==', profile.companyId)),
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setDeliveries(data);
        updateMapMarkers(data);
      }
    );

    loadData();
    return () => {
      unsubOrders();
      unsubDeliveries();
    };
  }, [profile?.companyId, loadData]);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || map.current) return;

    const initMap = async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN';

      map.current = new mapboxgl.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [139.7670, 35.6812],
        zoom: 11
      });

      map.current.on('load', () => {
        updateMapMarkers(deliveries);
      });
    };

    initMap().catch(() => toast.error('Map failed'));
  }, [deliveries]);

  const updateMapMarkers = (deliveryList) => {
    if (!map.current) return;

    deliveryList.forEach(del => {
      if (del.driverLocation && del.driverLocation.lat) {
        const key = del.id;
        const el = document.createElement('div');
        el.innerHTML = 'Truck';
        el.style.fontSize = '24px';

        if (markers.current[key]) {
          markers.current[key].setLngLat([del.driverLocation.lng, del.driverLocation.lat]);
        } else {
          markers.current[key] = new mapboxgl.Marker(el)
            .setLngLat([del.driverLocation.lng, del.driverLocation.lat])
            .setPopup(new mapboxgl.Popup().setHTML(`
              <strong>${del.customerName}</strong><br/>
              Status: ${del.status}<br/>
              Driver: ${del.driverName}
            `))
            .addTo(map.current);
        }
      }
    });
  };

  const assignDriver = async (orderId, driverId) => {
    try {
      const deliveryRef = await addDoc(collection(db, 'deliveries'), {
        orderId,
        customerId: orders.find(o => o.id === orderId).customerId,
        customerName: orders.find(o => o.id === orderId).customerName,
        customerAddress: orders.find(o => o.id === orderId).address,
        driverId,
        driverName: drivers.find(d => d.id === driverId).name,
        companyId: profile.companyId,
        status: 'assigned',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'orders', orderId), { status: 'assigned', deliveryId: deliveryRef.id });
      toast.success('Driver assigned!');
    } catch (err) {
      toast.error('Assign failed');
    }
  };

  const formatCurrency = (amt) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amt || 0);
  const formatDate = (ts) => ts?.toDate?.()?.toLocaleString('ja-JP') || 'N/A';

  if (loading) return <LoadingScreen styles={styles} message="Operator Command Center Loading..." />;

  return (
    <>
      <style jsx>{`
        .container { padding: 15px; background: #f8fafc; min-height: 100vh; }
        @media (min-width: 768px) { .container { padding: 20px; display: grid; grid-template-columns: 1fr 400px; gap: 20px; } }
        .header { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); marginBottom: 20px; text-align: center; }
        .title { font-size: 22px; font-weight: 700; color: #1f2937; }
        .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 20px 0; }
        @media (min-width: 768px) { .stats { grid-template-columns: repeat(4, 1fr); } }
        .stat { background: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .stat-value { font-size: 24px; font-weight: 700; color: #ea580c; }
        .map { height: 400px; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); marginBottom: 20px; }
        .section { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); marginBottom: 20px; }
        .section-title { font-size: 18px; font-weight: 600; marginBottom: 16px; color: #1f2937; }
        .order-item { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; marginBottom: 12px; }
        .assign-btn { background: #ea580c; color: white; padding: 8px 16px; border-radius: 8px; font-weight: 600; }
        .status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .empty { text-align: center; padding: 40px; color: #6b7280; }
      `}</style>

      <div className="container">
        {/* Left: Map + Orders */}
        <div>
          <div className="header">
            <h1 className="title">Operator Command Center</h1>
            <p>{company?.name || 'Loading...'}</p>
          </div>

          <div className="map" ref={mapRef}></div>

          <div className="section">
            <h2 className="section-title">Pending Orders</h2>
            {orders.filter(o => o.status === 'pending').length === 0 ? (
              <div className="empty">No pending orders</div>
            ) : (
              orders.filter(o => o.status === 'pending').map(order => (
                <div key={order.id} className="order-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>Order #{order.id.slice(-6)}</strong><br/>
                      {order.customerName} • {formatCurrency(order.total)}
                    </div>
                    <select onChange={(e) => assignDriver(order.id, e.target.value)} className="assign-btn">
                      <option>Assign Driver</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Stats + Live Deliveries */}
        <div>
          <div className="stats">
            <div className="stat">
              <div className="stat-value">{orders.length}</div>
              <div>Total Orders</div>
            </div>
            <div className="stat">
              <div className="stat-value">{deliveries.length}</div>
              <div>Active Deliveries</div>
            </div>
            <div className="stat">
              <div className="stat-value">{drivers.length}</div>
              <div>Online Drivers</div>
            </div>
            <div className="stat">
              <div className="stat-value">{orders.filter(o => o.status === 'delivered').length}</div>
              <div>Completed</div>
            </div>
          </div>

          <div className="section">
            <h2 className="section-title">Live Deliveries</h2>
            {deliveries.length === 0 ? (
              <div className="empty">No active deliveries</div>
            ) : (
              deliveries.map(del => (
                <div key={del.id} className="order-item" style={{ cursor: 'pointer' }} onClick={() => {
                  if (del.driverLocation) {
                    map.current?.flyTo({ center: [del.driverLocation.lng, del.driverLocation.lat], zoom: 15 });
                  }
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{del.customerName}</strong><br/>
                      Truck {del.driverName}
                    </div>
                    <span className="status" style={{ background: del.status === 'in_transit' ? '#10b981' : '#f59e0b' }}>
                      {del.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default OperatorDashboard;