const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

let db = null;
let adminApp = null;

try {
  const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    adminApp = initializeApp({
      credential: cert(serviceAccount)
    });
    console.log("✅ Firebase Admin initialized with serviceAccountKey.json");
  } else if (process.env.FIREBASE_CREDENTIALS) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    adminApp = initializeApp({
      credential: cert(serviceAccount)
    });
    console.log("✅ Firebase Admin initialized with FIREBASE_CREDENTIALS env var");
  } else {
    // Якщо файлу немає, спробувати ініціалізувати через змінні середовища
    adminApp = initializeApp();
    console.log("✅ Firebase Admin initialized with default credentials");
  }
  
  db = getFirestore();
} catch (error) {
  console.error("⚠️ Firebase initialization failed:", error.message);
  console.log("💡 Будь ласка, додайте serviceAccountKey.json у корінь проекту або налаштуйте GOOGLE_APPLICATION_CREDENTIALS");
}

module.exports = { db, admin: adminApp };
