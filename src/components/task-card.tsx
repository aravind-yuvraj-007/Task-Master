
import type { Task } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserCircle, Trash2 } from 'lucide-react';
import { Button } from './ui/button';

interface TaskCardProps {
  task: Task;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskCard({ task, onDragStart, onEdit, onDelete }: TaskCardProps) {
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card's onClick (edit) from firing
    onDelete(task);
  };

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onEdit(task)}
      className="cursor-pointer shadow-sm hover:shadow-md transition-shadow duration-150 bg-card border rounded-md group relative"
    >
      <CardContent className="p-3 flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <span className="text-sm font-medium text-foreground line-clamp-2 leading-snug pr-6">{task.title}</span>
        </div>
        <div className="flex items-center justify-between">
          {task.category && (
            <Badge 
              variant="outline" 
              className="text-xs px-1.5 py-0.5 font-normal border-green-300 bg-green-50 text-green-700"
            >
              {task.category}
            </Badge>
          )}
          {task.assignee ? (
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                {task.assignee.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <UserCircle className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardContent>
      <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleDeleteClick}
          aria-label="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </Card>
  );
}
