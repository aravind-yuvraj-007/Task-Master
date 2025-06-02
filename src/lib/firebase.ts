
// Ensure this file does NOT have 'use server;' at the top.
// It's a utility module for Firebase initialization, not a server action module.

import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

// console.log(
//   `[Firebase SDK - src/lib/firebase.ts - Top Level] Node.js process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID: '${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}'`
// );
// console.log(
//   `[Firebase SDK - src/lib/firebase.ts - Top Level] Node.js process.env.FIREBASE_WEBAPP_CONFIG: '${process.env.FIREBASE_WEBAPP_CONFIG ? process.env.FIREBASE_WEBAPP_CONFIG.substring(0, 50) + "..." : "Not set"}'`
// );

// Attempt to parse FIREBASE_WEBAPP_CONFIG first if available
let parsedWebAppConfig: Partial<FirebaseOptions> = {};
if (process.env.FIREBASE_WEBAPP_CONFIG) {
  try {
    const webAppConf = JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG);
    parsedWebAppConfig = {
      apiKey: webAppConf.apiKey,
      authDomain: webAppConf.authDomain,
      projectId: webAppConf.projectId,
      storageBucket: webAppConf.storageBucket,
      messagingSenderId: webAppConf.messagingSenderId,
      appId: webAppConf.appId,
      databaseURL: webAppConf.databaseURL, // Include databaseURL if present
    };
    // console.log("[Firebase SDK - src/lib/firebase.ts] Successfully parsed FIREBASE_WEBAPP_CONFIG.");
  } catch (e) {
    console.error("[Firebase SDK - src/lib/firebase.ts] Failed to parse FIREBASE_WEBAPP_CONFIG. Will rely on individual NEXT_PUBLIC_ variables. Error:", e);
    // Keep parsedWebAppConfig as empty or default if parsing fails
  }
} else {
  // console.log("[Firebase SDK - src/lib/firebase.ts] FIREBASE_WEBAPP_CONFIG environment variable not found. Relying on individual NEXT_PUBLIC_ variables.");
}

// Construct firebaseConfig, prioritizing individual NEXT_PUBLIC_ vars, then FIREBASE_WEBAPP_CONFIG
export const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || parsedWebAppConfig.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || parsedWebAppConfig.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || parsedWebAppConfig.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || parsedWebAppConfig.storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || parsedWebAppConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || parsedWebAppConfig.appId,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || parsedWebAppConfig.databaseURL,
};

// console.log("[Firebase SDK - src/lib/firebase.ts] Constructed firebaseConfig:", JSON.stringify({
//   apiKey: firebaseConfig.apiKey ? 'SET' : 'NOT_SET',
//   authDomain: firebaseConfig.authDomain,
//   projectId: firebaseConfig.projectId,
//   storageBucket: firebaseConfig.storageBucket,
//   messagingSenderId: firebaseConfig.messagingSenderId,
//   appId: firebaseConfig.appId,
//   databaseURL: firebaseConfig.databaseURL,
// }));


export function areEssentialConfigsPresent(config: FirebaseOptions | undefined): config is FirebaseOptions {
  if (!config) {
    // console.warn("[Firebase SDK - areEssentialConfigsPresent] Config object is undefined.");
    return false;
  }
  const essentials = !!(config.apiKey && config.authDomain && config.projectId && config.appId);
  // if (!essentials) {
  //   console.warn("[Firebase SDK - areEssentialConfigsPresent] One or more essential Firebase config properties are missing from the final config object.");
  //   console.warn(`  Details - apiKey: ${!!config.apiKey}, authDomain: ${!!config.authDomain}, projectId: ${!!config.projectId}, appId: ${!!config.appId}`);
  // }
  return essentials;
}

// Internal singletons to ensure Firebase is initialized only once per "context"
let appInstanceInternal: FirebaseApp | null = null;
let dbInstanceInternal: Firestore | null = null;

// This function takes the config as an argument
export function initializeFirebaseFromConfig(config: FirebaseOptions): { app: FirebaseApp | null; db: Firestore | null } {
  // console.log("[Firebase SDK - initializeFirebaseFromConfig] Called.");

  if (!areEssentialConfigsPresent(config)) {
    console.error(
      "[Firebase SDK - initializeFirebaseFromConfig] CRITICAL ERROR: Essential Firebase configuration passed to this function is MISSING or incomplete after attempting to source from env vars. Firebase will NOT be initialized."
    );
    return { app: null, db: null };
  }

  if (appInstanceInternal && dbInstanceInternal && appInstanceInternal.options.projectId === config.projectId) {
    // console.log(`[Firebase SDK - initializeFirebaseFromConfig] Reusing existing internal Firebase app ('${appInstanceInternal.options.projectId}') and Firestore instance for this config.`);
    return { app: appInstanceInternal, db: dbInstanceInternal };
  }

  // console.log("[Firebase SDK - initializeFirebaseFromConfig] Attempting new Firebase app initialization with provided config.");
  let currentApp: FirebaseApp;
  try {
    const existingApps = getApps();
    // Attempt to find an app that matches the resolved projectId from config
    const existingApp = existingApps.find(app => app.options.projectId === config.projectId);

    if (existingApp) {
        // console.log(`[Firebase SDK - initializeFirebaseFromConfig] Found matching existing Firebase app globally: '${existingApp.options.projectId}'. Reusing it.`);
        currentApp = existingApp;
    } else {
        // console.log(`[Firebase SDK - initializeFirebaseFromConfig] No suitable existing app found globally for projectId '${config.projectId}'. Calling initializeApp().`);
        currentApp = initializeApp(config); // Initialize with potentially a unique name if needed, or default
    }
    appInstanceInternal = currentApp; 
    // console.log(`[Firebase SDK - initializeFirebaseFromConfig] Firebase app initialized/retrieved successfully. Project ID: '${appInstanceInternal?.options?.projectId}'`);
  } catch (error) {
    console.error("[Firebase SDK - initializeFirebaseFromConfig] Error during Firebase app initialization/retrieval:", error);
    appInstanceInternal = null;
    dbInstanceInternal = null;
    return { app: null, db: null };
  }

  try {
    dbInstanceInternal = getFirestore(appInstanceInternal);
    // console.log("[Firebase SDK - initializeFirebaseFromConfig] Firestore instance obtained successfully.");
  } catch (error) {
    console.error("[Firebase SDK - initializeFirebaseFromConfig] Error obtaining Firestore instance:", error);
    dbInstanceInternal = null; 
  }

  return { app: appInstanceInternal, db: dbInstanceInternal };
}
