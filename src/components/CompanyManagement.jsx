// src/components/CompanyManagement.jsx
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const CompanyManagement = ({ fy }) => {
  const [companies, setCompanies] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!fy) return;

    const unsub = onSnapshot(collection(db, fy, 'companies'), (snap) => {
      const list = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.ownerId === auth.currentUser.uid) {
          list.push({ id: d.id, ...data });
        }
      });
      setCompanies(list);
    }, (err) => {
      console.error('Firestore error:', err);
      toast.error('Failed to load companies');
    });

    return () => unsub();
  }, [fy]);

  const handleDelete = async (id) => {
    if (window.confirm('Delete this company permanently?')) {
      try {
        await deleteDoc(doc(db, fy, 'companies', id));
        toast.success('Company deleted successfully!');
      } catch (err) {
        toast.error('Delete failed: ' + err.message);
      }
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1f2937' }}>
          Company Management
        </h1>
        <button 
          onClick={() => navigate('/')} 
          style={{ 
            padding: '1rem 2rem', background: '#3b82f6', color: 'white', 
            border: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '1.1rem'
          }}
        >
          + New Company
        </button>
      </div>

      {companies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem', background: 'white', borderRadius: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '1.3rem', color: '#6b7280' }}>
            No companies registered yet.<br />
            Click "New Company" to add your first one.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
          {companies.map((c) => (
            <div 
              key={c.id} 
              style={{ 
                background: 'white', 
                padding: '2rem', 
                borderRadius: '1rem', 
                boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
                border: '1px solid #e5e7eb'
              }}
            >
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#111827' }}>
                {c.companyName || 'Unnamed Company'}
              </h3>
              <p style={{ color: '#4b5563', marginBottom: '0.5rem' }}>
                <strong>Corp No:</strong> {c.corporateNumber || 'N/A'}
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>
                {c.prefecture} {c.city} {c.address}
              </p>
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={() => navigate('/')} 
                  style={{ color: '#3b82f6', fontWeight: 'bold' }}
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDelete(c.id)} 
                  style={{ color: '#ef4444', fontWeight: 'bold' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '3rem' }}>
        <button 
          onClick={() => navigate('/admin')} 
          style={{ 
            padding: '1.2rem 4rem', background: '#8b5cf6', color: 'white', 
            border: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '1.2rem'
          }}
        >
          Go to Admin Dashboard
        </button>
      </div>
    </div>
  );
};

export default CompanyManagement;