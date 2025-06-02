
'use server';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc,
  type Firestore
} from 'firebase/firestore';
import type { Project } from '@/types';
import { firebaseConfig as importedFirebaseConfig, areEssentialConfigsPresent } from '@/lib/firebase';

// Internal helper to get DB instance, attempting to initialize if necessary
async function _getDbInstance(actionName: string): Promise<Firestore | null> {
  // console.log(`[projectActions - _getDbInstance called by ${actionName}] Attempting to get/initialize Firestore instance.`);

  if (!areEssentialConfigsPresent(importedFirebaseConfig)) {
    console.error(`[projectActions - _getDbInstance called by ${actionName}] CRITICAL: Imported firebaseConfig from firebase.ts is missing essential properties. This means env vars were not read correctly when firebase.ts was loaded. Firestore operations will fail.`);
    console.error(`[projectActions - _getDbInstance called by ${actionName}] Directly checking process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID: '${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}'`);
    return null;
  }

  try {
    const { app, db } = await initializeFirebaseFromConfig(importedFirebaseConfig, actionName);
    if (!db) {
      console.error(`[projectActions - _getDbInstance called by ${actionName}] initializeFirebaseFromConfig failed to return a valid Firestore db instance.`);
      return null;
    }
    // console.log(`[projectActions - _getDbInstance called by ${actionName}] Successfully obtained db instance from initializeFirebaseFromConfig.`);
    return db;
  } catch (error) {
    console.error(`[projectActions - _getDbInstance called by ${actionName}] Unexpected error during initializeFirebaseFromConfig call:`, error);
    return null;
  }
}


// Copied from firebase.ts to be self-contained for actions, ensuring it uses the passed config.
// Manages its own internal static instances to be idempotent within a similar context/request.
let appInstanceInternal: FirebaseApp | null = null;
let dbInstanceInternal: Firestore | null = null;

async function initializeFirebaseFromConfig(config: typeof importedFirebaseConfig, callerContext: string): Promise<{ app: FirebaseApp | null; db: Firestore | null }> {
    // console.log(`[Firebase SDK - initializeFirebaseFromConfig called by ${callerContext}] Called. Checking env vars passed in config.`);
    // console.log(`  - Config Project ID: '${config?.projectId}'`);

    if (!areEssentialConfigsPresent(config)) {
        console.error(`[Firebase SDK - initializeFirebaseFromConfig called by ${callerContext}] CRITICAL ERROR: Essential Firebase configuration passed to this function is MISSING or incomplete. Firebase will NOT be initialized.`);
        return { app: null, db: null };
    }

    if (appInstanceInternal && dbInstanceInternal && appInstanceInternal.options.projectId === config.projectId) {
        // console.log(`[Firebase SDK - initializeFirebaseFromConfig called by ${callerContext}] Reusing existing internal Firebase app ('${appInstanceInternal.options.projectId}') and Firestore instance for this config.`);
        return { app: appInstanceInternal, db: dbInstanceInternal };
    }
    
    // console.log(`[Firebase SDK - initializeFirebaseFromConfig called by ${callerContext}] Attempting new Firebase app initialization with provided config.`);
    let currentApp: FirebaseApp;
    try {
        if (getApps().length > 0) {
            const existingApp = getApps().find(app => app.options.projectId === config.projectId);
            if (existingApp) {
                // console.log(`[Firebase SDK - initializeFirebaseFromConfig called by ${callerContext}] Found matching existing Firebase app globally: '${existingApp.options.projectId}'. Reusing it.`);
                currentApp = existingApp;
            } else {
                 // This case is tricky. If default app exists but doesn't match config, initializing new might conflict.
                 // For simplicity in this app, if any app exists but doesn't match, we'll try to initialize a new one,
                 // which might throw if a default app already exists and Firebase SDK prevents named apps easily here.
                 // Firebase v9+ recommends initializing apps with unique names if multiple are needed.
                 // console.log(`[Firebase SDK - initializeFirebaseFromConfig called by ${callerContext}] Existing apps found, but none match current config's projectId. Attempting initializeApp() for this config.`);
                currentApp = initializeApp(config);
            }
        } else {
            // console.log(`[Firebase SDK - initializeFirebaseFromConfig called by ${callerContext}] No Firebase apps initialized yet. Calling initializeApp().`);
            currentApp = initializeApp(config);
        }
        appInstanceInternal = currentApp;
        // console.log(`[Firebase SDK - initializeFirebaseFromConfig called by ${callerContext}] Firebase app initialized/retrieved successfully. Project ID: '${appInstanceInternal?.options?.projectId}'`);
    } catch (error) {
        console.error(`[Firebase SDK - initializeFirebaseFromConfig called by ${callerContext}] Error during Firebase app initialization/retrieval:`, error);
        appInstanceInternal = null;
        dbInstanceInternal = null;
        return { app: null, db: null };
    }

    try {
        dbInstanceInternal = getFirestore(appInstanceInternal);
        // console.log(`[Firebase SDK - initializeFirebaseFromConfig called by ${callerContext}] Firestore instance obtained successfully.`);
    } catch (error) {
        console.error(`[Firebase SDK - initializeFirebaseFromConfig called by ${callerContext}] Error obtaining Firestore instance via getFirestore(app):`, error);
        dbInstanceInternal = null;
    }
    return { app: appInstanceInternal, db: dbInstanceInternal };
}


export async function addProject(projectData: Project, userId: string): Promise<Project | null> {
  const actionName = "addProject";
  try {
    const db = await _getDbInstance(actionName);
    if (!db) {
      console.error(`[projectActions - ${actionName}] Aborted: Could not get valid Firestore instance.`);
      return null;
    }
    
    if (!userId) {
      console.error(`[projectActions - ${actionName}] User ID is required. Aborting.`);
      return null;
    }
    if (!projectData.id) {
      console.error(`[projectActions - ${actionName}] Project ID (client-generated) is required. Aborting.`);
      return null;
    }
    
    const projectWithValidatedOwner: Project = { ...projectData, ownerId: userId };
    const projectRef = doc(db, 'projects', projectWithValidatedOwner.id);
    
    await setDoc(projectRef, projectWithValidatedOwner);
    // console.log(`[projectActions - ${actionName}] Successfully added project '${projectWithValidatedOwner.id}' for user '${userId}'.`);
    return projectWithValidatedOwner;
  } catch (error) {
    console.error(`[projectActions - ${actionName}] UNHANDLED EXCEPTION: Error adding project for user '${userId}'. Project ID: '${projectData?.id}'. Error:`, error);
    return null;
  }
}

export async function getProjectsByUserId(userId: string): Promise<Project[]> {
  const actionName = "getProjectsByUserId";
  try {
    const db = await _getDbInstance(actionName);
    if (!db) {
      console.error(`[projectActions - ${actionName}] Aborted: Could not get valid Firestore instance. Returning empty array.`);
      return [];
    }

    if (!userId) {
      // console.warn(`[projectActions - ${actionName}] Called without a userId. Returning empty array.`);
      return [];
    }
    const projectsColRef = collection(db, 'projects');
    const q = query(projectsColRef, where('ownerId', '==', userId));
    const querySnapshot = await getDocs(q);
    const projects: Project[] = [];
    querySnapshot.forEach((docSnap) => {
      projects.push({ id: docSnap.id, ...docSnap.data() } as Project);
    });
    // console.log(`[projectActions - ${actionName}] Found ${projects.length} projects for user '${userId}'.`);
    return projects;
  } catch (error) {
    console.error(`[projectActions - ${actionName}] UNHANDLED EXCEPTION: Error fetching projects for user '${userId}'. Error:`, error);
    return [];
  }
}


export async function getProjectById(projectId: string, userId: string): Promise<Project | null> {
  const actionName = "getProjectById";
  try {
    const db = await _getDbInstance(actionName);
    if (!db) {
      console.error(`[projectActions - ${actionName}] Aborted: Could not get valid Firestore instance.`);
      return null;
    }
  
    if (!userId) {
      console.error(`[projectActions - ${actionName}] User ID is required.`);
      return null;
    }
    if (!projectId) {
      console.error(`[projectActions - ${actionName}] Project ID is required.`);
      return null;
    }
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      // console.warn(`[projectActions - ${actionName}] Project with ID '${projectId}' not found.`);
      return null;
    }
    
    const projectData = projectSnap.data() as Project; 
    if (projectData.ownerId !== userId) {
      // console.warn(`[projectActions - ${actionName}] User '${userId}' does not have access to project '${projectId}'. Project owner: '${projectData.ownerId}'.`);
      return null;
    }
    // console.log(`[projectActions - ${actionName}] Successfully fetched project '${projectId}' for user '${userId}'.`);
    return { id: projectSnap.id, ...projectData };
  } catch (error) {
    console.error(`[projectActions - ${actionName}] UNHANDLED EXCEPTION: Error fetching project '${projectId}' for user '${userId}'. Error:`, error);
    return null;
  }
}

export async function createDefaultProjectForUser(
  userId: string, 
  userName: string, 
  defaultProjectDetails: Omit<Project, 'ownerId'> 
): Promise<Project | null> {
  const actionName = "createDefaultProjectForUser";
  try {
    const db = await _getDbInstance(actionName);
    if (!db) {
      console.error(`[projectActions - ${actionName}] Aborted: Could not get valid Firestore instance.`);
      return null;
    }
    
    if (!userId) {
      console.error(`[projectActions - ${actionName}] User ID is required.`);
      return null;
    }

    const projectData: Project = {
      ...defaultProjectDetails, 
      ownerId: userId,
    };

    if (!projectData.id) {
      console.error(`[projectActions - ${actionName}] defaultProjectDetails is missing 'id'. Cannot create project.`);
      return null;
    }

    const projectRef = doc(db, 'projects', projectData.id);
    await setDoc(projectRef, projectData);
    // console.log(`[projectActions - ${actionName}] Default project '${projectData.id}' successfully created/updated for user '${userId}'.`);
    return projectData;
  } catch (error) {
    console.error(`[projectActions - ${actionName}] UNHANDLED EXCEPTION: Error creating/updating default project for user '${userId}'. Project ID: '${defaultProjectDetails?.id}'. Error:`, error);
    return null;
  }
}
