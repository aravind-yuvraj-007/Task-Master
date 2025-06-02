
import type { Task, TaskStatus } from '@/types'; // TaskStatus is now string
import { TaskCard } from './task-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Plus, Trash2 } from 'lucide-react';

interface TaskColumnProps {
  status: TaskStatus; // This is now a string
  tasks: Task[];
  onDrop: (e: React.DragEvent<HTMLDivElement>, status: TaskStatus) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void; // Added for delete
  onDragStartTask: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
  onOpenForm: () => void;
  isFirstColumn: boolean; // To show "+ Create" only on the first column
}

export function TaskColumn({ status, tasks, onDrop, onDragOver, onEditTask, onDeleteTask, onDragStartTask, onOpenForm, isFirstColumn }: TaskColumnProps) {
  return (
    <div
      onDrop={(e) => onDrop(e, status)}
      onDragOver={onDragOver}
      className="bg-secondary p-3 rounded-lg flex flex-col flex-shrink-0 w-full md:w-[280px] lg:w-[300px] h-full"
      data-testid={`column-${status.toLowerCase().replace(/ /g, '-')}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{status}</h2>
          <Badge variant="secondary" className="text-xs px-1.5 py-0.5">{tasks.length}</Badge>
          {status.toLowerCase() === "done" && <Check className="h-4 w-4 text-green-600" />}
        </div>
      </div>
      <div className="space-y-3 overflow-y-auto flex-grow min-h-[100px] pr-1">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskCard 
                key={task.id} 
                task={task} 
                onEdit={onEditTask} 
                onDelete={onDeleteTask} 
                onDragStart={onDragStartTask} 
            />
          ))
        ) : (
          <div className="text-xs text-muted-foreground text-center pt-8 flex-grow flex items-center justify-center">
            Drop tasks here or use '+' to create.
          </div>
        )}
      </div>
      {isFirstColumn && ( // Only show "+ Create" for the first column (typically "To Do")
        <Button 
          variant="ghost" 
          onClick={onOpenForm} 
          className="mt-3 w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted text-sm p-2"
        >
          <Plus className="h-4 w-4 mr-2" /> Create
        </Button>
      )}
    </div>
  );
}
