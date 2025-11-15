// functions/index.js
const { onCall } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

exports.createUserWithRole = onCall({ 
  timeoutSeconds: 60,
  memory: '256MiB'
}, async (request) => {
  try {
    const { email, password, role, companyId, userData } = request.data;

    if (!email || !password || !role || !companyId) {
      throw new Error('Missing required fields');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Create user in Firebase Auth
    const userRecord = await getAuth().createUser({
      email,
      password,
      emailVerified: false,
    });

    // Store user data in Firestore
    const db = getFirestore();
    await db.collection('users').doc(userRecord.uid).set({
      email,
      role,
      companyId,
      createdAt: new Date(),
      ...userData
    });

    return {
      success: true,
      userId: userRecord.uid,
      message: 'User created successfully'
    };

  } catch (error) {
    console.error('Error creating user:', error);
    throw new Error(error.message);
  }
});