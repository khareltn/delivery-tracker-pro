// src/components/RegistrationTab.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { db, functions } from '../firebase'; // Import functions
import { httpsCallable } from 'firebase/functions'; // Import httpsCallable
import { doc, setDoc, getDocs, query, where, collection, serverTimestamp } from 'firebase/firestore';

const RegistrationTab = ({ currentUser, company, loadUsersData, logActivity, defaultType = 'driver' }) => {
  const [activeRegistrationTab, setActiveRegistrationTab] = useState(defaultType);
  const [creatingUser, setCreatingUser] = useState(false);
  const [error, setError] = useState('');
  const [postalCodes, setPostalCodes] = useState([]);
  const [filteredPostalCodes, setFilteredPostalCodes] = useState([]);
  const [loadingPostalCodes, setLoadingPostalCodes] = useState(false);
  const [postalSearchTerm, setPostalSearchTerm] = useState('');
  const [selectedPostalCode, setSelectedPostalCode] = useState(null);

  // Form states
  const [driverForm, setDriverForm] = useState({
    name: '',
    mobileNumber: '', // Mobile for driver
    password: '',
    email: '',
    phone: '', // Additional phone
    address: '',
    vehicleNumber: '',
    licenseNumber: '',
    salary: '',
    joiningDate: ''
  });
  
  // Restaurant Customer Form - Using landline
  const [restaurantForm, setRestaurantForm] = useState({
    restaurantName: '',
    contactPerson: '',
    landlineNumber: '', // Landline for restaurant
    customerId: '',
    password: '',
    email: '',
    phone: '', // Additional phone
    address: '',
    postalCode: '',
    prefecture: '',
    city: '',
    town: '',
    buildingName: '',
    restaurantType: 'restaurant',
    businessRegistrationNumber: '',
    paymentOption: 'cod',
    paymentTerms: '30days',
    creditLimit: '',
    deliveryInstructions: '',
    specialNotes: '',
    familyMembers: [{ 
      name: '', 
      relation: '', 
      phone: '' 
    }]
  });
  
  // Supplier Form - Using landline
  const [supplierForm, setSupplierForm] = useState({
    businessName: '',
    contactPerson: '',
    landlineNumber: '', // Landline for supplier
    supplierId: '',
    password: '',
    email: '',
    phone: '', // Additional phone
    address: '',
    postalCode: '',
    prefecture: '',
    city: '',
    town: '',
    buildingName: '',
    businessRegistrationNumber: '',
    bankAccount: '',
    bankName: '',
    branchName: '',
    paymentOption: 'cod',
    paymentTerms: '30days',
    supplyType: '',
    website: '',
    notes: ''
  });

  // Load postal codes on component mount
  useEffect(() => {
    loadPostalCodes();
  }, []);

  // Auto-generate customer ID from landline number
  useEffect(() => {
    if (restaurantForm.landlineNumber && restaurantForm.landlineNumber.replace(/\D/g, '').length >= 10) {
      const cleanNumber = restaurantForm.landlineNumber.replace(/\D/g, '');
      const customerId = `REST${cleanNumber.slice(-10)}`;
      setRestaurantForm(prev => ({
        ...prev,
        customerId
      }));
    }
  }, [restaurantForm.landlineNumber]);

  // Auto-generate supplier ID from landline number
  useEffect(() => {
    if (supplierForm.landlineNumber && supplierForm.landlineNumber.replace(/\D/g, '').length >= 10) {
      const cleanNumber = supplierForm.landlineNumber.replace(/\D/g, '');
      const supplierId = `SUPP${cleanNumber.slice(-10)}`;
      setSupplierForm(prev => ({
        ...prev,
        supplierId
      }));
    }
  }, [supplierForm.landlineNumber]);

  // Load postal codes from JSON file
  const loadPostalCodes = async () => {
    try {
      setLoadingPostalCodes(true);
      const response = await fetch('/postal_codes.json');
      if (!response.ok) {
        throw new Error('Failed to load postal codes');
      }
      const data = await response.json();
      setPostalCodes(data);
      setFilteredPostalCodes([]); // Don't show all initially
    } catch (error) {
      console.error('Error loading postal codes:', error);
      toast.error('Failed to load postal code data');
    } finally {
      setLoadingPostalCodes(false);
    }
  };

  // Search postal codes
  const searchPostalCodes = (searchTerm) => {
    setPostalSearchTerm(searchTerm);
    
    if (!searchTerm || searchTerm.length < 3) {
      setFilteredPostalCodes([]);
      return;
    }
    
    const searchNum = searchTerm.replace(/[^0-9]/g, '');
    
    let filtered = [];
    
    if (searchNum.length >= 3) {
      // Search by postal code (Japanese format: 0600000)
      filtered = postalCodes.filter(code => 
        code.postal_code.includes(searchNum)
      );
    }
    
    // Also search by city/town/prefecture if needed
    if (filtered.length < 10 && searchTerm.length >= 2) {
      const textSearch = postalCodes.filter(code => 
        code.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.town.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.prefecture.toLowerCase().includes(searchTerm.toLowerCase())
      );
      filtered = [...filtered, ...textSearch];
    }
    
    // Remove duplicates
    const uniqueFiltered = filtered.filter((code, index, self) =>
      index === self.findIndex((c) => c.postal_code === code.postal_code)
    );
    
    setFilteredPostalCodes(uniqueFiltered.slice(0, 20));
  };

  // Select postal code
  const selectPostalCode = (code, formType) => {
    setSelectedPostalCode(code);
    
    // Format address in Japanese style
    const formattedAddress = `${code.prefecture} ${code.city} ${code.town}`;
    
    if (formType === 'restaurant') {
      setRestaurantForm(prev => ({
        ...prev,
        postalCode: code.postal_code,
        prefecture: code.prefecture,
        city: code.city,
        town: code.town,
        address: formattedAddress
      }));
    } else if (formType === 'supplier') {
      setSupplierForm(prev => ({
        ...prev,
        postalCode: code.postal_code,
        prefecture: code.prefecture,
        city: code.city,
        town: code.town,
        address: formattedAddress
      }));
    }
    
    setFilteredPostalCodes([]);
    setPostalSearchTerm('');
  };

  // Handle form changes
  const handleDriverFormChange = (e) => {
    setDriverForm({
      ...driverForm,
      [e.target.name]: e.target.value
    });
  };

  const handleRestaurantFormChange = (e) => {
    const { name, value } = e.target;
    setRestaurantForm(prev => ({
      ...prev,
      [name]: value
    }));

    // If payment option changes to COD, reset payment terms
    if (name === 'paymentOption' && value === 'cod') {
      setRestaurantForm(prev => ({
        ...prev,
        paymentTerms: '0'
      }));
    }
  };

  const handleSupplierFormChange = (e) => {
    const { name, value } = e.target;
    setSupplierForm(prev => ({
      ...prev,
      [name]: value
    }));

    // If payment option changes to COD, reset payment terms
    if (name === 'paymentOption' && value === 'cod') {
      setSupplierForm(prev => ({
        ...prev,
        paymentTerms: '0'
      }));
    }
  };

  // Handle family member changes
  const handleFamilyMemberChange = (index, field, value) => {
    const updatedFamilyMembers = [...restaurantForm.familyMembers];
    updatedFamilyMembers[index][field] = value;
    setRestaurantForm(prev => ({
      ...prev,
      familyMembers: updatedFamilyMembers
    }));
  };

  // Add new family member
  const addFamilyMember = () => {
    setRestaurantForm(prev => ({
      ...prev,
      familyMembers: [...prev.familyMembers, { 
        name: '', 
        relation: '', 
        phone: '' 
      }]
    }));
  };

  // Remove family member
  const removeFamilyMember = (index) => {
    const updatedFamilyMembers = [...restaurantForm.familyMembers];
    updatedFamilyMembers.splice(index, 1);
    setRestaurantForm(prev => ({
      ...prev,
      familyMembers: updatedFamilyMembers
    }));
  };

  // Validation functions
  const validateMobileNumber = (mobileNumber) => {
    // Japanese mobile number format: 10-11 digits starting with 0
    const mobileRegex = /^0[0-9]{9,10}$/;
    return mobileRegex.test(mobileNumber);
  };

  const validateLandlineNumber = (landlineNumber) => {
    // Japanese landline format: Area code + local number
    // Example: 03-1234-5678 or 011-123-4567
    const landlineRegex = /^0\d{1,4}-\d{1,4}-\d{3,4}$/;
    return landlineRegex.test(landlineNumber);
  };

  const cleanPhoneNumber = (phoneNumber) => {
    // Remove all non-digit characters
    return phoneNumber.replace(/\D/g, '');
  };

  const checkPhoneNumberExists = async (phoneNumber, role) => {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('mobileNumber', '==', phoneNumber),
        where('role', '==', role)
      );
      const querySnapshot = await getDocs(usersQuery);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking phone number:', error);
      return false;
    }
  };

  const generateEmail = (phoneNumber, role) => {
    const cleanNumber = cleanPhoneNumber(phoneNumber);
    return `${role}.${cleanNumber}@${company?.id || 'company'}.com`;
  };

  // Format Japanese address
  const formatJapaneseAddress = (postalCode, prefecture, city, town, buildingName) => {
    let address = `〒${postalCode} ${prefecture} ${city} ${town}`;
    if (buildingName) {
      address += ` ${buildingName}`;
    }
    return address;
  };

  // Create user using Cloud Function
  const createUserAccount = async (userData) => {
    try {
      const email = userData.email || generateEmail(
        userData.phoneNumber || userData.mobileNumber || userData.landlineNumber, 
        userData.role
      );
      const password = userData.password;
      const role = userData.role;
      const companyId = company.id;

      // Call the cloud function
      const createUserWithRole = httpsCallable(functions, 'createUserWithRole');
      
      const result = await createUserWithRole({
        email: email,
        password: password,
        role: role,
        companyId: companyId,
        userData: {
          ...userData,
          email: email,
          createdBy: currentUser?.email,
          createdById: currentUser?.uid,
          createdByRole: 'operator',
          status: 'active',
          fyId: company.financialYear || '2026_2026',
          companyName: company.name || 'Unknown Company',
          // Add timestamp on server side
        }
      });

      if (result.data.success) {
        toast.success(`✅ ${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully!`);
        
        // Log activity
        await logActivity(`${role.toUpperCase()}_CREATED`, role, {
          userName: userData.name || userData.restaurantName || userData.businessName,
          mobileNumber: userData.mobileNumber || userData.landlineNumber,
          email: email,
          userId: result.data.userId
        });

        // Refresh users list
        await loadUsersData();

        return { success: true, userId: result.data.userId };
      } else {
        throw new Error(result.data.message || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user account:', error);
      throw error;
    }
  };

  // Handle Driver Registration
  const handleDriverRegistration = async (e) => {
    e.preventDefault();
    setError('');

    if (!driverForm.name || !driverForm.mobileNumber || !driverForm.password) {
      setError('Name, mobile number and password are required');
      return;
    }

    if (!validateMobileNumber(driverForm.mobileNumber)) {
      setError('Please enter a valid mobile number (Japanese format: 09012345678)');
      return;
    }

    if (driverForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setCreatingUser(true);

    try {
      const cleanMobile = cleanPhoneNumber(driverForm.mobileNumber);
      
      // Check if mobile number exists for drivers
      const phoneExists = await checkPhoneNumberExists(cleanMobile, 'driver');
      if (phoneExists) {
        setError('Mobile number already registered for a driver. Please use a different number.');
        setCreatingUser(false);
        return;
      }

      const driverData = {
        name: driverForm.name,
        mobileNumber: driverForm.mobileNumber,
        password: driverForm.password,
        role: 'driver',
        companyId: company.id,
        phone: driverForm.phone || driverForm.mobileNumber,
        email: driverForm.email || generateEmail(driverForm.mobileNumber, 'driver'),
        address: driverForm.address || '',
        vehicleNumber: driverForm.vehicleNumber || '',
        licenseNumber: driverForm.licenseNumber || '',
        salary: driverForm.salary || '',
        joiningDate: driverForm.joiningDate || '',
      };

      // Create driver account using cloud function
      const result = await createUserAccount(driverData);
      
      if (result.success) {
        // Reset form on success
        setDriverForm({
          name: '',
          mobileNumber: '',
          password: '',
          email: '',
          phone: '',
          address: '',
          vehicleNumber: '',
          licenseNumber: '',
          salary: '',
          joiningDate: ''
        });
      }
      
    } catch (error) {
      console.error('Driver registration error:', error);
      setError(`Failed to register driver: ${error.message}`);
      toast.error(`Failed to register driver: ${error.message}`);
    } finally {
      setCreatingUser(false);
    }
  };

  // Handle Restaurant Registration
  const handleRestaurantRegistration = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!restaurantForm.restaurantName || !restaurantForm.contactPerson || !restaurantForm.landlineNumber || !restaurantForm.password) {
      setError('Restaurant name, contact person, landline number and password are required');
      return;
    }

    if (!validateLandlineNumber(restaurantForm.landlineNumber)) {
      setError('Please enter a valid landline number (Format: 03-1234-5678)');
      return;
    }

    if (restaurantForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    // Validate postal code if provided
    if (restaurantForm.postalCode && !/^\d{7}$/.test(restaurantForm.postalCode)) {
      setError('Postal code must be 7 digits');
      return;
    }

    setCreatingUser(true);

    try {
      const cleanLandline = cleanPhoneNumber(restaurantForm.landlineNumber);
      
      // Check if landline number exists for customers
      const phoneExists = await checkPhoneNumberExists(cleanLandline, 'customer');
      if (phoneExists) {
        setError('Landline number already registered for a customer. Please use a different number.');
        setCreatingUser(false);
        return;
      }

      // Format Japanese address
      const japaneseAddress = formatJapaneseAddress(
        restaurantForm.postalCode,
        restaurantForm.prefecture,
        restaurantForm.city,
        restaurantForm.town,
        restaurantForm.buildingName
      );

      // Prepare restaurant data
      const restaurantData = {
        name: restaurantForm.restaurantName,
        contactPerson: restaurantForm.contactPerson,
        landlineNumber: restaurantForm.landlineNumber,
        mobileNumber: cleanLandline, // Store for backward compatibility
        customerId: restaurantForm.customerId,
        password: restaurantForm.password,
        role: 'customer',
        customerType: 'restaurant',
        companyId: company.id,
        phone: restaurantForm.phone || restaurantForm.landlineNumber,
        email: restaurantForm.email || generateEmail(restaurantForm.landlineNumber, 'customer'),
        address: restaurantForm.address || japaneseAddress,
        postalCode: restaurantForm.postalCode,
        prefecture: restaurantForm.prefecture,
        city: restaurantForm.city,
        town: restaurantForm.town,
        buildingName: restaurantForm.buildingName || '',
        restaurantType: restaurantForm.restaurantType,
        businessRegistrationNumber: restaurantForm.businessRegistrationNumber || '',
        paymentOption: restaurantForm.paymentOption,
        paymentTerms: restaurantForm.paymentOption === 'cod' ? '0' : restaurantForm.paymentTerms,
        creditLimit: restaurantForm.creditLimit || '0',
        deliveryInstructions: restaurantForm.deliveryInstructions || '',
        specialNotes: restaurantForm.specialNotes || '',
        familyMembers: restaurantForm.familyMembers.filter(member => member.name.trim() !== ''),
      };

      // Create restaurant account using cloud function
      const result = await createUserAccount(restaurantData);
      
      if (result.success) {
        // Reset form on success
        setRestaurantForm({
          restaurantName: '',
          contactPerson: '',
          landlineNumber: '',
          customerId: '',
          password: '',
          email: '',
          phone: '',
          address: '',
          postalCode: '',
          prefecture: '',
          city: '',
          town: '',
          buildingName: '',
          restaurantType: 'restaurant',
          businessRegistrationNumber: '',
          paymentOption: 'cod',
          paymentTerms: '30days',
          creditLimit: '',
          deliveryInstructions: '',
          specialNotes: '',
          familyMembers: [{ name: '', relation: '', phone: '' }]
        });
        setSelectedPostalCode(null);
      }
      
    } catch (error) {
      console.error('Restaurant registration error:', error);
      setError(`Failed to register restaurant: ${error.message}`);
      toast.error(`Failed to register restaurant: ${error.message}`);
    } finally {
      setCreatingUser(false);
    }
  };

  // Handle Supplier Registration
  const handleSupplierRegistration = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!supplierForm.businessName || !supplierForm.contactPerson || !supplierForm.landlineNumber || !supplierForm.password) {
      setError('Business name, contact person, landline number and password are required');
      return;
    }

    if (!validateLandlineNumber(supplierForm.landlineNumber)) {
      setError('Please enter a valid landline number (Format: 03-1234-5678)');
      return;
    }

    if (supplierForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    // Validate postal code if provided
    if (supplierForm.postalCode && !/^\d{7}$/.test(supplierForm.postalCode)) {
      setError('Postal code must be 7 digits');
      return;
    }

    setCreatingUser(true);

    try {
      const cleanLandline = cleanPhoneNumber(supplierForm.landlineNumber);
      
      // Check if landline number exists for suppliers
      const phoneExists = await checkPhoneNumberExists(cleanLandline, 'supplier');
      if (phoneExists) {
        setError('Landline number already registered for a supplier. Please use a different number.');
        setCreatingUser(false);
        return;
      }

      // Format Japanese address
      const japaneseAddress = formatJapaneseAddress(
        supplierForm.postalCode,
        supplierForm.prefecture,
        supplierForm.city,
        supplierForm.town,
        supplierForm.buildingName
      );

      // Prepare supplier data
      const supplierData = {
        name: supplierForm.businessName,
        contactPerson: supplierForm.contactPerson,
        landlineNumber: supplierForm.landlineNumber,
        mobileNumber: cleanLandline, // Store for backward compatibility
        supplierId: supplierForm.supplierId,
        password: supplierForm.password,
        role: 'supplier',
        companyId: company.id,
        phone: supplierForm.phone || supplierForm.landlineNumber,
        email: supplierForm.email || generateEmail(supplierForm.landlineNumber, 'supplier'),
        address: supplierForm.address || japaneseAddress,
        postalCode: supplierForm.postalCode,
        prefecture: supplierForm.prefecture,
        city: supplierForm.city,
        town: supplierForm.town,
        buildingName: supplierForm.buildingName || '',
        businessRegistrationNumber: supplierForm.businessRegistrationNumber || '',
        bankAccount: supplierForm.bankAccount || '',
        bankName: supplierForm.bankName || '',
        branchName: supplierForm.branchName || '',
        paymentOption: supplierForm.paymentOption,
        paymentTerms: supplierForm.paymentOption === 'cod' ? '0' : supplierForm.paymentTerms,
        supplyType: supplierForm.supplyType || '',
        website: supplierForm.website || '',
        notes: supplierForm.notes || '',
      };

      // Create supplier account using cloud function
      const result = await createUserAccount(supplierData);
      
      if (result.success) {
        // Reset form on success
        setSupplierForm({
          businessName: '',
          contactPerson: '',
          landlineNumber: '',
          supplierId: '',
          password: '',
          email: '',
          phone: '',
          address: '',
          postalCode: '',
          prefecture: '',
          city: '',
          town: '',
          buildingName: '',
          businessRegistrationNumber: '',
          bankAccount: '',
          bankName: '',
          branchName: '',
          paymentOption: 'cod',
          paymentTerms: '30days',
          supplyType: '',
          website: '',
          notes: ''
        });
        setSelectedPostalCode(null);
      }
      
    } catch (error) {
      console.error('Supplier registration error:', error);
      setError(`Failed to register supplier: ${error.message}`);
      toast.error(`Failed to register supplier: ${error.message}`);
    } finally {
      setCreatingUser(false);
    }
  };

  // Render Postal Code Search Component
  const renderPostalCodeSearch = (formType) => (
    <div style={styles.postalCodeSection}>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Search Postal Code *</label>
        <input
          type="text"
          placeholder="Enter postal code (7 digits) or area name"
          value={postalSearchTerm}
          onChange={(e) => searchPostalCodes(e.target.value)}
          style={styles.input}
          disabled={creatingUser || loadingPostalCodes}
        />
        <div style={styles.infoText}>
          Enter 3 or more digits of postal code or area name to search
        </div>
      </div>
      
      {selectedPostalCode && (
        <div style={styles.selectedPostalCode}>
          <strong>Selected Address:</strong> 
          <div>〒{selectedPostalCode.postal_code} {selectedPostalCode.prefecture} {selectedPostalCode.city} {selectedPostalCode.town}</div>
          <button 
            type="button" 
            onClick={() => {
              setSelectedPostalCode(null);
              if (formType === 'restaurant') {
                setRestaurantForm(prev => ({
                  ...prev,
                  postalCode: '',
                  prefecture: '',
                  city: '',
                  town: '',
                  address: ''
                }));
              } else if (formType === 'supplier') {
                setSupplierForm(prev => ({
                  ...prev,
                  postalCode: '',
                  prefecture: '',
                  city: '',
                  town: '',
                  address: ''
                }));
              }
            }}
            style={styles.clearButton}
          >
            Clear
          </button>
        </div>
      )}
      
      {loadingPostalCodes ? (
        <div style={styles.loading}>Loading postal codes...</div>
      ) : filteredPostalCodes.length > 0 ? (
        <div style={styles.postalCodeResults}>
          {filteredPostalCodes.map((code, index) => (
            <div
              key={`${code.postal_code}-${index}`}
              style={styles.postalCodeItem}
              onClick={() => selectPostalCode(code, formType)}
            >
              <div style={styles.postalCodeHeader}>
                <span style={styles.postalCode}>〒{code.postal_code}</span>
                <span style={styles.town}>{code.town}</span>
              </div>
              <div style={styles.postalCodeDetails}>
                <span style={styles.city}>{code.city}</span>
                <span style={styles.prefecture}>{code.prefecture}</span>
              </div>
            </div>
          ))}
        </div>
      ) : postalSearchTerm.length >= 3 ? (
        <div style={styles.noResults}>No postal codes found for "{postalSearchTerm}"</div>
      ) : null}
    </div>
  );

  // Render Driver Registration Form
  const renderDriverForm = () => (
    <form onSubmit={handleDriverRegistration} style={styles.form}>
      <h3 style={styles.formTitle}>Register New Driver</h3>
      
      <div style={styles.formGrid}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Full Name *</label>
          <input
            type="text"
            name="name"
            value={driverForm.name}
            onChange={handleDriverFormChange}
            style={styles.input}
            required
            placeholder="Enter driver's full name"
            disabled={creatingUser}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Mobile Number *</label>
          <input
            type="tel"
            name="mobileNumber"
            value={driverForm.mobileNumber}
            onChange={handleDriverFormChange}
            style={styles.input}
            required
            placeholder="09012345678"
            disabled={creatingUser}
            pattern="0[0-9]{9,10}"
          />
          <div style={styles.infoText}>
            Japanese mobile number format starting with 0. Driver will use this to login.
          </div>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Password *</label>
          <input
            type="password"
            name="password"
            value={driverForm.password}
            onChange={handleDriverFormChange}
            style={styles.input}
            required
            placeholder="Min. 6 characters"
            disabled={creatingUser}
            minLength="6"
          />
          <div style={styles.infoText}>
            Driver will use this password to login with their mobile number
          </div>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Vehicle Number</label>
          <input
            type="text"
            name="vehicleNumber"
            value={driverForm.vehicleNumber}
            onChange={handleDriverFormChange}
            style={styles.input}
            placeholder="Enter vehicle number"
            disabled={creatingUser}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>License Number</label>
          <input
            type="text"
            name="licenseNumber"
            value={driverForm.licenseNumber}
            onChange={handleDriverFormChange}
            style={styles.input}
            placeholder="Enter license number"
            disabled={creatingUser}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Salary (Monthly)</label>
          <input
            type="number"
            name="salary"
            value={driverForm.salary}
            onChange={handleDriverFormChange}
            style={styles.input}
            placeholder="Enter monthly salary"
            disabled={creatingUser}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Joining Date</label>
          <input
            type="date"
            name="joiningDate"
            value={driverForm.joiningDate}
            onChange={handleDriverFormChange}
            style={styles.input}
            disabled={creatingUser}
          />
        </div>
      </div>

      <div style={styles.inputGroup}>
        <label style={styles.label}>Address</label>
        <textarea
          name="address"
          value={driverForm.address}
          onChange={handleDriverFormChange}
          style={{ ...styles.input, minHeight: '80px' }}
          placeholder="Enter complete address"
          disabled={creatingUser}
          rows="3"
        />
      </div>

      <div style={styles.noteBox}>
        <strong>Login Instructions for Driver:</strong><br/>
        • Mobile: <strong>{driverForm.mobileNumber || '[mobile]'}</strong><br/>
        • Password: The password you set above<br/>
        • Driver will use the main login page to access their dashboard
      </div>

      <button 
        type="submit" 
        style={styles.submitButton}
        disabled={creatingUser}
      >
        {creatingUser ? 'Creating Driver Account...' : 'Create Driver Account'}
      </button>
    </form>
  );

  // Render Restaurant Registration Form
  const renderRestaurantForm = () => (
    <form onSubmit={handleRestaurantRegistration} style={styles.form}>
      <h3 style={styles.formTitle}>Register Restaurant Customer</h3>
      
      <div style={styles.formSection}>
        <h4 style={styles.sectionTitle}>Basic Information</h4>
        <div style={styles.formGrid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Restaurant Name *</label>
            <input
              type="text"
              name="restaurantName"
              value={restaurantForm.restaurantName}
              onChange={handleRestaurantFormChange}
              style={styles.input}
              required
              placeholder="Enter restaurant name"
              disabled={creatingUser}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Contact Person *</label>
            <input
              type="text"
              name="contactPerson"
              value={restaurantForm.contactPerson}
              onChange={handleRestaurantFormChange}
              style={styles.input}
              required
              placeholder="Main contact person"
              disabled={creatingUser}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Landline Number *</label>
            <input
              type="tel"
              name="landlineNumber"
              value={restaurantForm.landlineNumber}
              onChange={handleRestaurantFormChange}
              style={styles.input}
              required
              placeholder="03-1234-5678"
              disabled={creatingUser}
              pattern="0\d{1,4}-\d{1,4}-\d{3,4}"
            />
            <div style={styles.infoText}>
              Japanese landline number format (e.g., 03-1234-5678)
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Customer ID</label>
            <input
              type="text"
              name="customerId"
              value={restaurantForm.customerId}
              style={styles.input}
              disabled
              placeholder="Auto-generated from landline"
              readOnly
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password *</label>
            <input
              type="password"
              name="password"
              value={restaurantForm.password}
              onChange={handleRestaurantFormChange}
              style={styles.input}
              required
              placeholder="Min. 6 characters"
              disabled={creatingUser}
              minLength="6"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Restaurant Type</label>
            <select
              name="restaurantType"
              value={restaurantForm.restaurantType}
              onChange={handleRestaurantFormChange}
              style={styles.input}
              disabled={creatingUser}
            >
              <option value="restaurant">Restaurant</option>
              <option value="cafe">Cafe</option>
              <option value="hotel">Hotel Restaurant</option>
              <option value="izakaya">Izakaya</option>
              <option value="ramen">Ramen Shop</option>
              <option value="sushi">Sushi Restaurant</option>
              <option value="family">Family Restaurant</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div style={styles.formSection}>
        <h4 style={styles.sectionTitle}>Address Information</h4>
        {renderPostalCodeSearch('restaurant')}
        
        <div style={styles.formGrid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Postal Code *</label>
            <input
              type="text"
              name="postalCode"
              value={restaurantForm.postalCode}
              onChange={handleRestaurantFormChange}
              style={styles.input}
              required
              placeholder="0600000"
              disabled={creatingUser || selectedPostalCode}
              maxLength="7"
              pattern="[0-9]{7}"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Prefecture *</label>
            <input
              type="text"
              name="prefecture"
              value={restaurantForm.prefecture}
              onChange={handleRestaurantFormChange}
              style={styles.input}
              required
              placeholder="HOKKAIDO"
              disabled={creatingUser || selectedPostalCode}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>City *</label>
            <input
              type="text"
              name="city"
              value={restaurantForm.city}
              onChange={handleRestaurantFormChange}
              style={styles.input}
              required
              placeholder="SAPPORO SHI CHUO KU"
              disabled={creatingUser || selectedPostalCode}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Town *</label>
            <input
              type="text"
              name="town"
              value={restaurantForm.town}
              onChange={handleRestaurantFormChange}
              style={styles.input}
              required
              placeholder="ASAHIGAOKA"
              disabled={creatingUser || selectedPostalCode}
            />
          </div>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Building Name / Floor</label>
          <input
            type="text"
            name="buildingName"
            value={restaurantForm.buildingName}
            onChange={handleRestaurantFormChange}
            style={styles.input}
            placeholder="Building name, floor number"
            disabled={creatingUser}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Complete Address *</label>
          <textarea
            name="address"
            value={restaurantForm.address}
            onChange={handleRestaurantFormChange}
            style={{ ...styles.input, minHeight: '80px' }}
            required
            placeholder="Complete address will auto-fill from postal code search"
            disabled={creatingUser || selectedPostalCode}
            rows="3"
          />
        </div>
      </div>

      <div style={styles.formSection}>
        <h4 style={styles.sectionTitle}>Payment Information</h4>
        <div style={styles.formGrid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Payment Option *</label>
            <select
              name="paymentOption"
              value={restaurantForm.paymentOption}
              onChange={handleRestaurantFormChange}
              style={styles.input}
              required
              disabled={creatingUser}
            >
              <option value="cod">Cash on Delivery</option>
              <option value="monthly">Monthly Payment</option>
            </select>
          </div>

          {restaurantForm.paymentOption === 'monthly' && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Payment Terms *</label>
              <select
                name="paymentTerms"
                value={restaurantForm.paymentTerms}
                onChange={handleRestaurantFormChange}
                style={styles.input}
                required
                disabled={creatingUser}
              >
                <option value="15days">15 Days</option>
                <option value="30days">30 Days</option>
                <option value="45days">45 Days</option>
                <option value="60days">60 Days</option>
                <option value="90days">90 Days</option>
              </select>
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Credit Limit (¥)</label>
            <input
              type="number"
              name="creditLimit"
              value={restaurantForm.creditLimit}
              onChange={handleRestaurantFormChange}
              style={styles.input}
              placeholder="0"
              disabled={creatingUser}
              min="0"
              step="1000"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Business Registration Number</label>
            <input
              type="text"
              name="businessRegistrationNumber"
              value={restaurantForm.businessRegistrationNumber}
              onChange={handleRestaurantFormChange}
              style={styles.input}
              placeholder="Business registration number"
              disabled={creatingUser}
            />
          </div>
        </div>
      </div>

      <div style={styles.formSection}>
        <h4 style={styles.sectionTitle}>Family Members / Staff</h4>
        {restaurantForm.familyMembers.map((member, index) => (
          <div key={index} style={styles.familyMemberRow}>
            <div style={styles.formGrid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Name</label>
                <input
                  type="text"
                  value={member.name}
                  onChange={(e) => handleFamilyMemberChange(index, 'name', e.target.value)}
                  style={styles.input}
                  placeholder="Full name"
                  disabled={creatingUser}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Relation</label>
                <select
                  value={member.relation}
                  onChange={(e) => handleFamilyMemberChange(index, 'relation', e.target.value)}
                  style={styles.input}
                  disabled={creatingUser}
                >
                  <option value="">Select relation</option>
                  <option value="owner">Owner</option>
                  <option value="manager">Manager</option>
                  <option value="chef">Chef</option>
                  <option value="staff">Staff</option>
                  <option value="family">Family Member</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Phone</label>
                <input
                  type="tel"
                  value={member.phone}
                  onChange={(e) => handleFamilyMemberChange(index, 'phone', e.target.value)}
                  style={styles.input}
                  placeholder="Phone number"
                  disabled={creatingUser}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>&nbsp;</label>
                <button
                  type="button"
                  onClick={() => removeFamilyMember(index)}
                  style={styles.removeButton}
                  disabled={creatingUser || restaurantForm.familyMembers.length === 1}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addFamilyMember}
          style={styles.addButton}
          disabled={creatingUser}
        >
          + Add Family Member/Staff
        </button>
      </div>

      <div style={styles.formSection}>
        <h4 style={styles.sectionTitle}>Additional Information</h4>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Delivery Instructions</label>
          <textarea
            name="deliveryInstructions"
            value={restaurantForm.deliveryInstructions}
            onChange={handleRestaurantFormChange}
            style={{ ...styles.input, minHeight: '60px' }}
            placeholder="Any special delivery instructions"
            disabled={creatingUser}
            rows="2"
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Special Notes</label>
          <textarea
            name="specialNotes"
            value={restaurantForm.specialNotes}
            onChange={handleRestaurantFormChange}
            style={{ ...styles.input, minHeight: '60px' }}
            placeholder="Any special notes or requirements"
            disabled={creatingUser}
            rows="2"
          />
        </div>
      </div>

      <div style={styles.noteBox}>
        <strong>Login Instructions for Restaurant:</strong><br/>
        • Can login with email or contact number<br/>
        • Password: The password you set above<br/>
        • Restaurant will use the main login page
      </div>

      <button 
        type="submit" 
        style={styles.submitButton}
        disabled={creatingUser}
      >
        {creatingUser ? 'Creating Restaurant Account...' : 'Create Restaurant Account'}
      </button>
    </form>
  );

  // Render Supplier Registration Form
  const renderSupplierForm = () => (
    <form onSubmit={handleSupplierRegistration} style={styles.form}>
      <h3 style={styles.formTitle}>Register New Supplier</h3>
      
      <div style={styles.formSection}>
        <h4 style={styles.sectionTitle}>Business Information</h4>
        <div style={styles.formGrid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Business Name *</label>
            <input
              type="text"
              name="businessName"
              value={supplierForm.businessName}
              onChange={handleSupplierFormChange}
              style={styles.input}
              required
              placeholder="Enter business name"
              disabled={creatingUser}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Contact Person *</label>
            <input
              type="text"
              name="contactPerson"
              value={supplierForm.contactPerson}
              onChange={handleSupplierFormChange}
              style={styles.input}
              required
              placeholder="Main contact person"
              disabled={creatingUser}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Landline Number *</label>
            <input
              type="tel"
              name="landlineNumber"
              value={supplierForm.landlineNumber}
              onChange={handleSupplierFormChange}
              style={styles.input}
              required
              placeholder="03-1234-5678"
              disabled={creatingUser}
              pattern="0\d{1,4}-\d{1,4}-\d{3,4}"
            />
            <div style={styles.infoText}>
              Japanese landline number format (e.g., 03-1234-5678)
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Supplier ID</label>
            <input
              type="text"
              name="supplierId"
              value={supplierForm.supplierId}
              style={styles.input}
              disabled
              placeholder="Auto-generated from landline"
              readOnly
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password *</label>
            <input
              type="password"
              name="password"
              value={supplierForm.password}
              onChange={handleSupplierFormChange}
              style={styles.input}
              required
              placeholder="Min. 6 characters"
              disabled={creatingUser}
              minLength="6"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Supply Type</label>
            <select
              name="supplyType"
              value={supplierForm.supplyType}
              onChange={handleSupplierFormChange}
              style={styles.input}
              disabled={creatingUser}
            >
              <option value="">Select type</option>
              <option value="food">Food Items</option>
              <option value="beverage">Beverages</option>
              <option value="vegetables">Vegetables</option>
              <option value="meat">Meat & Poultry</option>
              <option value="seafood">Seafood</option>
              <option value="packaging">Packaging</option>
              <option value="equipment">Equipment</option>
              <option value="cleaning">Cleaning Supplies</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div style={styles.formSection}>
        <h4 style={styles.sectionTitle}>Address Information</h4>
        {renderPostalCodeSearch('supplier')}
        
        <div style={styles.formGrid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Postal Code *</label>
            <input
              type="text"
              name="postalCode"
              value={supplierForm.postalCode}
              onChange={handleSupplierFormChange}
              style={styles.input}
              required
              placeholder="0600000"
              disabled={creatingUser || selectedPostalCode}
              maxLength="7"
              pattern="[0-9]{7}"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Prefecture *</label>
            <input
              type="text"
              name="prefecture"
              value={supplierForm.prefecture}
              onChange={handleSupplierFormChange}
              style={styles.input}
              required
              placeholder="HOKKAIDO"
              disabled={creatingUser || selectedPostalCode}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>City *</label>
            <input
              type="text"
              name="city"
              value={supplierForm.city}
              onChange={handleSupplierFormChange}
              style={styles.input}
              required
              placeholder="SAPPORO SHI CHUO KU"
              disabled={creatingUser || selectedPostalCode}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Town *</label>
            <input
              type="text"
              name="town"
              value={supplierForm.town}
              onChange={handleSupplierFormChange}
              style={styles.input}
              required
              placeholder="ASAHIGAOKA"
              disabled={creatingUser || selectedPostalCode}
            />
          </div>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Building Name / Floor</label>
          <input
            type="text"
            name="buildingName"
            value={supplierForm.buildingName}
            onChange={handleSupplierFormChange}
            style={styles.input}
            placeholder="Building name, floor number"
            disabled={creatingUser}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Complete Address *</label>
          <textarea
            name="address"
            value={supplierForm.address}
            onChange={handleSupplierFormChange}
            style={{ ...styles.input, minHeight: '80px' }}
            required
            placeholder="Complete address will auto-fill from postal code search"
            disabled={creatingUser || selectedPostalCode}
            rows="3"
          />
        </div>
      </div>

      <div style={styles.formSection}>
        <h4 style={styles.sectionTitle}>Payment & Financial Information</h4>
        <div style={styles.formGrid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Payment Option *</label>
            <select
              name="paymentOption"
              value={supplierForm.paymentOption}
              onChange={handleSupplierFormChange}
              style={styles.input}
              required
              disabled={creatingUser}
            >
              <option value="cod">Cash on Delivery</option>
              <option value="monthly">Monthly Payment</option>
            </select>
          </div>

          {supplierForm.paymentOption === 'monthly' && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Payment Terms *</label>
              <select
                name="paymentTerms"
                value={supplierForm.paymentTerms}
                onChange={handleSupplierFormChange}
                style={styles.input}
                required
                disabled={creatingUser}
              >
                <option value="15days">15 Days</option>
                <option value="30days">30 Days</option>
                <option value="45days">45 Days</option>
                <option value="60days">60 Days</option>
                <option value="90days">90 Days</option>
              </select>
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Business Registration Number</label>
            <input
              type="text"
              name="businessRegistrationNumber"
              value={supplierForm.businessRegistrationNumber}
              onChange={handleSupplierFormChange}
              style={styles.input}
              placeholder="Business registration number"
              disabled={creatingUser}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Bank Name</label>
            <input
              type="text"
              name="bankName"
              value={supplierForm.bankName}
              onChange={handleSupplierFormChange}
              style={styles.input}
              placeholder="Bank name"
              disabled={creatingUser}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Branch Name</label>
            <input
              type="text"
              name="branchName"
              value={supplierForm.branchName}
              onChange={handleSupplierFormChange}
              style={styles.input}
              placeholder="Branch name"
              disabled={creatingUser}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Bank Account</label>
            <input
              type="text"
              name="bankAccount"
              value={supplierForm.bankAccount}
              onChange={handleSupplierFormChange}
              style={styles.input}
              placeholder="Bank account number"
              disabled={creatingUser}
            />
          </div>
        </div>
      </div>

      <div style={styles.formSection}>
        <h4 style={styles.sectionTitle}>Additional Information</h4>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Website</label>
          <input
            type="url"
            name="website"
            value={supplierForm.website}
            onChange={handleSupplierFormChange}
            style={styles.input}
            placeholder="https://example.com"
            disabled={creatingUser}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Notes</label>
          <textarea
            name="notes"
            value={supplierForm.notes}
            onChange={handleSupplierFormChange}
            style={{ ...styles.input, minHeight: '80px' }}
            placeholder="Any additional notes or information"
            disabled={creatingUser}
            rows="3"
          />
        </div>
      </div>

      <div style={styles.noteBox}>
        <strong>Login Instructions for Supplier:</strong><br/>
        • Can login with email or contact number<br/>
        • Password: The password you set above<br/>
        • Supplier will use the main login page
      </div>

      <button 
        type="submit" 
        style={styles.submitButton}
        disabled={creatingUser}
      >
        {creatingUser ? 'Creating Supplier Account...' : 'Create Supplier Account'}
      </button>
    </form>
  );

  return (
    <div style={styles.container}>
      {/* Registration Type Tabs */}
      <div style={styles.registrationTabs}>
        <button
          style={{
            ...styles.registrationTab,
            ...(activeRegistrationTab === 'driver' && styles.activeRegistrationTab)
          }}
          onClick={() => setActiveRegistrationTab('driver')}
        >
          🚚 Driver Registration
        </button>
        <button
          style={{
            ...styles.registrationTab,
            ...(activeRegistrationTab === 'restaurant' && styles.activeRegistrationTab)
          }}
          onClick={() => setActiveRegistrationTab('restaurant')}
        >
          🍽️ Restaurant Registration
        </button>
        <button
          style={{
            ...styles.registrationTab,
            ...(activeRegistrationTab === 'supplier' && styles.activeRegistrationTab)
          }}
          onClick={() => setActiveRegistrationTab('supplier')}
        >
          🏭 Supplier Registration
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={styles.errorMessage}>
          ⚠️ {error}
        </div>
      )}

      {/* Registration Form */}
      <div style={styles.formContainer}>
        {activeRegistrationTab === 'driver' && renderDriverForm()}
        {activeRegistrationTab === 'restaurant' && renderRestaurantForm()}
        {activeRegistrationTab === 'supplier' && renderSupplierForm()}
      </div>
    </div>
  );
};

// Styles (keep the same styles as before)
const styles = {
  container: {
    padding: '20px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  header: {
    marginBottom: '24px',
    textAlign: 'center'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: '8px'
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '14px'
  },
  errorMessage: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px'
  },
  registrationTabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    flexWrap: 'wrap'
  },
  registrationTab: {
    flex: 1,
    minWidth: '200px',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    padding: '12px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
    transition: 'all 0.2s'
  },
  activeRegistrationTab: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#3b82f6'
  },
  formContainer: {
    marginTop: '20px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  formTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: '2px solid #e5e7eb'
  },
  formSection: {
    backgroundColor: '#f9fafb',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '16px'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
    marginBottom: '16px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontWeight: '500',
    color: '#374151',
    fontSize: '14px'
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box'
  },
  infoText: {
    color: '#6b7280',
    fontSize: '12px',
    fontStyle: 'italic'
  },
  postalCodeSection: {
    marginBottom: '20px'
  },
  postalCodeResults: {
    maxHeight: '200px',
    overflowY: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    marginTop: '8px'
  },
  postalCodeItem: {
    padding: '10px 12px',
    borderBottom: '1px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#f3f4f6'
    },
    '&:last-child': {
      borderBottom: 'none'
    }
  },
  postalCodeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px'
  },
  postalCode: {
    fontWeight: 'bold',
    color: '#1f2937',
    fontSize: '14px'
  },
  town: {
    color: '#374151',
    fontSize: '14px',
    fontWeight: '500'
  },
  postalCodeDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#6b7280'
  },
  city: {},
  prefecture: {},
  selectedPostalCode: {
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '6px',
    padding: '12px',
    marginTop: '12px',
    marginBottom: '12px',
    fontSize: '14px',
    color: '#0369a1'
  },
  clearButton: {
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    marginTop: '8px',
    cursor: 'pointer'
  },
  loading: {
    padding: '20px',
    textAlign: 'center',
    color: '#6b7280'
  },
  noResults: {
    padding: '20px',
    textAlign: 'center',
    color: '#6b7280',
    fontStyle: 'italic'
  },
  familyMemberRow: {
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '6px',
    border: '1px solid #e5e7eb',
    marginBottom: '12px'
  },
  addButton: {
    backgroundColor: '#f3f4f6',
    border: '1px dashed #d1d5db',
    color: '#374151',
    padding: '10px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    width: '100%',
    marginTop: '8px',
    transition: 'background-color 0.2s',
    '&:hover:not(:disabled)': {
      backgroundColor: '#e5e7eb'
    }
  },
  removeButton: {
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'background-color 0.2s',
    '&:hover:not(:disabled)': {
      backgroundColor: '#fecaca'
    }
  },
  noteBox: {
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '14px',
    color: '#0369a1'
  },
  submitButton: {
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    marginTop: '10px',
    '&:hover:not(:disabled)': {
      backgroundColor: '#059669'
    },
    '&:disabled': {
      backgroundColor: '#9ca3af',
      cursor: 'not-allowed'
    }
  }
};

export default RegistrationTab;