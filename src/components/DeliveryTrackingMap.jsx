// components/DeliveryTrackingMap.jsx
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DeliveryTrackingMap = ({ company, drivers, deliveries }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const [isMapInitialized, setIsMapInitialized] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || isMapInitialized) return;

    // Initialize map
    map.current = L.map(mapContainer.current).setView([35.6812, 139.7670], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);

    setIsMapInitialized(true);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [isMapInitialized]);

  // Update markers when drivers or deliveries change
  useEffect(() => {
    if (!map.current || !isMapInitialized) return;

    // Clear existing markers
    Object.values(markers.current).forEach(marker => {
      if (marker && map.current.hasLayer(marker)) {
        map.current.removeLayer(marker);
      }
    });
    markers.current = {};

    // Add driver markers
    drivers.forEach(driver => {
      if (driver.currentLocation) {
        const driverIcon = L.divIcon({
          html: `
            <div style="
              background-color: ${driver.isOnline ? '#10b981' : '#64748b'};
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

        const marker = L.marker([driver.currentLocation.lat, driver.currentLocation.lng], {
          icon: driverIcon
        }).addTo(map.current);

        // Add popup
        marker.bindPopup(`
          <div style="font-family: sans-serif; padding: 10px;">
            <h4 style="margin: 0 0 10px 0;">🚚 ${driver.name}</h4>
            <p style="margin: 5px 0;"><strong>Status:</strong> ${driver.isOnline ? '🟢 Online' : '🔴 Offline'}</p>
            <p style="margin: 5px 0;"><strong>Vehicle:</strong> ${driver.vehicleNumber || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Phone:</strong> ${driver.mobileNumber || 'N/A'}</p>
            ${driver.isTracking ? '<p style="margin: 5px 0; color: #10b981;"><strong>📦 Live Tracking ON</strong></p>' : ''}
          </div>
        `);

        markers.current[driver.id] = marker;
      }
    });

    // Add delivery destination markers
    const activeDeliveries = deliveries.filter(d => 
      ['assigned', 'picked_up', 'in_transit'].includes(d.status)
    );

    activeDeliveries.forEach(delivery => {
      if (delivery.customerLocation) {
        const deliveryIcon = L.divIcon({
          html: `
            <div style="
              background-color: #3b82f6;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 0 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 12px;
            ">
              📦
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([delivery.customerLocation.lat, delivery.customerLocation.lng], {
          icon: deliveryIcon
        }).addTo(map.current);

        marker.bindPopup(`
          <div style="font-family: sans-serif; padding: 10px;">
            <h4 style="margin: 0 0 10px 0;">📦 Delivery #${delivery.id.slice(-6)}</h4>
            <p style="margin: 5px 0;"><strong>To:</strong> ${delivery.customerName}</p>
            <p style="margin: 5px 0;"><strong>Address:</strong> ${delivery.customerAddress}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> ${delivery.status.replace('_', ' ')}</p>
            ${delivery.driverName ? `<p style="margin: 5px 0;"><strong>Driver:</strong> ${delivery.driverName}</p>` : ''}
          </div>
        `);

        markers.current[`delivery_${delivery.id}`] = marker;
      }
    });

  }, [drivers, deliveries, isMapInitialized]);

  return (
    <div>
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Live Delivery Tracking - {company.name}</h3>
        <div style={styles.mapStats}>
          <div style={styles.statItem}>
            <span style={styles.statIcon}>🚚</span>
            <span style={styles.statLabel}>Online Drivers:</span>
            <span style={styles.statValue}>
              {drivers.filter(d => d.isOnline).length}/{drivers.length}
            </span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statIcon}>📦</span>
            <span style={styles.statLabel}>Active Deliveries:</span>
            <span style={styles.statValue}>
              {deliveries.filter(d => ['picked_up', 'in_transit'].includes(d.status)).length}
            </span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statIcon}>⏳</span>
            <span style={styles.statLabel}>Pending:</span>
            <span style={styles.statValue}>
              {deliveries.filter(d => ['pending', 'assigned'].includes(d.status)).length}
            </span>
          </div>
        </div>
      </div>
      
      <div style={styles.mapContainer} ref={mapContainer}></div>
      
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div style={{...styles.legendColor, backgroundColor: '#10b981'}}></div>
          <span>🟢 Online Driver</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{...styles.legendColor, backgroundColor: '#64748b'}}></div>
          <span>🔴 Offline Driver</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{...styles.legendColor, backgroundColor: '#3b82f6'}}></div>
          <span>📦 Delivery Destination</span>
        </div>
      </div>
    </div>
  );
};

const styles = {
  section: {
    marginBottom: '20px'
  },
  sectionTitle: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '15px'
  },
  mapStats: {
    display: 'flex',
    gap: '20px',
    marginBottom: '15px',
    flexWrap: 'wrap'
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#f8fafc',
    padding: '10px 15px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0'
  },
  statIcon: {
    fontSize: '18px'
  },
  statLabel: {
    color: '#64748b',
    fontSize: '14px'
  },
  statValue: {
    fontWeight: 'bold',
    color: '#1e293b'
  },
  mapContainer: {
    height: '500px',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    marginBottom: '20px'
  },
  legend: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
    backgroundColor: '#f8fafc',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0'
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  legendColor: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: '2px solid white',
    boxShadow: '0 0 5px rgba(0,0,0,0.2)'
  }
};

export default DeliveryTrackingMap;