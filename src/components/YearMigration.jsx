import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, getDocs, query, where, writeBatch, doc, serverTimestamp, runTransaction 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'react-toastify';
import LoadingScreen from './LoadingScreen';

const YearMigration = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(null);
  const [nextYear, setNextYear] = useState(null);
  const [stats, setStats] = useState({
    orders: 0,
    inventory: 0,
    drivers: 0,
    finances: 0,
    users: 0
  });
  const [migrationReady, setMigrationReady] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Japanese FY starts April 1
  const getfyId = () => {
    const today = new Date();
    const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    return year;
  };

  const getNextFY = () => getfyId() + 1;

  useEffect(() => {
    const checkAccess = async () => {
      if (!auth.currentUser) {
        navigate('/login');
        return;
      }

      const uid = auth.currentUser.uid;
      const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
      if (userDoc.empty || userDoc.docs[0].data().role !== 'admin') {
        toast.error('Admin access required');
        navigate('/admin-dashboard');
        return;
      }

      const fyId = getfyId();
      const nextFY = getNextFY();
      setCurrentYear(fyId);
      setNextYear(nextFY);

      // Check if next year collection exists
      const nextCol = await getDocs(collection(db, `companies_${nextFY}`));
      setMigrationReady(nextCol.empty);

      // Load stats
      const loadStats = async () => {
        const ordersSnap = await getDocs(collection(db, 'orders'));
        const inventorySnap = await getDocs(collection(db, 'inventory'));
        const driversSnap = await getDocs(collection(db, 'drivers'));
        const financeSnap = await getDocs(collection(db, 'finances'));
        const usersSnap = await getDocs(collection(db, 'users'));

        setStats({
          orders: ordersSnap.size,
          inventory: inventorySnap.size,
          drivers: driversSnap.size,
          finances: financeSnap.size,
          users: usersSnap.size
        });
      };

      await loadStats();
      setLoading(false);
    };

    checkAccess();
  }, [navigate]);

  const startMigration = async () => {
    if (!window.confirm(`Migrate ALL data from FY${currentYear} to FY${nextYear}?\nThis action is irreversible.`)) {
      return;
    }

    setMigrating(true);
    setProgress(0);

    try {
      const batchSize = 500;
      const collectionsToMigrate = [
        'companies', 'orders', 'inventory', 'drivers', 'finances', 'routes', 'customers', 'suppliers'
      ];

      let completed = 0;
      const total = collectionsToMigrate.length;

      for (const colName of collectionsToMigrate) {
        const oldCol = collection(db, `${colName}_${currentYear}`);
        const newCol = collection(db, `${colName}_${nextYear}`);

        const snapshot = await getDocs(oldCol);
        const batch = writeBatch(db);

        snapshot.docs.forEach((docSnap) => {
          const newRef = doc(newCol, docSnap.id);
          batch.set(newRef, {
            ...docSnap.data(),
            migratedFrom: currentYear,
            migratedAt: serverTimestamp(),
            fiscalYear: nextYear
          });
        });

        await batch.commit();
        completed++;
        setProgress(Math.round((completed / total) * 100));
        toast.success(`${colName} migrated`);
      }

      // Update company active year
      await runTransaction(db, async (transaction) => {
        const companyRefs = await getDocs(collection(db, `companies_${currentYear}`));
        companyRefs.docs.forEach((docSnap) => {
          const ref = doc(db, `companies_${nextYear}`, docSnap.id);
          transaction.update(ref, { activeFiscalYear: nextYear });
        });
      });

      toast.success(`Fiscal Year ${currentYear} to ${nextYear} Migration Complete!`);
      setTimeout(() => navigate('/admin-dashboard'), 2000);
    } catch (err) {
      console.error(err);
      toast.error('Migration failed: ' + err.message);
    } finally {
      setMigrating(false);
    }
  };

  if (loading) return <LoadingScreen message="Preparing fiscal year migration..." />;

  return (
    <>
      <style jsx>{`
        .container {
          min-height: 100vh;
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          color: white;
          padding: 40px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .card {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(12px);
          border-radius: 24px;
          padding: 40px;
          width: 100%;
          max-width: 640px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.2);
        }
        .header {
          text-align: center;
          marginBottom: 32px;
        }
        .title {
          font-size: 32px;
          font-weight: 800;
          marginBottom: 12px;
          background: linear-gradient(to right, #fbbf24, #f59e0b);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .subtitle {
          font-size: 18px;
          opacity: 0.9;
        }
        .fy-info {
          background: rgba(251, 191, 36, 0.2);
          border: 2px solid #fbbf24;
          border-radius: 16px;
          padding: 24px;
          text-align: center;
          margin: 32px 0;
        }
        .fy-current {
          font-size: 28px;
          font-weight: 700;
          color: #fbbf24;
        }
        .fy-next {
          font-size: 36px;
          font-weight: 800;
          color: #fcd34d;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 16px;
          margin: 32px 0;
        }
        .stat {
          background: rgba(255,255,255,0.1);
          padding: 16px;
          border-radius: 12px;
          text-align: center;
        }
        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #fcd34d;
        }
        .stat-label {
          font-size: 14px;
          opacity: 0.8;
          marginTop: 4px;
        }
        .warning {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid #fca5a5;
          padding: 16px;
          border-radius: 12px;
          margin: 24px 0;
          font-size: 15px;
        }
        .btn {
          width: 100%;
          padding: 18px;
          border: none;
          border-radius: 16px;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          marginTop: 20px;
        }
        .btn-ready {
          background: #fbbf24;
          color: #1e293b;
        }
        .btn-ready:hover {
          background: #f59e0b;
          transform: translateY(-2px);
        }
        .btn-disabled {
          background: #64748b;
          cursor: not-allowed;
        }
        .progress-bar {
          height: 12px;
          background: rgba(255,255,255,0.2);
          border-radius: 6px;
          margin: 20px 0;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: #fbbf24;
          width: ${progress}%;
          transition: width 0.4s ease;
        }
        .back {
          position: absolute;
          top: 20px;
          left: 20px;
          background: rgba(255,255,255,0.2);
          padding: 12px 20px;
          border-radius: 12px;
          color: white;
          text-decoration: none;
          font-weight: 600;
        }
      `}</style>

      <div className="container">
        <a href="/admin-dashboard" className="back">Back to Dashboard</a>
        
        <div className="card">
          <div className="header">
            <h1 className="title">Fiscal Year Migration</h1>
            <p className="subtitle">Japanese Financial Year Rollover (April 1)</p>
          </div>

          <div className="fy-info">
            <div>Current Year</div>
            <div className="fy-current">FY{currentYear}</div>
            <div style={{ fontSize: '48px', margin: '16px 0' }}>Next</div>
            <div className="fy-next">FY{nextYear}</div>
          </div>

          <div className="stats-grid">
            <div className="stat">
              <div className="stat-value">{stats.orders}</div>
              <div className="stat-label">Orders</div>
            </div>
            <div className="stat">
              <div className="stat-value">{stats.inventory}</div>
              <div className="stat-label">Inventory</div>
            </div>
            <div className="stat">
              <div className="stat-value">{stats.drivers}</div>
              <div className="stat-label">Drivers</div>
            </div>
            <div className="stat">
              <div className="stat-value">{stats.finances}</div>
              <div className="stat-label">Finance Records</div>
            </div>
          </div>

          <div className="warning">
            <strong>Warning:</strong> This will copy ALL data to FY{nextYear} collections. 
            Old data remains untouched. Only run ONCE per year.
          </div>

          {migrating && (
            <>
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
              <p style={{ textAlign: 'center' }}>Migrating... {progress}%</p>
            </>
          )}

          <button
            onClick={startMigration}
            disabled={!migrationReady || migrating}
            className={`btn ${migrationReady && !migrating ? 'btn-ready' : 'btn-disabled'}`}
          >
            {migrating ? 'Migrating Data...' : 
             migrationReady ? `Start FY${nextYear} Migration` : 
             `FY${nextYear} Already Exists`}
          </button>
        </div>
      </div>
    </>
  );
};

export default YearMigration;