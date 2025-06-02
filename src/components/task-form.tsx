
'use client';

import type { Task } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
// Removed: import { suggestTaskCategory } from '@/ai/flows/suggest-task-category';
import { useToast } from '@/hooks/use-toast';
// Removed: import { Wand2, Loader2 } from 'lucide-react'; // Wand2 no longer needed
import { Loader2 } from 'lucide-react'; // Loader2 might still be used for form submission
import { useState, useEffect } from 'react';

const taskPriorities = ['Low', 'Medium', 'High', 'Critical'] as const;

const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title must be 100 characters or less"),
  description: z.string().min(1, "Description is required").max(500, "Description must be 500 characters or less"),
  status: z.string().min(1, "Status is required"),
  category: z.string().max(20, "Identifier/tag must be 20 characters or less (e.g., 'FEAT-101', 'FIX')").optional(),
  assignee: z.string().max(10, "Assignee initials must be 10 characters or less").optional(),
  priority: z.enum(taskPriorities).optional(),
  effort: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? undefined : Number(val),
    z.number({ invalid_type_error: "Effort must be a number." }).nonnegative("Effort must be non-negative.").optional()
  ),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Task, 'id' | 'createdAt' | 'projectId' | 'category'> & { category?: string }, taskId?: string) => void;
  taskToEdit?: Task;
  projectKey: string;
  availableStatuses: string[];
}

export function TaskForm({ isOpen, onClose, onSubmit, taskToEdit, projectKey, availableStatuses }: TaskFormProps) {
  // Removed: const { toast } = useToast();
  // Removed: const [isSuggesting, setIsSuggesting] = useState(false);

  const firstStatus = availableStatuses.length > 0 ? availableStatuses[0] : "To Do";

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      status: firstStatus,
      category: '',
      assignee: '',
      priority: 'Medium',
      effort: undefined,
    },
  });

  useEffect(() => {
    const currentFirstStatus = availableStatuses.length > 0 ? availableStatuses[0] : "To Do";
    if (taskToEdit) {
      let categorySuffix = taskToEdit.category || '';
      if (taskToEdit.category && taskToEdit.category.startsWith(`${projectKey}-`)) {
        categorySuffix = taskToEdit.category.substring(projectKey.length + 1);
      } else if (taskToEdit.category === projectKey) { 
        categorySuffix = '';
      }

      form.reset({
        title: taskToEdit.title,
        description: taskToEdit.description,
        status: availableStatuses.includes(taskToEdit.status) ? taskToEdit.status : currentFirstStatus,
        category: categorySuffix,
        assignee: taskToEdit.assignee || '',
        priority: taskToEdit.priority || 'Medium',
        effort: taskToEdit.effort === undefined || isNaN(Number(taskToEdit.effort)) ? undefined : Number(taskToEdit.effort),
      });
    } else {
      form.reset({
        title: '',
        description: '',
        status: currentFirstStatus,
        category: '',
        assignee: '',
        priority: 'Medium',
        effort: undefined,
      });
    }
  }, [taskToEdit, form, isOpen, projectKey, availableStatuses]);

  // Removed handleSuggestCategory function

  const handleSubmit = (data: TaskFormValues) => {
    const submissionData = {
      title: data.title,
      description: data.description,
      status: data.status,
      category: data.category?.trim() || undefined,
      assignee: data.assignee?.trim() || undefined,
      priority: data.priority,
      effort: data.effort === undefined || isNaN(Number(data.effort)) ? undefined : Number(data.effort),
    };
    onSubmit(submissionData, taskToEdit?.id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[520px] bg-card">
        <DialogHeader>
          <DialogTitle>{taskToEdit ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          <DialogDescription>
            {taskToEdit ? 'Update the details of your task.' : 'Fill in the details for your new task.'}
            Task identifiers will be prefixed with '{projectKey}-'.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g., Develop new feature" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Provide details about the task..." {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableStatuses.map(status => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="assignee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignee</FormLabel>
                    <FormControl>
                      <Input placeholder="E.g., U1 or AK (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {taskPriorities.map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="effort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effort (Story Points)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="E.g., 3 (optional)" 
                          {...field} 
                          value={field.value === undefined ? '' : field.value}
                          onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            <FormField
              control={form.control}
              name="category" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Identifier Suffix</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Input placeholder="E.g., FEAT-101, FIX (optional)" {...field} />
                    </FormControl>
                    {/* Suggest button removed */}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {taskToEdit ? 'Save Changes' : 'Create Task'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
