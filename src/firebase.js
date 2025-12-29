// src/firebase.js - CORRECTED VERSION
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc,
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged
} from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

// CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDsUvlVgCUmMXMPqIVnRWVM43Ttta6I-3Q",
  authDomain: "buini-tirth.firebaseapp.com",
  projectId: "buini-tirth",
  storageBucket: "buini-tirth.firebasestorage.app",
  messagingSenderId: "198522091241",
  appId: "1:198522091241:web:caca46cc7a098aa7d6a278"
};

// INITIALIZE FIREBASE
const app = initializeApp(firebaseConfig);

// INITIALIZE FIREBASE AUTHENTICATION WITH PERSISTENCE
const auth = getAuth(app);

// Set persistence to keep users logged in
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('Auth persistence set to browserLocalPersistence');
  })
  .catch((error) => {
    console.error('Error setting auth persistence:', error);
  });

// INITIALIZE FIRESTORE
const db = getFirestore(app);

// INITIALIZE FIREBASE FUNCTIONS
const functions = getFunctions(app);

// ============ HELPER FUNCTIONS (DECLARE FIRST) ============

// JAPAN FY FUNCTION
const getCurrentFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  return month >= 3 ? `${year}_${year + 1}` : `${year - 1}_${year}`;
};

// CATEGORY HELPER FUNCTIONS
const initializeCategoriesCollection = async (companyId, companyName, userId) => {
  try {
    // Check if categories collection exists for this company
    const categoriesQuery = query(
      collection(db, 'categories'),
      where('companyId', '==', companyId)
    );
    const categoriesSnapshot = await getDocs(categoriesQuery);
    
    if (categoriesSnapshot.empty) {
      console.log('Creating default categories for company:', companyId);
      
      // Create default categories
      const defaultCategories = [
        { 
          name: 'Meat & Poultry', 
          type: 'food', 
          description: '肉類 (Meat & Poultry)', 
          taxRate: 8, 
          isActive: true 
        },
        { 
          name: 'Vegetables', 
          type: 'food', 
          description: '野菜類 (Vegetables)', 
          taxRate: 8, 
          isActive: true 
        },
        { 
          name: 'Packaging', 
          type: 'non-food', 
          description: '包装材 (Packaging Materials)', 
          taxRate: 10, 
          isActive: true 
        },
        { 
          name: 'Spices & Masalas', 
          type: 'food', 
          description: 'スパイスとマサラ (Spices & Masalas)', 
          taxRate: 8, 
          isActive: true 
        },
        { 
          name: 'Dairy', 
          type: 'food', 
          description: '乳製品 (Dairy Products)', 
          taxRate: 8, 
          isActive: true 
        }
      ];
      
      const batch = writeBatch(db);
      
      defaultCategories.forEach((category, index) => {
        const categoryRef = doc(collection(db, 'categories'));
        batch.set(categoryRef, {
          ...category,
          companyId: companyId,
          companyName: companyName || 'Unknown Company',
          createdAt: new Date(),
          createdBy: userId || 'system',
          createdById: userId || 'system'
        });
      });
      
      await batch.commit();
      console.log('Default categories created successfully');
      return { success: true, count: defaultCategories.length };
    } else {
      console.log('Categories already exist for company:', companyId);
      return { success: true, count: categoriesSnapshot.size };
    }
    
  } catch (error) {
    console.error('Error initializing categories:', error);
    return { success: false, error: error.message };
  }
};

const getCategoriesByCompany = async (companyId) => {
  try {
    const categoriesQuery = query(
      collection(db, 'categories'),
      where('companyId', '==', companyId),
      where('isActive', '==', true)
    );
    const categoriesSnapshot = await getDocs(categoriesQuery);
    
    const categories = categoriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { success: true, categories };
  } catch (error) {
    console.error('Error getting categories:', error);
    return { success: false, error: error.message, categories: [] };
  }
};

const addCategory = async (categoryData) => {
  try {
    const categoryRef = doc(collection(db, 'categories'));
    await setDoc(categoryRef, {
      ...categoryData,
      createdAt: new Date()
    });
    
    return { 
      success: true, 
      id: categoryRef.id,
      message: 'Category added successfully'
    };
  } catch (error) {
    console.error('Error adding category:', error);
    return { success: false, error: error.message };
  }
};

// AUTHENTICATION FUNCTIONS
const registerUserWithEmail = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const loginUserWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// MOBILE NUMBER AUTHENTICATION HELPER FUNCTIONS
const findUserByMobileNumber = async (mobileNumber) => {
  try {
    const usersQuery = query(
      collection(db, 'users'),
      where('mobileNumber', '==', mobileNumber)
    );
    const querySnapshot = await getDocs(usersQuery);
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      return {
        id: userDoc.id,
        ...userDoc.data(),
        exists: true
      };
    }
    return { exists: false };
  } catch (error) {
    console.error('Error finding user by mobile:', error);
    return { exists: false, error: error.message };
  }
};

const registerUserWithMobile = async (userData) => {
  const { mobileNumber, password, name, role, companyId, current_fy, ...additionalData } = userData;
  
  try {
    // Create email from mobile number for Firebase Auth
    const authEmail = `${mobileNumber}@delivery.com`;
    
    // Create user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
    const user = userCredential.user;

    // Prepare user data for Firestore
    const userDocData = {
      uid: user.uid,
      role: role,
      name: name,
      mobileNumber: mobileNumber,
      email: authEmail,
      companyId: companyId,
      current_fy: current_fy,
      status: 'active',
      createdAt: serverTimestamp(),
      ...additionalData
    };

    // Save user data to Firestore
    await setDoc(doc(db, 'users', user.uid), userDocData);

    // Initialize default categories for this company
    await initializeCategoriesCollection(companyId, name, user.uid);

    return { 
      success: true, 
      user: user,
      userData: userDocData
    };
  } catch (error) {
    console.error('Mobile registration error:', error);
    return { 
      success: false, 
      error: error.message,
      errorCode: error.code
    };
  }
};

const loginUserWithMobile = async (mobileNumber, password) => {
  try {
    // Find user by mobile number
    const userInfo = await findUserByMobileNumber(mobileNumber);
    
    if (!userInfo.exists) {
      return { 
        success: false, 
        error: 'No account found with this mobile number' 
      };
    }

    // Use the stored email for login
    const authEmail = userInfo.email;
    
    // Sign in with email and password
    const userCredential = await signInWithEmailAndPassword(auth, authEmail, password);
    
    // Initialize categories if needed
    if (userInfo.companyId) {
      await initializeCategoriesCollection(userInfo.companyId, userInfo.companyName, userInfo.uid);
    }
    
    return { 
      success: true, 
      user: userCredential.user,
      userData: userInfo
    };
  } catch (error) {
    console.error('Mobile login error:', error);
    let errorMessage = 'Login failed';
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'No account found with this mobile number';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Invalid password';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid mobile number format';
        break;
      default:
        errorMessage = error.message;
    }
    
    return { 
      success: false, 
      error: errorMessage,
      errorCode: error.code
    };
  }
};

// ============ EXPORTS (AFTER FUNCTION DECLARATIONS) ============

// Export core Firebase instances
export { 
  app,
  auth, 
  db,
  functions
};

// Export all Firestore functions
export {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch
};

// Export auth functions
export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};

// Export helper functions (NOW THEY ARE DEFINED!)
export {
  getCurrentFinancialYear,
  initializeCategoriesCollection,
  getCategoriesByCompany,
  addCategory,
  registerUserWithEmail,
  loginUserWithEmail,
  logoutUser,
  findUserByMobileNumber,
  registerUserWithMobile,
  loginUserWithMobile
};

console.log('Firebase initialized successfully - All exports defined');