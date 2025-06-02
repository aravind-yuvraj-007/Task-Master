
export const DEFAULT_TASK_STATUSES = ["To Do", "In Progress", "In Review", "Done"] as const;
// TaskStatus is now a string to allow for custom column names.
export type TaskStatus = string;

export interface Project {
  id: string;
  name: string;
  description: string;
  key: string;
  type?: string; 
  lead?: string; 
  leadAvatar?: string;
  ownerId: string;
  // customStatuses?: string[]; // We'll store this in localStorage separately for simplicity
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus; // Now a string
  category?: string; 
  createdAt: Date; 
  assignee?: string; 
  projectId: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  effort?: number;
}
