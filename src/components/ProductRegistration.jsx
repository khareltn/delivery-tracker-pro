import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import './ProductMgmt.css';

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
    hsnCode: ''
  });

  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [companyId, setCompanyId] = useState(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewSubCategory, setShowNewSubCategory] = useState(false);

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
    try {
      const finalCategory = showNewCategory ? formData.newCategory : formData.mainCategory;
      const finalSubCategory = showNewSubCategory ? formData.newSubCategory : formData.subCategory;
      
      const productData = {
        ...formData,
        mainCategory: finalCategory,
        subCategory: finalSubCategory,
        companyId: companyId,
        createdAt: new Date(),
        createdBy: currentUser?.uid,
        lastUpdated: new Date(),
        taxAmount: (formData.sellPrice * formData.taxRate / 100).toFixed(2),
        totalPrice: (parseFloat(formData.sellPrice) + (formData.sellPrice * formData.taxRate / 100)).toFixed(2)
      };

      // Remove temporary fields
      delete productData.newCategory;
      delete productData.newSubCategory;

      await addDoc(collection(db, 'products'), productData);
      
      alert('Product registered successfully!');
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
        hsnCode: ''
      });
      setShowNewCategory(false);
      setShowNewSubCategory(false);
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Error registering product. Please try again.');
    }
  };

  // Generate SKU automatically
  const generateSKU = () => {
    const categoryCode = formData.mainCategory ? formData.mainCategory.substring(0, 3).toUpperCase() : 'GEN';
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${categoryCode}-${randomNum}`;
  };

  return (
    <div className="product-registration">
      <div className="product-header">
        <h2>PRODUCT REGISTRATION</h2>
        <div className="header-badge">Restaurant Inventory</div>
      </div>
      
      <form onSubmit={handleSubmit} className="product-form">
        {/* Category Section */}
        <div className="form-section">
          <div className="section-title">
            <span className="section-icon">📁</span>
            CATEGORY INFORMATION
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🏷️</span>
                MAIN CATEGORY *
              </label>
              <select 
                value={formData.mainCategory}
                onChange={handleCategoryChange}
                className="form-select"
                required
              >
                <option value="">SELECT CATEGORY</option>
                {categories.map((cat, index) => (
                  <option key={index} value={cat.name} className={cat.isFood ? 'food-category' : 'nonfood-category'}>
                    {cat.name} • {cat.isFood ? 'FOOD (8% TAX)' : 'NON-FOOD (10% TAX)'}
                  </option>
                ))}
              </select>
              
              <button 
                type="button" 
                className="btn-custom"
                onClick={() => setShowNewCategory(!showNewCategory)}
              >
                {showNewCategory ? '← SELECT EXISTING' : '+ CREATE NEW CATEGORY'}
              </button>
            </div>

            {showNewCategory ? (
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">🆕</span>
                  NEW CATEGORY NAME *
                </label>
                <input 
                  type="text" 
                  value={formData.newCategory}
                  onChange={(e) => setFormData({...formData, newCategory: e.target.value})}
                  className="form-input"
                  placeholder="ENTER NEW CATEGORY"
                  required={showNewCategory}
                />
                <div className="tax-toggle">
                  <div className="toggle-group">
                    <input 
                      type="radio" 
                      id="foodTax"
                      name="taxType"
                      checked={formData.isFoodItem}
                      onChange={() => setFormData({...formData, isFoodItem: true, taxRate: 8})}
                    />
                    <label htmlFor="foodTax" className="toggle-label food-toggle">
                      🍽️ FOOD ITEM • 8% TAX
                    </label>
                  </div>
                  <div className="toggle-group">
                    <input 
                      type="radio" 
                      id="nonFoodTax"
                      name="taxType"
                      checked={!formData.isFoodItem}
                      onChange={() => setFormData({...formData, isFoodItem: false, taxRate: 10})}
                    />
                    <label htmlFor="nonFoodTax" className="toggle-label nonfood-toggle">
                      📦 NON-FOOD • 10% TAX
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">🔽</span>
                  SUB CATEGORY
                </label>
                <select 
                  value={formData.subCategory}
                  onChange={(e) => setFormData({...formData, subCategory: e.target.value})}
                  className="form-select"
                >
                  <option value="">SELECT SUB-CATEGORY</option>
                  {subCategories.map((sub, index) => (
                    <option key={index} value={sub}>{sub}</option>
                  ))}
                </select>
                <button 
                  type="button" 
                  className="btn-custom"
                  onClick={() => setShowNewSubCategory(!showNewSubCategory)}
                >
                  {showNewSubCategory ? '← SELECT EXISTING' : '+ NEW SUB-CATEGORY'}
                </button>
              </div>
            )}

            {showNewSubCategory && (
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">🆕</span>
                  NEW SUB-CATEGORY
                </label>
                <input 
                  type="text" 
                  value={formData.newSubCategory}
                  onChange={(e) => setFormData({...formData, newSubCategory: e.target.value})}
                  className="form-input"
                  placeholder="ENTER NEW SUB-CATEGORY"
                />
              </div>
            )}
          </div>
        </div>

        {/* Product Details */}
        <div className="form-section">
          <div className="section-title">
            <span className="section-icon">📝</span>
            PRODUCT DETAILS
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">📛</span>
                PRODUCT NAME *
              </label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="form-input"
                placeholder="e.g., CHICKEN BREAST, BASMATI RICE"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🏷️</span>
                PRODUCT CODE
              </label>
              <div className="input-group">
                <input 
                  type="text" 
                  value={formData.sku}
                  onChange={(e) => setFormData({...formData, sku: e.target.value})}
                  className="form-input"
                  placeholder="SKU CODE"
                />
                <button 
                  type="button" 
                  className="btn-generate"
                  onClick={() => setFormData({...formData, sku: generateSKU()})}
                >
                  GENERATE
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">📦</span>
                UNIT TYPE *
              </label>
              <div className="form-row">
                <select 
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="form-select"
                >
                  <option value="weight">⚖️ BY WEIGHT</option>
                  <option value="piece">🔢 BY PIECE</option>
                  <option value="volume">🧴 BY VOLUME</option>
                  <option value="packet">📦 BY PACKET</option>
                </select>
                
                <select 
                  value={formData.unit}
                  onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  className="form-select"
                >
                  {formData.type === 'weight' && (
                    <>
                      <option value="kg">KG (KILOGRAM)</option>
                      <option value="g">G (GRAM)</option>
                      <option value="lb">LB (POUND)</option>
                    </>
                  )}
                  {formData.type === 'volume' && (
                    <>
                      <option value="L">L (LITER)</option>
                      <option value="ml">ML (MILLILITER)</option>
                    </>
                  )}
                  {formData.type === 'piece' && (
                    <>
                      <option value="pc">PC (PIECE)</option>
                      <option value="dozen">DOZEN</option>
                      <option value="pack">PACK</option>
                    </>
                  )}
                  {formData.type === 'packet' && (
                    <>
                      <option value="packet">PACKET</option>
                      <option value="box">BOX</option>
                      <option value="case">CASE</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">📏</span>
                UNIT SIZE
              </label>
              <input 
                type="text" 
                value={formData.unitSize}
                onChange={(e) => setFormData({...formData, unitSize: e.target.value})}
                className="form-input"
                placeholder="e.g., 500G, 1KG, 1L, DOZEN"
              />
            </div>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="form-section">
          <div className="section-title">
            <span className="section-icon">💰</span>
            PRICING & TAX
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🏷️</span>
                PURCHASE PRICE *
              </label>
              <div className="price-input">
                <span className="currency">₹</span>
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className="form-input"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">💲</span>
                SELLING PRICE *
              </label>
              <div className="price-input">
                <span className="currency">₹</span>
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.sellPrice}
                  onChange={(e) => setFormData({...formData, sellPrice: e.target.value})}
                  className="form-input"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">📊</span>
                TAX RATE *
              </label>
              <div className="tax-display">
                <select 
                  value={formData.taxRate}
                  onChange={(e) => setFormData({...formData, taxRate: parseFloat(e.target.value)})}
                  className="tax-select"
                >
                  <option value="0">0% (TAX FREE)</option>
                  <option value="5">5% (SPECIAL)</option>
                  <option value="8">8% (FOOD ITEMS)</option>
                  <option value="10">10% (NON-FOOD)</option>
                  <option value="12">12% (STANDARD)</option>
                  <option value="18">18% (PREMIUM)</option>
                </select>
                <div className="tax-breakdown">
                  <div className="tax-item">
                    <span>TAX AMOUNT:</span>
                    <span className="tax-value">
                      ₹{(formData.sellPrice * formData.taxRate / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="tax-item">
                    <span>TOTAL PRICE:</span>
                    <span className="total-value">
                      ₹{(parseFloat(formData.sellPrice || 0) + (formData.sellPrice * formData.taxRate / 100)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stock Management */}
        <div className="form-section">
          <div className="section-title">
            <span className="section-icon">📊</span>
            STOCK MANAGEMENT
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">📦</span>
                CURRENT STOCK *
              </label>
              <input 
                type="number" 
                step="0.01"
                value={formData.currentStock}
                onChange={(e) => setFormData({...formData, currentStock: e.target.value})}
                className="form-input"
                placeholder="0"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">⚠️</span>
                STOCK ALERT LIMIT *
              </label>
              <input 
                type="number" 
                step="0.01"
                value={formData.stockLowerLimit}
                onChange={(e) => setFormData({...formData, stockLowerLimit: e.target.value})}
                className="form-input"
                placeholder="ALERT WHEN BELOW"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">📦</span>
                MINIMUM ORDER LOT
              </label>
              <input 
                type="number" 
                step="0.01"
                value={formData.minimumOrderLot}
                onChange={(e) => setFormData({...formData, minimumOrderLot: e.target.value})}
                className="form-input"
                placeholder="SUPPLIER MINIMUM"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">📅</span>
                NEXT AVAILABLE DATE
              </label>
              <input 
                type="date" 
                value={formData.nextAvailableDate}
                onChange={(e) => setFormData({...formData, nextAvailableDate: e.target.value})}
                className="form-input"
              />
            </div>
          </div>
        </div>

        {/* Supplier & Storage */}
        <div className="form-section">
          <div className="section-title">
            <span className="section-icon">🚚</span>
            SUPPLIER & STORAGE
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🏢</span>
                SUPPLIER *
              </label>
              <select 
                value={formData.supplierId}
                onChange={(e) => {
                  const selected = suppliers.find(s => s.id === e.target.value);
                  setFormData({
                    ...formData, 
                    supplierId: e.target.value,
                    supplierName: selected ? selected.name : ''
                  });
                }}
                className="form-select"
                required
              >
                <option value="">SELECT SUPPLIER</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    🏢 {supplier.name} • 📞 {supplier.contact}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">❄️</span>
                STORAGE TYPE
              </label>
              <select 
                value={formData.storageType}
                onChange={(e) => setFormData({...formData, storageType: e.target.value})}
                className="form-select"
              >
                <option value="normal">🌡️ ROOM TEMPERATURE</option>
                <option value="refrigerated">❄️ REFRIGERATED</option>
                <option value="frozen">🧊 FROZEN</option>
                <option value="dry">☀️ DRY STORAGE</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🏷️</span>
                HSN CODE
              </label>
              <input 
                type="text" 
                value={formData.hsnCode}
                onChange={(e) => setFormData({...formData, hsnCode: e.target.value})}
                className="form-input"
                placeholder="HSN CODE FOR GST"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">📱</span>
                BARCODE
              </label>
              <input 
                type="text" 
                value={formData.barcode}
                onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                className="form-input"
                placeholder="SCAN OR ENTER BARCODE"
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button type="submit" className="btn-submit">
            <span className="btn-icon">✅</span>
            REGISTER PRODUCT
          </button>
          <button type="button" className="btn-draft" onClick={() => {
            setFormData({...formData, isActive: false});
            handleSubmit(new Event('submit'));
          }}>
            <span className="btn-icon">💾</span>
            SAVE AS DRAFT
          </button>
          <button type="button" className="btn-clear" onClick={() => {
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
              hsnCode: ''
            });
            setShowNewCategory(false);
            setShowNewSubCategory(false);
          }}>
            <span className="btn-icon">🗑️</span>
            CLEAR FORM
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductRegistration;