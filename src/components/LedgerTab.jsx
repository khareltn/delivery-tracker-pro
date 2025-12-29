// components/LedgerTab.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, addDoc, getDocs, query, where,
  updateDoc, deleteDoc, doc, writeBatch
} from 'firebase/firestore';
import { toast } from 'react-toastify';

const LedgerTab = ({ company, currentUser, customers, suppliers, drivers, products, formatCurrency }) => {
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('drivers');
  
  // Driver form state
  const [newDriver, setNewDriver] = useState({
    name: '',
    mobileNumber: '',
    licenseNumber: '',
    vehicleType: 'car',
    vehicleNumber: '',
    experience: '1',
    postalCode: '',
    prefecture: '',
    city: '',
    streetAddress: '',
    building: '',
    emergencyContact: '',
    insuranceNumber: '',
    notes: ''
  });

  // Customer form state
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    mobileNumber: '',
    landlineNumber: '',
    email: '',
    postalCode: '',
    prefecture: '',
    city: '',
    streetAddress: '',
    building: '',
    customerType: 'restaurant',
    taxNumber: '',
    creditLimit: '',
    paymentTermsType: 'cod',
    paymentDays: 0,
    customPaymentDate: '',
    paymentMethod: 'bank_transfer',
    notes: ''
  });

  // Supplier form state
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    mobileNumber: '',
    landlineNumber: '',
    email: '',
    postalCode: '',
    prefecture: '',
    city: '',
    streetAddress: '',
    building: '',
    supplierType: 'food',
    taxNumber: '',
    paymentTermsType: 'net',
    paymentDays: 30,
    customPaymentDate: '',
    paymentMethod: 'bank_transfer',
    contactPerson: '',
    notes: ''
  });

  // Product form state
  const [newProduct, setNewProduct] = useState({
    name: '',
    mainCategory: '',
    subCategory: '',
    type: 'weight',
    unit: 'kg',
    unitSize: '',
    price: '',
    sellPrice: '',
    taxRate: 8,
    currentStock: 0,
    stockLowerLimit: '10',
    supplierId: '',
    description: '',
    barcode: '',
    sku: ''
  });

  // CATEGORY MANAGEMENT STATE
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categoryManagerTab, setCategoryManagerTab] = useState('categories');
  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'food',
    description: ''
  });
  const [newSubCategory, setNewSubCategory] = useState({
    name: '',
    parentCategory: '',
    description: ''
  });
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingSubCategory, setEditingSubCategory] = useState(null);

  // OPERATOR-MANAGED POSTAL CODES STATE
  const [postalCodes, setPostalCodes] = useState([]);
  const [showPostalCodeManager, setShowPostalCodeManager] = useState(false);
  const [newPostalCode, setNewPostalCode] = useState({
    postalCode: '',
    prefecture: '',
    city: '',
    street: ''
  });

  // Load categories from Firestore
  const loadCategories = async () => {
    if (!company?.id) {
      console.log('No company ID available');
      return;
    }

    try {
      console.log('Loading categories for company:', company.id);
      
      // Load categories
      const categoriesQuery = query(
        collection(db, 'categories'),
        where('companyId', '==', company.id)
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categoriesData = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Categories loaded:', categoriesData.length);
      setCategories(categoriesData);

      // Load subcategories
      const subCategoriesQuery = query(
        collection(db, 'subcategories'),
        where('companyId', '==', company.id)
      );
      const subCategoriesSnapshot = await getDocs(subCategoriesQuery);
      const subCategoriesData = subCategoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSubCategories(subCategoriesData);
      
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories');
    }
  };

  // Load postal codes from Firestore (operator-managed)
  const loadPostalCodes = async () => {
    if (!company?.id) return;
    
    try {
      const postalCodesQuery = query(
        collection(db, 'postal_codes'),
        where('companyId', '==', company.id)
      );
      const snapshot = await getDocs(postalCodesQuery);
      const postalData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPostalCodes(postalData);
    } catch (error) {
      console.error('Error loading postal codes:', error);
    }
  };

  // Load data when company is available
  useEffect(() => {
    if (company?.id) {
      loadCategories();
      loadPostalCodes();
    }
  }, [company]);

  // Update subcategories when main category changes
  useEffect(() => {
    if (newProduct.mainCategory) {
      const subs = subCategories.filter(
        sub => sub.parentCategory === newProduct.mainCategory && sub.isActive !== false
      );
      setNewProduct(prev => ({ ...prev, subCategory: '' }));
    }
  }, [newProduct.mainCategory, subCategories]);

  // ============ CATEGORY MANAGEMENT FUNCTIONS ============

  const handleAddCategory = async (e) => {
    e.preventDefault();
    
    if (!newCategory.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    if (!company?.id) {
      toast.error('Company information not loaded');
      return;
    }

    setLoading(true);
    try {
      const categoryData = {
        name: newCategory.name.trim(),
        type: newCategory.type,
        description: newCategory.description?.trim() || '',
        companyId: company.id,
        companyName: company.name || 'Unknown Company',
        createdAt: new Date(),
        createdBy: currentUser?.email || 'unknown@email.com',
        createdById: currentUser?.uid || 'unknown',
        isActive: true,
        taxRate: newCategory.type === 'food' ? 8 : 10
      };

      console.log('Adding category:', categoryData);
      
      await addDoc(collection(db, 'categories'), categoryData);
      
      toast.success('✅ Category added successfully!');
      setNewCategory({ name: '', type: 'food', description: '' });
      await loadCategories();
      
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error(`Failed to add category: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCategory = async (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;
    
    setEditingCategory(category);
    setNewCategory({
      name: category.name,
      type: category.type,
      description: category.description || ''
    });
    setCategoryManagerTab('categories');
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    
    if (!editingCategory || !newCategory.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'categories', editingCategory.id), {
        name: newCategory.name.trim(),
        type: newCategory.type,
        description: newCategory.description?.trim() || '',
        taxRate: newCategory.type === 'food' ? 8 : 10,
        updatedAt: new Date()
      });
      
      toast.success('✅ Category updated successfully!');
      setEditingCategory(null);
      setNewCategory({ name: '', type: 'food', description: '' });
      await loadCategories();
      
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Failed to update category');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCategoryStatus = async (categoryId, currentStatus) => {
    try {
      await updateDoc(doc(db, 'categories', categoryId), {
        isActive: !currentStatus,
        updatedAt: new Date()
      });
      
      toast.success(`Category ${!currentStatus ? 'activated' : 'deactivated'}`);
      await loadCategories();
      
    } catch (error) {
      console.error('Error toggling category status:', error);
      toast.error('Failed to update category status');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Are you sure you want to delete this category? This will also delete all subcategories under it.')) {
      return;
    }

    try {
      // Delete category
      await deleteDoc(doc(db, 'categories', categoryId));
      
      // Delete related subcategories
      const relatedSubCategories = subCategories.filter(sub => sub.parentCategory === categories.find(c => c.id === categoryId)?.name);
      const batch = writeBatch(db);
      
      relatedSubCategories.forEach(sub => {
        const subRef = doc(db, 'subcategories', sub.id);
        batch.delete(subRef);
      });
      
      if (relatedSubCategories.length > 0) {
        await batch.commit();
      }
      
      toast.success('✅ Category deleted successfully!');
      await loadCategories();
      
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    }
  };

  const handleAddSubCategory = async (e) => {
    e.preventDefault();
    
    if (!newSubCategory.name.trim() || !newSubCategory.parentCategory) {
      toast.error('Subcategory name and parent category are required');
      return;
    }

    if (!company?.id) {
      toast.error('Company information not loaded');
      return;
    }

    setLoading(true);
    try {
      const subCategoryData = {
        name: newSubCategory.name.trim(),
        parentCategory: newSubCategory.parentCategory,
        description: newSubCategory.description?.trim() || '',
        companyId: company.id,
        companyName: company.name || 'Unknown Company',
        createdAt: new Date(),
        createdBy: currentUser?.email || 'unknown@email.com',
        createdById: currentUser?.uid || 'unknown',
        isActive: true
      };

      await addDoc(collection(db, 'subcategories'), subCategoryData);
      
      toast.success('✅ Subcategory added successfully!');
      setNewSubCategory({ name: '', parentCategory: '', description: '' });
      await loadCategories();
      
    } catch (error) {
      console.error('Error adding subcategory:', error);
      toast.error('Failed to add subcategory');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubCategoryStatus = async (subCategoryId, currentStatus) => {
    try {
      await updateDoc(doc(db, 'subcategories', subCategoryId), {
        isActive: !currentStatus,
        updatedAt: new Date()
      });
      
      toast.success(`Subcategory ${!currentStatus ? 'activated' : 'deactivated'}`);
      await loadCategories();
      
    } catch (error) {
      console.error('Error toggling subcategory status:', error);
      toast.error('Failed to update subcategory status');
    }
  };

  const handleDeleteSubCategory = async (subCategoryId) => {
    if (!window.confirm('Are you sure you want to delete this subcategory?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'subcategories', subCategoryId));
      toast.success('✅ Subcategory deleted successfully!');
      await loadCategories();
      
    } catch (error) {
      console.error('Error deleting subcategory:', error);
      toast.error('Failed to delete subcategory');
    }
  };

  // ============ POSTAL CODE MANAGEMENT FUNCTIONS ============

  const handleAddPostalCode = async (e) => {
    e.preventDefault();
    
    if (!newPostalCode.postalCode || !newPostalCode.prefecture || !newPostalCode.city) {
      toast.error('Postal code, prefecture, and city are required');
      return;
    }

    setLoading(true);
    try {
      const postalData = {
        ...newPostalCode,
        companyId: company.id,
        companyName: company.name,
        createdAt: new Date(),
        createdBy: currentUser?.email,
        createdById: currentUser?.uid
      };

      await addDoc(collection(db, 'postal_codes'), postalData);
      
      toast.success('✅ Postal code added successfully!');
      setNewPostalCode({
        postalCode: '',
        prefecture: '',
        city: '',
        street: ''
      });
      await loadPostalCodes();
      
    } catch (error) {
      console.error('Error adding postal code:', error);
      toast.error('Failed to add postal code');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePostalCode = async (postalCodeId) => {
    if (!window.confirm('Are you sure you want to delete this postal code?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'postal_codes', postalCodeId));
      toast.success('✅ Postal code deleted successfully!');
      await loadPostalCodes();
    } catch (error) {
      console.error('Error deleting postal code:', error);
      toast.error('Failed to delete postal code');
    }
  };

  // ============ REGISTRATION FUNCTIONS ============

  const handleRegisterDriver = async (e) => {
    e.preventDefault();
    if (!newDriver.name || !newDriver.mobileNumber) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      // Build address string from components
      const address = [
        newDriver.prefecture,
        newDriver.city,
        newDriver.streetAddress,
        newDriver.building
      ].filter(Boolean).join(' ');

      const driverData = {
        ...newDriver,
        address: address,
        postalCode: newDriver.postalCode,
        prefecture: newDriver.prefecture,
        city: newDriver.city,
        streetAddress: newDriver.streetAddress,
        building: newDriver.building,
        role: 'driver',
        companyId: company.id,
        companyName: company.name,
        createdAt: new Date(),
        createdBy: currentUser?.email,
        createdById: currentUser?.uid,
        status: 'active'
      };

      // Remove the individual address fields before saving
      delete driverData.streetAddress;
      delete driverData.prefecture;
      delete driverData.city;
      delete driverData.building;

      await addDoc(collection(db, 'users'), driverData);
      toast.success('✅ Driver registered successfully!');
      setNewDriver({
        name: '',
        mobileNumber: '',
        licenseNumber: '',
        vehicleType: 'car',
        vehicleNumber: '',
        experience: '1',
        postalCode: '',
        prefecture: '',
        city: '',
        streetAddress: '',
        building: '',
        emergencyContact: '',
        insuranceNumber: '',
        notes: ''
      });
    } catch (error) {
      console.error('Error registering driver:', error);
      toast.error('Failed to register driver');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.name) {
      toast.error('Please enter customer name');
      return;
    }

    setLoading(true);
    try {
      // Build address string from components
      const address = [
        newCustomer.prefecture,
        newCustomer.city,
        newCustomer.streetAddress,
        newCustomer.building
      ].filter(Boolean).join(' ');

      // Format payment terms for storage
      let paymentTerms = '';
      if (newCustomer.paymentTermsType === 'cod') {
        paymentTerms = 'Cash on Delivery (COD)';
      } else if (newCustomer.paymentTermsType === 'net') {
        paymentTerms = `Net ${newCustomer.paymentDays} days`;
      } else if (newCustomer.paymentTermsType === 'custom') {
        paymentTerms = `Custom: ${newCustomer.customPaymentDate}`;
      }

      const customerData = {
        ...newCustomer,
        address: address,
        postalCode: newCustomer.postalCode,
        prefecture: newCustomer.prefecture,
        city: newCustomer.city,
        streetAddress: newCustomer.streetAddress,
        building: newCustomer.building,
        paymentTerms: paymentTerms,
        role: 'customer',
        companyId: company.id,
        companyName: company.name,
        createdAt: new Date(),
        createdBy: currentUser?.email,
        createdById: currentUser?.uid,
        status: 'active'
      };

      // Remove the individual address fields before saving
      delete customerData.streetAddress;
      delete customerData.prefecture;
      delete customerData.city;
      delete customerData.building;

      await addDoc(collection(db, 'users'), customerData);
      toast.success('✅ Customer registered successfully!');
      setNewCustomer({
        name: '',
        mobileNumber: '',
        landlineNumber: '',
        email: '',
        postalCode: '',
        prefecture: '',
        city: '',
        streetAddress: '',
        building: '',
        customerType: 'restaurant',
        taxNumber: '',
        creditLimit: '',
        paymentTermsType: 'cod',
        paymentDays: 0,
        customPaymentDate: '',
        paymentMethod: 'bank_transfer',
        notes: ''
      });
    } catch (error) {
      console.error('Error registering customer:', error);
      toast.error('Failed to register customer');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplier.name) {
      toast.error('Please enter supplier name');
      return;
    }

    setLoading(true);
    try {
      // Build address string from components
      const address = [
        newSupplier.prefecture,
        newSupplier.city,
        newSupplier.streetAddress,
        newSupplier.building
      ].filter(Boolean).join(' ');

      // Format payment terms for storage
      let paymentTerms = '';
      if (newSupplier.paymentTermsType === 'cod') {
        paymentTerms = 'Cash on Delivery (COD)';
      } else if (newSupplier.paymentTermsType === 'net') {
        paymentTerms = `Net ${newSupplier.paymentDays} days`;
      } else if (newSupplier.paymentTermsType === 'custom') {
        paymentTerms = `Custom: ${newSupplier.customPaymentDate}`;
      }

      const supplierData = {
        ...newSupplier,
        address: address,
        postalCode: newSupplier.postalCode,
        prefecture: newSupplier.prefecture,
        city: newSupplier.city,
        streetAddress: newSupplier.streetAddress,
        building: newSupplier.building,
        paymentTerms: paymentTerms,
        role: 'supplier',
        companyId: company.id,
        companyName: company.name,
        createdAt: new Date(),
        createdBy: currentUser?.email,
        createdById: currentUser?.uid,
        status: 'active'
      };

      // Remove the individual address fields before saving
      delete supplierData.streetAddress;
      delete supplierData.prefecture;
      delete supplierData.city;
      delete supplierData.building;

      await addDoc(collection(db, 'users'), supplierData);
      toast.success('✅ Supplier registered successfully!');
      setNewSupplier({
        name: '',
        mobileNumber: '',
        landlineNumber: '',
        email: '',
        postalCode: '',
        prefecture: '',
        city: '',
        streetAddress: '',
        building: '',
        supplierType: 'food',
        taxNumber: '',
        paymentTermsType: 'net',
        paymentDays: 30,
        customPaymentDate: '',
        paymentMethod: 'bank_transfer',
        contactPerson: '',
        notes: ''
      });
    } catch (error) {
      console.error('Error registering supplier:', error);
      toast.error('Failed to register supplier');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterProduct = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!newProduct.name || !newProduct.price || !newProduct.sellPrice) {
      toast.error('Please fill all required fields: Name, Purchase Price, and Selling Price');
      return;
    }

    // Validate category
    if (!newProduct.mainCategory) {
      toast.error('Please select a main category');
      return;
    }

    setLoading(true);
    try {
      const productData = {
        name: newProduct.name.trim(),
        mainCategory: newProduct.mainCategory,
        subCategory: newProduct.subCategory || '',
        type: newProduct.type,
        unit: newProduct.unit,
        unitSize: newProduct.unitSize || '',
        price: parseFloat(newProduct.price) || 0,
        sellPrice: parseFloat(newProduct.sellPrice) || 0,
        taxRate: parseInt(newProduct.taxRate) || 8,
        currentStock: parseFloat(newProduct.currentStock) || 0,
        stockLowerLimit: parseFloat(newProduct.stockLowerLimit) || 10,
        supplierId: newProduct.supplierId || '',
        description: newProduct.description?.trim() || '',
        barcode: newProduct.barcode || '',
        sku: newProduct.sku || '',
        companyId: company.id,
        companyName: company.name || 'Unknown Company',
        createdAt: new Date(),
        createdBy: currentUser?.email || 'unknown@email.com',
        createdById: currentUser?.uid || 'unknown',
        status: 'active',
        currency: 'JPY'
      };

      await addDoc(collection(db, 'products'), productData);
      
      toast.success('✅ Product registered successfully!');
      
      // Reset form but keep categories
      setNewProduct({
        name: '',
        mainCategory: newProduct.mainCategory, // Keep same category
        subCategory: newProduct.subCategory, // Keep same subcategory
        type: 'weight',
        unit: 'kg',
        unitSize: '',
        price: '',
        sellPrice: '',
        taxRate: 8,
        currentStock: 0,
        stockLowerLimit: '10',
        supplierId: '',
        description: '',
        barcode: '',
        sku: ''
      });
      
    } catch (error) {
      console.error('Error registering product:', error);
      toast.error(`Failed to register product: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ============ HELPER FUNCTIONS ============

  const getSubCategoriesForCategory = (categoryName) => {
    return subCategories.filter(
      sub => sub.parentCategory === categoryName && sub.isActive !== false
    );
  };

  // Get active categories
  const activeCategories = categories.filter(cat => cat.isActive !== false);
  
  // Get units based on product type
  const getUnitsForType = (type) => {
    switch(type) {
      case 'weight':
        return [
          { value: 'kg', label: 'キログラム (kg)' },
          { value: 'g', label: 'グラム (g)' },
          { value: 'lb', label: 'ポンド (lb)' },
          { value: 'oz', label: 'オンス (oz)' }
        ];
      case 'volume':
        return [
          { value: 'L', label: 'リットル (L)' },
          { value: 'ml', label: 'ミリリットル (ml)' },
          { value: 'gal', label: 'ガロン (gal)' },
          { value: 'pint', label: 'パイント (pt)' }
        ];
      case 'quantity':
        return [
          { value: 'piece', label: '個 (Piece)' },
          { value: 'box', label: '箱 (Box)' },
          { value: 'case', label: 'ケース (Case)' },
          { value: 'pack', label: 'パック (Pack)' },
          { value: 'dozen', label: 'ダース (Dozen)' }
        ];
      default:
        return [{ value: 'unit', label: '単位 (Unit)' }];
    }
  };

  // Payment terms options
  const paymentTermsOptions = [
    { id: 'cod', label: '現金払い / Cash on Delivery', description: '支払いは商品到着時に現金で', icon: '💰', days: 0 },
    { id: 'net7', label: 'Net 7 Days', description: '7日以内の支払い', icon: '📅', days: 7 },
    { id: 'net15', label: 'Net 15 Days', description: '15日以内の支払い', icon: '📅', days: 15 },
    { id: 'net30', label: 'Net 30 Days', description: '30日以内の支払い', icon: '📅', days: 30 },
    { id: 'net45', label: 'Net 45 Days', description: '45日以内の支払い', icon: '📅', days: 45 },
    { id: 'net60', label: 'Net 60 Days', description: '60日以内の支払い', icon: '📅', days: 60 },
    { id: 'custom', label: 'カスタム / Custom Date', description: '特定の日付に支払い', icon: '📝', days: null }
  ];

  // Payment method options
  const paymentMethodOptions = [
    { value: 'bank_transfer', label: '💰 銀行振込 / Bank Transfer' },
    { value: 'cash', label: '💵 現金 / Cash' },
    { value: 'credit_card', label: '💳 クレジットカード / Credit Card' },
    { value: 'check', label: '🧾 小切手 / Check' },
    { value: 'digital', label: '📱 デジタル決済 / Digital Payment' }
  ];

  // ============ STYLES ============

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
    navTabs: {
      display: 'flex',
      gap: '10px',
      marginBottom: '25px',
      flexWrap: 'wrap',
      borderBottom: '1px solid #334155',
      paddingBottom: '15px'
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
      transition: 'all 0.2s',
      '&:hover': {
        backgroundColor: '#475569'
      }
    },
    tabButtonActive: {
      backgroundColor: '#3b82f6',
      color: 'white'
    },
    formContainer: {
      backgroundColor: '#0f172a',
      borderRadius: '10px',
      padding: '25px',
      border: '1px solid #334155'
    },
    formTitle: {
      fontSize: '20px',
      fontWeight: '600',
      color: '#e2e8f0',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '20px',
      marginBottom: '25px'
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
    required: {
      color: '#ef4444'
    },
    input: {
      padding: '10px 12px',
      backgroundColor: '#1e293b',
      border: '1px solid #475569',
      borderRadius: '6px',
      color: '#e2e8f0',
      fontSize: '14px',
      '&:focus': {
        outline: 'none',
        borderColor: '#3b82f6'
      }
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
    textarea: {
      padding: '10px 12px',
      backgroundColor: '#1e293b',
      border: '1px solid #475569',
      borderRadius: '6px',
      color: '#e2e8f0',
      fontSize: '14px',
      minHeight: '100px',
      resize: 'vertical'
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
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      transition: 'background-color 0.2s',
      '&:hover:not(:disabled)': {
        backgroundColor: '#2563eb'
      },
      '&:disabled': {
        backgroundColor: '#475569',
        cursor: 'not-allowed'
      }
    },
    statsCard: {
      backgroundColor: '#0f172a',
      borderRadius: '10px',
      padding: '20px',
      border: '1px solid #334155',
      marginTop: '20px'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '15px',
      marginTop: '15px'
    },
    statItem: {
      textAlign: 'center',
      padding: '15px',
      backgroundColor: '#1e293b',
      borderRadius: '8px'
    },
    statValue: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#3b82f6',
      marginBottom: '5px'
    },
    statLabel: {
      color: '#94a3b8',
      fontSize: '13px'
    },
    categoryManagerContainer: {
      backgroundColor: '#0f172a',
      borderRadius: '10px',
      padding: '20px',
      border: '1px solid #334155',
      marginBottom: '20px'
    },
    categoryManagerHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
    },
    categoryManagerTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#e2e8f0',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    categoryManagerTabs: {
      display: 'flex',
      gap: '10px',
      marginBottom: '20px',
      borderBottom: '1px solid #334155',
      paddingBottom: '10px'
    },
    categoryTabButton: {
      padding: '8px 16px',
      backgroundColor: '#334155',
      color: '#cbd5e1',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'background-color 0.2s',
      '&:hover': {
        backgroundColor: '#475569'
      }
    },
    categoryTabButtonActive: {
      backgroundColor: '#3b82f6',
      color: 'white'
    },
    categoryList: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '15px',
      marginTop: '20px'
    },
    categoryCard: {
      backgroundColor: '#1e293b',
      padding: '15px',
      borderRadius: '8px',
      border: '1px solid #334155',
      transition: 'all 0.2s',
      '&:hover': {
        transform: 'translateY(-2px)',
        borderColor: '#3b82f6'
      }
    },
    categoryCardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '10px'
    },
    categoryName: {
      color: '#e2e8f0',
      fontWeight: '600',
      fontSize: '16px'
    },
    categoryTypeBadge: {
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: '#3b82f6',
      color: 'white'
    },
    categoryDescription: {
      color: '#94a3b8',
      fontSize: '14px',
      marginTop: '8px',
      minHeight: '20px'
    },
    categoryActions: {
      display: 'flex',
      gap: '8px',
      marginTop: '10px'
    },
    actionButton: {
      padding: '6px 12px',
      backgroundColor: '#475569',
      color: '#cbd5e1',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      transition: 'background-color 0.2s',
      '&:hover': {
        backgroundColor: '#64748b'
      },
      '&:disabled': {
        opacity: 0.5,
        cursor: 'not-allowed'
      }
    },
    editButton: {
      backgroundColor: '#3b82f6',
      color: 'white',
      '&:hover': {
        backgroundColor: '#2563eb'
      }
    },
    deleteButton: {
      backgroundColor: '#ef4444',
      color: 'white',
      '&:hover': {
        backgroundColor: '#dc2626'
      }
    },
    statusBadge: (isActive) => ({
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: isActive ? '#10b981' : '#ef4444',
      color: 'white',
      marginTop: '8px',
      display: 'inline-block'
    }),
    postalCodeManagerContainer: {
      backgroundColor: '#0f172a',
      borderRadius: '10px',
      padding: '20px',
      border: '1px solid #334155',
      marginBottom: '20px'
    },
    postalCodeGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '15px',
      marginTop: '15px'
    },
    postalCodeCard: {
      backgroundColor: '#1e293b',
      padding: '15px',
      borderRadius: '8px',
      border: '1px solid #334155'
    },
    postalCodeActions: {
      display: 'flex',
      gap: '8px',
      marginTop: '10px'
    },
    buttonGroup: {
      display: 'flex',
      gap: '10px',
      marginTop: '20px'
    },
    secondaryButton: {
      padding: '10px 20px',
      backgroundColor: '#475569',
      color: '#cbd5e1',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      '&:hover': {
        backgroundColor: '#64748b'
      }
    },
    successButton: {
      backgroundColor: '#10b981',
      color: 'white',
      '&:hover': {
        backgroundColor: '#059669'
      }
    },
    addressGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '15px',
      marginTop: '10px'
    }
  };

  // ============ RENDER FUNCTIONS ============

  const renderDriverForm = () => (
    <form onSubmit={handleRegisterDriver} style={styles.formContainer}>
      <h3 style={styles.formTitle}>
        <span style={{color: '#3b82f6'}}>👨‍✈️</span>
        ドライバー新規登録 / New Driver Registration
      </h3>
      
      <div style={styles.formGrid}>
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>👤</span>
            氏名 / Full Name <span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            value={newDriver.name}
            onChange={(e) => setNewDriver({...newDriver, name: e.target.value})}
            style={styles.input}
            placeholder="例: 山田 太郎"
            required
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📱</span>
            携帯電話 / Mobile Number <span style={styles.required}>*</span>
          </label>
          <input
            type="tel"
            value={newDriver.mobileNumber}
            onChange={(e) => setNewDriver({...newDriver, mobileNumber: e.target.value})}
            style={styles.input}
            placeholder="090-1234-5678"
            required
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📄</span>
            運転免許証番号 / License Number
          </label>
          <input
            type="text"
            value={newDriver.licenseNumber}
            onChange={(e) => setNewDriver({...newDriver, licenseNumber: e.target.value})}
            style={styles.input}
            placeholder="運転免許証番号"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🚗</span>
            車両タイプ / Vehicle Type
          </label>
          <select
            value={newDriver.vehicleType}
            onChange={(e) => setNewDriver({...newDriver, vehicleType: e.target.value})}
            style={styles.select}
            disabled={loading}
          >
            <option value="car">🚗 普通車 / Car</option>
            <option value="van">🚐 バン / Van</option>
            <option value="truck">🚚 トラック / Truck</option>
            <option value="motorcycle">🏍️ バイク / Motorcycle</option>
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🔢</span>
            車両番号 / Vehicle Number
          </label>
          <input
            type="text"
            value={newDriver.vehicleNumber}
            onChange={(e) => setNewDriver({...newDriver, vehicleNumber: e.target.value})}
            style={styles.input}
            placeholder="例: 東京 500 あ 1234"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📅</span>
            経験年数 / Experience (years)
          </label>
          <select
            value={newDriver.experience}
            onChange={(e) => setNewDriver({...newDriver, experience: e.target.value})}
            style={styles.select}
            disabled={loading}
          >
            <option value="1">1年未満 / Less than 1 year</option>
            <option value="3">1-3年 / 1-3 years</option>
            <option value="5">3-5年 / 3-5 years</option>
            <option value="10">5-10年 / 5-10 years</option>
            <option value="15">10年以上 / More than 10 years</option>
          </select>
        </div>

        {/* Address Section */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📍</span>
            郵便番号 / Postal Code
          </label>
          <input
            type="text"
            value={newDriver.postalCode}
            onChange={(e) => setNewDriver({...newDriver, postalCode: e.target.value})}
            style={styles.input}
            placeholder="例: 100-0001"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏛️</span>
            都道府県 / Prefecture
          </label>
          <input
            type="text"
            value={newDriver.prefecture}
            onChange={(e) => setNewDriver({...newDriver, prefecture: e.target.value})}
            style={styles.input}
            placeholder="例: 東京都"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏙️</span>
            市区町村 / City
          </label>
          <input
            type="text"
            value={newDriver.city}
            onChange={(e) => setNewDriver({...newDriver, city: e.target.value})}
            style={styles.input}
            placeholder="例: 千代田区"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏠</span>
            丁目・番地 / Street Address
          </label>
          <input
            type="text"
            value={newDriver.streetAddress}
            onChange={(e) => setNewDriver({...newDriver, streetAddress: e.target.value})}
            style={styles.input}
            placeholder="例: 大手町1-1"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏢</span>
            建物名・部屋番号 / Building & Room
          </label>
          <input
            type="text"
            value={newDriver.building}
            onChange={(e) => setNewDriver({...newDriver, building: e.target.value})}
            style={styles.input}
            placeholder="例: 〇〇ビル 3階"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📞</span>
            緊急連絡先 / Emergency Contact
          </label>
          <input
            type="tel"
            value={newDriver.emergencyContact}
            onChange={(e) => setNewDriver({...newDriver, emergencyContact: e.target.value})}
            style={styles.input}
            placeholder="090-8765-4321"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🛡️</span>
            保険番号 / Insurance Number
          </label>
          <input
            type="text"
            value={newDriver.insuranceNumber}
            onChange={(e) => setNewDriver({...newDriver, insuranceNumber: e.target.value})}
            style={styles.input}
            placeholder="保険証番号"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📝</span>
            備考 / Notes
          </label>
          <textarea
            value={newDriver.notes}
            onChange={(e) => setNewDriver({...newDriver, notes: e.target.value})}
            style={styles.textarea}
            placeholder="特記事項があれば記入してください"
            disabled={loading}
          />
        </div>
      </div>

      <div style={styles.buttonGroup}>
        <button 
          type="submit" 
          style={styles.submitButton}
          disabled={loading}
        >
          {loading ? '登録中...' : '✅ ドライバーを登録 / Register Driver'}
        </button>
        
        <button
          type="button"
          style={{...styles.secondaryButton, ...styles.successButton}}
          onClick={() => setShowPostalCodeManager(true)}
        >
          📍 郵便番号を管理 / Manage Postal Codes
        </button>
      </div>
    </form>
  );

  const renderCustomerForm = () => (
    <form onSubmit={handleRegisterCustomer} style={styles.formContainer}>
      <h3 style={styles.formTitle}>
        <span style={{color: '#10b981'}}>👥</span>
        顧客新規登録 / New Customer Registration
      </h3>
      
      <div style={styles.formGrid}>
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏢</span>
            会社名 / Company Name <span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            value={newCustomer.name}
            onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
            style={styles.input}
            placeholder="例: 〇〇レストラン"
            required
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>👤</span>
            担当者名 / Contact Person
          </label>
          <input
            type="text"
            value={newCustomer.contactPerson}
            onChange={(e) => setNewCustomer({...newCustomer, contactPerson: e.target.value})}
            style={styles.input}
            placeholder="例: 鈴木 一郎"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📱</span>
            携帯電話 / Mobile Number
          </label>
          <input
            type="tel"
            value={newCustomer.mobileNumber}
            onChange={(e) => setNewCustomer({...newCustomer, mobileNumber: e.target.value})}
            style={styles.input}
            placeholder="090-1234-5678"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📞</span>
            固定電話 / Landline Number
          </label>
          <input
            type="tel"
            value={newCustomer.landlineNumber}
            onChange={(e) => setNewCustomer({...newCustomer, landlineNumber: e.target.value})}
            style={styles.input}
            placeholder="03-1234-5678"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📧</span>
            メールアドレス / Email
          </label>
          <input
            type="email"
            value={newCustomer.email}
            onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
            style={styles.input}
            placeholder="example@restaurant.com"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏷️</span>
            顧客タイプ / Customer Type
          </label>
          <select
            value={newCustomer.customerType}
            onChange={(e) => setNewCustomer({...newCustomer, customerType: e.target.value})}
            style={styles.select}
            disabled={loading}
          >
            <option value="restaurant">🍽️ レストラン / Restaurant</option>
            <option value="cafe">☕ カフェ / Café</option>
            <option value="hotel">🏨 ホテル / Hotel</option>
            <option value="supermarket">🛒 スーパーマーケット / Supermarket</option>
            <option value="wholesale">📦 卸売業 / Wholesale</option>
            <option value="individual">👤 個人顧客 / Individual</option>
            <option value="other">🔧 その他 / Other</option>
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📋</span>
            税登録番号 / Tax Number
          </label>
          <input
            type="text"
            value={newCustomer.taxNumber}
            onChange={(e) => setNewCustomer({...newCustomer, taxNumber: e.target.value})}
            style={styles.input}
            placeholder="例: T123456789012"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>💰</span>
            与信限度額 / Credit Limit (JPY)
          </label>
          <input
            type="number"
            value={newCustomer.creditLimit}
            onChange={(e) => setNewCustomer({...newCustomer, creditLimit: e.target.value})}
            style={styles.input}
            placeholder="例: 1000000"
            disabled={loading}
          />
        </div>

        {/* Address Section */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📍</span>
            郵便番号 / Postal Code
          </label>
          <input
            type="text"
            value={newCustomer.postalCode}
            onChange={(e) => setNewCustomer({...newCustomer, postalCode: e.target.value})}
            style={styles.input}
            placeholder="例: 100-0001"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏛️</span>
            都道府県 / Prefecture
          </label>
          <input
            type="text"
            value={newCustomer.prefecture}
            onChange={(e) => setNewCustomer({...newCustomer, prefecture: e.target.value})}
            style={styles.input}
            placeholder="例: 東京都"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏙️</span>
            市区町村 / City
          </label>
          <input
            type="text"
            value={newCustomer.city}
            onChange={(e) => setNewCustomer({...newCustomer, city: e.target.value})}
            style={styles.input}
            placeholder="例: 千代田区"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏠</span>
            丁目・番地 / Street Address
          </label>
          <input
            type="text"
            value={newCustomer.streetAddress}
            onChange={(e) => setNewCustomer({...newCustomer, streetAddress: e.target.value})}
            style={styles.input}
            placeholder="例: 大手町1-1"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏢</span>
            建物名・部屋番号 / Building & Room
          </label>
          <input
            type="text"
            value={newCustomer.building}
            onChange={(e) => setNewCustomer({...newCustomer, building: e.target.value})}
            style={styles.input}
            placeholder="例: 〇〇ビル 3階"
            disabled={loading}
          />
        </div>

        {/* Payment Terms */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>💰</span>
            支払条件 / Payment Terms
          </label>
          <select
            value={newCustomer.paymentTermsType}
            onChange={(e) => setNewCustomer({...newCustomer, paymentTermsType: e.target.value})}
            style={styles.select}
            disabled={loading}
          >
            <option value="cod">💰 現金払い / Cash on Delivery</option>
            <option value="net7">📅 Net 7 Days (7日以内)</option>
            <option value="net15">📅 Net 15 Days (15日以内)</option>
            <option value="net30">📅 Net 30 Days (30日以内)</option>
            <option value="net45">📅 Net 45 Days (45日以内)</option>
            <option value="net60">📅 Net 60 Days (60日以内)</option>
            <option value="custom">📝 カスタム / Custom</option>
          </select>
        </div>

        {newCustomer.paymentTermsType === 'custom' && (
          <div style={styles.formGroup}>
            <label style={styles.label}>
              <span>📅</span>
              カスタム支払日 / Custom Payment Date
            </label>
            <input
              type="text"
              value={newCustomer.customPaymentDate}
              onChange={(e) => setNewCustomer({...newCustomer, customPaymentDate: e.target.value})}
              style={styles.input}
              placeholder="例: 毎月15日"
              disabled={loading}
            />
          </div>
        )}

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>💳</span>
            支払方法 / Payment Method
          </label>
          <select
            value={newCustomer.paymentMethod}
            onChange={(e) => setNewCustomer({...newCustomer, paymentMethod: e.target.value})}
            style={styles.select}
            disabled={loading}
          >
            {paymentMethodOptions.map(method => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📝</span>
            備考 / Notes
          </label>
          <textarea
            value={newCustomer.notes}
            onChange={(e) => setNewCustomer({...newCustomer, notes: e.target.value})}
            style={styles.textarea}
            placeholder="特記事項があれば記入してください"
            disabled={loading}
          />
        </div>
      </div>

      <div style={styles.buttonGroup}>
        <button 
          type="submit" 
          style={styles.submitButton}
          disabled={loading}
        >
          {loading ? '登録中...' : '✅ 顧客を登録 / Register Customer'}
        </button>
      </div>
    </form>
  );

  const renderSupplierForm = () => (
    <form onSubmit={handleRegisterSupplier} style={styles.formContainer}>
      <h3 style={styles.formTitle}>
        <span style={{color: '#f59e0b'}}>🏭</span>
        仕入先新規登録 / New Supplier Registration
      </h3>
      
      <div style={styles.formGrid}>
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏢</span>
            仕入先名 / Supplier Name <span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            value={newSupplier.name}
            onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
            style={styles.input}
            placeholder="例: 〇〇食品株式会社"
            required
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>👤</span>
            担当者名 / Contact Person
          </label>
          <input
            type="text"
            value={newSupplier.contactPerson}
            onChange={(e) => setNewSupplier({...newSupplier, contactPerson: e.target.value})}
            style={styles.input}
            placeholder="例: 田中 次郎"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📱</span>
            携帯電話 / Mobile Number
          </label>
          <input
            type="tel"
            value={newSupplier.mobileNumber}
            onChange={(e) => setNewSupplier({...newSupplier, mobileNumber: e.target.value})}
            style={styles.input}
            placeholder="090-1234-5678"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📞</span>
            固定電話 / Landline Number
          </label>
          <input
            type="tel"
            value={newSupplier.landlineNumber}
            onChange={(e) => setNewSupplier({...newSupplier, landlineNumber: e.target.value})}
            style={styles.input}
            placeholder="03-1234-5678"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📧</span>
            メールアドレス / Email
          </label>
          <input
            type="email"
            value={newSupplier.email}
            onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})}
            style={styles.input}
            placeholder="contact@supplier.com"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏷️</span>
            仕入先タイプ / Supplier Type
          </label>
          <select
            value={newSupplier.supplierType}
            onChange={(e) => setNewSupplier({...newSupplier, supplierType: e.target.value})}
            style={styles.select}
            disabled={loading}
          >
            <option value="food">🥦 食品 / Food</option>
            <option value="beverage">🥤 飲料 / Beverage</option>
            <option value="packaging">📦 包装資材 / Packaging</option>
            <option value="equipment">🔧 設備 / Equipment</option>
            <option value="cleaning">🧼 清掃用品 / Cleaning</option>
            <option value="office">📎 事務用品 / Office Supplies</option>
            <option value="other">🔧 その他 / Other</option>
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📋</span>
            税登録番号 / Tax Number
          </label>
          <input
            type="text"
            value={newSupplier.taxNumber}
            onChange={(e) => setNewSupplier({...newSupplier, taxNumber: e.target.value})}
            style={styles.input}
            placeholder="例: T123456789012"
            disabled={loading}
          />
        </div>

        {/* Address Section */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📍</span>
            郵便番号 / Postal Code
          </label>
          <input
            type="text"
            value={newSupplier.postalCode}
            onChange={(e) => setNewSupplier({...newSupplier, postalCode: e.target.value})}
            style={styles.input}
            placeholder="例: 100-0001"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏛️</span>
            都道府県 / Prefecture
          </label>
          <input
            type="text"
            value={newSupplier.prefecture}
            onChange={(e) => setNewSupplier({...newSupplier, prefecture: e.target.value})}
            style={styles.input}
            placeholder="例: 東京都"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏙️</span>
            市区町村 / City
          </label>
          <input
            type="text"
            value={newSupplier.city}
            onChange={(e) => setNewSupplier({...newSupplier, city: e.target.value})}
            style={styles.input}
            placeholder="例: 千代田区"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏠</span>
            丁目・番地 / Street Address
          </label>
          <input
            type="text"
            value={newSupplier.streetAddress}
            onChange={(e) => setNewSupplier({...newSupplier, streetAddress: e.target.value})}
            style={styles.input}
            placeholder="例: 大手町1-1"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏢</span>
            建物名・部屋番号 / Building & Room
          </label>
          <input
            type="text"
            value={newSupplier.building}
            onChange={(e) => setNewSupplier({...newSupplier, building: e.target.value})}
            style={styles.input}
            placeholder="例: 〇〇ビル 3階"
            disabled={loading}
          />
        </div>

        {/* Payment Terms */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>💰</span>
            支払条件 / Payment Terms
          </label>
          <select
            value={newSupplier.paymentTermsType}
            onChange={(e) => setNewSupplier({...newSupplier, paymentTermsType: e.target.value})}
            style={styles.select}
            disabled={loading}
          >
            <option value="cod">💰 現金払い / Cash on Delivery</option>
            <option value="net7">📅 Net 7 Days (7日以内)</option>
            <option value="net15">📅 Net 15 Days (15日以内)</option>
            <option value="net30">📅 Net 30 Days (30日以内)</option>
            <option value="net45">📅 Net 45 Days (45日以内)</option>
            <option value="net60">📅 Net 60 Days (60日以内)</option>
            <option value="custom">📝 カスタム / Custom</option>
          </select>
        </div>

        {newSupplier.paymentTermsType === 'net' && (
          <div style={styles.formGroup}>
            <label style={styles.label}>
              <span>📅</span>
              支払日数 / Payment Days
            </label>
            <select
              value={newSupplier.paymentDays}
              onChange={(e) => setNewSupplier({...newSupplier, paymentDays: parseInt(e.target.value)})}
              style={styles.select}
              disabled={loading}
            >
              <option value="7">7日 / 7 Days</option>
              <option value="15">15日 / 15 Days</option>
              <option value="30">30日 / 30 Days</option>
              <option value="45">45日 / 45 Days</option>
              <option value="60">60日 / 60 Days</option>
              <option value="90">90日 / 90 Days</option>
            </select>
          </div>
        )}

        {newSupplier.paymentTermsType === 'custom' && (
          <div style={styles.formGroup}>
            <label style={styles.label}>
              <span>📅</span>
              カスタム支払日 / Custom Payment Date
            </label>
            <input
              type="text"
              value={newSupplier.customPaymentDate}
              onChange={(e) => setNewSupplier({...newSupplier, customPaymentDate: e.target.value})}
              style={styles.input}
              placeholder="例: 毎月15日"
              disabled={loading}
            />
          </div>
        )}

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>💳</span>
            支払方法 / Payment Method
          </label>
          <select
            value={newSupplier.paymentMethod}
            onChange={(e) => setNewSupplier({...newSupplier, paymentMethod: e.target.value})}
            style={styles.select}
            disabled={loading}
          >
            {paymentMethodOptions.map(method => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📝</span>
            備考 / Notes
          </label>
          <textarea
            value={newSupplier.notes}
            onChange={(e) => setNewSupplier({...newSupplier, notes: e.target.value})}
            style={styles.textarea}
            placeholder="特記事項があれば記入してください"
            disabled={loading}
          />
        </div>
      </div>

      <div style={styles.buttonGroup}>
        <button 
          type="submit" 
          style={styles.submitButton}
          disabled={loading}
        >
          {loading ? '登録中...' : '✅ 仕入先を登録 / Register Supplier'}
        </button>
      </div>
    </form>
  );

  const renderProductForm = () => (
    <form onSubmit={handleRegisterProduct} style={styles.formContainer}>
      <h3 style={styles.formTitle}>
        <span style={{color: '#8b5cf6'}}>📦</span>
        商品新規登録 / New Product Registration
      </h3>
      
      <div style={styles.formGrid}>
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏷️</span>
            商品名 / Product Name <span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            value={newProduct.name}
            onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
            style={styles.input}
            placeholder="例: りんご"
            required
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📂</span>
            メインカテゴリー / Main Category <span style={styles.required}>*</span>
          </label>
          <div style={{display: 'flex', gap: '10px'}}>
            <select
              value={newProduct.mainCategory}
              onChange={(e) => setNewProduct({...newProduct, mainCategory: e.target.value})}
              style={styles.select}
              required
              disabled={loading}
            >
              <option value="">-- 選択してください / Select --</option>
              {activeCategories.map(category => (
                <option key={category.id} value={category.name}>
                  {category.name} ({category.type === 'food' ? '食品' : '非食品'})
                </option>
              ))}
            </select>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setShowCategoryManager(true)}
              disabled={loading}
            >
              📁 カテゴリー管理
            </button>
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📁</span>
            サブカテゴリー / Sub Category
          </label>
          <select
            value={newProduct.subCategory}
            onChange={(e) => setNewProduct({...newProduct, subCategory: e.target.value})}
            style={styles.select}
            disabled={!newProduct.mainCategory || loading}
          >
            <option value="">-- 選択してください / Select --</option>
            {getSubCategoriesForCategory(newProduct.mainCategory).map(sub => (
              <option key={sub.id} value={sub.name}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📏</span>
            商品タイプ / Product Type
          </label>
          <select
            value={newProduct.type}
            onChange={(e) => setNewProduct({...newProduct, type: e.target.value})}
            style={styles.select}
            disabled={loading}
          >
            <option value="weight">⚖️ 重量販売 / Weight-based</option>
            <option value="volume">🧪 容量販売 / Volume-based</option>
            <option value="quantity">🔢 個数販売 / Quantity-based</option>
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📊</span>
            単位 / Unit
          </label>
          <select
            value={newProduct.unit}
            onChange={(e) => setNewProduct({...newProduct, unit: e.target.value})}
            style={styles.select}
            disabled={loading}
          >
            {getUnitsForType(newProduct.type).map(unit => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📦</span>
            単位サイズ / Unit Size
          </label>
          <input
            type="text"
            value={newProduct.unitSize}
            onChange={(e) => setNewProduct({...newProduct, unitSize: e.target.value})}
            style={styles.input}
            placeholder="例: 1kg, 500ml, 12個入り"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>💰</span>
            仕入価格 / Purchase Price (JPY) <span style={styles.required}>*</span>
          </label>
          <input
            type="number"
            value={newProduct.price}
            onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
            style={styles.input}
            placeholder="例: 1000"
            required
            min="0"
            step="0.01"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>💰</span>
            販売価格 / Selling Price (JPY) <span style={styles.required}>*</span>
          </label>
          <input
            type="number"
            value={newProduct.sellPrice}
            onChange={(e) => setNewProduct({...newProduct, sellPrice: e.target.value})}
            style={styles.input}
            placeholder="例: 1500"
            required
            min="0"
            step="0.01"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📋</span>
            消費税率 / Tax Rate (%)
          </label>
          <select
            value={newProduct.taxRate}
            onChange={(e) => setNewProduct({...newProduct, taxRate: parseInt(e.target.value)})}
            style={styles.select}
            disabled={loading}
          >
            <option value="8">8% (軽減税率)</option>
            <option value="10">10% (標準税率)</option>
            <option value="0">0% (非課税)</option>
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📊</span>
            現在在庫 / Current Stock
          </label>
          <input
            type="number"
            value={newProduct.currentStock}
            onChange={(e) => setNewProduct({...newProduct, currentStock: parseFloat(e.target.value) || 0})}
            style={styles.input}
            placeholder="例: 100"
            min="0"
            step="0.001"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>⚠️</span>
            在庫下限 / Stock Lower Limit
          </label>
          <input
            type="number"
            value={newProduct.stockLowerLimit}
            onChange={(e) => setNewProduct({...newProduct, stockLowerLimit: e.target.value})}
            style={styles.input}
            placeholder="例: 10"
            min="0"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🏭</span>
            仕入先 / Supplier
          </label>
          <select
            value={newProduct.supplierId}
            onChange={(e) => setNewProduct({...newProduct, supplierId: e.target.value})}
            style={styles.select}
            disabled={loading}
          >
            <option value="">-- 選択してください / Select --</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📱</span>
            バーコード / Barcode
          </label>
          <input
            type="text"
            value={newProduct.barcode}
            onChange={(e) => setNewProduct({...newProduct, barcode: e.target.value})}
            style={styles.input}
            placeholder="例: 4902102100000"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>🔢</span>
            SKUコード / SKU Code
          </label>
          <input
            type="text"
            value={newProduct.sku}
            onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
            style={styles.input}
            placeholder="例: APPLE-RED-01"
            disabled={loading}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span>📝</span>
            商品説明 / Description
          </label>
          <textarea
            value={newProduct.description}
            onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
            style={styles.textarea}
            placeholder="商品の詳細な説明を記入してください"
            disabled={loading}
          />
        </div>
      </div>

      <div style={styles.buttonGroup}>
        <button 
          type="submit" 
          style={styles.submitButton}
          disabled={loading}
        >
          {loading ? '登録中...' : '✅ 商品を登録 / Register Product'}
        </button>
        
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() => setShowCategoryManager(true)}
          disabled={loading}
        >
          📁 カテゴリーを管理 / Manage Categories
        </button>
      </div>
    </form>
  );

  const renderCategoryManager = () => {
    if (!showCategoryManager) return null;

    return (
      <div style={styles.categoryManagerContainer}>
        <div style={styles.categoryManagerHeader}>
          <h4 style={styles.categoryManagerTitle}>
            <span style={{color: '#8b5cf6'}}>📁</span>
            カテゴリー管理 / Category Management
          </h4>
          <button
            type="button"
            style={styles.actionButton}
            onClick={() => setShowCategoryManager(false)}
          >
            ✕ 閉じる
          </button>
        </div>

        <div style={styles.categoryManagerTabs}>
          <button
            type="button"
            style={{
              ...styles.categoryTabButton,
              ...(categoryManagerTab === 'categories' ? styles.categoryTabButtonActive : {})
            }}
            onClick={() => setCategoryManagerTab('categories')}
          >
            📂 メインカテゴリー
          </button>
          <button
            type="button"
            style={{
              ...styles.categoryTabButton,
              ...(categoryManagerTab === 'subcategories' ? styles.categoryTabButtonActive : {})
            }}
            onClick={() => setCategoryManagerTab('subcategories')}
          >
            📁 サブカテゴリー
          </button>
        </div>

        {categoryManagerTab === 'categories' ? (
          <>
            <form onSubmit={editingCategory ? handleUpdateCategory : handleAddCategory}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span>🏷️</span>
                    カテゴリー名 / Category Name <span style={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                    style={styles.input}
                    placeholder="例: 野菜"
                    required
                    disabled={loading}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span>🏷️</span>
                    タイプ / Type
                  </label>
                  <select
                    value={newCategory.type}
                    onChange={(e) => setNewCategory({...newCategory, type: e.target.value})}
                    style={styles.select}
                    disabled={loading}
                  >
                    <option value="food">🥦 食品 / Food</option>
                    <option value="non-food">🔧 非食品 / Non-Food</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span>📝</span>
                    説明 / Description
                  </label>
                  <textarea
                    value={newCategory.description}
                    onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                    style={styles.textarea}
                    placeholder="カテゴリーの説明を記入してください"
                    disabled={loading}
                    rows={3}
                  />
                </div>
              </div>

              <div style={styles.buttonGroup}>
                <button 
                  type="submit" 
                  style={styles.submitButton}
                  disabled={loading}
                >
                  {loading ? '保存中...' : editingCategory ? '✅ カテゴリーを更新' : '✅ カテゴリーを追加'}
                </button>
                {editingCategory && (
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() => {
                      setEditingCategory(null);
                      setNewCategory({ name: '', type: 'food', description: '' });
                    }}
                  >
                    ✕ キャンセル
                  </button>
                )}
              </div>
            </form>

            <div style={styles.categoryList}>
              {categories.map(category => (
                <div key={category.id} style={styles.categoryCard}>
                  <div style={styles.categoryCardHeader}>
                    <span style={styles.categoryName}>{category.name}</span>
                    <span style={styles.categoryTypeBadge}>
                      {category.type === 'food' ? '食品' : '非食品'}
                    </span>
                  </div>
                  
                  {category.description && (
                    <p style={styles.categoryDescription}>{category.description}</p>
                  )}
                  
                  <div style={styles.statusBadge(category.isActive !== false)}>
                    {category.isActive !== false ? '有効' : '無効'}
                  </div>
                  
                  <div style={styles.categoryActions}>
                    <button
                      type="button"
                      style={{...styles.actionButton, ...styles.editButton}}
                      onClick={() => handleEditCategory(category.id)}
                      disabled={loading}
                    >
                      ✏️ 編集
                    </button>
                    <button
                      type="button"
                      style={{...styles.actionButton, ...styles.deleteButton}}
                      onClick={() => handleDeleteCategory(category.id)}
                      disabled={loading}
                    >
                      🗑️ 削除
                    </button>
                    <button
                      type="button"
                      style={styles.actionButton}
                      onClick={() => handleToggleCategoryStatus(category.id, category.isActive !== false)}
                      disabled={loading}
                    >
                      {category.isActive !== false ? '⏸️ 無効化' : '▶️ 有効化'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handleAddSubCategory}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span>🏷️</span>
                    サブカテゴリー名 / Subcategory Name <span style={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    value={newSubCategory.name}
                    onChange={(e) => setNewSubCategory({...newSubCategory, name: e.target.value})}
                    style={styles.input}
                    placeholder="例: 葉物野菜"
                    required
                    disabled={loading}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span>📂</span>
                    親カテゴリー / Parent Category <span style={styles.required}>*</span>
                  </label>
                  <select
                    value={newSubCategory.parentCategory}
                    onChange={(e) => setNewSubCategory({...newSubCategory, parentCategory: e.target.value})}
                    style={styles.select}
                    required
                    disabled={loading}
                  >
                    <option value="">-- 選択してください / Select --</option>
                    {activeCategories.map(category => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span>📝</span>
                    説明 / Description
                  </label>
                  <textarea
                    value={newSubCategory.description}
                    onChange={(e) => setNewSubCategory({...newSubCategory, description: e.target.value})}
                    style={styles.textarea}
                    placeholder="サブカテゴリーの説明を記入してください"
                    disabled={loading}
                    rows={3}
                  />
                </div>
              </div>

              <div style={styles.buttonGroup}>
                <button 
                  type="submit" 
                  style={styles.submitButton}
                  disabled={loading}
                >
                  {loading ? '保存中...' : '✅ サブカテゴリーを追加'}
                </button>
              </div>
            </form>

            <div style={styles.categoryList}>
              {subCategories.map(sub => {
                const parentCategory = categories.find(cat => cat.name === sub.parentCategory);
                return (
                  <div key={sub.id} style={styles.categoryCard}>
                    <div style={styles.categoryCardHeader}>
                      <span style={styles.categoryName}>{sub.name}</span>
                      {parentCategory && (
                        <span style={{...styles.categoryTypeBadge, backgroundColor: '#10b981'}}>
                          {parentCategory.name}
                        </span>
                      )}
                    </div>
                    
                    {sub.description && (
                      <p style={styles.categoryDescription}>{sub.description}</p>
                    )}
                    
                    <div style={styles.statusBadge(sub.isActive !== false)}>
                      {sub.isActive !== false ? '有効' : '無効'}
                    </div>
                    
                    <div style={styles.categoryActions}>
                      <button
                        type="button"
                        style={{...styles.actionButton, ...styles.deleteButton}}
                        onClick={() => handleDeleteSubCategory(sub.id)}
                        disabled={loading}
                      >
                        🗑️ 削除
                      </button>
                      <button
                        type="button"
                        style={styles.actionButton}
                        onClick={() => handleToggleSubCategoryStatus(sub.id, sub.isActive !== false)}
                        disabled={loading}
                      >
                        {sub.isActive !== false ? '⏸️ 無効化' : '▶️ 有効化'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderPostalCodeManager = () => {
    if (!showPostalCodeManager) return null;

    return (
      <div style={styles.postalCodeManagerContainer}>
        <div style={styles.categoryManagerHeader}>
          <h4 style={styles.categoryManagerTitle}>
            <span style={{color: '#3b82f6'}}>📍</span>
            郵便番号管理 / Postal Code Management
          </h4>
          <button
            type="button"
            style={styles.actionButton}
            onClick={() => setShowPostalCodeManager(false)}
          >
            ✕ 閉じる
          </button>
        </div>

        <form onSubmit={handleAddPostalCode}>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span>📍</span>
                郵便番号 / Postal Code <span style={styles.required}>*</span>
              </label>
              <input
                type="text"
                value={newPostalCode.postalCode}
                onChange={(e) => setNewPostalCode({...newPostalCode, postalCode: e.target.value})}
                style={styles.input}
                placeholder="例: 100-0001"
                required
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span>🏛️</span>
                都道府県 / Prefecture <span style={styles.required}>*</span>
              </label>
              <input
                type="text"
                value={newPostalCode.prefecture}
                onChange={(e) => setNewPostalCode({...newPostalCode, prefecture: e.target.value})}
                style={styles.input}
                placeholder="例: 東京都"
                required
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span>🏙️</span>
                市区町村 / City <span style={styles.required}>*</span>
              </label>
              <input
                type="text"
                value={newPostalCode.city}
                onChange={(e) => setNewPostalCode({...newPostalCode, city: e.target.value})}
                style={styles.input}
                placeholder="例: 千代田区"
                required
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                <span>🏠</span>
                町域・番地 / Street
              </label>
              <input
                type="text"
                value={newPostalCode.street}
                onChange={(e) => setNewPostalCode({...newPostalCode, street: e.target.value})}
                style={styles.input}
                placeholder="例: 大手町"
                disabled={loading}
              />
            </div>
          </div>

          <div style={styles.buttonGroup}>
            <button 
              type="submit" 
              style={styles.submitButton}
              disabled={loading}
            >
              {loading ? '保存中...' : '✅ 郵便番号を追加'}
            </button>
          </div>
        </form>

        <div style={styles.postalCodeGrid}>
          {postalCodes.map(postal => (
            <div key={postal.id} style={styles.postalCodeCard}>
              <h5 style={{color: '#e2e8f0', marginBottom: '10px'}}>
                📍 {postal.postalCode}
              </h5>
              <p style={{color: '#94a3b8', fontSize: '14px', marginBottom: '5px'}}>
                {postal.prefecture} {postal.city}
              </p>
              {postal.street && (
                <p style={{color: '#94a3b8', fontSize: '12px'}}>{postal.street}</p>
              )}
              <div style={styles.postalCodeActions}>
                <button
                  type="button"
                  style={{...styles.actionButton, ...styles.deleteButton}}
                  onClick={() => handleDeletePostalCode(postal.id)}
                  disabled={loading}
                >
                  🗑️ 削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span style={{color: '#3b82f6'}}>📒</span>
          台帳管理 / Ledger Management
        </h2>
        <p style={{color: '#94a3b8', fontSize: '14px', marginTop: '5px'}}>
          ドライバー、顧客、仕入先、商品の登録と管理
        </p>
      </div>

      {/* Navigation Tabs */}
      <div style={styles.navTabs}>
        <button
          type="button"
          style={{
            ...styles.tabButton,
            ...(activeSection === 'drivers' ? styles.tabButtonActive : {})
          }}
          onClick={() => setActiveSection('drivers')}
        >
          👨‍✈️ ドライバー / Drivers
        </button>
        <button
          type="button"
          style={{
            ...styles.tabButton,
            ...(activeSection === 'customers' ? styles.tabButtonActive : {})
          }}
          onClick={() => setActiveSection('customers')}
        >
          👥 顧客 / Customers
        </button>
        <button
          type="button"
          style={{
            ...styles.tabButton,
            ...(activeSection === 'suppliers' ? styles.tabButtonActive : {})
          }}
          onClick={() => setActiveSection('suppliers')}
        >
          🏭 仕入先 / Suppliers
        </button>
        <button
          type="button"
          style={{
            ...styles.tabButton,
            ...(activeSection === 'products' ? styles.tabButtonActive : {})
          }}
          onClick={() => setActiveSection('products')}
        >
          📦 商品 / Products
        </button>
      </div>

      {/* Category Manager */}
      {renderCategoryManager()}

      {/* Postal Code Manager */}
      {renderPostalCodeManager()}

      {/* Current Form */}
      {activeSection === 'drivers' && renderDriverForm()}
      {activeSection === 'customers' && renderCustomerForm()}
      {activeSection === 'suppliers' && renderSupplierForm()}
      {activeSection === 'products' && renderProductForm()}

      {/* Stats Overview */}
      <div style={styles.statsCard}>
        <h4 style={{color: '#e2e8f0', marginBottom: '15px'}}>
          📊 統計概要 / Statistics Overview
        </h4>
        <div style={styles.statsGrid}>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{drivers.length}</div>
            <div style={styles.statLabel}>ドライバー / Drivers</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{customers.length}</div>
            <div style={styles.statLabel}>顧客 / Customers</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{suppliers.length}</div>
            <div style={styles.statLabel}>仕入先 / Suppliers</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{products.length}</div>
            <div style={styles.statLabel}>商品 / Products</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{categories.length}</div>
            <div style={styles.statLabel}>カテゴリー / Categories</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{subCategories.length}</div>
            <div style={styles.statLabel}>サブカテゴリー / Subcategories</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LedgerTab;