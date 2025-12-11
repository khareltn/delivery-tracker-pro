// src/firebase.js
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
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
import { getFunctions } from 'firebase/functions'; // ADD THIS LINE

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

// INITIALIZE FIREBASE FUNCTIONS - ADD THIS
const functions = getFunctions(app);

// Optional: If you want to use emulator for local development
// import { connectFunctionsEmulator } from 'firebase/functions';
// if (window.location.hostname === 'localhost') {
//   connectFunctionsEmulator(functions, 'localhost', 5001);
// }

// JAPAN FY FUNCTION
export const getCurrentFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  return month >= 3 ? `${year}_${year + 1}` : `${year - 1}_${year}`;
};

// AUTHENTICATION FUNCTIONS
export const registerUserWithEmail = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const loginUserWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// MOBILE NUMBER AUTHENTICATION HELPER FUNCTIONS
export const findUserByMobileNumber = async (mobileNumber) => {
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

export const registerUserWithMobile = async (userData) => {
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

export const loginUserWithMobile = async (mobileNumber, password) => {
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

// FIREBASE EXPORTS
export { 
  app, // Add this if needed
  auth, 
  db,
  functions, // ADD THIS - Export the functions instance
  // Firestore functions
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  // Auth functions
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};

console.log('Firebase + Auth + FY + Functions Ready - Digital Bhai');