import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'react-toastify';
import LoadingScreen from './LoadingScreen';

const MAPBOX_TOKEN = 'YOUR_MAPBOX_TOKEN'; // ← Replace with your Mapbox token

const DriverDashboard = ({ styles }) => {
  const navigate = useNavigate();
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState([]);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [tracking, setTracking] = useState(false);
  const watchId = useRef(null);

  // Load driver data
  const loadDriverData = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const userId = auth.currentUser.uid;

      // Get profile
      const userQ = query(collection(db, 'users'), where('uid', '==', userId));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty) throw new Error('Profile not found');
      const userData = { ...userSnap.docs[0].data(), id: userSnap.docs[0].id };
      setProfile(userData);

      // Get company
      const compQ = query(collection(db, `companies_2025`), where('id', '==', userData.companyId));
      const compSnap = await getDocs(compQ);
      if (!compSnap.empty) setCompany(compSnap.docs[0].data());

      // Get active deliveries
      const delQ = query(
        collection(db, 'deliveries'),
        where('driverId', '==', userId),
        where('status', 'in', ['assigned', 'picked_up', 'in_transit'])
      );
      const delSnap = await getDocs(delQ);
      const delData = delSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDeliveries(delData);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Realtime updates
  useEffect(() => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    const delQ = query(
      collection(db, 'deliveries'),
      where('driverId', '==', userId)
    );

    const unsubscribe = onSnapshot(delQ, (snap) => {
      const updated = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDeliveries(updated);
    }, (err) => {
      toast.warn('Realtime updates paused');
    });

    loadDriverData();
    return () => unsubscribe();
  }, [loadDriverData]);

  // Initialize Map (lazy load)
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initMap = async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [139.7670, 35.6812], // Tokyo default
        zoom: 12
      });

      marker.current = new mapboxgl.Marker({ color: '#dc2626' })
        .setLngLat([139.7670, 35.6812])
        .addTo(map.current);
    };

    initMap().catch(() => toast.error('Map failed to load'));
  }, []);

  // Start GPS Tracking
  const startTracking = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }

    toast.success('Live tracking started');
    setTracking(true);

    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const loc = { lat: latitude, lng: longitude, timestamp: new Date() };

        // Update map
        if (marker.current && map.current) {
          marker.current.setLngLat([longitude, latitude]);
          map.current.easeTo({ center: [longitude, latitude], zoom: 15 });
        }

        // Update driver location in Firestore
        try {
          await updateDoc(doc(db, 'users', profile.id), {
            location: loc,
            lastSeen: new Date(),
            isTracking: true
          });

          // Update active delivery
          const activeDel = deliveries.find(d => d.status === 'in_transit');
          if (activeDel) {
            await updateDoc(doc(db, 'deliveries', activeDel.id), {
              driverLocation: loc,
              lastLocationUpdate: new Date()
            });
          }
        } catch (err) {
          console.error('Location sync failed', err);
        }
      },
      (err) => {
        toast.error('GPS error: ' + err.message);
        stopTracking();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );
  };

  // Stop Tracking
  const stopTracking = () => {
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setTracking(false);
    toast.info('Live tracking stopped');

    // Update status
    if (profile?.id) {
      updateDoc(doc(db, 'users', profile.id), { isTracking: false }).catch(console.error);
    }
  };

  const formatDate = (ts) => ts?.toDate?.()?.toLocaleString('ja-JP') || 'N/A';

  if (loading) {
    return <LoadingScreen styles={styles} />;
  }

  if (!profile) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>Profile not found.</p>
        <button onClick={() => auth.signOut().then(() => navigate('/driver-login'))} className="btn">
          Logout
        </button>
      </div>
    );
  }

  return (
    <>
      <style jsx>{`
        .container { padding: 15px; background: #f8fafc; min-height: 100vh; }
        @media (min-width: 768px) { .container { padding: 30px; } }
        .header { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); marginBottom: 20px; text-align: center; }
        .welcome { font-size: 20px; font-weight: 700; color: #1f2937; margin: 0 0 8px; }
        .company { font-size: 14px; color: #6b7280; }
        .tracking-btn {
          padding: 12px 24px; border-radius: 50px; font-weight: 600; cursor: pointer;
          margin: 10px 5px; font-size: 14px; transition: all 0.2s;
        }
        .tracking-on { background: #10b981; color: white; }
        .tracking-off { background: #ef4444; color: white; }
        .map-container { height: 300px; border-radius: 16px; overflow: hidden; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .section { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); marginBottom: 20px; }
        .section-title { font-size: 18px; font-weight: 600; margin: 0 0 16px; color: #1f2937; }
        .delivery-list { display: flex; flex-direction: column; gap: 12px; }
        .delivery-item { 
          border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; 
          display: flex; flex-direction: column; gap: 8px;
        }
        @media (min-width: 768px) { 
          .delivery-item { flex-direction: row; justify-content: space-between; align-items: center; }
        }
        .delivery-info h4 { margin: 0; font-size: 16px; font-weight: 600; }
        .delivery-meta { font-size: 13px; color: #6b7280; }
        .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; color: white; }
        .empty { text-align: center; padding: 40px; color: #6b7280; }
        .btn { padding: 10px 16px; border-radius: 8px; font-weight: 500; cursor: pointer; background: #3b82f6; color: white; border: none; }
        .btn:hover { background: #2563eb; }
        .logout { background: #dc2626; marginTop: 20px; }
        .logout:hover { background: #b91c1c; }
      `}</style>

      <div className="container">
        {/* Header */}
        <div className="header">
          <h1 className="welcome">Driver: {profile.name}</h1>
          {company && <p className="company">{company.name}</p>}
          <div style={{ margin: '15px 0' }}>
            <button
              onClick={tracking ? stopTracking : startTracking}
              className={`tracking-btn ${tracking ? 'tracking-on' : 'tracking-off'}`}
            >
              {tracking ? 'Stop Live Tracking' : 'Start Live Tracking'}
            </button>
          </div>
          <button 
            onClick={() => auth.signOut().then(() => navigate('/driver-login'))} 
            className="btn logout"
            style={{ width: 'fit-content', margin: '0 auto' }}
          >
            Logout
          </button>
        </div>

        {/* Map */}
        <div className="map-container" ref={mapContainer}></div>

        {/* Deliveries */}
        <div className="section">
          <h2 className="section-title">Active Deliveries</h2>
          {deliveries.length === 0 ? (
            <div className="empty">
              <p>No active deliveries.</p>
            </div>
          ) : (
            <div className="delivery-list">
              {deliveries.map(del => (
                <div key={del.id} className="delivery-item">
                  <div className="delivery-info">
                    <h4>Delivery #{del.id.slice(-6)}</h4>
                    <div className="delivery-meta">
                      To: {del.customerName || 'Unknown'} • {del.customerAddress || 'N/A'}
                    </div>
                    <div className="delivery-meta">
                      Status: {del.status.replace('_', ' ')}
                    </div>
                  </div>
                  <div>
                    <span 
                      className="status-badge" 
                      style={{ backgroundColor: del.status === 'in_transit' ? '#10b981' : '#f59e0b' }}
                    >
                      {del.status === 'in_transit' ? 'En Route' : 'Assigned'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DriverDashboard;