// components/CategoryManagement.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, addDoc, getDocs, query, where, 
  updateDoc, deleteDoc, doc 
} from 'firebase/firestore';
import { toast } from 'react-toastify';

const CategoryManagement = ({ company, currentUser }) => {
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'food', // food or non-food
    description: '',
    isActive: true
  });
  
  const [newSubCategory, setNewSubCategory] = useState({
    name: '',
    parentCategory: '',
    description: '',
    isActive: true
  });
  
  const [activeTab, setActiveTab] = useState('categories'); // categories or subcategories

  // Load categories from Firestore
  const loadCategories = async () => {
    if (!company?.id) return;
    
    try {
      setLoading(true);
      const categoriesQuery = query(
        collection(db, 'categories'),
        where('companyId', '==', company.id)
      );
      const snapshot = await getDocs(categoriesQuery);
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCategories(categoriesData);
      
      // Also load subcategories
      const subCategoriesQuery = query(
        collection(db, 'subcategories'),
        where('companyId', '==', company.id)
      );
      const subSnapshot = await getDocs(subCategoriesQuery);
      const subCategoriesData = subSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSubCategories(subCategoriesData);
      
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [company]);

  // Add new category
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    try {
      setLoading(true);
      const categoryData = {
        ...newCategory,
        companyId: company.id,
        companyName: company.name,
        createdAt: new Date(),
        createdBy: currentUser?.email,
        createdById: currentUser?.uid,
        taxRate: newCategory.type === 'food' ? 8 : 10 // Default tax rates
      };

      await addDoc(collection(db, 'categories'), categoryData);
      toast.success('✅ Category added successfully!');
      setNewCategory({ name: '', type: 'food', description: '', isActive: true });
      loadCategories();
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error('Failed to add category');
    } finally {
      setLoading(false);
    }
  };

  // Add new subcategory
  const handleAddSubCategory = async (e) => {
    e.preventDefault();
    if (!newSubCategory.name.trim() || !newSubCategory.parentCategory) {
      toast.error('Subcategory name and parent category are required');
      return;
    }

    try {
      setLoading(true);
      const subCategoryData = {
        ...newSubCategory,
        companyId: company.id,
        companyName: company.name,
        createdAt: new Date(),
        createdBy: currentUser?.email,
        createdById: currentUser?.uid
      };

      await addDoc(collection(db, 'subcategories'), subCategoryData);
      toast.success('✅ Subcategory added successfully!');
      setNewSubCategory({ name: '', parentCategory: '', description: '', isActive: true });
      loadCategories();
    } catch (error) {
      console.error('Error adding subcategory:', error);
      toast.error('Failed to add subcategory');
    } finally {
      setLoading(false);
    }
  };

  // Toggle category status
  const toggleCategoryStatus = async (categoryId, currentStatus) => {
    try {
      await updateDoc(doc(db, 'categories', categoryId), {
        isActive: !currentStatus,
        updatedAt: new Date()
      });
      toast.success(`Category ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadCategories();
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Failed to update category');
    }
  };

  // Toggle subcategory status
  const toggleSubCategoryStatus = async (subCategoryId, currentStatus) => {
    try {
      await updateDoc(doc(db, 'subcategories', subCategoryId), {
        isActive: !currentStatus,
        updatedAt: new Date()
      });
      toast.success(`Subcategory ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadCategories();
    } catch (error) {
      console.error('Error updating subcategory:', error);
      toast.error('Failed to update subcategory');
    }
  };

  const styles = {
    container: {
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
    },
    header: {
      marginBottom: '25px',
      borderBottom: '2px solid #334155',
      paddingBottom: '15px'
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#e2e8f0',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    tabNav: {
      display: 'flex',
      gap: '10px',
      marginBottom: '25px',
      flexWrap: 'wrap'
    },
    tabButton: {
      padding: '10px 20px',
      backgroundColor: '#334155',
      color: '#cbd5e1',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      '&:hover': {
        backgroundColor: '#475569'
      }
    },
    tabButtonActive: {
      backgroundColor: '#3b82f6',
      color: 'white'
    },
    formCard: {
      backgroundColor: '#0f172a',
      borderRadius: '10px',
      padding: '20px',
      border: '1px solid #334155',
      marginBottom: '20px'
    },
    formTitle: {
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
      gap: '15px',
      marginBottom: '15px'
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
    input: {
      padding: '10px 12px',
      backgroundColor: '#1e293b',
      border: '1px solid #475569',
      borderRadius: '6px',
      color: '#e2e8f0',
      fontSize: '14px'
    },
    select: {
      padding: '10px 12px',
      backgroundColor: '#1e293b',
      border: '1px solid #475569',
      borderRadius: '6px',
      color: '#e2e8f0',
      fontSize: '14px',
      cursor: 'pointer'
    },
    submitButton: {
      padding: '10px 20px',
      backgroundColor: '#10b981',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      '&:hover:not(:disabled)': {
        backgroundColor: '#059669'
      },
      '&:disabled': {
        backgroundColor: '#475569',
        cursor: 'not-allowed'
      }
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      backgroundColor: '#0f172a',
      borderRadius: '8px',
      overflow: 'hidden'
    },
    tableHeader: {
      backgroundColor: '#334155',
      color: '#e2e8f0',
      padding: '12px',
      textAlign: 'left',
      fontWeight: '600'
    },
    tableCell: {
      padding: '12px',
      borderBottom: '1px solid #334155',
      color: '#cbd5e1'
    },
    statusBadge: (isActive) => ({
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: isActive ? '#10b981' : '#ef4444',
      color: 'white',
      display: 'inline-block'
    }),
    actionButton: {
      padding: '6px 12px',
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      '&:hover': {
        backgroundColor: '#2563eb'
      }
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span style={{color: '#8b5cf6'}}>📁</span>
          カテゴリ管理 / Category Management
        </h2>
        <p style={{color: '#94a3b8', marginTop: '8px'}}>
          製品カテゴリとサブカテゴリの管理 / Manage product categories and subcategories
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={styles.tabNav}>
        <button
          style={{
            ...styles.tabButton,
            ...(activeTab === 'categories' ? styles.tabButtonActive : {})
          }}
          onClick={() => setActiveTab('categories')}
        >
          📁 カテゴリ / Categories
        </button>
        <button
          style={{
            ...styles.tabButton,
            ...(activeTab === 'subcategories' ? styles.tabButtonActive : {})
          }}
          onClick={() => setActiveTab('subcategories')}
        >
          🔽 サブカテゴリ / Subcategories
        </button>
      </div>

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <>
          {/* Add Category Form */}
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>
              <span style={{color: '#10b981'}}>➕</span>
              新規カテゴリ追加 / Add New Category
            </h3>
            <form onSubmit={handleAddCategory}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span>🏷️</span>
                    カテゴリ名 / Category Name *
                  </label>
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                    style={styles.input}
                    placeholder="例: 肉類"
                    required
                    disabled={loading}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span>📋</span>
                    タイプ / Type *
                  </label>
                  <select
                    value={newCategory.type}
                    onChange={(e) => setNewCategory({...newCategory, type: e.target.value})}
                    style={styles.select}
                    required
                    disabled={loading}
                  >
                    <option value="food">🍽️ 食品 / Food (税8%)</option>
                    <option value="non-food">📦 非食品 / Non-Food (税10%)</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span>📄</span>
                    説明 / Description
                  </label>
                  <input
                    type="text"
                    value={newCategory.description}
                    onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                    style={styles.input}
                    placeholder="カテゴリの説明"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={styles.submitButton}
                disabled={loading}
              >
                {loading ? '追加中...' : '✅ カテゴリを追加'}
              </button>
            </form>
          </div>

          {/* Categories List */}
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>
              <span style={{color: '#3b82f6'}}>📋</span>
              カテゴリ一覧 / Categories List ({categories.length})
            </h3>
            
            <div style={{overflowX: 'auto'}}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>カテゴリ名 / Category</th>
                    <th style={styles.tableHeader}>タイプ / Type</th>
                    <th style={styles.tableHeader}>税率 / Tax Rate</th>
                    <th style={styles.tableHeader}>ステータス / Status</th>
                    <th style={styles.tableHeader}>作成日 / Created</th>
                    <th style={styles.tableHeader}>操作 / Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(category => (
                    <tr key={category.id}>
                      <td style={styles.tableCell}>
                        <strong style={{color: '#e2e8f0'}}>{category.name}</strong>
                        <div style={{fontSize: '12px', color: '#94a3b8'}}>
                          {category.description || '説明なし'}
                        </div>
                      </td>
                      <td style={styles.tableCell}>
                        {category.type === 'food' ? '🍽️ 食品' : '📦 非食品'}
                      </td>
                      <td style={styles.tableCell}>
                        {category.taxRate || (category.type === 'food' ? 8 : 10)}%
                      </td>
                      <td style={styles.tableCell}>
                        <span style={styles.statusBadge(category.isActive)}>
                          {category.isActive ? '有効 / Active' : '無効 / Inactive'}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        {category.createdAt?.toDate ? 
                          category.createdAt.toDate().toLocaleDateString('ja-JP') : 
                          'N/A'}
                      </td>
                      <td style={styles.tableCell}>
                        <button
                          style={styles.actionButton}
                          onClick={() => toggleCategoryStatus(category.id, category.isActive)}
                          disabled={loading}
                        >
                          {category.isActive ? '無効化' : '有効化'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{...styles.tableCell, textAlign: 'center', color: '#94a3b8', padding: '40px'}}>
                        カテゴリが登録されていません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Subcategories Tab */}
      {activeTab === 'subcategories' && (
        <>
          {/* Add Subcategory Form */}
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>
              <span style={{color: '#10b981'}}>➕</span>
              新規サブカテゴリ追加 / Add New Subcategory
            </h3>
            <form onSubmit={handleAddSubCategory}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span>🏷️</span>
                    サブカテゴリ名 / Subcategory Name *
                  </label>
                  <input
                    type="text"
                    value={newSubCategory.name}
                    onChange={(e) => setNewSubCategory({...newSubCategory, name: e.target.value})}
                    style={styles.input}
                    placeholder="例: 鶏肉"
                    required
                    disabled={loading}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span>📁</span>
                    親カテゴリ / Parent Category *
                  </label>
                  <select
                    value={newSubCategory.parentCategory}
                    onChange={(e) => setNewSubCategory({...newSubCategory, parentCategory: e.target.value})}
                    style={styles.select}
                    required
                    disabled={loading || categories.length === 0}
                  >
                    <option value="">カテゴリを選択 / Select Category</option>
                    {categories.filter(cat => cat.isActive).map(category => (
                      <option key={category.id} value={category.name}>
                        {category.name} ({category.type === 'food' ? '食品' : '非食品'})
                      </option>
                    ))}
                  </select>
                  {categories.length === 0 && (
                    <small style={{color: '#ef4444', fontSize: '12px', marginTop: '4px'}}>
                      先にカテゴリを作成してください
                    </small>
                  )}
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span>📄</span>
                    説明 / Description
                  </label>
                  <input
                    type="text"
                    value={newSubCategory.description}
                    onChange={(e) => setNewSubCategory({...newSubCategory, description: e.target.value})}
                    style={styles.input}
                    placeholder="サブカテゴリの説明"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={styles.submitButton}
                disabled={loading || categories.length === 0}
              >
                {loading ? '追加中...' : '✅ サブカテゴリを追加'}
              </button>
            </form>
          </div>

          {/* Subcategories List */}
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>
              <span style={{color: '#3b82f6'}}>📋</span>
              サブカテゴリ一覧 / Subcategories List ({subCategories.length})
            </h3>
            
            <div style={{overflowX: 'auto'}}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>サブカテゴリ名 / Subcategory</th>
                    <th style={styles.tableHeader}>親カテゴリ / Parent Category</th>
                    <th style={styles.tableHeader}>説明 / Description</th>
                    <th style={styles.tableHeader}>ステータス / Status</th>
                    <th style={styles.tableHeader}>作成日 / Created</th>
                    <th style={styles.tableHeader}>操作 / Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subCategories.map(subCat => (
                    <tr key={subCat.id}>
                      <td style={styles.tableCell}>
                        <strong style={{color: '#e2e8f0'}}>{subCat.name}</strong>
                      </td>
                      <td style={styles.tableCell}>
                        {subCat.parentCategory}
                      </td>
                      <td style={styles.tableCell}>
                        {subCat.description || '説明なし'}
                      </td>
                      <td style={styles.tableCell}>
                        <span style={styles.statusBadge(subCat.isActive)}>
                          {subCat.isActive ? '有効 / Active' : '無効 / Inactive'}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        {subCat.createdAt?.toDate ? 
                          subCat.createdAt.toDate().toLocaleDateString('ja-JP') : 
                          'N/A'}
                      </td>
                      <td style={styles.tableCell}>
                        <button
                          style={styles.actionButton}
                          onClick={() => toggleSubCategoryStatus(subCat.id, subCat.isActive)}
                          disabled={loading}
                        >
                          {subCat.isActive ? '無効化' : '有効化'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  
                  {subCategories.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{...styles.tableCell, textAlign: 'center', color: '#94a3b8', padding: '40px'}}>
                        サブカテゴリが登録されていません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CategoryManagement;