// src/components/CompanyRegistration.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import './CompanyRegistration.css';

const CompanyRegistration = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [taxVerificationStatus, setTaxVerificationStatus] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [postalData, setPostalData] = useState([]);
  
  // YE HAI — currentFY aur setCurrentFY defined!
  const [currentFY, setCurrentFY] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    companyId: '',
    companyNameKana: '',
    postalCode: '',
    prefecture: '',
    city: '',
    address: '',
    building: '',
    corporateNumber: '',
    taxRegistrationNo: '',
    representative: '',
    phone: '',
    fax: '',
    email: '',
    website: '',
    bankAccounts: [
      { bankName: '', branchName: '', accountType: 'savings', accountNumber: '', accountHolder: '' }
    ]
  });

  // 1. FETCH CURRENT FY FROM users/{uid}.current_fy
  useEffect(() => {
    const fetchFY = async () => {
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          toast.error('User data not found');
          return;
        }

        const fyId = userDoc.data().current_fy;
        if (!fyId) {
          toast.error('Financial Year not set. Please set in FY Setup.');
          navigate('/fy-setup');
          return;
        }

        const fyDoc = await getDoc(doc(db, 'financial_years', fyId));
        if (!fyDoc.exists()) {
          toast.error('Invalid Financial Year. Contact admin.');
          navigate('/fy-setup');
          return;
        }

        // YE HAI — setCurrentFY use kiya!
        setCurrentFY(fyId);
      } catch (err) {
        console.error('FY fetch error:', err);
        toast.error('Failed to load Financial Year');
      }
    };

    fetchFY();
  }, [user, navigate]);

  // 2. POSTAL DATA LOAD
  useEffect(() => {
    fetch('/postal_codes.json?t=' + Date.now())
      .then(r => r.json())
      .then(data => setPostalData(data))
      .catch(() => toast.error('postal_codes.json not found'));
  }, []);

  // 3. GENERATE COMPANY ID
  useEffect(() => {
    if (!currentFY) return; // currentFY use kiya

    const generateId = async () => {
      const year = currentFY.split('_')[0]; // currentFY
      const companiesRef = collection(db, 'financial_years', currentFY, 'companies'); // currentFY
      const q = query(
        companiesRef,
        where('companyId', '>=', `COMP-${year}-`),
        where('companyId', '<=', `COMP-${year}-\uf8ff`),
        orderBy('companyId', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      const next = snap.empty ? 1 : parseInt(snap.docs[0].data().companyId.split('-')[2]) + 1;
      const newId = `COMP-${year}-${String(next).padStart(3, '0')}`;
      setCompanyId(newId);
      setFormData(prev => ({ ...prev, companyId: newId }));
    };
    generateId();
  }, [currentFY]); // currentFY dependency

  // POSTAL CHANGE
  const handlePostalChange = (value) => {
    const clean = value.replace(/[^0-9]/g, '');
    if (clean.length === 7) {
      const found = postalData.find(p => p.postal_code === clean);
      if (found) {
        setFormData(prev => ({
          ...prev,
          postalCode: clean,
          prefecture: found.prefecture,
          city: found.city,
          address: found.town
        }));
        toast.success('Address filled!');
      }
    }
  };

  // BANK FUNCTIONS
  const handleBankAccountChange = (index, field, value) => {
    const updated = [...formData.bankAccounts];
    updated[index][field] = value;
    setFormData(prev => ({ ...prev, bankAccounts: updated }));
  };

  const addBankAccount = () => {
    setFormData(prev => ({
      ...prev,
      bankAccounts: [...prev.bankAccounts, { bankName: '', branchName: '', accountType: 'savings', accountNumber: '', accountHolder: '' }]
    }));
  };

  const removeBankAccount = (index) => {
    if (formData.bankAccounts.length > 1) {
      setFormData(prev => ({
        ...prev,
        bankAccounts: prev.bankAccounts.filter((_, i) => i !== index)
      }));
    }
  };

  // TAX VERIFY
  const verifyTaxRegistration = async () => {
    const taxId = formData.taxRegistrationNo;
    const cleanId = taxId.replace(/^T/, '');
    if (!taxId.startsWith('T') || cleanId.length !== 13 || !/^\d+$/.test(cleanId)) {
      setError('Tax ID: T + 13 digits');
      setTaxVerificationStatus('error');
      return;
    }
    setTaxVerificationStatus('verifying');
    setError('');
    await new Promise(r => setTimeout(r, 1500));
    if (cleanId === '1234567890123') {
      setTaxVerificationStatus('success');
    } else {
      setTaxVerificationStatus('error');
      setError('Invalid Tax ID');
    }
  };

  // SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentFY) return toast.error('Financial Year not set'); // currentFY
    if (formData.taxRegistrationNo && taxVerificationStatus !== 'success') return setError('Verify Tax ID');
    if (!formData.name || !formData.postalCode) return setError('Fill required fields');

    setLoading(true);
    try {
      await addDoc(collection(db, 'financial_years', currentFY, 'companies'), { // currentFY
        ...formData,
        ownerId: currentUser.uid,
        ownerEmail: currentUser.email,
        createdAt: new Date(),
        status: 'active',
        financialYear: currentFY // currentFY
      });
      toast.success('Company Registered!');
      navigate('/management');
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // LOADING STATE
  if (!currentFY) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading Financial Year...</div>;
  }

  return (
    <div className="company-reg-container">
      <h1>Company Registration (FY: {currentFY})</h1>
      <p className="company-id">Company ID: <strong>{companyId}</strong></p>
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit} className="company-form">
        <div className="form-grid">
          <input placeholder="Company Name *" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} required />
          <input placeholder="Kana" value={formData.companyNameKana} onChange={e => setFormData(prev => ({ ...prev, companyNameKana: e.target.value }))} />
          <input placeholder="Postal Code" value={formData.postalCode} onChange={e => { setFormData(prev => ({ ...prev, postalCode: e.target.value })); handlePostalChange(e.target.value); }} maxLength="7" />
          <input placeholder="Prefecture" value={formData.prefecture} readOnly className="readonly" />
          <input placeholder="City" value={formData.city} readOnly className="readonly" />
          <input placeholder="Address" value={formData.address} readOnly className="readonly" />
          <input placeholder="Building" value={formData.building} onChange={e => setFormData(prev => ({ ...prev, building: e.target.value }))} style={{ gridColumn: '1 / -1' }} />
          <input placeholder="Corp No" value={formData.corporateNumber} onChange={e => setFormData(prev => ({ ...prev, corporateNumber: e.target.value }))} maxLength="13" />
          <input placeholder="Representative" value={formData.representative} onChange={e => setFormData(prev => ({ ...prev, representative: e.target.value }))} style={{ gridColumn: '1 / -1' }} />
          <input placeholder="Phone" value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} />
          <input placeholder="Email" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem' }}>
            <input placeholder="Tax ID (T+13 digits)" value={formData.taxRegistrationNo} onChange={e => setFormData(prev => ({ ...prev, taxRegistrationNo: e.target.value }))} style={{ flex: 1 }} />
            <button type="button" onClick={verifyTaxRegistration} disabled={taxVerificationStatus === 'verifying'} className="verify-btn">
              {taxVerificationStatus === 'success' ? 'Verified' : taxVerificationStatus === 'verifying' ? 'Checking...' : 'Verify'}
            </button>
          </div>
        </div>

        <h3>Bank Accounts</h3>
        {formData.bankAccounts.map((acc, i) => (
          <div key={i} className="bank-account">
            <input placeholder="Bank Name *" value={acc.bankName} onChange={e => handleBankAccountChange(i, 'bankName', e.target.value)} />
            <input placeholder="Branch Name" value={acc.branchName} onChange={e => handleBankAccountChange(i, 'branchName', e.target.value)} />
            <select value={acc.accountType} onChange={e => handleBankAccountChange(i, 'accountType', e.target.value)}>
              <option value="savings">Savings</option>
              <option value="checking">Checking</option>
              <option value="current">Current</option>
            </select>
            <input placeholder="Account Number *" value={acc.accountNumber} onChange={e => handleBankAccountChange(i, 'accountNumber', e.target.value)} />
            <input placeholder="Holder (Kana)" value={acc.accountHolder} onChange={e => handleBankAccountChange(i, 'accountHolder', e.target.value)} />
            {formData.bankAccounts.length > 1 && (
              <button type="button" onClick={() => removeBankAccount(i)} className="remove-btn">Remove</button>
            )}
          </div>
        ))}
        <button type="button" onClick={addBankAccount} className="add-bank-btn">+ Add Bank</button>

        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? 'Saving...' : 'Complete Registration'}
        </button>
      </form>
    </div>
  );
};

export default CompanyRegistration;