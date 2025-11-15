// setAdminClaim.js (Final Version - Ready to Run)

const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// 🔑 ZAROORI: Yahan apni JSON key file ka sahi naam likhein.
const serviceAccount = require('./tirth.json');

// Firebase Admin SDK ko initialize karein
initializeApp({
  credential: cert(serviceAccount) // Key file ka istemal karein
});

const auth = getAuth();

// ==============================================================================
// 🎯 ADMIN USER DETAILS 🎯
// ==============================================================================

// 1. Apne Admin user ki asli UID (jo aapne daali hai)
const ADMIN_UID = "9zECyV64o4RlkRY8nW37gIdLqdA2"; 

// 2. Admin ki company ID
const ADMIN_COMPANY_ID = "08030613287";

// ==============================================================================

async function setAdminClaim() {
    
    // ❌ OLD SAFETY CHECK HATA DIYA HAI ❌
    // Kyunki ab values set ho gayi hain, iski zaroorat nahi hai.
    
    try {
        console.log(`Attempting to set role: 'admin' for UID: ${ADMIN_UID}`);

        // Admin role aur company ID ko Custom Claims mein set karna
        await auth.setCustomUserClaims(ADMIN_UID, {
            role: 'admin',
            companyId: ADMIN_COMPANY_ID
        });
        
        console.log(`✅ SUCCESS: Custom claim 'role: admin' set for UID: ${ADMIN_UID}`);
        
        // Refresh token: Old claims ko invalid karne ke liye.
        await auth.revokeRefreshTokens(ADMIN_UID);
        console.log("Token revoked. Admin ko naye claims lene ke liye dobara login karna hoga.");
        
    } catch (error) {
        console.error("❌ FINAL ERROR setting custom claims:", error.message);
        
        if (error.code === 'auth/user-not-found') {
             console.error("Aapne galat UID daali hai. Kripya Firebase Console se sahi UID copy karein.");
        } else {
            console.error("Please check if your 'tirth.json' file is in the correct folder and has permission.");
        }
    }
}

setAdminClaim();