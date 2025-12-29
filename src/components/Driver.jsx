// src/components/Driver.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, auth, signOut } from '../firebase';
import { toast } from 'react-toastify';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
const fixLeafletIcons = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
};

const Driver = ({ styles }) => {
  const navigate = useNavigate();
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState([]);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [locationHistory, setLocationHistory] = useState([]);
  const [earnings, setEarnings] = useState(0);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const watchId = useRef(null);

  // Load driver data from localStorage or fetch from Firestore
  const loadDriverData = useCallback(async () => {
    console.log('🔍 Starting loadDriverData...');
    
    if (!auth.currentUser) {
      console.log('❌ No authenticated user, redirecting to login');
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      const userId = auth.currentUser.uid;
      console.log('👤 User ID:', userId);

      // Check localStorage first for faster loading
      const storedDriver = localStorage.getItem('driverData');
      if (storedDriver) {
        console.log('📦 Found driver data in localStorage');
        const driverData = JSON.parse(storedDriver);
        setProfile(driverData);
        
        // Load company info in background
        if (driverData.companyId) {
          loadCompanyInfo(driverData.companyId, driverData.current_fy);
        }
      }

      // Get profile from Firestore
      const userQ = query(collection(db, 'users'), where('uid', '==', userId));
      console.log('📡 Fetching user data from Firestore...');
      
      const userSnap = await getDocs(userQ);
      
      if (userSnap.empty) {
        console.log('⚠️ No user found in Firestore');
        if (!storedDriver) {
          toast.error('Driver profile not found. Please login again.');
          await signOut(auth);
          navigate('/login');
          return;
        }
        return;
      }

      const userData = { ...userSnap.docs[0].data(), id: userSnap.docs[0].id };
      console.log('✅ User data loaded:', userData.name);
      setProfile(userData);
      
      localStorage.setItem('driverData', JSON.stringify(userData));

      // Load company info
      if (userData.companyId) {
        loadCompanyInfo(userData.companyId, userData.current_fy);
      }

      // Load deliveries - No composite index needed
      console.log('📦 Loading deliveries...');
      
      const delQuery = query(
        collection(db, 'deliveries'),
        where('driverId', '==', userId)
      );
      
      const delSnap = await getDocs(delQuery);
      
      // Filter and sort in memory
      const delData = delSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => ['assigned', 'picked_up', 'in_transit', 'pending', 'delivered'].includes(d.status))
        .sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return dateB - dateA;
        });
      
      console.log(`✅ Loaded ${delData.length} deliveries`);
      setDeliveries(delData);

      // Calculate earnings
      console.log('💰 Calculating earnings...');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const totalEarnings = delData
        .filter(d => {
          if (d.status !== 'delivered') return false;
          const deliveryDate = d.deliveryTime?.toDate ? d.deliveryTime.toDate() : new Date(d.deliveryTime || 0);
          return deliveryDate >= today;
        })
        .reduce((sum, d) => sum + (d.driverEarnings || d.deliveryFee || 0), 0);
      
      setEarnings(totalEarnings);
      console.log(`💰 Total earnings: ¥${totalEarnings}`);

    } catch (err) {
      console.error('❌ Error loading driver data:', err);
      toast.error('Failed to load driver data. Please refresh the page.');
    } finally {
      console.log('✅ Finished loading driver data');
      setLoading(false);
    }
  }, [navigate]);

  // Helper function to load company info
  const loadCompanyInfo = async (companyId, current_fy) => {
    try {
      console.log('🏢 Loading company info...');
      
      const mainCompQuery = query(
        collection(db, 'companies'),
        where('companyId', '==', companyId)
      );
      const mainCompSnap = await getDocs(mainCompQuery);
      
      if (!mainCompSnap.empty) {
        const companyData = mainCompSnap.docs[0].data();
        console.log('✅ Company found in main collection:', companyData.name);
        setCompany(companyData);
        return;
      }
      
      if (current_fy) {
        try {
          const fyCompQuery = query(
            collection(db, 'financial_years', current_fy, 'companies'),
            where('companyId', '==', companyId)
          );
          const fyCompSnap = await getDocs(fyCompQuery);
          if (!fyCompSnap.empty) {
            const companyData = fyCompSnap.docs[0].data();
            console.log('✅ Company found in financial_years:', companyData.name);
            setCompany(companyData);
          }
        } catch (error) {
          console.log('ℹ️ Company not found in financial_years');
        }
      }
    } catch (error) {
      console.error('⚠️ Error loading company info:', error);
    }
  };

  // Initial data load
  useEffect(() => {
    console.log('🚀 Initializing driver dashboard...');
    loadDriverData();
  }, [loadDriverData]);

  // Realtime updates for deliveries
  useEffect(() => {
    if (!profile?.id) {
      console.log('⏳ Waiting for profile to load...');
      return;
    }
    
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    console.log('📡 Setting up realtime delivery updates...');
    
    const delQuery = query(
      collection(db, 'deliveries'),
      where('driverId', '==', userId)
    );

    const unsubscribe = onSnapshot(delQuery, 
      (snap) => {
        const allDeliveries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const filteredDeliveries = allDeliveries
          .filter(d => ['assigned', 'picked_up', 'in_transit', 'pending', 'delivered'].includes(d.status))
          .sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA;
          });
        
        console.log(`🔄 Realtime update: ${filteredDeliveries.length} deliveries`);
        setDeliveries(filteredDeliveries);
        
        // Update earnings
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayEarnings = filteredDeliveries
          .filter(d => {
            if (d.status !== 'delivered') return false;
            const deliveryDate = d.deliveryTime?.toDate ? d.deliveryTime.toDate() : new Date(d.deliveryTime || 0);
            return deliveryDate >= today;
          })
          .reduce((sum, d) => sum + (d.driverEarnings || d.deliveryFee || 0), 0);
        
        setEarnings(todayEarnings);
      }, 
      (err) => {
        console.error('❌ Realtime updates error:', err);
        toast.error('Connection error. Some data may not update in real-time.');
      }
    );

    return () => {
      console.log('🧹 Cleaning up realtime listener');
      unsubscribe();
    };
  }, [profile]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainer.current || isMapInitialized) return;
    
    console.log('🗺️ Initializing Leaflet map...');
    
    try {
      fixLeafletIcons();
      
      map.current = L.map(mapContainer.current).setView([35.6812, 139.7670], 12);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map.current);
      
      const driverIcon = L.divIcon({
        html: `
          <div style="
            background-color: #dc2626;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
          ">
            🚚
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        className: 'driver-marker'
      });
      
      marker.current = L.marker([35.6812, 139.7670], {
        icon: driverIcon,
        draggable: false
      }).addTo(map.current);
      
      map.current.zoomControl.setPosition('topright');
      
      L.control.scale({ imperial: false }).addTo(map.current);
      
      setIsMapInitialized(true);
      console.log('✅ Leaflet map loaded successfully');
      
    } catch (error) {
      console.error('❌ Map initialization error:', error);
      toast.error('Map failed to load. Please check your internet connection.');
      setIsMapInitialized(true);
    }

    return () => {
      if (map.current) {
        console.log('🧹 Cleaning up map');
        map.current.remove();
        map.current = null;
        setIsMapInitialized(false);
      }
    };
  }, [isMapInitialized]);

  // Start GPS Tracking
  const startTracking = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser');
      return;
    }

    console.log('📍 Starting GPS tracking...');
    toast.success('🚚 Live tracking started');
    setTracking(true);

    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const loc = { 
          lat: latitude, 
          lng: longitude, 
          accuracy,
          timestamp: new Date() 
        };

        setLocationHistory(prev => [...prev.slice(-49), loc]);

        if (marker.current && map.current && isMapInitialized) {
          marker.current.setLatLng([latitude, longitude]);
          map.current.flyTo([latitude, longitude], 15, {
            duration: 1
          });
          
          if (map.current.hasLayer(window.accuracyCircle)) {
            map.current.removeLayer(window.accuracyCircle);
          }
          
          window.accuracyCircle = L.circle([latitude, longitude], {
            radius: accuracy,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            weight: 1
          }).addTo(map.current);
        }

        if (profile?.id) {
          try {
            await updateDoc(doc(db, 'users', profile.id), {
              currentLocation: loc,
              lastLocationUpdate: new Date(),
              isOnline: true,
              isTracking: true
            });

            const activeDel = deliveries.find(d => 
              d.status === 'in_transit' || d.status === 'picked_up'
            );
            if (activeDel) {
              await updateDoc(doc(db, 'deliveries', activeDel.id), {
                driverLocation: loc,
                lastLocationUpdate: new Date(),
                estimatedDeliveryTime: calculateETA(loc, activeDel.customerLocation)
              });
            }
          } catch (error) {
            console.error('Location sync failed:', error);
          }
        }
      },
      (error) => {
        console.error('GPS error:', error);
        toast.error(`GPS error: ${error.message}`);
        stopTracking();
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
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

    if (map.current && window.accuracyCircle) {
      map.current.removeLayer(window.accuracyCircle);
    }

    if (profile?.id) {
      updateDoc(doc(db, 'users', profile.id), { 
        isTracking: false,
        isOnline: false,
        lastSeen: new Date()
      }).catch(console.error);
    }
  };

  // Calculate ETA
  const calculateETA = (driverLoc, customerLoc) => {
    if (!driverLoc || !customerLoc) return 'Calculating...';
    
    const R = 6371;
    const dLat = (customerLoc.lat - driverLoc.lat) * Math.PI / 180;
    const dLon = (customerLoc.lng - driverLoc.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(driverLoc.lat * Math.PI / 180) * 
      Math.cos(customerLoc.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    const etaMinutes = Math.round((distance / 30) * 60);
    
    if (etaMinutes < 1) return 'Arriving now';
    if (etaMinutes < 60) return `${etaMinutes} min`;
    return `${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}m`;
  };

  // Update delivery status
  const updateDeliveryStatus = async (deliveryId, newStatus) => {
    try {
      const updateData = {
        status: newStatus,
        statusUpdatedAt: new Date(),
        updatedAt: new Date()
      };

      if (newStatus === 'picked_up') {
        updateData.pickupTime = new Date();
      } else if (newStatus === 'in_transit') {
        updateData.startTime = new Date();
        const delivery = deliveries.find(d => d.id === deliveryId);
        if (delivery && locationHistory.length > 0) {
          updateData.estimatedDeliveryTime = calculateETA(
            locationHistory[locationHistory.length - 1],
            delivery.customerLocation
          );
        }
      } else if (newStatus === 'delivered') {
        updateData.deliveryTime = new Date();
        updateData.endTime = new Date();
        updateData.completedAt = new Date();
        
        const delivery = deliveries.find(d => d.id === deliveryId);
        if (delivery && !delivery.driverEarnings) {
          const earnings = delivery.deliveryFee || 500;
          updateData.driverEarnings = earnings;
          setEarnings(prev => prev + earnings);
        }
      }

      await updateDoc(doc(db, 'deliveries', deliveryId), updateData);
      
      toast.success(`✅ Delivery status updated to ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      console.error('Error updating delivery status:', error);
      toast.error('Failed to update delivery status');
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      if (tracking) stopTracking();
      await signOut(auth);
      localStorage.removeItem('driverData');
      navigate('/login');
      toast.info('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'assigned': return '#3b82f6';
      case 'picked_up': return '#8b5cf6';
      case 'in_transit': return '#10b981';
      case 'delivered': return '#059669';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Stat Card Component
  const StatCard = ({ value, label, color = '#10b981', icon, onClick }) => (
    <div 
      style={{...driverStyles.statCard, cursor: onClick ? 'pointer' : 'default'}} 
      onClick={onClick}
    >
      <div style={driverStyles.statHeader}>
        <div style={driverStyles.statIcon}>{icon}</div>
        <div style={{...driverStyles.statValue, color: color }}>
          {value}
        </div>
      </div>
      <div style={driverStyles.statLabel}>
        {label}
      </div>
    </div>
  );

  // Render Dashboard
  const renderDashboard = () => {
    const pendingDeliveries = deliveries.filter(d => 
      d.status === 'pending' || d.status === 'assigned'
    );
    const activeDeliveries = deliveries.filter(d => 
      d.status === 'picked_up' || d.status === 'in_transit'
    );
    const completedToday = deliveries.filter(d => 
      d.status === 'delivered' && 
      new Date(d.deliveryTime?.toDate?.() || d.deliveryTime) >= new Date().setHours(0,0,0,0)
    );

    return (
      <div>
        {/* Stats Grid */}
        <div style={driverStyles.statsGrid}>
          <StatCard 
            value={pendingDeliveries.length}
            label="Pending Deliveries"
            color="#f59e0b"
            icon="⏳"
            onClick={() => setActiveTab('deliveries')}
          />
          
          <StatCard 
            value={activeDeliveries.length}
            label="Active Deliveries"
            color="#10b981"
            icon="🚚"
            onClick={() => setActiveTab('deliveries')}
          />
          
          <StatCard 
            value={completedToday.length}
            label="Completed Today"
            color="#8b5cf6"
            icon="✅"
            onClick={() => setActiveTab('history')}
          />
          
          <StatCard 
            value={`¥${earnings.toLocaleString()}`}
            label="Today's Earnings"
            color="#3b82f6"
            icon="💰"
            onClick={() => setActiveTab('earnings')}
          />
        </div>

        {/* Tracking Controls */}
        <div style={driverStyles.section}>
          <h3 style={driverStyles.sectionTitle}>Live Tracking</h3>
          <div style={driverStyles.trackingControls}>
            <button
              onClick={tracking ? stopTracking : startTracking}
              style={{
                ...driverStyles.primaryButton,
                backgroundColor: tracking ? '#ef4444' : '#10b981',
                width: '200px'
              }}
            >
              {tracking ? '🛑 Stop Tracking' : '📍 Start Live Tracking'}
            </button>
            
            {tracking && locationHistory.length > 0 && (
              <div style={driverStyles.locationInfo}>
                <div><strong>Current Location:</strong></div>
                <div>Lat: {locationHistory[locationHistory.length - 1].lat.toFixed(6)}</div>
                <div>Lng: {locationHistory[locationHistory.length - 1].lng.toFixed(6)}</div>
                <div>Accuracy: {locationHistory[locationHistory.length - 1].accuracy?.toFixed(1)}m</div>
                <div>Last update: {formatDate(locationHistory[locationHistory.length - 1].timestamp)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div style={driverStyles.section}>
          <h3 style={driverStyles.sectionTitle}>Delivery Map</h3>
          <div style={driverStyles.mapContainer} ref={mapContainer}>
            {!isMapInitialized && (
              <div style={driverStyles.mapPlaceholder}>
                <div style={driverStyles.loadingSpinner}></div>
                <p>Loading map...</p>
              </div>
            )}
          </div>
        </div>

        {/* Active Deliveries */}
        <div style={driverStyles.section}>
          <div style={driverStyles.sectionHeader}>
            <h3 style={driverStyles.sectionTitle}>Active Deliveries</h3>
            <button 
              onClick={() => setActiveTab('deliveries')}
              style={driverStyles.viewAllButton}
            >
              View All
            </button>
          </div>
          
          {activeDeliveries.length === 0 ? (
            <div style={driverStyles.emptyState}>
              <div style={driverStyles.emptyStateIcon}>📦</div>
              <h4>No active deliveries</h4>
              <p>Check pending deliveries or wait for new assignments</p>
            </div>
          ) : (
            <div style={driverStyles.deliveriesList}>
              {activeDeliveries.slice(0, 3).map(delivery => (
                <div key={delivery.id} style={driverStyles.deliveryCard}>
                  <div style={driverStyles.deliveryHeader}>
                    <div>
                      <h4 style={driverStyles.deliveryTitle}>
                        Delivery #{delivery.id.slice(-6)}
                      </h4>
                      <div style={driverStyles.deliveryMeta}>
                        📍 {delivery.customerAddress || 'Address not specified'}
                      </div>
                      <div style={driverStyles.deliveryMeta}>
                        📞 {delivery.customerPhone || delivery.customerContact || 'No contact'}
                      </div>
                    </div>
                    <div>
                      <span style={{
                        ...driverStyles.statusBadge,
                        backgroundColor: getStatusColor(delivery.status)
                      }}>
                        {delivery.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  
                  <div style={driverStyles.deliveryDetails}>
                    <div style={driverStyles.detailItem}>
                      <strong>Customer:</strong> {delivery.customerName || 'Unknown'}
                    </div>
                    <div style={driverStyles.detailItem}>
                      <strong>Order ID:</strong> {delivery.orderId || 'N/A'}
                    </div>
                    <div style={driverStyles.detailItem}>
                      <strong>Items:</strong> {delivery.items?.length || '0'} items
                    </div>
                    <div style={driverStyles.detailItem}>
                      <strong>Assigned:</strong> {formatDate(delivery.assignedAt)}
                    </div>
                  </div>
                  
                  <div style={driverStyles.deliveryActions}>
                    {delivery.status === 'assigned' && (
                      <button
                        onClick={() => updateDeliveryStatus(delivery.id, 'picked_up')}
                        style={driverStyles.actionButton}
                      >
                        📦 Pick Up Order
                      </button>
                    )}
                    
                    {delivery.status === 'picked_up' && (
                      <button
                        onClick={() => updateDeliveryStatus(delivery.id, 'in_transit')}
                        style={driverStyles.actionButton}
                      >
                        🚚 Start Delivery
                      </button>
                    )}
                    
                    {delivery.status === 'in_transit' && (
                      <button
                        onClick={() => updateDeliveryStatus(delivery.id, 'delivered')}
                        style={driverStyles.actionButton}
                      >
                        ✅ Mark as Delivered
                      </button>
                    )}
                    
                    <button
                      onClick={() => {
                        toast.info(`Viewing details for delivery #${delivery.id.slice(-6)}`);
                      }}
                      style={driverStyles.secondaryButton}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Profile
  const renderProfile = () => (
    <div style={driverStyles.profileSection}>
      <h3 style={driverStyles.sectionTitle}>Driver Profile</h3>
      {profile && (
        <div style={driverStyles.profileCard}>
          <div style={driverStyles.profileHeader}>
            <div style={driverStyles.profileAvatar}>
              {profile.name?.charAt(0) || 'D'}
            </div>
            <div>
              <h2 style={driverStyles.profileName}>{profile.name || 'Unknown Driver'}</h2>
              <div style={driverStyles.profileRole}>🚚 Professional Driver</div>
              {company && (
                <div style={driverStyles.companyName}>{company.name}</div>
              )}
            </div>
          </div>
          
          <div style={driverStyles.profileDetails}>
            <div style={driverStyles.detailRow}>
              <strong>Mobile:</strong> {profile.mobileNumber || 'N/A'}
            </div>
            <div style={driverStyles.detailRow}>
              <strong>Vehicle:</strong> {profile.vehicleNumber || 'Not assigned'}
            </div>
            <div style={driverStyles.detailRow}>
              <strong>License:</strong> {profile.licenseNumber || 'Not provided'}
            </div>
            <div style={driverStyles.detailRow}>
              <strong>Email:</strong> {profile.email || 'N/A'}
            </div>
            <div style={driverStyles.detailRow}>
              <strong>Status:</strong> 
              <span style={{
                ...driverStyles.statusBadge,
                backgroundColor: profile.status === 'active' ? '#10b981' : '#ef4444'
              }}>
                {profile.status || 'inactive'}
              </span>
            </div>
            <div style={driverStyles.detailRow}>
              <strong>Joined:</strong> {formatDate(profile.createdAt)}
            </div>
            <div style={driverStyles.detailRow}>
              <strong>Last Seen:</strong> {formatDate(profile.lastSeen)}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render Deliveries
  const renderDeliveries = () => (
    <div>
      <h3 style={driverStyles.sectionTitle}>All Deliveries</h3>
      
      <div style={driverStyles.tabFilters}>
        <button
          style={{
            ...driverStyles.filterTab,
            ...(activeTab === 'deliveries' && driverStyles.activeFilterTab)
          }}
          onClick={() => setActiveTab('deliveries')}
        >
          All Deliveries
        </button>
        <button
          style={{
            ...driverStyles.filterTab,
            ...(activeTab === 'pending' && driverStyles.activeFilterTab)
          }}
          onClick={() => setActiveTab('pending')}
        >
          Pending
        </button>
        <button
          style={{
            ...driverStyles.filterTab,
            ...(activeTab === 'active' && driverStyles.activeFilterTab)
          }}
          onClick={() => setActiveTab('active')}
        >
          Active
        </button>
        <button
          style={{
            ...driverStyles.filterTab,
            ...(activeTab === 'completed' && driverStyles.activeFilterTab)
          }}
          onClick={() => setActiveTab('completed')}
        >
          Completed
        </button>
      </div>
      
      {deliveries.length === 0 ? (
        <div style={driverStyles.emptyState}>
          <div style={driverStyles.emptyStateIcon}>📦</div>
          <h4>No deliveries assigned</h4>
          <p>You don't have any deliveries assigned yet.</p>
        </div>
      ) : (
        <div style={driverStyles.deliveriesList}>
          {deliveries.map(delivery => (
            <div key={delivery.id} style={driverStyles.deliveryCard}>
              <div style={driverStyles.deliveryHeader}>
                <div>
                  <h4 style={driverStyles.deliveryTitle}>
                    Delivery #{delivery.id.slice(-6)}
                    {delivery.orderId && (
                      <span style={driverStyles.orderId}> • Order: {delivery.orderId}</span>
                    )}
                  </h4>
                  <div style={driverStyles.deliveryMeta}>
                    <span>📍 {delivery.customerAddress || 'No address'}</span>
                    <span>📞 {delivery.customerPhone || 'No phone'}</span>
                    <span>🕒 {formatDate(delivery.createdAt)}</span>
                  </div>
                </div>
                <div>
                  <span style={{
                    ...driverStyles.statusBadge,
                    backgroundColor: getStatusColor(delivery.status)
                  }}>
                    {delivery.status.replace('_', ' ')}
                  </span>
                  {delivery.driverEarnings && (
                    <div style={driverStyles.earningsBadge}>
                      ¥{delivery.driverEarnings.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
              
              <div style={driverStyles.deliveryActions}>
                {delivery.status === 'assigned' && (
                  <button
                    onClick={() => updateDeliveryStatus(delivery.id, 'picked_up')}
                    style={driverStyles.actionButton}
                  >
                    📦 Pick Up
                  </button>
                )}
                
                {delivery.status === 'picked_up' && (
                  <button
                    onClick={() => updateDeliveryStatus(delivery.id, 'in_transit')}
                    style={driverStyles.actionButton}
                  >
                    🚚 Start Delivery
                  </button>
                )}
                
                {delivery.status === 'in_transit' && (
                  <button
                    onClick={() => updateDeliveryStatus(delivery.id, 'delivered')}
                    style={driverStyles.actionButton}
                  >
                    ✅ Mark Delivered
                  </button>
                )}
                
                <button
                  style={driverStyles.secondaryButton}
                  onClick={() => {
                    toast.info(`Delivery details: ${delivery.customerName} - ${delivery.customerAddress}`);
                  }}
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <div style={driverStyles.loadingContainer}>
        <div style={driverStyles.loadingSpinner}></div>
        <p>Loading driver dashboard...</p>
        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '10px' }}>
          Please wait while we load your data
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={driverStyles.errorContainer}>
        <h2>Access Denied</h2>
        <p>This dashboard is for drivers only.</p>
        <button 
          onClick={() => navigate('/login')}
          style={driverStyles.primaryButton}
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div style={driverStyles.container}>
      {/* Sidebar */}
      <div style={driverStyles.sidebar}>
        <div style={driverStyles.sidebarHeader}>
          <h2 style={driverStyles.sidebarTitle}>🚚 Driver Portal</h2>
          <p style={driverStyles.driverName}>{profile.name}</p>
          {company && (
            <p style={driverStyles.companyNameSmall}>{company.name}</p>
          )}
        </div>
        
        <div style={driverStyles.sidebarMenu}>
          <button
            style={{
              ...driverStyles.sidebarButton,
              ...(activeTab === 'dashboard' && driverStyles.activeSidebarButton)
            }}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          
          <button
            style={{
              ...driverStyles.sidebarButton,
              ...(activeTab === 'deliveries' && driverStyles.activeSidebarButton)
            }}
            onClick={() => setActiveTab('deliveries')}
          >
            📦 My Deliveries ({deliveries.length})
          </button>
          
          <button
            style={{
              ...driverStyles.sidebarButton,
              ...(activeTab === 'profile' && driverStyles.activeSidebarButton)
            }}
            onClick={() => setActiveTab('profile')}
          >
            👤 Profile
          </button>
          
          <button
            style={{
              ...driverStyles.sidebarButton,
              ...(activeTab === 'earnings' && driverStyles.activeSidebarButton)
            }}
            onClick={() => setActiveTab('earnings')}
          >
            💰 Earnings: ¥{earnings.toLocaleString()}
          </button>
          
          <button
            style={{
              ...driverStyles.sidebarButton,
              ...(activeTab === 'history' && driverStyles.activeSidebarButton)
            }}
            onClick={() => setActiveTab('history')}
          >
            📋 Delivery History
          </button>
          
          <button
            style={{
              ...driverStyles.sidebarButton,
              backgroundColor: tracking ? '#10b981' : '#ef4444',
              color: 'white'
            }}
            onClick={tracking ? stopTracking : startTracking}
          >
            {tracking ? '🟢 Live Tracking ON' : '🔴 Start Tracking'}
          </button>
        </div>
        
        <div style={driverStyles.sidebarFooter}>
          <div style={driverStyles.onlineStatus}>
            <div style={{
              ...driverStyles.statusDot,
              backgroundColor: tracking ? '#10b981' : '#ef4444'
            }}></div>
            {tracking ? 'Live Tracking ON' : 'Offline'}
          </div>
          
          <button
            onClick={handleLogout}
            style={driverStyles.logoutButton}
          >
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={driverStyles.mainContent}>
        <div style={driverStyles.header}>
          <h1 style={driverStyles.pageTitle}>
            {activeTab === 'dashboard' && 'Driver Dashboard'}
            {activeTab === 'deliveries' && 'My Deliveries'}
            {activeTab === 'profile' && 'Driver Profile'}
            {activeTab === 'earnings' && 'Earnings'}
            {activeTab === 'history' && 'Delivery History'}
          </h1>
          
          <div style={driverStyles.headerInfo}>
            <span style={driverStyles.infoItem}>📱 {profile.mobileNumber}</span>
            <span style={driverStyles.infoItem}>🚚 {profile.vehicleNumber || 'No Vehicle'}</span>
            <span style={driverStyles.infoItem}>
              {tracking ? '🟢 Live' : '🔴 Offline'}
            </span>
            <span style={driverStyles.infoItem}>
              💰 ¥{earnings.toLocaleString()}
            </span>
          </div>
        </div>

        <div style={driverStyles.content}>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'profile' && renderProfile()}
          {activeTab === 'deliveries' && renderDeliveries()}
          {activeTab === 'earnings' && (
            <div style={driverStyles.section}>
              <h3 style={driverStyles.sectionTitle}>Earnings Summary</h3>
              <div style={driverStyles.earningsCard}>
                <div style={driverStyles.earningsAmount}>¥{earnings.toLocaleString()}</div>
                <div style={driverStyles.earningsLabel}>Today's Earnings</div>
                <div style={driverStyles.earningsBreakdown}>
                  {deliveries
                    .filter(d => d.status === 'delivered' && d.driverEarnings)
                    .map(delivery => (
                      <div key={delivery.id} style={driverStyles.earningItem}>
                        <span>Delivery #{delivery.id.slice(-6)}</span>
                        <span>¥{delivery.driverEarnings.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'history' && (
            <div style={driverStyles.section}>
              <h3 style={driverStyles.sectionTitle}>Delivery History</h3>
              <div style={driverStyles.historyList}>
                {deliveries
                  .filter(d => d.status === 'delivered')
                  .map(delivery => (
                    <div key={delivery.id} style={driverStyles.historyItem}>
                      <div>
                        <strong>Delivery #{delivery.id.slice(-6)}</strong>
                        <div>To: {delivery.customerName}</div>
                        <div>Delivered: {formatDate(delivery.deliveryTime)}</div>
                      </div>
                      <div style={driverStyles.historyEarnings}>
                        ¥{delivery.driverEarnings?.toLocaleString() || '0'}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Styles
const driverStyles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  sidebar: {
    width: '280px',
    backgroundColor: '#1f2937',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 0',
    position: 'sticky',
    top: 0,
    height: '100vh'
  },
  sidebarHeader: {
    padding: '0 20px 20px',
    borderBottom: '1px solid #374151'
  },
  sidebarTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '5px',
    color: '#60a5fa'
  },
  driverName: {
    fontSize: '16px',
    fontWeight: '500',
    marginBottom: '5px'
  },
  companyNameSmall: {
    fontSize: '12px',
    color: '#9ca3af',
    opacity: 0.8
  },
  sidebarMenu: {
    flex: 1,
    padding: '20px 0',
    overflowY: 'auto'
  },
  sidebarButton: {
    width: '100%',
    padding: '12px 20px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#d1d5db',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: '#374151'
    }
  },
  activeSidebarButton: {
    backgroundColor: '#374151',
    color: 'white',
    borderLeft: '4px solid #3b82f6'
  },
  sidebarFooter: {
    padding: '20px',
    borderTop: '1px solid #374151'
  },
  onlineStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    marginBottom: '15px',
    color: '#d1d5db'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%'
  },
  logoutButton: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#b91c1c'
    }
  },
  mainContent: {
    flex: 1,
    padding: '25px',
    overflowY: 'auto',
    backgroundColor: '#f8fafc'
  },
  header: {
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '2px solid #e2e8f0'
  },
  pageTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '10px'
  },
  headerInfo: {
    display: 'flex',
    gap: '15px',
    flexWrap: 'wrap'
  },
  infoItem: {
    backgroundColor: '#e2e8f0',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '14px',
    color: '#475569',
    fontWeight: '500'
  },
  content: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '25px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    minHeight: 'calc(100vh - 180px)'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  statCard: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '22px',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    transition: 'all 0.2s',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      borderColor: '#3b82f6'
    }
  },
  statHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '15px',
    marginBottom: '10px'
  },
  statIcon: {
    fontSize: '28px'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 'bold'
  },
  statLabel: {
    color: '#64748b',
    fontSize: '15px',
    fontWeight: '500'
  },
  section: {
    marginBottom: '30px'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  sectionTitle: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '20px',
    paddingBottom: '10px',
    borderBottom: '2px solid #3b82f6'
  },
  trackingControls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    alignItems: 'flex-start'
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#2563eb'
    }
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    color: '#3b82f6',
    border: '2px solid #3b82f6',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: '#3b82f6',
      color: 'white'
    }
  },
  locationInfo: {
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '8px',
    padding: '15px',
    fontSize: '14px',
    color: '#0369a1',
    width: '100%',
    maxWidth: '400px'
  },
  mapContainer: {
    height: '400px',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    position: 'relative',
    zIndex: 1
  },
  mapPlaceholder: {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    color: '#64748b',
    zIndex: 0
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
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  orderId: {
    fontSize: '14px',
    color: '#64748b',
    fontWeight: 'normal'
  },
  deliveryMeta: {
    color: '#64748b',
    fontSize: '13px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '15px'
  },
  statusBadge: {
    color: 'white',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    display: 'inline-block'
  },
  earningsBadge: {
    backgroundColor: '#f0f9ff',
    color: '#0369a1',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    marginTop: '8px',
    textAlign: 'center'
  },
  deliveryDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px',
    marginBottom: '15px'
  },
  detailItem: {
    color: '#4b5563',
    fontSize: '14px'
  },
  deliveryActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
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
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    '&:hover': {
      backgroundColor: '#059669'
    }
  },
  viewAllButton: {
    backgroundColor: 'transparent',
    border: '2px solid #3b82f6',
    color: '#3b82f6',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
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
  emptyStateIcon: {
    fontSize: '60px',
    marginBottom: '20px',
    opacity: '0.5'
  },
  profileSection: {
    maxWidth: '800px'
  },
  profileCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '30px'
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '30px'
  },
  profileAvatar: {
    width: '80px',
    height: '80px',
    backgroundColor: '#3b82f6',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    fontWeight: 'bold',
    color: 'white'
  },
  profileName: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '5px'
  },
  profileRole: {
    color: '#6b7280',
    fontSize: '16px'
  },
  companyName: {
    color: '#3b82f6',
    fontSize: '14px',
    fontWeight: '500'
  },
  profileDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '15px'
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '15px',
    color: '#4b5563'
  },
  tabFilters: {
    display: 'flex',
    gap: '10px',
    marginBottom: '25px',
    flexWrap: 'wrap'
  },
  filterTab: {
    backgroundColor: 'white',
    border: '2px solid #e2e8f0',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#64748b',
    transition: 'all 0.2s'
  },
  activeFilterTab: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#3b82f6'
  },
  earningsCard: {
    backgroundColor: '#f0f9ff',
    border: '2px solid #bae6fd',
    borderRadius: '12px',
    padding: '30px',
    textAlign: 'center'
  },
  earningsAmount: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#0369a1',
    marginBottom: '10px'
  },
  earningsLabel: {
    fontSize: '18px',
    color: '#0c4a6e',
    marginBottom: '30px'
  },
  earningsBreakdown: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  earningItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px',
    backgroundColor: 'white',
    borderRadius: '6px',
    border: '1px solid #e2e8f0'
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px'
  },
  historyEarnings: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#10b981'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f3f4f6'
  },
  loadingSpinner: {
    width: '50px',
    height: '50px',
    border: '5px solid #e5e7eb',
    borderTop: '5px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px'
  },
  errorContainer: {
    textAlign: 'center',
    padding: '50px',
    backgroundColor: '#fef2f2',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  }
};

// CSS Animation component
const DriverWithCSS = (props) => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      /* Leaflet custom styles */
      .leaflet-container {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      
      .leaflet-control-zoom {
        border: none !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
        border-radius: 6px !important;
        overflow: hidden;
      }
      
      .leaflet-control-zoom a {
        background-color: white !important;
        color: #374151 !important;
        border-bottom: 1px solid #e5e7eb !important;
      }
      
      .leaflet-control-zoom a:hover {
        background-color: #f3f4f6 !important;
      }
      
      .leaflet-control-scale {
        background-color: rgba(255, 255, 255, 0.8) !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 4px !important;
        padding: 2px 5px !important;
      }
      
      .driver-marker {
        background: none !important;
        border: none !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return <Driver {...props} />;
};

export default DriverWithCSS;