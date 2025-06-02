
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
  orderBy, 
  Timestamp,
  serverTimestamp,
  deleteDoc, // Import deleteDoc
  type Firestore 
} from 'firebase/firestore';
import type { Task, Project } from '@/types'; 
import { firebaseConfig as importedFirebaseConfig, areEssentialConfigsPresent } from '@/lib/firebase'; 

// Internal helper to get DB instance, attempting to initialize if necessary
async function _getDbInstance(actionName: string): Promise<Firestore | null> {
  if (!areEssentialConfigsPresent(importedFirebaseConfig)) {
    console.error(`[taskActions - _getDbInstance called by ${actionName}] CRITICAL: Imported firebaseConfig from firebase.ts is missing essential properties.`);
    return null;
  }
  
  try {
    const { app, db } = await initializeFirebaseFromConfig(importedFirebaseConfig, actionName);
    if (!db) {
      console.error(`[taskActions - _getDbInstance called by ${actionName}] initializeFirebaseFromConfig failed to return a valid Firestore db instance.`);
      return null;
    }
    return db;
  } catch (error) {
     console.error(`[taskActions - _getDbInstance called by ${actionName}] Unexpected error during initializeFirebaseFromConfig call:`, error);
    return null;
  }
}

let appInstanceInternal: FirebaseApp | null = null;
let dbInstanceInternal: Firestore | null = null;

async function initializeFirebaseFromConfig(config: typeof importedFirebaseConfig, callerContext: string): Promise<{ app: FirebaseApp | null; db: Firestore | null }> {
    if (!areEssentialConfigsPresent(config)) {
        console.error(`[Firebase SDK - initializeFirebaseFromConfig called by ${callerContext} in taskActions] CRITICAL ERROR: Essential Firebase configuration passed to this function is MISSING or incomplete.`);
        return { app: null, db: null };
    }

    if (appInstanceInternal && dbInstanceInternal && appInstanceInternal.options.projectId === config.projectId) {
        return { app: appInstanceInternal, db: dbInstanceInternal };
    }
    
    let currentApp: FirebaseApp;
    try {
        if (getApps().length > 0) {
            const existingApp = getApps().find(app => app.options.projectId === config.projectId);
            if (existingApp) {
                currentApp = existingApp;
            } else {
                currentApp = initializeApp(config);
            }
        } else {
            currentApp = initializeApp(config);
        }
        appInstanceInternal = currentApp;
    } catch (error) {
        console.error(`[Firebase SDK - initializeFirebaseFromConfig called by ${callerContext} in taskActions] Error during Firebase app initialization/retrieval:`, error);
        appInstanceInternal = null;
        dbInstanceInternal = null;
        return { app: null, db: null };
    }

    try {
        dbInstanceInternal = getFirestore(appInstanceInternal);
    } catch (error) {
        console.error(`[Firebase SDK - initializeFirebaseFromConfig called by ${callerContext} in taskActions] Error obtaining Firestore instance via getFirestore(app):`, error);
        dbInstanceInternal = null;
    }
    return { app: appInstanceInternal, db: dbInstanceInternal };
}


export async function getTasksByProjectId(projectId: string, userId: string): Promise<Task[]> {
  const actionName = "getTasksByProjectId";
  try {
    const db = await _getDbInstance(actionName);
    if (!db) return [];
    if (!userId || !projectId) return [];

    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists() || projectSnap.data()?.ownerId !== userId) return [];

    const tasksColRef = collection(db, 'projects', projectId, 'tasks');
    const q = query(tasksColRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const tasks: Task[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      tasks.push({
        id: docSnap.id,
        title: data.title,
        description: data.description,
        status: data.status,
        category: data.category,
        createdAt: (data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt?.seconds * 1000 || Date.now())), 
        assignee: data.assignee,
        projectId: projectId, 
        priority: data.priority,
        effort: data.effort,
      });
    });
    return tasks;
  } catch (error) {
    console.error(`[taskActions - ${actionName}] UNHANDLED EXCEPTION: Error fetching tasks for project '${projectId}', user '${userId}'. Error:`, error);
    return [];
  }
}

export async function addTask(
  taskData: Omit<Task, 'id' | 'createdAt'>, 
  userId: string
): Promise<Task | null> {
  const actionName = "addTask";
  try {
    const db = await _getDbInstance(actionName);
    if (!db) return null;
    if (!userId || !taskData.projectId) return null;

    const projectRef = doc(db, 'projects', taskData.projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists() || projectSnap.data()?.ownerId !== userId) return null;

    const tasksColRef = collection(db, 'projects', taskData.projectId, 'tasks');
    const newTaskId = `task-${crypto.randomUUID()}`; 
    const taskToSaveInFirestore = { ...taskData, createdAt: serverTimestamp() };
    const taskDocRef = doc(tasksColRef, newTaskId);
    await setDoc(taskDocRef, taskToSaveInFirestore);

    return { ...taskData, id: newTaskId, createdAt: new Date() };
  } catch (error) {
    console.error(`[taskActions - ${actionName}] UNHANDLED EXCEPTION: Error adding task to project '${taskData.projectId}' for user '${userId}'. Error:`, error);
    return null;
  }
}

export async function updateTask(taskData: Task, userId: string): Promise<Task | null> {
  const actionName = "updateTask";
  try {
    const db = await _getDbInstance(actionName);
    if (!db) return null;
    if (!userId || !taskData.projectId || !taskData.id) return null;
  
    const projectRef = doc(db, 'projects', taskData.projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists() || projectSnap.data()?.ownerId !== userId) return null;

    const taskRef = doc(db, 'projects', taskData.projectId, 'tasks', taskData.id);
    const { id, ...updateDataInput } = taskData; 
    const updateData: Record<string, any> = { ...updateDataInput };
    if (updateData.createdAt && updateData.createdAt instanceof Date) {
      updateData.createdAt = Timestamp.fromDate(updateData.createdAt);
    }
    await setDoc(taskRef, updateData, { merge: true });
    return taskData;
  } catch (error) {
     console.error(`[taskActions - ${actionName}] UNHANDLED EXCEPTION: Error updating task '${taskData.id}' in project '${taskData.projectId}' for user '${userId}'. Error:`, error);
    return null;
  }
}

export async function deleteTask(projectId: string, taskId: string, userId: string): Promise<boolean> {
  const actionName = "deleteTask";
  try {
    const db = await _getDbInstance(actionName);
    if (!db) return false;
    if (!userId || !projectId || !taskId) return false;

    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists() || projectSnap.data()?.ownerId !== userId) {
      console.error(`[taskActions - ${actionName}] User ${userId} cannot delete tasks from project ${projectId}. Project not found or user not owner.`);
      return false;
    }

    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
    await deleteDoc(taskRef);
    // console.log(`[taskActions - ${actionName}] Successfully deleted task '${taskId}' from project '${projectId}'.`);
    return true;
  } catch (error) {
    console.error(`[taskActions - ${actionName}] UNHANDLED EXCEPTION: Error deleting task '${taskId}' from project '${projectId}' for user '${userId}'. Error:`, error);
    return false;
  }
}


export async function addInitialTasksForProject(projectId: string, projectKey: string, userId: string, userName?: string, firstStatus?: string): Promise<Task[]> {
  const actionName = "addInitialTasksForProject";
  try {
    const db = await _getDbInstance(actionName);
    if (!db) return [];
    if (!userId) return [];

    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists() || projectSnap.data()?.ownerId !== userId) return [];

    const assignee = userName?.substring(0, 2).toUpperCase() || 'U1';
    const effectiveFirstStatus = firstStatus || DEFAULT_TASK_STATUSES[0];

    const initialRawTasks: Omit<Task, 'id' | 'createdAt' | 'projectId'>[] = [
      { title: 'Market Research for Product-Market Fit', description: 'Analyze target audience, competitor landscape, and validate core value proposition.', status: effectiveFirstStatus, category: `${projectKey}-RESEARCH`, assignee, priority: 'High', effort: 8 },
      { title: 'Develop MVP User Authentication Flow', description: 'Implement secure sign-up, login, and password reset functionality.', status: effectiveFirstStatus, category: `${projectKey}-DEV`, assignee: 'U2', priority: 'Critical', effort: 5 },
      { title: 'Wireframe Key User Interface Screens', description: 'Create low-fidelity wireframes for the main application views and user flows.', status: effectiveFirstStatus, category: `${projectKey}-DESIGN`, assignee, priority: 'High', effort: 5 },
      { title: 'Set Up Project Repository & CI/CD Pipeline', description: 'Initialize version control, and configure basic continuous integration and deployment.', status: effectiveFirstStatus, category: `${projectKey}-INFRA`, assignee: 'U2', priority: 'Medium', effort: 3 },
      { title: 'Draft Initial Investor Pitch Deck Content', description: 'Outline the key slides and content for a V1 pitch deck to potential investors.', status: effectiveFirstStatus, category: `${projectKey}-BIZ`, assignee, priority: 'Medium', effort: 3 },
    ];

    const addedTasks: Task[] = [];
    const tasksColRef = collection(db, 'projects', projectId, 'tasks');

    const existingTasksSnapshot = await getDocs(query(tasksColRef, where("category", "in", initialRawTasks.map(t => t.category))));
    if (!existingTasksSnapshot.empty && existingTasksSnapshot.docs.some(doc => initialRawTasks.find(rt => rt.category === doc.data().category && rt.title === doc.data().title))) {
        const existingTasks: Task[] = [];
         existingTasksSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            existingTasks.push({
                id: docSnap.id,
                title: data.title,
                description: data.description,
                status: data.status,
                category: data.category,
                createdAt: (data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt?.seconds * 1000 || Date.now())),
                assignee: data.assignee,
                projectId: projectId,
                priority: data.priority,
                effort: data.effort,
            });
        });
        return existingTasks;
    }

    for (const rawTask of initialRawTasks) {
      const newTaskId = `task-initial-${crypto.randomUUID().substring(0,8)}`;
      const taskToSaveInFirestore = {
        ...rawTask,
        projectId, 
        createdAt: serverTimestamp(),
      };
      const taskDocRef = doc(tasksColRef, newTaskId);
      await setDoc(taskDocRef, taskToSaveInFirestore);
      
      addedTasks.push({
        ...rawTask,
        id: newTaskId,
        createdAt: new Date(),
        projectId,
      });
    }
    return addedTasks;
  } catch (error) {
    console.error(`[taskActions - ${actionName}] UNHANDLED EXCEPTION: Error batch-adding initial tasks for project '${projectId}', user '${userId}'. Error:`, error);
    return [];
  }
}
