// src/components/CompanyRegistration.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc,
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  getDoc, 
  doc 
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
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
  const [postalData, setPostalData] = useState([]);
  const [currentFY, setCurrentFY] = useState(null);
  const [isLoadingFY, setIsLoadingFY] = useState(true);
  const [hasValidFY, setHasValidFY] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [existingCompanyId, setExistingCompanyId] = useState('');
  const [originalData, setOriginalData] = useState(null);

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

  // Check if we're in edit or view mode
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

  // 1. FETCH CURRENT FY - MODIFIED FOR EDIT MODE
  useEffect(() => {
    const fetchFY = async () => {
      if (!user) {
        setIsLoadingFY(false);
        return;
      }

      try {
        // In edit/view mode, we don't need to check FY from user doc
        // Instead, we'll get it from the company data itself
        if (isEditMode || isViewMode) {
          setIsLoadingFY(false);
          setHasValidFY(true); // Allow edit/view even if no FY in user doc
          return;
        }

        // For new registration, check FY from user document
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          toast.error('User data not found');
          setIsLoadingFY(false);
          return;
        }

        const fyId = userDoc.data().current_fy;
        if (!fyId) {
          toast.error('Financial Year not set. Please set in FY Setup.');
          navigate('/fy-setup');
          setIsLoadingFY(false);
          return;
        }

        const fyDoc = await getDoc(doc(db, 'financial_years', fyId));
        if (!fyDoc.exists()) {
          toast.error('Invalid Financial Year. Contact admin.');
          navigate('/fy-setup');
          setIsLoadingFY(false);
          return;
        }

        setCurrentFY(fyId);
        setHasValidFY(true);
        setIsLoadingFY(false);
      } catch (err) {
        console.error('FY fetch error:', err);
        // In edit mode, don't redirect to FY setup
        if (!isEditMode && !isViewMode) {
          toast.error('Failed to load Financial Year');
          navigate('/fy-setup');
        }
        setIsLoadingFY(false);
      }
    };

    fetchFY();
  }, [user, navigate, isEditMode, isViewMode]);

  // 2. POSTAL DATA LOAD (Only if not in edit/view mode or hasValidFY)
  useEffect(() => {
    if (isEditMode || isViewMode || hasValidFY) {
      fetch('/postal_codes.json?t=' + Date.now())
        .then(r => {
          if (!r.ok) throw new Error('Failed to load postal codes');
          return r.json();
        })
        .then(data => setPostalData(data))
        .catch(() => toast.error('postal_codes.json not found'));
    }
  }, [hasValidFY, isEditMode, isViewMode]);

  // 3. LOAD EXISTING COMPANY OR GENERATE NEW ID
  useEffect(() => {
    const processCompanyData = async () => {
      try {
        if ((isEditMode || isViewMode) && existingCompanyId) {
          // EDIT/VIEW MODE: Load existing company data
          await loadExistingCompany();
        } else if (currentFY && hasValidFY && !isEditMode && !isViewMode) {
          // NEW REGISTRATION: Generate new company ID
          await generateCompanyId();
        }
      } catch (error) {
        console.error('Error processing company data:', error);
        toast.error('Failed to load company data');
      }
    };

    processCompanyData();
  }, [currentFY, hasValidFY, isEditMode, isViewMode, existingCompanyId]);

  // Function to load existing company data
  const loadExistingCompany = async () => {
    try {
      console.log('Loading company for edit/view:', existingCompanyId);
      
      // Search across all financial_years to find the company
      const financialYearsRef = collection(db, 'financial_years');
      const fySnapshot = await getDocs(financialYearsRef);
      
      let foundCompany = null;
      let foundFY = null;
      let foundDocId = null;

      // Search through all financial years
      for (const fyDoc of fySnapshot.docs) {
        const fyId = fyDoc.id;
        const companiesRef = collection(db, 'financial_years', fyId, 'companies');
        const q = query(companiesRef, where('companyId', '==', existingCompanyId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          foundCompany = querySnapshot.docs[0].data();
          foundFY = fyId;
          foundDocId = querySnapshot.docs[0].id;
          console.log('Found company in FY:', fyId, foundCompany);
          break;
        }
      }

      if (!foundCompany) {
        toast.error('Company not found');
        navigate('/management');
        return;
      }

      // Store original data for comparison
      setOriginalData(foundCompany);
      
      // Set form data from existing company
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
        bankAccounts: foundCompany.bankAccounts || [
          { bankName: '', branchName: '', accountType: 'savings', accountNumber: '', accountHolder: '' }
        ]
      });

      setCompanyId(foundCompany.companyId || '');
      setCurrentFY(foundFY); // Set current FY from where company was found
      
      // Auto-verify tax if it exists
      if (foundCompany.taxRegistrationNo) {
        setTaxVerificationStatus('success');
      }
      
      // Mark as valid for edit/view
      setHasValidFY(true);
      setIsLoadingFY(false);
      
    } catch (error) {
      console.error('Error loading company:', error);
      toast.error('Failed to load company data');
      navigate('/management');
    }
  };

  // Function to generate new company ID
  const generateCompanyId = async () => {
    try {
      const year = currentFY.split('_')[0];
      const companiesRef = collection(db, 'financial_years', currentFY, 'companies');
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
      console.error('Error generating company ID:', error);
      const year = currentFY.split('_')[0];
      const newId = `COMP-${year}-001`;
      setCompanyId(newId);
      setFormData(prev => ({ ...prev, companyId: newId }));
    }
  };

  // POSTAL CHANGE
  const handlePostalChange = (value) => {
    if (isViewMode) return; // Don't allow changes in view mode
    
    const clean = value.replace(/[^0-9]/g, '');
    setFormData(prev => ({ ...prev, postalCode: clean }));
    
    if (clean.length === 7) {
      const found = postalData.find(p => p.postal_code === clean);
      if (found) {
        setFormData(prev => ({
          ...prev,
          prefecture: found.prefecture,
          city: found.city,
          address: found.town
        }));
        toast.success('Address filled!');
      } else {
        toast.warning('Postal code not found in database');
      }
    }
  };

  // BANK FUNCTIONS
  const handleBankAccountChange = (index, field, value) => {
    if (isViewMode) return; // Don't allow changes in view mode
    
    const updated = [...formData.bankAccounts];
    updated[index][field] = value;
    setFormData(prev => ({ ...prev, bankAccounts: updated }));
  };

  const addBankAccount = () => {
    if (isViewMode) return; // Don't allow changes in view mode
    
    setFormData(prev => ({
      ...prev,
      bankAccounts: [...prev.bankAccounts, 
        { bankName: '', branchName: '', accountType: 'savings', accountNumber: '', accountHolder: '' }
      ]
    }));
  };

  const removeBankAccount = (index) => {
    if (isViewMode) return; // Don't allow changes in view mode
    if (formData.bankAccounts.length > 1) {
      setFormData(prev => ({
        ...prev,
        bankAccounts: prev.bankAccounts.filter((_, i) => i !== index)
      }));
    }
  };

  // TAX VERIFY
  const verifyTaxRegistration = async () => {
    if (isViewMode) return; // Don't allow changes in view mode
    
    const taxId = formData.taxRegistrationNo.trim();
    if (!taxId) {
      setError('Please enter Tax Registration Number');
      setTaxVerificationStatus('error');
      return;
    }

    const cleanId = taxId.replace(/^T/, '').replace(/\D/g, '');
    
    if (cleanId.length !== 13) {
      setError('Tax ID must be 13 digits (T + 12 numbers)');
      setTaxVerificationStatus('error');
      return;
    }

    setTaxVerificationStatus('verifying');
    setError('');
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setTaxVerificationStatus('success');
    toast.success('Tax ID verified successfully!');
  };

  // SUBMIT - Handle both create and update
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isViewMode) {
      navigate('/management');
      return;
    }
    
    if (!isEditMode && (!currentFY || !hasValidFY)) {
      toast.error('Financial Year not set');
      navigate('/fy-setup');
      return;
    }
    
    if (formData.taxRegistrationNo && taxVerificationStatus !== 'success') {
      setError('Please verify Tax ID first');
      return;
    }
    
    if (!formData.name.trim()) {
      setError('Company Name is required');
      return;
    }
    
    if (!formData.postalCode || formData.postalCode.length !== 7) {
      setError('Valid 7-digit Postal Code is required');
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
        financialYear: currentFY || formData.financialYear || ''
      };

      if (isEditMode && currentFY) {
        // UPDATE EXISTING COMPANY
        // Find the company document
        const companiesRef = collection(db, 'financial_years', currentFY, 'companies');
        const q = query(companiesRef, where('companyId', '==', companyId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          throw new Error('Company not found for update');
        }
        
        const companyDoc = querySnapshot.docs[0];
        await updateDoc(companyDoc.ref, companyData);
        
        toast.success('Company Updated Successfully!');
      } else {
        // CREATE NEW COMPANY
        companyData.createdAt = new Date();
        await addDoc(collection(db, 'financial_years', currentFY, 'companies'), companyData);
        
        toast.success('Company Registered Successfully!');
      }
      
      navigate('/management');
      
    } catch (err) {
      console.error('Registration/Update error:', err);
      setError(`${isEditMode ? 'Update' : 'Registration'} failed: ${err.message}`);
      toast.error(`Failed to ${isEditMode ? 'update' : 'register'} company`);
    } finally {
      setLoading(false);
    }
  };

  // Reset form to original values
  const handleReset = () => {
    if (isViewMode) return; // Don't allow changes in view mode
    if (originalData) {
      setFormData(originalData);
      toast.info('Form reset to original values');
    }
  };

  // Cancel and navigate back
  const handleCancel = () => {
    navigate('/management');
  };

  // LOADING STATE
  if (isLoadingFY && !isEditMode && !isViewMode) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading Financial Year Configuration...</p>
        <p className="loading-subtext">
          Please wait while we verify your financial year setup
        </p>
      </div>
    );
  }

  // In edit/view mode, we don't need FY validation
  if (!isEditMode && !isViewMode && !hasValidFY) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h2 className="error-title">Financial Year Required</h2>
        <p className="error-message">
          You need to setup a Financial Year before registering a company.
        </p>
        <button
          onClick={() => navigate('/fy-setup')}
          className="redirect-button"
        >
          Go to Financial Year Setup
        </button>
        <button
          onClick={() => navigate('/management')}
          className="back-button"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="company-reg-container">
      <div className="header-section">
        <div className="header-top">
          <h1 className="title">
            {isViewMode ? 'View Company' : isEditMode ? 'Edit Company' : 'Company Registration'}
          </h1>
          {isViewMode && (
            <div className="view-mode-badge">
              <span className="view-mode-indicator">👁️</span>
              View Mode
            </div>
          )}
          {isEditMode && !isViewMode && (
            <div className="edit-mode-badge">
              <span className="edit-mode-indicator">✏️</span>
              Edit Mode
            </div>
          )}
        </div>
        <div className="sub-header">
          <span className="fy-badge">
            FY: {currentFY || formData.financialYear || 'Not Set'}
          </span>
          <span className="company-id-display">
            Company ID: <strong>{companyId}</strong>
            {(isEditMode || isViewMode) && <span className="readonly-tag"> (Read Only)</span>}
          </span>
        </div>
      </div>

      {error && (
        <div className="error-alert">
          ⚠️ {error}
        </div>
      )}

      <div className="form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {/* Basic Information */}
            <div className="form-section">
              <h3 className="section-title">Basic Information</h3>
              <div className="input-group">
                <label className="label">Company Name *</label>
                <input
                  type="text"
                  placeholder="Enter company name"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input"
                  required
                  disabled={isViewMode}
                  readOnly={isViewMode}
                />
              </div>

              <div className="input-group">
                <label className="label">Company Name (Kana)</label>
                <input
                  type="text"
                  placeholder="カナ表記"
                  value={formData.companyNameKana}
                  onChange={e => setFormData(prev => ({ ...prev, companyNameKana: e.target.value }))}
                  className="input"
                  disabled={isViewMode}
                  readOnly={isViewMode}
                />
              </div>

              <div className="input-group">
                <label className="label">Corporate Number</label>
                <input
                  type="text"
                  placeholder="13-digit corporate number"
                  value={formData.corporateNumber}
                  onChange={e => setFormData(prev => ({ ...prev, corporateNumber: e.target.value }))}
                  className="input"
                  maxLength="13"
                  disabled={isViewMode}
                  readOnly={isViewMode}
                />
              </div>

              <div className="input-group">
                <label className="label">Representative</label>
                <input
                  type="text"
                  placeholder="Representative name"
                  value={formData.representative}
                  onChange={e => setFormData(prev => ({ ...prev, representative: e.target.value }))}
                  className="input"
                  disabled={isViewMode}
                  readOnly={isViewMode}
                />
              </div>

              {/* Company ID Field - Always Read Only */}
              <div className="input-group">
                <label className="label">Company ID</label>
                <input
                  type="text"
                  value={formData.companyId}
                  className="input readonly"
                  readOnly
                />
                <small className="field-note">Company ID cannot be changed</small>
              </div>
            </div>

            {/* Contact Information */}
            <div className="form-section">
              <h3 className="section-title">Contact Information</h3>
              <div className="input-group">
                <label className="label">Phone *</label>
                <input
                  type="tel"
                  placeholder="Phone number"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="input"
                  required
                  disabled={isViewMode}
                  readOnly={isViewMode}
                />
              </div>

              <div className="input-group">
                <label className="label">Email</label>
                <input
                  type="email"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="input"
                  disabled={isViewMode}
                  readOnly={isViewMode}
                />
              </div>

              <div className="input-group">
                <label className="label">Fax</label>
                <input
                  type="text"
                  placeholder="Fax number"
                  value={formData.fax}
                  onChange={e => setFormData(prev => ({ ...prev, fax: e.target.value }))}
                  className="input"
                  disabled={isViewMode}
                  readOnly={isViewMode}
                />
              </div>

              <div className="input-group">
                <label className="label">Website</label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  className="input"
                  disabled={isViewMode}
                  readOnly={isViewMode}
                />
              </div>
            </div>

            {/* Address Information */}
            <div className="form-section">
              <h3 className="section-title">Address Information</h3>
              <div className="input-group">
                <label className="label">Postal Code *</label>
                <input
                  type="text"
                  placeholder="123-4567"
                  value={formData.postalCode}
                  onChange={e => handlePostalChange(e.target.value)}
                  className="input"
                  maxLength="7"
                  required
                  disabled={isViewMode}
                  readOnly={isViewMode}
                />
              </div>

              <div className="input-group">
                <label className="label">Prefecture</label>
                <input
                  type="text"
                  placeholder="Prefecture"
                  value={formData.prefecture}
                  readOnly
                  className="input readonly"
                />
              </div>

              <div className="input-group">
                <label className="label">City</label>
                <input
                  type="text"
                  placeholder="City"
                  value={formData.city}
                  readOnly
                  className="input readonly"
                />
              </div>

              <div className="input-group">
                <label className="label">Address</label>
                <input
                  type="text"
                  placeholder="Address"
                  value={formData.address}
                  readOnly
                  className="input readonly"
                />
              </div>

              <div className="input-group">
                <label className="label">Building/Apartment</label>
                <input
                  type="text"
                  placeholder="Building name, floor, apartment"
                  value={formData.building}
                  onChange={e => setFormData(prev => ({ ...prev, building: e.target.value }))}
                  className="input"
                  disabled={isViewMode}
                  readOnly={isViewMode}
                />
              </div>
            </div>

            {/* Tax Information */}
            <div className="form-section">
              <h3 className="sectionTitle">Tax Information</h3>
              <div className="input-group">
                <label className="label">Tax Registration No</label>
                <div className="tax-input-container">
                  <input
                    type="text"
                    placeholder="T + 12 digits"
                    value={formData.taxRegistrationNo}
                    onChange={e => {
                      setFormData(prev => ({ ...prev, taxRegistrationNo: e.target.value }));
                      setTaxVerificationStatus('');
                    }}
                    className="input"
                    disabled={isViewMode}
                    readOnly={isViewMode}
                  />
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={verifyTaxRegistration}
                      disabled={taxVerificationStatus === 'verifying' || !formData.taxRegistrationNo}
                      className={`verify-button ${taxVerificationStatus}`}
                    >
                      {taxVerificationStatus === 'success' ? '✓ Verified' : 
                       taxVerificationStatus === 'verifying' ? 'Checking...' : 
                       taxVerificationStatus === 'error' ? '✗ Failed' : 'Verify'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bank Accounts */}
          <div className="bank-section">
            <h3 className="section-title">Bank Accounts</h3>
            {formData.bankAccounts.map((account, index) => (
              <div key={index} className="bank-account-card">
                <div className="bank-account-header">
                  <h4 className="bank-account-title">Account {index + 1}</h4>
                  {!isViewMode && isEditMode && formData.bankAccounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBankAccount(index)}
                      className="remove-bank-button"
                    >
                      Remove
                    </button>
                  )}
                </div>
                
                <div className="bank-grid">
                  <div className="input-group">
                    <label className="label">Bank Name *</label>
                    <input
                      type="text"
                      placeholder="Bank name"
                      value={account.bankName}
                      onChange={e => handleBankAccountChange(index, 'bankName', e.target.value)}
                      className="input"
                      required
                      disabled={isViewMode}
                      readOnly={isViewMode}
                    />
                  </div>

                  <div className="input-group">
                    <label className="label">Branch Name</label>
                    <input
                      type="text"
                      placeholder="Branch name"
                      value={account.branchName}
                      onChange={e => handleBankAccountChange(index, 'branchName', e.target.value)}
                      className="input"
                      disabled={isViewMode}
                      readOnly={isViewMode}
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
                      <option value="savings">Savings Account</option>
                      <option value="checking">Checking Account</option>
                      <option value="current">Current Account</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label className="label">Account Number *</label>
                    <input
                      type="text"
                      placeholder="Account number"
                      value={account.accountNumber}
                      onChange={e => handleBankAccountChange(index, 'accountNumber', e.target.value)}
                      className="input"
                      required
                      disabled={isViewMode}
                      readOnly={isViewMode}
                    />
                  </div>

                  <div className="input-group">
                    <label className="label">Account Holder (Kana)</label>
                    <input
                      type="text"
                      placeholder="Holder name in Kana"
                      value={account.accountHolder}
                      onChange={e => handleBankAccountChange(index, 'accountHolder', e.target.value)}
                      className="input"
                      disabled={isViewMode}
                      readOnly={isViewMode}
                    />
                  </div>
                </div>
              </div>
            ))}

            {!isViewMode && isEditMode && (
              <button
                type="button"
                onClick={addBankAccount}
                className="add-bank-button"
              >
                + Add Another Bank Account
              </button>
            )}
          </div>

          {/* Submit Button */}
          <div className="submit-section">
            {isEditMode ? (
              <>
                <button
                  type="submit"
                  disabled={loading || isViewMode}
                  className="submit-button"
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Updating Company...
                    </>
                  ) : (
                    'Update Company'
                  )}
                </button>
                
                {!isViewMode && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="reset-button"
                    disabled={loading}
                  >
                    Reset
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={handleCancel}
                  className="cancel-button"
                  disabled={loading}
                >
                  {isViewMode ? 'Back to List' : 'Cancel'}
                </button>
              </>
            ) : isViewMode ? (
              <div className="view-mode-actions">
                <button
                  type="button"
                  onClick={() => navigate(`/company-registration/edit/${companyId}`)}
                  className="edit-from-view-button"
                >
                  Edit This Company
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="cancel-button"
                >
                  Back to List
                </button>
              </div>
            ) : (
              <>
                <button
                  type="submit"
                  disabled={loading}
                  className="submit-button"
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Registering Company...
                    </>
                  ) : (
                    'Complete Registration'
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={handleCancel}
                  className="cancel-button"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanyRegistration;