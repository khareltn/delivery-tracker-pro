// src/components/FinancialYearSetup.jsx
import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const FinancialYearSetup = ({ onComplete }) => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fyName = `${start.split('-')[0]}_${end.split('-')[0]}`;

    try {
      // Create Financial Year document
      await setDoc(doc(db, 'financial_years', fyName), {
      fyId: fyName,
      startDate: start,
      endDate: end,
      createdBy: auth.currentUser.uid,
      createdAt: new Date(),
      status: 'active'
    });


      // Save current FY in user settings changed //
      //await setDoc(doc(db, 'user_settings', auth.currentUser.uid), { 
        //fyId: fyName 
      //}, { merge: true });
      await setDoc(
       doc(db, 'users', auth.currentUser.uid),
      {
       current_fy: fyName,
       updatedAt: new Date()
       },
        { merge: true }
);


      toast.success(`Financial Year ${fyName} created successfully!`);
      
      // Pass FY to parent and navigate to company registration
      if (onComplete) {
        onComplete(fyName);
      }
      navigate('/company-reg');
    } catch (err) {
      toast.error('Error creating financial year: ' + err.message);
      console.error('Full error:', err);
    }
  };

  return (
    <div style={{ padding: '3rem', textAlign: 'center' }}>
      <h1>Financial Year Setup</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Create a financial year first. All company data will be stored under this financial year.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'inline-grid', gap: '1rem', marginTop: '2rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Start Date:</label>
          <input 
            type="date" 
            value={start} 
            onChange={e => setStart(e.target.value)} 
            required 
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>End Date:</label>
          <input 
            type="date" 
            value={end} 
            onChange={e => setEnd(e.target.value)} 
            required 
          />
        </div>
        <button 
          type="submit" 
          style={{ 
            padding: '1rem 3rem', 
            background: '#10b981', 
            color: 'white', 
            border: 'none', 
            borderRadius: '50px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Create Financial Year
        </button>
      </form>
    </div>
  );
};

export default FinancialYearSetup;