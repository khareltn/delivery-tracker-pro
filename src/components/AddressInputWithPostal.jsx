// components/AddressInputWithPostal.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

const AddressInputWithPostal = ({ 
  formData, 
  setFormData, 
  disabled = false,
  label = "Address Information",
  showBuilding = true
}) => {
  const [postalData, setPostalData] = useState([]);
  const [loadingPostal, setLoadingPostal] = useState(false);
  
  // Load postal codes from JSON
  useEffect(() => {
    const loadPostalCodes = async () => {
      try {
        setLoadingPostal(true);
        const response = await fetch('/postal_codes.json');
        if (response.ok) {
          const data = await response.json();
          setPostalData(data);
        }
      } catch (error) {
        console.log('Postal codes not loaded');
        setPostalData([]);
      } finally {
        setLoadingPostal(false);
      }
    };
    
    loadPostalCodes();
  }, []);

  // Handle postal code change
  const handlePostalChange = (postalCode) => {
    const clean = postalCode.replace(/[^0-9]/g, '');
    
    setFormData(prev => ({ 
      ...prev, 
      postalCode: clean,
      ...(clean.length < 7 ? {
        prefecture: '',
        city: '',
        streetAddress: ''
      } : {})
    }));
    
    // Lookup address if we have 7 digits
    if (clean.length === 7 && postalData.length > 0) {
      const formattedCode = `${clean.substring(0, 3)}-${clean.substring(3)}`;
      const found = postalData.find(p => p.postal_code === formattedCode);
      
      if (found) {
        setTimeout(() => {
          setFormData(prev => ({
            ...prev,
            prefecture: found.prefecture || '',
            city: found.city || '',
            streetAddress: found.town || ''
          }));
          toast.success('✓ Address auto-filled');
        }, 100);
      }
    }
  };

  // Manually update any field
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const styles = {
    container: {
      backgroundColor: '#0f172a',
      borderRadius: '10px',
      padding: '20px',
      border: '1px solid #334155',
      marginBottom: '20px'
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#e2e8f0',
      marginBottom: '15px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '15px'
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    label: {
      color: '#cbd5e1',
      fontSize: '14px',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    required: {
      color: '#ef4444'
    },
    input: {
      padding: '10px 12px',
      backgroundColor: '#1e293b',
      border: '1px solid #475569',
      borderRadius: '6px',
      color: '#e2e8f0',
      fontSize: '14px',
      '&:disabled': {
        backgroundColor: '#334155',
        color: '#94a3b8',
        cursor: 'not-allowed'
      }
    },
    loadingText: {
      color: '#94a3b8',
      fontSize: '12px',
      fontStyle: 'italic'
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.sectionTitle}>
        <span style={{color: '#3b82f6'}}>📍</span>
        {label}
      </h3>
      
      {loadingPostal && (
        <div style={{color: '#94a3b8', marginBottom: '10px', fontSize: '12px'}}>
          Loading postal code database...
        </div>
      )}
      
      <div style={styles.formGrid}>
        {/* Postal Code */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📮</span>
            郵便番号 / Postal Code
          </label>
          <input
            type="text"
            value={formData.postalCode || ''}
            onChange={(e) => handlePostalChange(e.target.value)}
            style={styles.input}
            placeholder="1234567 (7桁)"
            maxLength="7"
            disabled={disabled || loadingPostal}
          />
          <small style={styles.loadingText}>
            Enter 7-digit postal code to auto-fill address
          </small>
        </div>

        {/* Prefecture */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🗾</span>
            都道府県 / Prefecture
          </label>
          <input
            type="text"
            value={formData.prefecture || ''}
            onChange={(e) => handleFieldChange('prefecture', e.target.value)}
            style={styles.input}
            placeholder="例: 東京都"
            disabled={disabled}
          />
        </div>

        {/* City */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏙️</span>
            市区町村 / City
          </label>
          <input
            type="text"
            value={formData.city || ''}
            onChange={(e) => handleFieldChange('city', e.target.value)}
            style={styles.input}
            placeholder="例: 渋谷区"
            disabled={disabled}
          />
        </div>

        {/* Street Address */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏘️</span>
            丁目・番地・号 / Street Address
          </label>
          <input
            type="text"
            value={formData.streetAddress || ''}
            onChange={(e) => handleFieldChange('streetAddress', e.target.value)}
            style={styles.input}
            placeholder="例: 1-2-3"
            disabled={disabled}
          />
        </div>

        {/* Building/Apartment */}
        {showBuilding && (
          <div style={styles.formGroup}>
            <label style={styles.label}>
              <span>🏢</span>
              建物名・部屋番号 / Building & Room
            </label>
            <input
              type="text"
              value={formData.building || ''}
              onChange={(e) => handleFieldChange('building', e.target.value)}
              style={styles.input}
              placeholder="例: 〇〇ビル 3F"
              disabled={disabled}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AddressInputWithPostal;