// functions/index.js - REPLACE your getUserByMobileNumber function with this:

const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase-admin/firestore');
const cors = require('cors')({ origin: true }); // Install with: npm install cors

initializeApp();

exports.getUserByMobileNumber = onRequest(async (req, res) => {
  // Enable CORS
  cors(req, res, async () => {
    try {
      // Only allow POST requests
      if (req.method !== 'POST') {
        return res.status(405).json({ 
          success: false, 
          message: 'Method Not Allowed' 
        });
      }

      const { mobileNumber } = req.body;

      if (!mobileNumber) {
        return res.status(400).json({ 
          success: false, 
          message: 'Mobile number is required' 
        });
      }

      // Clean the mobile number
      const cleanMobile = mobileNumber.replace(/\D/g, '');
      
      // Get Firestore instance
      const db = getFirestore();
      
      // Query for user by mobile number
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef, 
        where('mobileNumber', '==', cleanMobile),
        where('status', '==', 'active')
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        
        return res.status(200).json({
          success: true,
          user: {
            id: userDoc.id,
            uid: userData.uid,
            email: userData.email,
            role: userData.role,
            name: userData.name,
            companyId: userData.companyId,
            companyName: userData.companyName,
            fyId: userData.fyId,
            status: userData.status,
            mobileNumber: userData.mobileNumber,
            ...(userData.role === 'driver' && {
              vehicleNumber: userData.vehicleNumber,
              licenseNumber: userData.licenseNumber
            })
          }
        });
      }
      
      return res.status(404).json({ 
        success: false, 
        message: 'No active user found with this mobile number' 
      });

    } catch (error) {
      console.error('Error in getUserByMobileNumber:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Internal server error' 
      });
    }
  });
});