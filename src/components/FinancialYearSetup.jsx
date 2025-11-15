// src/components/FinancialYearSetup.jsx
import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';

const FinancialYearSetup = ({ onComplete }) => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fyName = `${start.split('-')[0]}_${end.split('-')[0]}`;

    try {
       await updateDoc(doc(db, 'users', user.uid), {
  current_fy: selectedFY // ex: "2025_2026"
});
      // YE DAAL — FY KO DOCUMENT BANA
      await setDoc(doc(db, 'financial_years', fyName), {
        startDate: start,
        endDate: end,
        createdBy: auth.currentUser.uid,
        createdAt: new Date()
      });

      // User settings mein bhi save kar
      await setDoc(doc(db, 'settings', auth.currentUser.uid), { fyName }, { merge: true });

      toast.success(`${fyName} created!`);
      onComplete(fyName);
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };
  

  return (
    <div style={{ padding: '3rem', textAlign: 'center' }}>
      <h1>Financial Year Setup</h1>
      <form onSubmit={handleSubmit} style={{ display: 'inline-grid', gap: '1rem', marginTop: '2rem' }}>
        <input type="date" value={start} onChange={e => setStart(e.target.value)} required />
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} required />
        <button type="submit" style={{ padding: '1rem 3rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '50px' }}>
          Create FY
        </button>
      </form>
    </div>
  );
};

export default FinancialYearSetup;