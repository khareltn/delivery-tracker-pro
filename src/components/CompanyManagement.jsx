// src/components/CompanyManagement.jsx
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, deleteDoc, doc, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import './CompanyManagement.css';

const CompanyManagement = ({ fy }) => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!fy) {
      console.log('No FY provided:', fy);
      setLoading(false);
      return;
    }

    console.log('Fetching companies for FY:', fy);
    
    try {
      // Query the financial_years subcollection
      const companiesRef = collection(db, 'financial_years', fy, 'companies');
      const q = query(companiesRef);
      
      const unsub = onSnapshot(q, 
        (snapshot) => {
          console.log('Snapshot received, docs:', snapshot.docs.length);
          const list = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            console.log('Company data from subcollection:', data);
            // Check if the current user owns this company
            if (data.ownerId === auth.currentUser?.uid) {
              list.push({ id: doc.id, ...data });
            }
          });
          console.log('Filtered companies from subcollection:', list);
          setCompanies(list);
          setLoading(false);
        }, 
        (error) => {
          console.error('Firestore subcollection error:', error);
          toast.error('Failed to load companies: ' + error.message);
          setLoading(false);
        }
      );

      return () => unsub();
    } catch (error) {
      console.error('Error setting up subcollection listener:', error);
      toast.error('Error loading companies');
      setLoading(false);
    }
  }, [fy]);

  const handleDelete = async (company) => {
    setSelectedCompany(company);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedCompany || !fy) return;

    try {
      // Delete from financial_years subcollection
      await deleteDoc(doc(db, 'financial_years', fy, 'companies', selectedCompany.id));
      
      toast.success(`Company "${selectedCompany.name}" deleted successfully!`);
      setShowDeleteConfirm(false);
      setSelectedCompany(null);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Delete failed: ' + err.message);
    }
  };

  const handleEdit = (company) => {
    // Navigate to edit page with company ID as parameter
    navigate(`/company-registration/edit/${company.companyId}`, {
      state: { company: company }
    });
  };

  const handleView = (company) => {
    // Navigate to view page
    navigate(`/company-registration/view/${company.companyId}`, {
      state: { company: company, isViewOnly: true }
    });
  };

  const handleNewCompany = () => {
    navigate('/company-registration');
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  const handleGoToFYSetup = () => {
    navigate('/fy-setup');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading companies for FY: {fy || 'Not set'}...</p>
      </div>
    );
  }

  return (
    <div className="company-management-container">
      {/* Header Section */}
      <div className="management-header">
        <div className="header-content">
          <h1 className="page-title">Company Management</h1>
          <div className="header-subtitle">
            <span className="fy-display">Financial Year: <strong>{fy || 'Not set'}</strong></span>
            <span className="company-count">Total Companies: <strong>{companies.length}</strong></span>
          </div>
        </div>
        <div className="header-actions">
          <button 
            onClick={handleNewCompany}
            className="primary-button"
          >
            + New Company
          </button>
          <button 
            onClick={handleGoToDashboard}
            className="secondary-button"
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="management-content">
        {!fy ? (
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <h2 className="empty-title">Financial Year Not Set</h2>
            <p className="empty-message">
              Please complete Financial Year setup before managing companies.
            </p>
            <button 
              onClick={handleGoToFYSetup}
              className="action-button"
            >
              Go to FY Setup
            </button>
          </div>
        ) : companies.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏢</div>
            <h2 className="empty-title">No Companies Found</h2>
            <p className="empty-message">
              No companies registered for Financial Year <strong>{fy}</strong>.<br />
              Start by creating your first company.
            </p>
            <button 
              onClick={handleNewCompany}
              className="action-button"
            >
              Create Your First Company
            </button>
          </div>
        ) : (
          <div className="companies-grid">
            {companies.map((company) => (
              <div 
                key={company.id} 
                className="company-card"
              >
                <div className="card-header">
                  <h3 className="company-name">
                    {company.name || 'Unnamed Company'}
                  </h3>
                  <span className="company-status">
                    {company.status === 'active' ? '🟢 Active' : '🔴 Inactive'}
                  </span>
                </div>
                
                <div className="card-content">
                  {company.companyId && (
                    <div className="info-row">
                      <span className="info-label">Company ID:</span>
                      <span className="info-value">{company.companyId}</span>
                    </div>
                  )}
                  
                  {company.corporateNumber && (
                    <div className="info-row">
                      <span className="info-label">Corporate No:</span>
                      <span className="info-value">{company.corporateNumber}</span>
                    </div>
                  )}
                  
                  {company.representative && (
                    <div className="info-row">
                      <span className="info-label">Representative:</span>
                      <span className="info-value">{company.representative}</span>
                    </div>
                  )}
                  
                  {(company.prefecture || company.city) && (
                    <div className="info-row">
                      <span className="info-label">Location:</span>
                      <span className="info-value">
                        {[company.prefecture, company.city].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  
                  {company.phone && (
                    <div className="info-row">
                      <span className="info-label">Phone:</span>
                      <span className="info-value">{company.phone}</span>
                    </div>
                  )}
                  
                  {company.email && (
                    <div className="info-row">
                      <span className="info-label">Email:</span>
                      <span className="info-value">{company.email}</span>
                    </div>
                  )}
                </div>

                <div className="card-actions">
                  <button 
                    onClick={() => handleView(company)} 
                    className="view-button"
                  >
                    View
                  </button>
                  <button 
                    onClick={() => handleEdit(company)} 
                    className="edit-button"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(company)} 
                    className="delete-button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedCompany && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">Confirm Delete</h3>
            </div>
            <div className="modal-body">
              <p className="modal-message">
                Are you sure you want to delete <strong>"{selectedCompany.name}"</strong>?
              </p>
              <p className="modal-warning">
                This action cannot be undone. All company data will be permanently deleted.
              </p>
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="modal-cancel"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="modal-confirm"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Action */}
      {companies.length > 0 && (
        <div className="bottom-actions">
          <button 
            onClick={handleNewCompany}
            className="bottom-primary-button"
          >
            + Add Another Company
          </button>
        </div>
      )}
    </div>
  );
};

export default CompanyManagement;