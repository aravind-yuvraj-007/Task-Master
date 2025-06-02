
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Task, TaskStatus as TaskStatusType, Project } from '@/types'; // Renamed TaskStatus to TaskStatusType to avoid conflict
import { DEFAULT_TASK_STATUSES } from '@/types'; // Import default statuses
import { TaskColumn } from './task-column';
import { TaskForm } from './task-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'; // For Add Column Dialog
import { Briefcase, MoreHorizontal, Search, User, FileWarning, Inbox, Settings, FolderPlus, Loader2, List, Plus, Users, AlertTriangle, Trash2, Columns } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createDefaultProjectForUser, getProjectsByUserId, deleteProject as deleteProjectAction } from '@/lib/actions/projectActions';
import { addTask as addTaskAction, updateTask as updateTaskAction, getTasksByProjectId, addInitialTasksForProject, deleteTask as deleteTaskAction } from '@/lib/actions/taskActions';
import { Timestamp } from 'firebase/firestore';

const DEFAULT_PROJECT_ID_BASE = 'proj-startup-launch';

const getUserScopedKey = (baseKey: string, userId?: string): string => {
  if (!userId) return `${baseKey}-unauthenticated`; // Should ideally not happen for project-specific data
  return `${baseKey}-${userId}`;
};

const getProjectColumnsKey = (projectId: string, userId: string) => {
  return `taskMasterProjectColumns_${projectId}_${userId}`;
}

export function TaskBoard() {
  const { user, isAuthenticated } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  // State for dynamic columns
  const [activeColumnStatuses, setActiveColumnStatuses] = useState<string[]>(() => [...DEFAULT_TASK_STATUSES]);
  const [isAddColumnDialogOpen, setIsAddColumnDialogOpen] = useState(false);
  const [newColumnNameInput, setNewColumnNameInput] = useState('');


  const DEFAULT_PROJECT_ID = useMemo(() => {
    return getUserScopedKey(DEFAULT_PROJECT_ID_BASE, user?.id);
  }, [user]);

  const defaultProjectDetails: Omit<Project, 'ownerId'> = useMemo(() => ({
    id: DEFAULT_PROJECT_ID,
    name: user ? `${user.name.split(' ')[0]}'s Startup Launch` : 'Demo Startup Launch',
    description: 'Tasks related to launching the new startup venture.',
    key: 'SL',
    type: 'Team-managed software',
    lead: user?.name || 'Demo User',
    leadAvatar: user?.avatar || `https://placehold.co/32x32.png?text=${(user?.name?.substring(0, 2) || 'DU').toUpperCase()}`,
  }), [user, DEFAULT_PROJECT_ID]);


  // Load and Save Column Statuses to localStorage
  const loadColumnStatusesFromLocalStorage = useCallback((projectId: string, userId: string) => {
    const key = getProjectColumnsKey(projectId, userId);
    const storedStatuses = localStorage.getItem(key);
    let newStatusesToSet = [...DEFAULT_TASK_STATUSES]; // Default assumption

    if (storedStatuses) {
        try {
            const parsedStatuses = JSON.parse(storedStatuses);
            // Ensure parsedStatuses is an array of strings and non-empty before using it
            if (Array.isArray(parsedStatuses) && parsedStatuses.length > 0 && parsedStatuses.every(s => typeof s === 'string')) {
                newStatusesToSet = parsedStatuses;
            }
        } catch (e) {
            console.error("Failed to parse stored column statuses, using defaults:", e);
            // newStatusesToSet remains DEFAULT_TASK_STATUSES
        }
    }
    
    setActiveColumnStatuses(currentLocalActiveStatuses => {
        if (JSON.stringify(currentLocalActiveStatuses) !== JSON.stringify(newStatusesToSet)) {
            return newStatusesToSet;
        }
        return currentLocalActiveStatuses; // No change, return current state to prevent re-render
    });
  }, []); // Empty dependency for useCallback is fine because setActiveColumnStatuses dispatch is stable.

  const saveColumnStatusesToLocalStorage = useCallback((projectId: string, userId: string, statuses: string[]) => {
    const key = getProjectColumnsKey(projectId, userId);
    localStorage.setItem(key, JSON.stringify(statuses));
  }, []);

  // Effect for loading projects
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setIsLoading(false);
      setCurrentProject(null);
      setAllProjects([]);
      // Reset columns if user logs out or is not authenticated
      setActiveColumnStatuses(prevStatuses => {
        const newDefault = [...DEFAULT_TASK_STATUSES];
        if (JSON.stringify(prevStatuses) !== JSON.stringify(newDefault)) {
          return newDefault;
        }
        return prevStatuses;
      });
      return;
    }
    setIsLoading(true);
    setBackendError(null);

    getProjectsByUserId(user.id)
      .then(async (userProjects) => {
        if (userProjects && userProjects.length === 0) {
          const newDefaultProject = await createDefaultProjectForUser(user.id!, user.name!, defaultProjectDetails);
          if (newDefaultProject) {
            setAllProjects([newDefaultProject]);
            setCurrentProject(newDefaultProject);
            localStorage.setItem(getUserScopedKey('taskMasterActiveProjectId', user.id!), newDefaultProject.id);
            loadColumnStatusesFromLocalStorage(newDefaultProject.id, user.id!);
            await addInitialTasksForProject(newDefaultProject.id, newDefaultProject.key, user.id!, user.name, activeColumnStatuses[0] || 'To Do');
            toast({ title: "Welcome!", description: `Default project "${newDefaultProject.name}" created for you.` });
          } else {
            setBackendError("Could not create a default project.");
            toast({ variant: "destructive", title: "Error", description: "Could not set up your default project." });
          }
        } else if (userProjects && userProjects.length > 0) {
          setAllProjects(userProjects);
          const activeProjectIdKey = getUserScopedKey('taskMasterActiveProjectId', user.id!);
          let activeProjectId = localStorage.getItem(activeProjectIdKey);
          let projectToSetActive = userProjects.find(p => p.id === activeProjectId) || userProjects[0];
          setCurrentProject(projectToSetActive);
          if (!activeProjectId || !userProjects.find(p => p.id === activeProjectId)) {
            localStorage.setItem(activeProjectIdKey, projectToSetActive.id);
          }
          loadColumnStatusesFromLocalStorage(projectToSetActive.id, user.id!);
        } else {
             setBackendError("Could not load project data from the backend.");
        }
      })
      .catch(err => {
        console.error("Error during project loading/creation:", err);
        setBackendError("An unexpected error occurred while loading projects.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isAuthenticated, user, defaultProjectDetails, toast, DEFAULT_PROJECT_ID, loadColumnStatusesFromLocalStorage, activeColumnStatuses]); // activeColumnStatuses added here for addInitialTasksForProject


  // Effect for loading tasks when currentProject or activeColumnStatuses change
  useEffect(() => {
    if (!currentProject || !isAuthenticated || !user?.id) {
      setTasks([]); 
      setIsLoadingTasks(false);
      // If no current project but user is logged in, reset columns to default.
      // This is crucial to break loops if activeColumnStatuses was a dependency here before splitting.
      if (!currentProject && user?.id && isAuthenticated) {
        setActiveColumnStatuses(prevStatuses => {
          const newDefault = [...DEFAULT_TASK_STATUSES];
          if (JSON.stringify(prevStatuses) !== JSON.stringify(newDefault)) {
            return newDefault;
          }
          return prevStatuses;
        });
      }
      return;
    }
    
    // Column statuses should be loaded by the project loading effect or handled if project changes.
    // If currentProject.id or user.id changes, loadColumnStatusesFromLocalStorage is called in the *other* effect.
    // This effect primarily focuses on task loading now.

    setIsLoadingTasks(true);
    setBackendError(null);

    getTasksByProjectId(currentProject.id, user.id)
      .then(async (fetchedTasks) => {
        if (fetchedTasks) {
          const firstColumn = activeColumnStatuses.length > 0 ? activeColumnStatuses[0] : 'To Do';
          if (fetchedTasks.length === 0 && currentProject.id === DEFAULT_PROJECT_ID) {
            const initialAdded = await addInitialTasksForProject(currentProject.id, currentProject.key, user.id!, user.name, firstColumn);
            if (initialAdded.length > 0) {
               setTasks(initialAdded.map(task => ({
                ...task,
                createdAt: task.createdAt instanceof Timestamp ? task.createdAt.toDate() : new Date(task.createdAt),
              })));
              toast({ title: "Default Tasks Added", description: "Initial set of tasks added to your default project." });
            } else {
              setTasks([]);
            }
          } else {
            setTasks(fetchedTasks.map(task => ({
              ...task,
              createdAt: task.createdAt instanceof Timestamp ? task.createdAt.toDate() : new Date(task.createdAt),
            })));
          }
        } else {
            setBackendError("Could not load tasks from the backend for the current project.");
            setTasks([]);
        }
      })
       .catch(err => {
        setBackendError("An unexpected error occurred while fetching tasks.");
        setTasks([]);
      })
      .finally(() => {
        setIsLoadingTasks(false);
      });
  }, [currentProject, isAuthenticated, user, activeColumnStatuses, DEFAULT_PROJECT_ID, toast]); // activeColumnStatuses is a dependency


  const handleOpenForm = (task?: Task) => {
    setTaskToEdit(task);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setTaskToEdit(undefined);
  };

  const handleSubmitTask = async (data: Omit<Task, 'id' | 'createdAt' | 'projectId' | 'category'> & { category?: string }, taskId?: string) => {
    if (!currentProject || !user?.id) {
        toast({ variant: "destructive", title: "Error", description: "Cannot save task: No active project or user." });
        return;
    }

    const processedData = {
      ...data,
      category: data.category ? `${currentProject.key}-${data.category.toUpperCase()}` : undefined,
    };

    if (taskId) {
      const originalTasks = [...tasks];
      const taskToUpdateOptimistic = tasks.find(t => t.id === taskId)!;
      const optimisticUpdatedTask = { ...taskToUpdateOptimistic, ...processedData, projectId: currentProject.id };

      setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? optimisticUpdatedTask : t));

      const result = await updateTaskAction(optimisticUpdatedTask, user.id);
      if (result) {
        const finalResult = { ...result, createdAt: result.createdAt instanceof Timestamp ? result.createdAt.toDate() : new Date(result.createdAt) };
        setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? finalResult : t));
        toast({ title: "Task Updated", description: `Task "${result.title}" has been updated.` });
      } else {
        setTasks(originalTasks);
        toast({ variant: "destructive", title: "Update Failed", description: "Could not update task in the database." });
      }
    } else {
      const tempId = `temp-${crypto.randomUUID()}`;
      const newTaskForOptimisticUI: Task = {
        ...processedData,
        id: tempId,
        createdAt: new Date(),
        projectId: currentProject.id,
        assignee: data.assignee,
        status: data.status || (activeColumnStatuses.length > 0 ? activeColumnStatuses[0] : 'To Do'), 
      };
      setTasks(prevTasks => [...prevTasks, newTaskForOptimisticUI]);

      const taskDataForAction: Omit<Task, 'id' | 'createdAt'> = {
        title: processedData.title,
        description: processedData.description,
        status: processedData.status || (activeColumnStatuses.length > 0 ? activeColumnStatuses[0] : 'To Do'),
        category: processedData.category,
        assignee: data.assignee,
        projectId: currentProject.id,
        priority: data.priority,
        effort: data.effort,
      };

      const result = await addTaskAction(taskDataForAction, user.id);
      if (result) {
        const finalResult = { ...result, createdAt: result.createdAt instanceof Timestamp ? result.createdAt.toDate() : new Date(result.createdAt) };
        setTasks(prevTasks => prevTasks.map(t => t.id === tempId ? finalResult : t).filter(Boolean) as Task[]);
        toast({ title: "Task Created", description: `New task "${result.title}" has been added.` });
      } else {
        setTasks(prevTasks => prevTasks.filter(t => t.id !== tempId));
        toast({ variant: "destructive", title: "Creation Failed", description: "Could not create task in the database." });
      }
    }
    handleCloseForm();
  };


  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, newStatus: TaskStatusType) => {
    e.preventDefault();
    if (!draggedTaskId || !currentProject || !user?.id) return;

    const originalTasks = [...tasks];
    const taskToMove = tasks.find(task => task.id === draggedTaskId);
    if (!taskToMove || taskToMove.status === newStatus) {
      setDraggedTaskId(null);
      return;
    }

    const updatedTask = { ...taskToMove, status: newStatus };
    setTasks(prevTasks => prevTasks.map(t => t.id === draggedTaskId ? updatedTask : t));

    const result = await updateTaskAction(updatedTask, user.id);
    if (result) {
      const finalResult = { ...result, createdAt: result.createdAt instanceof Timestamp ? result.createdAt.toDate() : new Date(result.createdAt) };
      setTasks(prevTasks => prevTasks.map(t => t.id === draggedTaskId ? finalResult : t));
      toast({ title: "Task Moved", description: `Task "${result.title}" moved to ${newStatus}.` });
    } else {
      setTasks(originalTasks);
      toast({ variant: "destructive", title: "Move Failed", description: "Could not update task status." });
    }
    setDraggedTaskId(null);
  };

  const filteredTasks = useMemo(() => {
    if (!currentProject) return [];
    return tasks.filter(task => {
      const term = searchTerm.toLowerCase();
      const descriptionMatch = task.description ? task.description.toLowerCase().includes(term) : false;
      return term
        ? task.title.toLowerCase().includes(term) ||
          descriptionMatch ||
          (task.category && task.category.toLowerCase().includes(term)) ||
          (task.assignee && task.assignee.toLowerCase().includes(term))
        : true;
    });
  }, [tasks, searchTerm, currentProject]);

  const handleDeleteTask = async (taskId: string) => {
    if (!currentProject || !user?.id) {
        toast({ variant: "destructive", title: "Error", description: "Cannot delete task: No active project or user." });
        return;
    }
    const taskTitle = tasks.find(t => t.id === taskId)?.title || "this task";
    const originalTasks = [...tasks];
    setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));

    const success = await deleteTaskAction(currentProject.id, taskId, user.id);
    if (success) {
        toast({ title: "Task Deleted", description: `Task "${taskTitle}" has been deleted.` });
    } else {
        setTasks(originalTasks);
        toast({ variant: "destructive", title: "Delete Failed", description: "Could not delete task from the database." });
    }
    setTaskToDelete(null);
  };

  const handleOpenDeleteConfirmation = (task: Task) => {
    setTaskToDelete(task);
  };

  const handleCreateNewColumn = () => {
    if (!currentProject || !user?.id) {
      toast({ variant: "destructive", title: "Error", description: "User or project not identified." });
      return;
    }
    const newName = newColumnNameInput.trim();
    if (!newName) {
      toast({ title: "Invalid Name", description: "Column name cannot be empty.", variant: "destructive" });
      return;
    }
    if (activeColumnStatuses.map(s => s.toLowerCase()).includes(newName.toLowerCase())) {
      toast({ title: "Duplicate Name", description: "A column with this name already exists.", variant: "destructive" });
      return;
    }

    const doneIndex = activeColumnStatuses.indexOf("Done");
    let newStatuses;
    if (doneIndex !== -1) {
      newStatuses = [
        ...activeColumnStatuses.slice(0, doneIndex),
        newName,
        ...activeColumnStatuses.slice(doneIndex)
      ];
    } else {
      newStatuses = [...activeColumnStatuses, newName];
    }
    setActiveColumnStatuses(newStatuses);
    saveColumnStatusesToLocalStorage(currentProject.id, user.id, newStatuses);
    toast({ title: "Column Created", description: `Column "${newName}" added.`});
    setIsAddColumnDialogOpen(false);
    setNewColumnNameInput('');
  };


  if (isLoading && isAuthenticated && user) {
    return (
      <div className="flex items-center justify-center flex-grow bg-background p-6">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading project data...</p>
      </div>
    );
  }

  if (backendError) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow bg-background p-6 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Backend Error</h2>
        <p className="text-muted-foreground max-w-md">{backendError}</p>
        <p className="text-xs text-muted-foreground mt-2">Please ensure Firebase is configured correctly and check server console logs.</p>
      </div>
    );
  }

  if (!currentProject && !isLoading && isAuthenticated && allProjects.length === 0 && user) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow bg-background p-6 text-center">
        <Inbox className="h-20 w-20 text-muted-foreground mb-6" />
        <h2 className="text-2xl font-semibold text-foreground mb-3">No Projects Found</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Attempting to set up a default project. If this persists, there might be a backend issue.
        </p>
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentProject && !isLoading && isAuthenticated && user) {
    return (
        <div className="flex flex-col items-center justify-center flex-grow bg-background p-6 text-center">
          <FileWarning className="h-12 w-12 text-destructive mb-4" />
          <p className="ml-4 text-lg text-muted-foreground mb-6">Could not load project data or no project selected. Select a project or create a new one.</p>
           <div className="flex gap-4">
            <Button asChild size="lg">
                <Link href="/project-setup">
                  <FolderPlus className="mr-2 h-5 w-5" /> Create New Project
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/projects">
                  <List className="mr-2 h-5 w-5" /> View All Projects
                </Link>
              </Button>
           </div>
        </div>
    );
  }

  const renderSkeletonColumns = () => (
    activeColumnStatuses.map(status => (
      <div key={status} className="bg-secondary p-3 rounded-lg flex flex-col flex-shrink-0 w-full md:w-[280px] lg:w-[300px] h-full animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-24 bg-muted rounded"></div>
            <div className="h-5 w-8 bg-muted rounded-full"></div>
          </div>
        </div>
        <div className="space-y-3 overflow-y-auto flex-grow min-h-[100px] pr-1">
          {[1, 2].map(i => (
            <div key={i} className="p-3 bg-card border rounded-md shadow-sm">
              <div className="h-4 w-3/4 bg-muted rounded mb-2.5"></div>
              <div className="flex items-center justify-between">
                <div className="h-4 w-1/4 bg-muted rounded"></div>
                <div className="h-6 w-6 bg-muted rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
        {status === (activeColumnStatuses[0] || "To Do") && (
           <div className="mt-3 w-full h-9 bg-muted/50 rounded p-2 flex items-center">
             <div className="h-4 w-4 bg-muted rounded mr-2"></div>
             <div className="h-4 w-16 bg-muted rounded"></div>
           </div>
        )}
      </div>
    ))
  );

  const renderEmptyStateForTasks = () => {
    if (!currentProject) return null;
    return (
      <div className="flex flex-col items-center justify-center text-center p-10 col-span-full">
        <Inbox className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">No Tasks Yet for {currentProject.name}</h3>
        <p className="text-muted-foreground mb-4">Get started by creating your first task for this project.</p>
        <Button onClick={() => handleOpenForm()}>
          <Plus className="mr-2 h-4 w-4" /> Create Task
        </Button>
      </div>
    );
  };

  const renderNoSearchResultsState = () => {
     return (
        <div className="flex flex-col items-center justify-center text-center p-10 col-span-full">
          <FileWarning className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No Tasks Found Matching Your Search</h3>
          <p className="text-muted-foreground">Try adjusting your search term.</p>
        </div>
      );
  }

  return (
    <div className="p-4 md:p-6 flex-grow flex flex-col bg-background">
      {currentProject && (
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-4 border-b gap-3 sm:gap-0">
          <div className="flex items-center gap-2">
            <Briefcase className="h-7 w-7 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{currentProject.name}</h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem disabled>
                  <Settings className="mr-2 h-4 w-4" />
                  Project Settings (Soon)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/project-setup">
                    <FolderPlus className="mr-2 h-4 w-4" />
                    New Project
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/projects">
                    <List className="mr-2 h-4 w-4" />
                    View All Projects
                  </Link>
                </DropdownMenuItem>

                {allProjects.filter(p => p.id !== currentProject?.id).length > 0 && <DropdownMenuSeparator />}
                {allProjects.filter(p => p.id !== currentProject?.id).map(p => (
                  <DropdownMenuItem key={p.id} onSelect={() => {
                    if(user?.id) {
                      const activeProjIdKey = getUserScopedKey('taskMasterActiveProjectId', user.id);
                      localStorage.setItem(activeProjIdKey, p.id);
                      setCurrentProject(p); 
                    }
                  }}>
                    Switch to: {p.name} ({p.key})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="relative flex-grow sm:flex-grow-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                className="pl-8 pr-2 py-2 h-9 w-full sm:w-40 md:w-48 text-sm rounded-md"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search tasks in current project"
              />
            </div>
            <div className="flex -space-x-2">
              <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarImage src={user?.avatar || "https://placehold.co/32x32.png?text=U"} alt={user?.name || "User"} data-ai-hint="user avatar"/>
                <AvatarFallback><User className="h-4 w-4"/></AvatarFallback>
              </Avatar>
              <Avatar className="h-8 w-8 border-2 border-background">
                  <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold"><Users size={16}/></AvatarFallback>
              </Avatar>
            </div>
            <Button onClick={() => handleOpenForm()} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md whitespace-nowrap">
              <Plus className="h-4 w-4 mr-1 sm:mr-1.5" /> <span className="hidden sm:inline">New Task</span><span className="sm:hidden">Task</span>
            </Button>
          </div>
        </header>
      )}

      <main className="flex-grow flex flex-row gap-4 overflow-x-auto pb-4 items-start">
        {isLoadingTasks || (isLoading && !currentProject) ? (
          renderSkeletonColumns()
        ) : !currentProject && !backendError ? (
          <div className="flex-grow flex items-center justify-center text-muted-foreground">
             {isAuthenticated && user ? "Determining active project..." : "Please log in to view tasks."}
          </div>
        ) : currentProject && tasks.length === 0 && !searchTerm && !isLoadingTasks ? (
            renderEmptyStateForTasks()
        ) : currentProject && filteredTasks.length === 0 && searchTerm && !isLoadingTasks ? (
            renderNoSearchResultsState()
        ) : currentProject && filteredTasks.length > 0 && !isLoadingTasks ? (
            activeColumnStatuses.map(status => (
              <TaskColumn
                key={status}
                status={status}
                tasks={filteredTasks.filter(task => task.status === status).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onEditTask={handleOpenForm}
                onDeleteTask={handleOpenDeleteConfirmation}
                onDragStartTask={handleDragStart}
                onOpenForm={() => handleOpenForm()}
                isFirstColumn={status === (activeColumnStatuses[0] || "To Do")}
              />
            ))
        ) : null 
        }
        {currentProject && !isLoadingTasks && (
            <div className="flex-shrink-0 w-full md:w-auto self-start pt-0">
                 <Button 
                    variant="outline" 
                    className="mt-[44px] h-[40px] w-full md:w-auto text-muted-foreground hover:text-foreground border-dashed"
                    onClick={() => setIsAddColumnDialogOpen(true)}
                    aria-label="Add new column"
                >
                    <Plus className="h-4 w-4 mr-2" /> Add Column
                </Button>
            </div>
        )}
      </main>
      {currentProject && (
        <TaskForm
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSubmit={handleSubmitTask}
          taskToEdit={taskToEdit}
          projectKey={currentProject.key}
          availableStatuses={activeColumnStatuses}
        />
      )}
      {taskToDelete && (
        <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this task?</AlertDialogTitle>
              <AlertDialogDescription>
                Task: &quot;{taskToDelete.title}&quot; will be permanently deleted. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTaskToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeleteTask(taskToDelete.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <Dialog open={isAddColumnDialogOpen} onOpenChange={setIsAddColumnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Column</DialogTitle>
            <DialogDescription>
              Enter a name for your new Kanban column. It will be added before the &quot;Done&quot; column if it exists.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="new-column-name" className="text-right">Name</label>
              <Input
                id="new-column-name"
                value={newColumnNameInput}
                onChange={(e) => setNewColumnNameInput(e.target.value)}
                placeholder="E.g., QA Review"
                className="col-span-3"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNewColumn(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {setIsAddColumnDialogOpen(false); setNewColumnNameInput('');}}>Cancel</Button>
            <Button onClick={handleCreateNewColumn}>
                <Columns className="mr-2 h-4 w-4" /> Create Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    