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
import { getAuth } from 'firebase/auth';

// CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDsUvlVgCUmMXMPqIVnRWVM43Ttta6I-3Q",
  authDomain: "buini-tirth.firebaseapp.com",
  projectId: "buini-tirth",
  storageBucket: "buini-tirth.firebasestorage.app",
  messagingSenderId: "198522091241",
  appId: "1:198522091241:web:caca46cc7a098aa7d6a278"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// JAPAN FY FUNCTION — YE ADD KIYA
export const getCurrentFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  return month >= 3 ? `${year}_${year + 1}` : `${year - 1}_${year}`;
};

// SAB EXPORT
export {
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
};

console.log('Firebase + FY Ready - Digital Bhai');