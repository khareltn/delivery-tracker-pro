// src/components/CompanyRegistration.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { usePostalCodes } from '/src/hooks/usePostalCodes.js';
import './CompanyRegistration.css';

const CompanyRegistration = () => {
  const navigate = useNavigate();
  const { companyId: paramCompanyId } = useParams();
  const { user } = useAuth();
  const [currentUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [taxVerificationStatus, setTaxVerificationStatus] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [fyId, setfyId] = useState('');
  const [isLoadingFY, setIsLoadingFY] = useState(true);
  const [hasValidFY, setHasValidFY] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [existingCompanyId, setExistingCompanyId] = useState('');
  const [originalData, setOriginalData] = useState(null);

  const { postalData, loading: postalLoading, findAddressByPostalCode } = usePostalCodes();

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

  // Detect edit/view mode
  useEffect(() => {
    if (paramCompanyId) {
      const path = window.location.pathname;
      if (path.includes('/edit/')) {
        setIsEditMode(true);
        setIsViewMode(false);
      } else if (path.includes('/view/')) {
        setIsEditMode(false);
        setIsViewMode(true);
      }
      setExistingCompanyId(paramCompanyId);
    }
  }, [paramCompanyId]);

  // Fetch current FY from user document - FIXED TO WAIT PROPERLY
  useEffect(() => {
    const fetchFY = async () => {
      if (!user) {
        setIsLoadingFY(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          toast.error('User data not found');
          setIsLoadingFY(false);
          return;
        }

        const userData = userDoc.data();
        const fyFromUser = userData.current_fy;

        if (!fyFromUser) {
          setIsLoadingFY(false);
          return;
        }

        // Validate FY document exists
        const fyDoc = await getDoc(doc(db, 'financial_years', fyFromUser));
        if (!fyDoc.exists()) {
          toast.error('Financial Year document not found');
          setIsLoadingFY(false);
          return;
        }

        setfyId(fyFromUser);
        setHasValidFY(true);
        setIsLoadingFY(false);
      } catch (err) {
        console.error('Error loading FY:', err);
        setIsLoadingFY(false);
      }
    };

    fetchFY();
  }, [user]);

  // Load existing company or generate ID - only after FY loaded
  useEffect(() => {
  const processCompany = async () => {
    try {
      if ((isEditMode || isViewMode) && existingCompanyId) {
        await loadExistingCompany();
      } else if (fyId && !isEditMode && !isViewMode) {
        await generateCompanyId();
      }
    } catch (err) {
      console.error('Company processing error:', err);
      toast.error('Failed to load company data');
    }
  };

  // Sirf isLoadingFY false hone pe call karo, fyId truthy ho ya na ho
  if (!isLoadingFY) {
    processCompany();
  }
}, [isLoadingFY, fyId, isEditMode, isViewMode, existingCompanyId]);

  const loadExistingCompany = async () => {
    try {
      const companyRef = doc(db, 'financial_years', fyId, 'companies', existingCompanyId);
      const snap = await getDoc(companyRef);

      if (!snap.exists()) {
        toast.error('Company not found');
        navigate('/management');
        return;
      }

      const foundCompany = snap.data();
      setOriginalData(foundCompany);

      setFormData({
        name: foundCompany.name || '',
        companyId: foundCompany.companyId || '',
        companyNameKana: foundCompany.companyNameKana || '',
        postalCode: foundCompany.postalCode || '',
        prefecture: foundCompany.prefecture || '',
        city: foundCompany.city || '',
        address: foundCompany.address || '',
        building: foundCompany.building || '',
        corporateNumber: foundCompany.corporateNumber || '',
        taxRegistrationNo: foundCompany.taxRegistrationNo || '',
        representative: foundCompany.representative || '',
        phone: foundCompany.phone || '',
        fax: foundCompany.fax || '',
        email: foundCompany.email || '',
        website: foundCompany.website || '',
        bankAccounts: foundCompany.bankAccounts?.length > 0 
          ? foundCompany.bankAccounts 
          : [{ bankName: '', branchName: '', accountType: 'savings', accountNumber: '', accountHolder: '' }]
      });

      setCompanyId(foundCompany.companyId || '');
      
      if (foundCompany.taxRegistrationNo) {
        setTaxVerificationStatus('success');
      }

    } catch (error) {
      console.error('Load error:', error);
      toast.error('Failed to load company');
      navigate('/management');
    }
  };

  const generateCompanyId = async () => {
    try {
      const year = fyId.split('_')[0];
      const companiesRef = collection(db, 'financial_years', fyId, 'companies');
      const q = query(
        companiesRef,
        where('companyId', '>=', `COMP-${year}-`),
        where('companyId', '<=', `COMP-${year}-\uf8ff`),
        orderBy('companyId', 'desc'),
        limit(1)
      );
      
      const snap = await getDocs(q);
      let nextNumber = 1;
      
      if (!snap.empty) {
        const lastId = snap.docs[0].data().companyId;
        const lastNum = lastId.split('-')[2];
        nextNumber = parseInt(lastNum) + 1;
      }
      
      const newId = `COMP-${year}-${String(nextNumber).padStart(3, '0')}`;
      setCompanyId(newId);
      setFormData(prev => ({ ...prev, companyId: newId }));
    } catch (error) {
      console.error('ID generation error:', error);
      const year = fyId.split('_')[0];
      const fallbackId = `COMP-${year}-001`;
      setCompanyId(fallbackId);
      setFormData(prev => ({ ...prev, companyId: fallbackId }));
    }
  };

  const handlePostalChange = (value) => {
    if (isViewMode) return;

    const clean = value.replace(/[^0-9]/g, '').slice(0, 7);
    setFormData(prev => ({ ...prev, postalCode: clean }));

    if (clean.length < 7) {
      setFormData(prev => ({
        ...prev,
        prefecture: '',
        city: '',
        address: ''
      }));
      return;
    }

    if (clean.length === 7) {
      const result = findAddressByPostalCode(clean);

      if (result) {
        setFormData(prev => ({
          ...prev,
          prefecture: result.prefecture || '',
          city: result.city || '',
          address: result.town || ''
        }));
        toast.success('住所が自動入力されました！');
      } else {
        toast.warning('該当する郵便番号が見つかりませんでした');
        setFormData(prev => ({
          ...prev,
          prefecture: '',
          city: '',
          address: ''
        }));
      }
    }
  };

  useEffect(() => {
    if (formData.postalCode.length === 7 && !postalLoading && postalData) {
      handlePostalChange(formData.postalCode);
    }
  }, [postalLoading, postalData, formData.postalCode]);

  const handleBankAccountChange = (index, field, value) => {
    if (isViewMode) return;
    const updated = [...formData.bankAccounts];
    updated[index][field] = value;
    setFormData(prev => ({ ...prev, bankAccounts: updated }));
  };

  const addBankAccount = () => {
    if (isViewMode) return;
    setFormData(prev => ({
      ...prev,
      bankAccounts: [...prev.bankAccounts, 
        { bankName: '', branchName: '', accountType: 'savings', accountNumber: '', accountHolder: '' }
      ]
    }));
  };

  const removeBankAccount = (index) => {
    if (isViewMode) return;
    if (formData.bankAccounts.length > 1) {
      setFormData(prev => ({
        ...prev,
        bankAccounts: prev.bankAccounts.filter((_, i) => i !== index)
      }));
    }
  };

  const verifyTaxRegistration = async () => {
    if (isViewMode) return;
    
    const taxId = formData.taxRegistrationNo.trim();
    if (!taxId) {
      setError('Tax Registration Number required');
      setTaxVerificationStatus('error');
      return;
    }

    const cleanId = taxId.replace(/^T/, '').replace(/\D/g, '');
    
    if (cleanId.length !== 13) {
      setError('Tax ID must be T + 12 digits');
      setTaxVerificationStatus('error');
      return;
    }

    setTaxVerificationStatus('verifying');
    setError('');
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setTaxVerificationStatus('success');
    toast.success('Tax ID verified!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isViewMode) {
      navigate('/management');
      return;
    }
    
    if (!fyId) {
      toast.error('Financial Year not set');
      return;
    }
    
    if (formData.taxRegistrationNo && taxVerificationStatus !== 'success') {
      setError('Verify Tax ID first');
      return;
    }
    
    if (!formData.name.trim()) {
      setError('Company Name required');
      return;
    }
    
    if (!formData.postalCode || formData.postalCode.length !== 7) {
      setError('Valid 7-digit Postal Code required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const companyData = {
        ...formData,
        ownerId: currentUser.uid,
        ownerEmail: currentUser.email,
        updatedAt: new Date(),
        status: 'active',
        financialYear: fyId
      };

      if (isEditMode) {
        await setDoc(doc(db, 'financial_years', fyId, 'companies', companyId), companyData, { merge: true });
        toast.success('Company Updated Successfully!');
      } else {
        companyData.createdAt = new Date();
        await setDoc(doc(db, 'financial_years', fyId, 'companies', companyId), companyData);
        toast.success('Company Registered Successfully!');
      }
      
      navigate('/management');
    } catch (err) {
      console.error('Submit error:', err);
      setError(`${isEditMode ? 'Update' : 'Registration'} failed`);
      toast.error(`Failed to ${isEditMode ? 'update' : 'register'} company`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (isViewMode || !originalData) return;
    setFormData(originalData);
    toast.info('Form reset to original');
  };

  const handleCancel = () => navigate('/management');

  // FIXED: Proper loading and FY check - NO LOOP
  if (isLoadingFY) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading Financial Year configuration...</p>
      </div>
    );
  }

  if (!hasValidFY) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h2 className="error-title">Financial Year Required</h2>
        <p className="error-message">
          You need to setup a Financial Year before registering a company.
        </p>
        <button onClick={() => navigate('/fy-setup')} className="redirect-button">
          Go to Financial Year Setup
        </button>
        <button onClick={() => navigate('/management')} className="back-button">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="company-reg-container">
      <div className="header-section">
        <div className="header-top">
          <h2 className="title">
            {isEditMode ? 'Edit Company' : isViewMode ? 'View Company Details' : 'Register New Company'}
          </h2>
          {isEditMode && <div className="edit-mode-badge"><span className="edit-mode-indicator">✏️</span> Edit Mode</div>}
          {isViewMode && <div className="view-mode-badge"><span className="view-mode-indicator">👁️</span> View Mode</div>}
        </div>
        <div className="sub-header">
          <div className="fy-badge">FY: {fyId}</div>
          <div className="company-id-display">
            Company ID: <strong>{companyId || 'Generating...'}</strong>
            <span className="readonly-tag">(Read-only)</span>
          </div>
        </div>
      </div>

      {error && <div className="error-alert">{error}</div>}

      <div className="form-card">
        <form onSubmit={handleSubmit}>
          {/* Company Information */}
          <div className="form-section">
            <h3 className="section-title">Company Information</h3>
            <div className="form-grid">
              <div className="input-group">
                <label className="label">Company Name <span className="required">*</span></label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input"
                  required
                  disabled={isViewMode}
                />
              </div>
              <div className="input-group">
                <label className="label">Company Name (Kana)</label>
                <input
                  type="text"
                  value={formData.companyNameKana}
                  onChange={e => setFormData(prev => ({ ...prev, companyNameKana: e.target.value }))}
                  className="input"
                  disabled={isViewMode}
                />
              </div>
            </div>
          </div>

          {/* Address Section */}
          <div className="form-section">
            <h3 className="section-title">Address</h3>
            <div className="form-grid">
              <div className="input-group">
                <label className="label">Postal Code <span className="required">*</span></label>
                <input
                  type="text"
                  placeholder="1234567"
                  value={formData.postalCode}
                  onChange={(e) => handlePostalChange(e.target.value)}
                  className="input"
                  maxLength="7"
                  required
                  disabled={isViewMode || postalLoading}
                />
                {postalLoading && <small className="field-note">検索中です...</small>}
              </div>

              <div className="input-group">
                <label className="label">Prefecture</label>
                <input type="text" value={formData.prefecture} readOnly className="input readonly" />
              </div>
              <div className="input-group">
                <label className="label">City</label>
                <input type="text" value={formData.city} readOnly className="input readonly" />
              </div>
              <div className="input-group">
                <label className="label">Address Line</label>
                <input type="text" value={formData.address} readOnly className="input readonly" />
              </div>
              <div className="input-group">
                <label className="label">Building / Room</label>
                <input
                  type="text"
                  value={formData.building}
                  onChange={e => setFormData(prev => ({ ...prev, building: e.target.value }))}
                  className="input"
                  disabled={isViewMode}
                />
              </div>
            </div>
          </div>

          {/* Contact & Legal */}
          <div className="form-section">
            <h3 className="section-title">Contact & Legal Information</h3>
            <div className="form-grid">
              <div className="input-group">
                <label className="label">Corporate Number</label>
                <input
                  type="text"
                  value={formData.corporateNumber}
                  onChange={e => setFormData(prev => ({ ...prev, corporateNumber: e.target.value }))}
                  className="input"
                  disabled={isViewMode}
                />
              </div>
              <div className="input-group">
                <label className="label">Representative</label>
                <input
                  type="text"
                  value={formData.representative}
                  onChange={e => setFormData(prev => ({ ...prev, representative: e.target.value }))}
                  className="input"
                  disabled={isViewMode}
                />
              </div>
              <div className="input-group">
                <label className="label">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="input"
                  disabled={isViewMode}
                />
              </div>
              <div className="input-group">
                <label className="label">Fax</label>
                <input
                  type="text"
                  value={formData.fax}
                  onChange={e => setFormData(prev => ({ ...prev, fax: e.target.value }))}
                  className="input"
                  disabled={isViewMode}
                />
              </div>
              <div className="input-group">
                <label className="label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="input"
                  disabled={isViewMode}
                />
              </div>
              <div className="input-group">
                <label className="label">Website</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  className="input"
                  disabled={isViewMode}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="label">Tax Registration No</label>
              <div className="tax-input-container">
                <input
                  type="text"
                  value={formData.taxRegistrationNo}
                  onChange={e => {
                    setFormData(prev => ({ ...prev, taxRegistrationNo: e.target.value }));
                    setTaxVerificationStatus('');
                  }}
                  className="input"
                  placeholder="T + 12 digits"
                  disabled={isViewMode}
                />
                {!isViewMode && (
                  <button 
                    type="button" 
                    onClick={verifyTaxRegistration} 
                    className={`verify-button ${taxVerificationStatus}`}
                    disabled={taxVerificationStatus === 'verifying'}
                  >
                    {taxVerificationStatus === 'success' ? '✓ Verified' : 
                     taxVerificationStatus === 'verifying' ? 'Checking...' : 
                     'Verify'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bank Accounts */}
          <div className="bank-section">
            <h3 className="section-title">Bank Accounts</h3>
            {formData.bankAccounts.map((account, index) => (
              <div key={index} className="bank-account-card">
                <div className="bank-account-header">
                  <h4 className="bank-account-title">Bank Account {index + 1}</h4>
                  {!isViewMode && formData.bankAccounts.length > 1 && (
                    <button type="button" onClick={() => removeBankAccount(index)} className="remove-bank-button">
                      Remove
                    </button>
                  )}
                </div>
                <div className="bank-grid">
                  <div className="input-group">
                    <label className="label">Bank Name *</label>
                    <input
                      value={account.bankName}
                      onChange={e => handleBankAccountChange(index, 'bankName', e.target.value)}
                      className="input"
                      required
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="input-group">
                    <label className="label">Branch Name</label>
                    <input
                      value={account.branchName}
                      onChange={e => handleBankAccountChange(index, 'branchName', e.target.value)}
                      className="input"
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="input-group">
                    <label className="label">Account Type</label>
                    <select
                      value={account.accountType}
                      onChange={e => handleBankAccountChange(index, 'accountType', e.target.value)}
                      className="select"
                      disabled={isViewMode}
                    >
                      <option value="savings">Savings</option>
                      <option value="checking">Checking</option>
                      <option value="current">Current</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="label">Account Number *</label>
                    <input
                      value={account.accountNumber}
                      onChange={e => handleBankAccountChange(index, 'accountNumber', e.target.value)}
                      className="input"
                      required
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="input-group">
                    <label className="label">Account Holder (Kana)</label>
                    <input
                      value={account.accountHolder}
                      onChange={e => handleBankAccountChange(index, 'accountHolder', e.target.value)}
                      className="input"
                      disabled={isViewMode}
                    />
                  </div>
                </div>
              </div>
            ))}
            {!isViewMode && (
              <button type="button" onClick={addBankAccount} className="add-bank-button">
                + Add Another Bank Account
              </button>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="submit-section">
            {!isViewMode && (
              <button type="submit" disabled={loading} className="submit-button">
                {loading ? 'Saving...' : isEditMode ? 'Update Company' : 'Register Company'}
              </button>
            )}
            {isEditMode && !isViewMode && (
              <button type="button" onClick={handleReset} className="reset-button">
                Reset Form
              </button>
            )}
            <button type="button" onClick={handleCancel} className="cancel-button">
              {isViewMode ? 'Back to List' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanyRegistration;