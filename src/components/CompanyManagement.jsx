// src/components/CompanyManagement.jsx
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
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
    if (!fy || !auth.currentUser) {
      setLoading(false);
      return;
    }

    console.log('Fetching companies for FY:', fy);

    const companiesRef = collection(db, 'financial_years', fy, 'companies');

    const unsub = onSnapshot(
      companiesRef,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.ownerId === auth.currentUser.uid) {
            list.push({ id: docSnap.id, ...data });
          }
        });
        setCompanies(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading companies:', error);
        toast.error('Failed to load companies');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [fy]);

  const handleDelete = (company) => {
    setSelectedCompany(company);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedCompany || !fy) return;

    try {
      await deleteDoc(doc(db, 'financial_years', fy, 'companies', selectedCompany.id));
      toast.success(`Company "${selectedCompany.name}" deleted`);
      setShowDeleteConfirm(false);
      setSelectedCompany(null);
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleEdit = (company) => {
    navigate(`/company-registration/edit/${company.companyId}`);
  };

  const handleView = (company) => {
    navigate(`/company-registration/view/${company.companyId}`);
  };

  const handleNewCompany = () => {
    navigate('/company-registration');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading companies...</p>
      </div>
    );
  }

  // REMOVED misleading "Financial Year Not Set" message
  // App.jsx now controls routing — this page should never render without fy

  return (
    <div className="company-management-container">
      <div className="management-header">
        <div className="header-content">
          <h1 className="page-title">Company Management</h1>
          <div className="header-subtitle">
            <span className="fy-display">Financial Year: <strong>{fy}</strong></span>
            <span className="company-count">Total Companies: <strong>{companies.length}</strong></span>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={handleNewCompany} className="primary-button">
            + New Company
          </button>
        </div>
      </div>

      <div className="management-content">
        {companies.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏢</div>
            <h2 className="empty-title">No Companies Registered</h2>
            <p className="empty-message">
              Start by creating your first company for Financial Year <strong>{fy}</strong>.
            </p>
            <button onClick={handleNewCompany} className="action-button">
              Register First Company
            </button>
          </div>
        ) : (
          <div className="companies-grid">
            {companies.map((company) => (
              <div key={company.id} className="company-card">
                <div className="card-header">
                  <h3 className="company-name">{company.name || 'Unnamed'}</h3>
                  <span className="company-status">
                    {company.status === 'active' ? '🟢 Active' : '🔴 Inactive'}
                  </span>
                </div>
                <div className="card-content">
                  {company.companyId && (
                    <div className="info-row">
                      <span className="info-label">ID:</span>
                      <span className="info-value">{company.companyId}</span>
                    </div>
                  )}
                  {company.representative && (
                    <div className="info-row">
                      <span className="info-label">Rep:</span>
                      <span className="info-value">{company.representative}</span>
                    </div>
                  )}
                  {company.phone && (
                    <div className="info-row">
                      <span className="info-label">Phone:</span>
                      <span className="info-value">{company.phone}</span>
                    </div>
                  )}
                </div>
                <div className="card-actions">
                  <button onClick={() => handleView(company)} className="view-button">View</button>
                  <button onClick={() => handleEdit(company)} className="edit-button">Edit</button>
                  <button onClick={() => handleDelete(company)} className="delete-button">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showDeleteConfirm && selectedCompany && (
        <div className="modal-overlay">
          <div className="modal-container">
            <h3>Confirm Delete</h3>
            <p>Delete <strong>{selectedCompany.name}</strong>? This cannot be undone.</p>
            <button onClick={() => setShowDeleteConfirm(false)} className="modal-cancel">Cancel</button>
            <button onClick={confirmDelete} className="modal-confirm">Delete</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyManagement;