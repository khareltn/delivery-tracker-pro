// components/ProductRegistration.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';

const ProductRegistration = () => {
  const { currentUser } = useAuth();
  
  // Determine tax rate based on category
  const getDefaultTaxRate = (category) => {
    const foodCategories = [
      'Meat & Poultry', 'Spices & Masalas', 'Pulses & Lentils', 
      'Rice & Grains', 'Vegetables', 'Dairy', 'Oils & Fats',
      'Beverages', 'Fruits', 'Bakery', 'Ready Mix', 'Marinades',
      'Sauces & Condiments', 'Seafood'
    ];
    
    const nonFoodCategories = [
      'Packaging', 'Cleaning Supplies', 'Utensils', 'Disposables',
      'Kitchen Equipment', 'Wraps & Foils', 'Office Supplies',
      'Maintenance', 'Uniforms'
    ];
    
    if (foodCategories.includes(category)) {
      return 8; // 8% for food items
    } else if (nonFoodCategories.includes(category)) {
      return 10; // 10% for non-food items
    }
    return 5; // 5% default for uncategorized
  };

  const [formData, setFormData] = useState({
    name: '',
    mainCategory: '',
    subCategory: '',
    newCategory: '',
    newSubCategory: '',
    type: 'weight',
    weightPerUnit: '',
    unit: 'kg',
    price: '',
    supplierId: '',
    supplierName: '',
    minimumOrderLot: '',
    stockLowerLimit: '',
    sellPrice: '',
    taxRate: 8,
    currentStock: 0,
    nextAvailableDate: '',
    isActive: true,
    storageType: 'normal',
    unitSize: '',
    isFoodItem: true,
    barcode: '',
    sku: '',
    hsnCode: '',
    description: ''
  });

  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [companyId, setCompanyId] = useState(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewSubCategory, setShowNewSubCategory] = useState(false);
  const [loading, setLoading] = useState(false);

  // Default restaurant categories
  const defaultCategories = [
    { name: 'Meat & Poultry', subCategories: ['Chicken', 'Mutton', 'Pork', 'Beef', 'Fish', 'Seafood', 'Eggs'], isFood: true },
    { name: 'Spices & Masalas', subCategories: ['Whole Spices', 'Powdered Spices', 'Blended Masalas', 'Herbs', 'Seasonings'], isFood: true },
    { name: 'Pulses & Lentils', subCategories: ['Toor Dal', 'Moong Dal', 'Chana Dal', 'Urad Dal', 'Masoor Dal', 'Beans'], isFood: true },
    { name: 'Rice & Grains', subCategories: ['Basmati Rice', 'Regular Rice', 'Wheat Flour', 'Other Grains', 'Pasta'], isFood: true },
    { name: 'Vegetables', subCategories: ['Leafy Vegetables', 'Root Vegetables', 'Seasonal', 'Exotic', 'Onion & Garlic'], isFood: true },
    { name: 'Dairy', subCategories: ['Milk', 'Butter', 'Cheese', 'Yogurt', 'Cream', 'Paneer'], isFood: true },
    { name: 'Oils & Fats', subCategories: ['Cooking Oil', 'Ghee', 'Butter Oil', 'Vanaspati', 'Olive Oil'], isFood: true },
    { name: 'Beverages', subCategories: ['Soft Drinks', 'Juices', 'Tea/Coffee', 'Water', 'Energy Drinks'], isFood: true },
    { name: 'Fruits', subCategories: ['Fresh Fruits', 'Dry Fruits', 'Canned Fruits'], isFood: true },
    { name: 'Bakery', subCategories: ['Bread', 'Buns', 'Cakes', 'Pastries', 'Baking Ingredients'], isFood: true },
    { name: 'Ready Mix', subCategories: ['Gravy Mix', 'Batter Mix', 'Marinade Mix', 'Dessert Mix'], isFood: true },
    { name: 'Sauces & Condiments', subCategories: ['Soy Sauce', 'Tomato Sauce', 'Chutneys', 'Pickles', 'Vinegar'], isFood: true },
    { name: 'Seafood', subCategories: ['Fish', 'Prawns', 'Crabs', 'Squid', 'Other Seafood'], isFood: true },
    { name: 'Packaging', subCategories: ['Containers', 'Lids', 'Boxes', 'Bags', 'Labels'], isFood: false },
    { name: 'Cleaning Supplies', subCategories: ['Detergents', 'Sanitizers', 'Cleaning Cloths', 'Brushes'], isFood: false },
    { name: 'Utensils', subCategories: ['Cutlery', 'Crockery', 'Cookware', 'Servingware'], isFood: false },
    { name: 'Disposables', subCategories: ['Paper Plates', 'Plastic Cups', 'Straws', 'Napkins'], isFood: false },
    { name: 'Kitchen Equipment', subCategories: ['Knives', 'Utensils', 'Appliances', 'Storage'], isFood: false },
    { name: 'Wraps & Foils', subCategories: ['Aluminum Foil', 'Plastic Wrap', 'Butter Paper', 'Parchment'], isFood: false },
    { name: 'Office Supplies', subCategories: ['Register', 'Pens', 'Notebooks', 'Files'], isFood: false },
    { name: 'Maintenance', subCategories: ['Electrical', 'Plumbing', 'Repair Tools'], isFood: false },
    { name: 'Uniforms', subCategories: ['Chef Coats', 'Waiter Uniforms', 'Aprons', 'Caps'], isFood: false }
  ];

  // Fetch company ID and suppliers when user is available
  useEffect(() => {
    const fetchUserAndSuppliers = async () => {
      if (currentUser?.uid) {
        try {
          setLoading(true);
          // Get user data to get companyId
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const userCompanyId = userData.companyId;
            setCompanyId(userCompanyId);
            
            // Fetch suppliers for this company
            if (userCompanyId) {
              const suppliersQuery = query(
                collection(db, 'users'),
                where('companyId', '==', userCompanyId),
                where('role', '==', 'supplier')
              );
              const snapshot = await getDocs(suppliersQuery);
              const supplierList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));
              setSuppliers(supplierList);
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          toast.error('Failed to load supplier data');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchUserAndSuppliers();
    setCategories(defaultCategories);
  }, [currentUser]);

  // Update tax rate when category changes
  useEffect(() => {
    if (formData.mainCategory) {
      const taxRate = getDefaultTaxRate(formData.mainCategory);
      const selectedCategory = defaultCategories.find(cat => cat.name === formData.mainCategory);
      setFormData(prev => ({
        ...prev,
        taxRate: taxRate,
        isFoodItem: selectedCategory?.isFood ?? true
      }));
      
      // Set subcategories
      if (selectedCategory) {
        setSubCategories(selectedCategory.subCategories);
      }
    }
  }, [formData.mainCategory]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCategoryChange = (e) => {
    const selectedCategory = e.target.value;
    setFormData({
      ...formData,
      mainCategory: selectedCategory,
      subCategory: '',
      newCategory: '',
      newSubCategory: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const finalCategory = showNewCategory ? formData.newCategory : formData.mainCategory;
      const finalSubCategory = showNewSubCategory ? formData.newSubCategory : formData.subCategory;
      
      if (!formData.name || !finalCategory || !formData.sellPrice || !formData.price || !formData.supplierId) {
        toast.error('Please fill all required fields: Name, Category, Purchase Price, Selling Price, and Supplier');
        setLoading(false);
        return;
      }

      const productData = {
        ...formData,
        name: formData.name,
        mainCategory: finalCategory,
        subCategory: finalSubCategory,
        companyId: companyId,
        createdAt: new Date(),
        createdBy: currentUser?.uid,
        createdByEmail: currentUser?.email,
        lastUpdated: new Date(),
        taxAmount: Math.round((formData.sellPrice * formData.taxRate / 100)),
        totalPrice: Math.round(parseFloat(formData.sellPrice) + (formData.sellPrice * formData.taxRate / 100)),
        currency: 'JPY',
        status: 'active'
      };

      // Remove temporary fields
      delete productData.newCategory;
      delete productData.newSubCategory;

      await addDoc(collection(db, 'products'), productData);
      
      toast.success('✅ Product registered successfully!');
      
      // Reset form
      setFormData({
        name: '',
        mainCategory: '',
        subCategory: '',
        newCategory: '',
        newSubCategory: '',
        type: 'weight',
        weightPerUnit: '',
        unit: 'kg',
        price: '',
        supplierId: '',
        supplierName: '',
        minimumOrderLot: '',
        stockLowerLimit: '',
        sellPrice: '',
        taxRate: 8,
        currentStock: 0,
        nextAvailableDate: '',
        isActive: true,
        storageType: 'normal',
        unitSize: '',
        isFoodItem: true,
        barcode: '',
        sku: '',
        hsnCode: '',
        description: ''
      });
      setShowNewCategory(false);
      setShowNewSubCategory(false);
      
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Failed to register product: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate SKU automatically
  const generateSKU = () => {
    const categoryCode = formData.mainCategory ? formData.mainCategory.substring(0, 3).toUpperCase() : 'GEN';
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${categoryCode}-${randomNum}`;
  };

  // Format Yen currency
  const formatYen = (amount) => {
    return `¥${parseInt(amount || 0).toLocaleString('ja-JP')}`;
  };

  // ============ DARK BLUE/BLACK STYLES ============
  const styles = {
    container: {
      backgroundColor: '#1e293b', // Dark blue/black background
      borderRadius: '12px',
      padding: '25px',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
      border: '1px solid #334155'
    },
    header: {
      marginBottom: '30px',
      textAlign: 'center',
      borderBottom: '2px solid #475569',
      paddingBottom: '20px'
    },
    title: {
      fontSize: '26px',
      fontWeight: 'bold',
      color: '#e2e8f0', // Light text
      marginBottom: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px'
    },
    subtitle: {
      color: '#94a3b8',
      fontSize: '15px'
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    },
    section: {
      backgroundColor: '#0f172a', // Darker section background
      borderRadius: '10px',
      padding: '20px',
      border: '1px solid #334155',
      borderLeft: '4px solid #3b82f6',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#e2e8f0',
      marginBottom: '20px',
      paddingBottom: '10px',
      borderBottom: '1px solid #334155',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    sectionIcon: {
      fontSize: '20px',
      color: '#3b82f6'
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
      fontWeight: '500',
      color: '#cbd5e1',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    labelIcon: {
      fontSize: '16px',
      color: '#60a5fa'
    },
    required: {
      color: '#ef4444'
    },
    input: {
      padding: '10px 12px',
      border: '1px solid #475569',
      borderRadius: '6px',
      fontSize: '14px',
      backgroundColor: '#1e293b',
      color: '#e2e8f0',
      transition: 'border-color 0.2s',
      '&:focus': {
        outline: 'none',
        borderColor: '#3b82f6',
        boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.2)'
      },
      '&:disabled': {
        backgroundColor: '#334155',
        color: '#94a3b8',
        cursor: 'not-allowed'
      }
    },
    select: {
      padding: '10px 12px',
      border: '1px solid #475569',
      borderRadius: '6px',
      fontSize: '14px',
      backgroundColor: '#1e293b',
      color: '#e2e8f0',
      cursor: 'pointer',
      '&:focus': {
        outline: 'none',
        borderColor: '#3b82f6'
      },
      '&:disabled': {
        backgroundColor: '#334155',
        color: '#94a3b8',
        cursor: 'not-allowed'
      }
    },
    inputGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    currencySymbol: {
      color: '#10b981',
      fontWeight: 'bold',
      fontSize: '16px',
      padding: '10px',
      backgroundColor: '#064e3b',
      borderRadius: '6px',
      minWidth: '40px',
      textAlign: 'center'
    },
    taxDisplay: {
      backgroundColor: '#1e293b',
      borderRadius: '8px',
      padding: '15px',
      border: '1px solid #475569',
      marginTop: '15px'
    },
    taxRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid #334155'
    },
    taxLabel: {
      color: '#94a3b8',
      fontSize: '14px'
    },
    taxValue: {
      color: '#e2e8f0',
      fontWeight: '600',
      fontSize: '14px'
    },
    totalValue: {
      color: '#10b981',
      fontWeight: 'bold',
      fontSize: '15px'
    },
    toggleGroup: {
      display: 'flex',
      gap: '10px',
      marginTop: '10px'
    },
    toggleButton: {
      flex: 1,
      padding: '8px 12px',
      border: '1px solid #475569',
      borderRadius: '6px',
      backgroundColor: '#1e293b',
      color: '#cbd5e1',
      cursor: 'pointer',
      fontSize: '13px',
      textAlign: 'center',
      transition: 'all 0.2s',
      '&:hover:not(:disabled)': {
        backgroundColor: '#334155'
      },
      '&:disabled': {
        backgroundColor: '#334155',
        color: '#64748b',
        cursor: 'not-allowed'
      }
    },
    toggleButtonActive: {
      backgroundColor: '#3b82f6',
      color: 'white',
      borderColor: '#3b82f6'
    },
    actionButtons: {
      display: 'flex',
      gap: '15px',
      justifyContent: 'center',
      marginTop: '30px',
      paddingTop: '20px',
      borderTop: '1px solid #334155'
    },
    submitButton: {
      padding: '12px 30px',
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: '600',
      transition: 'background-color 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      '&:hover:not(:disabled)': {
        backgroundColor: '#2563eb'
      },
      '&:disabled': {
        backgroundColor: '#475569',
        cursor: 'not-allowed'
      }
    },
    secondaryButton: {
      padding: '12px 30px',
      backgroundColor: '#475569',
      color: '#e2e8f0',
      border: '1px solid #64748b',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: '500',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      '&:hover': {
        backgroundColor: '#64748b'
      }
    },
    buttonIcon: {
      fontSize: '18px'
    },
    infoText: {
      color: '#94a3b8',
      fontSize: '12px',
      fontStyle: 'italic',
      marginTop: '4px'
    },
    textarea: {
      minHeight: '80px',
      resize: 'vertical',
      padding: '10px 12px',
      border: '1px solid #475569',
      borderRadius: '6px',
      fontSize: '14px',
      backgroundColor: '#1e293b',
      color: '#e2e8f0',
      transition: 'border-color 0.2s',
      '&:focus': {
        outline: 'none',
        borderColor: '#3b82f6',
        boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.2)'
      },
      '&:disabled': {
        backgroundColor: '#334155',
        color: '#94a3b8',
        cursor: 'not-allowed'
      }
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span style={{color: '#3b82f6'}}>📦</span>
          製品登録 / Product Registration
        </h2>
        <p style={styles.subtitle}>Register new products for your inventory management</p>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Category Section */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>📁</span>
            カテゴリ情報 / Category Information
          </div>
          
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>🏷️</span>
                メインカテゴリ / Main Category <span style={styles.required}>*</span>
              </label>
              <select 
                value={formData.mainCategory}
                onChange={handleCategoryChange}
                style={styles.select}
                required
                disabled={loading}
              >
                <option value="">カテゴリを選択 / Select Category</option>
                {categories.map((cat, index) => (
                  <option key={index} value={cat.name}>
                    {cat.name} • {cat.isFood ? '食品 (税8%)' : '非食品 (税10%)'}
                  </option>
                ))}
              </select>
              
              <button 
                type="button" 
                style={{
                  ...styles.toggleButton,
                  ...(showNewCategory ? styles.toggleButtonActive : {})
                }}
                onClick={() => setShowNewCategory(!showNewCategory)}
                disabled={loading}
              >
                {showNewCategory ? '← 既存カテゴリを選択' : '+ 新規カテゴリ作成'}
              </button>
            </div>

            {showNewCategory ? (
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <span style={styles.labelIcon}>🆕</span>
                  新規カテゴリ名 / New Category Name <span style={styles.required}>*</span>
                </label>
                <input 
                  type="text" 
                  value={formData.newCategory}
                  onChange={(e) => setFormData({...formData, newCategory: e.target.value})}
                  style={styles.input}
                  placeholder="新規カテゴリ名を入力"
                  required={showNewCategory}
                  disabled={loading}
                />
                <div style={styles.toggleGroup}>
                  <button 
                    type="button"
                    style={{
                      ...styles.toggleButton,
                      ...(formData.isFoodItem ? styles.toggleButtonActive : {})
                    }}
                    onClick={() => setFormData({...formData, isFoodItem: true, taxRate: 8})}
                    disabled={loading}
                  >
                    🍽️ 食品アイテム • 税8%
                  </button>
                  <button 
                    type="button"
                    style={{
                      ...styles.toggleButton,
                      ...(!formData.isFoodItem ? styles.toggleButtonActive : {})
                    }}
                    onClick={() => setFormData({...formData, isFoodItem: false, taxRate: 10})}
                    disabled={loading}
                  >
                    📦 非食品 • 税10%
                  </button>
                </div>
              </div>
            ) : (
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <span style={styles.labelIcon}>🔽</span>
                  サブカテゴリ / Sub Category
                </label>
                <select 
                  value={formData.subCategory}
                  onChange={(e) => setFormData({...formData, subCategory: e.target.value})}
                  style={styles.select}
                  disabled={loading || !formData.mainCategory}
                >
                  <option value="">サブカテゴリを選択 / Select Sub-Category</option>
                  {subCategories.map((sub, index) => (
                    <option key={index} value={sub}>{sub}</option>
                  ))}
                </select>
                <button 
                  type="button" 
                  style={{
                    ...styles.toggleButton,
                    ...(showNewSubCategory ? styles.toggleButtonActive : {})
                  }}
                  onClick={() => setShowNewSubCategory(!showNewSubCategory)}
                  disabled={loading || !formData.mainCategory}
                >
                  {showNewSubCategory ? '← 既存を選択' : '+ 新規サブカテゴリ'}
                </button>
              </div>
            )}

            {showNewSubCategory && (
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <span style={styles.labelIcon}>🆕</span>
                  新規サブカテゴリ / New Sub-Category
                </label>
                <input 
                  type="text" 
                  value={formData.newSubCategory}
                  onChange={(e) => setFormData({...formData, newSubCategory: e.target.value})}
                  style={styles.input}
                  placeholder="新規サブカテゴリを入力"
                  disabled={loading}
                />
              </div>
            )}
          </div>
        </div>

        {/* Product Details */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>📝</span>
            製品詳細 / Product Details
          </div>
          
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>📛</span>
                製品名 / Product Name <span style={styles.required}>*</span>
              </label>
              <input 
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                style={styles.input}
                placeholder="例: 鶏むね肉、バスマティライス"
                required
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>🏷️</span>
                製品コード / Product Code
              </label>
              <div style={styles.inputGroup}>
                <input 
                  type="text" 
                  name="sku"
                  value={formData.sku}
                  onChange={handleInputChange}
                  style={styles.input}
                  placeholder="SKUコード"
                  disabled={loading}
                />
                <button 
                  type="button" 
                  style={styles.toggleButton}
                  onClick={() => setFormData({...formData, sku: generateSKU()})}
                  disabled={loading}
                >
                  生成 / Generate
                </button>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>📦</span>
                単位タイプ / Unit Type
              </label>
              <div style={styles.formGrid}>
                <select 
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  style={styles.select}
                  disabled={loading}
                >
                  <option value="weight">⚖️ 重量単位 / By Weight</option>
                  <option value="piece">🔢 個数単位 / By Piece</option>
                  <option value="volume">🧴 容量単位 / By Volume</option>
                  <option value="packet">📦 パケット単位 / By Packet</option>
                </select>
                
                <select 
                  name="unit"
                  value={formData.unit}
                  onChange={handleInputChange}
                  style={styles.select}
                  disabled={loading}
                >
                  {formData.type === 'weight' && (
                    <>
                      <option value="kg">kg (キログラム)</option>
                      <option value="g">g (グラム)</option>
                    </>
                  )}
                  {formData.type === 'volume' && (
                    <>
                      <option value="L">L (リットル)</option>
                      <option value="ml">ml (ミリリットル)</option>
                    </>
                  )}
                  {formData.type === 'piece' && (
                    <>
                      <option value="pc">pc (個)</option>
                      <option value="dozen">ダース / Dozen</option>
                      <option value="pack">パック / Pack</option>
                    </>
                  )}
                  {formData.type === 'packet' && (
                    <>
                      <option value="packet">パケット / Packet</option>
                      <option value="box">箱 / Box</option>
                      <option value="case">ケース / Case</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>📏</span>
                単位サイズ / Unit Size
              </label>
              <input 
                type="text" 
                name="unitSize"
                value={formData.unitSize}
                onChange={handleInputChange}
                style={styles.input}
                placeholder="例: 500g, 1kg, 1L, ダース"
                disabled={loading}
              />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              <span style={styles.labelIcon}>📄</span>
              説明 / Description
            </label>
            <textarea 
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              style={styles.textarea}
              placeholder="製品の説明..."
              disabled={loading}
              rows="3"
            />
          </div>
        </div>

        {/* Pricing & Tax */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>💰</span>
            価格と税金 / Pricing & Tax
          </div>
          
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>🏷️</span>
                仕入価格 / Purchase Price <span style={styles.required}>*</span>
              </label>
              <div style={styles.inputGroup}>
                <span style={styles.currencySymbol}>¥</span>
                <input 
                  type="number" 
                  name="price"
                  step="1"
                  min="0"
                  value={formData.price}
                  onChange={handleInputChange}
                  style={styles.input}
                  placeholder="0"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>💲</span>
                販売価格 / Selling Price <span style={styles.required}>*</span>
              </label>
              <div style={styles.inputGroup}>
                <span style={styles.currencySymbol}>¥</span>
                <input 
                  type="number" 
                  name="sellPrice"
                  step="1"
                  min="0"
                  value={formData.sellPrice}
                  onChange={handleInputChange}
                  style={styles.input}
                  placeholder="0"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>📊</span>
                税率 / Tax Rate <span style={styles.required}>*</span>
              </label>
              <select 
                name="taxRate"
                value={formData.taxRate}
                onChange={handleInputChange}
                style={styles.select}
                required
                disabled={loading}
              >
                <option value="0">0% (非課税 / Tax Free)</option>
                <option value="5">5% (特別 / Special)</option>
                <option value="8">8% (食品 / Food Items)</option>
                <option value="10">10% (非食品 / Non-Food)</option>
                <option value="12">12% (標準 / Standard)</option>
                <option value="18">18% (プレミアム / Premium)</option>
              </select>
            </div>
          </div>

          <div style={styles.taxDisplay}>
            <div style={styles.taxRow}>
              <span style={styles.taxLabel}>販売価格 / Selling Price:</span>
              <span style={styles.taxValue}>{formatYen(formData.sellPrice)}</span>
            </div>
            <div style={styles.taxRow}>
              <span style={styles.taxLabel}>税金額 ({formData.taxRate}%):</span>
              <span style={styles.taxValue}>{formatYen(formData.sellPrice * formData.taxRate / 100)}</span>
            </div>
            <div style={{...styles.taxRow, borderBottom: 'none'}}>
              <span style={styles.taxLabel}>合計金額 / Total Price:</span>
              <span style={styles.totalValue}>
                {formatYen(parseFloat(formData.sellPrice || 0) + (formData.sellPrice * formData.taxRate / 100))}
              </span>
            </div>
          </div>
        </div>

        {/* Stock Management */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>📊</span>
            在庫管理 / Stock Management
          </div>
          
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>📦</span>
                現在の在庫 / Current Stock
              </label>
              <input 
                type="number" 
                name="currentStock"
                step="0.01"
                min="0"
                value={formData.currentStock}
                onChange={handleInputChange}
                style={styles.input}
                placeholder="0"
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>⚠️</span>
                在庫アラート / Stock Alert Limit
              </label>
              <input 
                type="number" 
                name="stockLowerLimit"
                step="0.01"
                min="0"
                value={formData.stockLowerLimit}
                onChange={handleInputChange}
                style={styles.input}
                placeholder="アラート設定値"
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>📦</span>
                最低発注ロット / Minimum Order Lot
              </label>
              <input 
                type="number" 
                name="minimumOrderLot"
                step="0.01"
                min="0"
                value={formData.minimumOrderLot}
                onChange={handleInputChange}
                style={styles.input}
                placeholder="仕入先最低数量"
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>📅</span>
                次回入荷予定日 / Next Available Date
              </label>
              <input 
                type="date" 
                name="nextAvailableDate"
                value={formData.nextAvailableDate}
                onChange={handleInputChange}
                style={styles.input}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Supplier & Storage */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>🚚</span>
            仕入先と保管 / Supplier & Storage
          </div>
          
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>🏢</span>
                仕入先 / Supplier <span style={styles.required}>*</span>
              </label>
              <select 
                name="supplierId"
                value={formData.supplierId}
                onChange={(e) => {
                  const selected = suppliers.find(s => s.id === e.target.value);
                  setFormData({
                    ...formData, 
                    supplierId: e.target.value,
                    supplierName: selected ? selected.name : ''
                  });
                }}
                style={styles.select}
                required
                disabled={loading || suppliers.length === 0}
              >
                <option value="">仕入先を選択 / Select Supplier</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} • {supplier.mobileNumber || supplier.landlineNumber}
                  </option>
                ))}
              </select>
              {suppliers.length === 0 && (
                <div style={styles.infoText}>仕入先が見つかりません。最初に仕入先を追加してください。</div>
              )}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>❄️</span>
                保管タイプ / Storage Type
              </label>
              <select 
                name="storageType"
                value={formData.storageType}
                onChange={handleInputChange}
                style={styles.select}
                disabled={loading}
              >
                <option value="normal">🌡️ 常温 / Room Temperature</option>
                <option value="refrigerated">❄️ 冷蔵 / Refrigerated</option>
                <option value="frozen">🧊 冷凍 / Frozen</option>
                <option value="dry">☀️ 乾燥保管 / Dry Storage</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>🏷️</span>
                HSNコード / HSN Code
              </label>
              <input 
                type="text" 
                name="hsnCode"
                value={formData.hsnCode}
                onChange={handleInputChange}
                style={styles.input}
                placeholder="税務用HSNコード"
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span style={styles.labelIcon}>📱</span>
                バーコード / Barcode
              </label>
              <input 
                type="text" 
                name="barcode"
                value={formData.barcode}
                onChange={handleInputChange}
                style={styles.input}
                placeholder="スキャンまたは入力"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div style={styles.actionButtons}>
          <button 
            type="submit" 
            style={styles.submitButton}
            disabled={loading}
          >
            <span style={styles.buttonIcon}>✅</span>
            {loading ? '登録中...' : '製品を登録'}
          </button>
          
          <button 
            type="button" 
            style={styles.secondaryButton}
            onClick={() => {
              setFormData({
                name: '',
                mainCategory: '',
                subCategory: '',
                newCategory: '',
                newSubCategory: '',
                type: 'weight',
                weightPerUnit: '',
                unit: 'kg',
                price: '',
                supplierId: '',
                supplierName: '',
                minimumOrderLot: '',
                stockLowerLimit: '',
                sellPrice: '',
                taxRate: 8,
                currentStock: 0,
                nextAvailableDate: '',
                isActive: true,
                storageType: 'normal',
                unitSize: '',
                isFoodItem: true,
                barcode: '',
                sku: '',
                hsnCode: '',
                description: ''
              });
              setShowNewCategory(false);
              setShowNewSubCategory(false);
            }}
            disabled={loading}
          >
            <span style={styles.buttonIcon}>🗑️</span>
            フォームをクリア
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductRegistration;