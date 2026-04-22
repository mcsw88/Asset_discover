import * as admin from 'firebase-admin';

// Initialize the Admin SDK
// This uses Application Default Credentials in the AI Studio environment
if (!admin.apps.length) {
  admin.initializeApp();
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
