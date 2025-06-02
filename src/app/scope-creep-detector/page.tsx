
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Navbar } from '@/components/navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert, DownloadCloud, AlertTriangle, Info } from 'lucide-react';
import { type ScopeCreepInput, type ScopeCreepOutput, detectScopeCreep } from '@/ai/flows/scope-creep-detector-flow';
import { getTasksByProjectId } from '@/lib/actions/taskActions';
import type { Task } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const ScopeCreepClientInputSchema = z.object({
  currentTasksText: z.string().min(1, "Current sprint tasks cannot be empty."),
  originalTasksText: z.string().optional(),
  sprintGoal: z.string().optional(),
});

const getUserScopedKey = (baseKey: string, userId?: string): string => {
  if (!userId) return `${baseKey}-unauthenticated`;
  return `${baseKey}-${userId}`;
};

export default function ScopeCreepDetectorPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [aiResponse, setAiResponse] = useState<ScopeCreepOutput | null>(null);
  const [isSubmittingToAI, setIsSubmittingToAI] = useState(false);
  const [isFetchingProjectTasks, setIsFetchingProjectTasks] = useState(false);

  const form = useForm<ScopeCreepInput>({
    resolver: zodResolver(ScopeCreepClientInputSchema),
    defaultValues: {
      currentTasksText: '',
      originalTasksText: '',
      sprintGoal: '',
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/scope-creep-detector');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleFetchCurrentProjectTasks = async () => {
    if (!user?.id) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in." });
      return;
    }
    setIsFetchingProjectTasks(true);
    const activeProjectIdKey = getUserScopedKey('taskMasterActiveProjectId', user.id);
    const activeProjectId = localStorage.getItem(activeProjectIdKey);

    if (!activeProjectId) {
      toast({ variant: "destructive", title: "No Active Project", description: "Select a project on the board page." });
      setIsFetchingProjectTasks(false);
      return;
    }

    try {
      const projectTasks: Task[] = await getTasksByProjectId(activeProjectId, user.id);
      const activeSprintTasks = projectTasks.filter(
        task => task.status === 'To Do' || task.status === 'In Progress' || task.status === 'In Review'
      );

      if (activeSprintTasks.length > 0) {
        const formattedTasks = activeSprintTasks
          .map(task => `${task.title}${task.description ? ` - ${task.description}` : ''} (Status: ${task.status})`)
          .join('\n');
        form.setValue('currentTasksText', formattedTasks);
        toast({ title: "Tasks Loaded", description: "Active tasks (To Do, In Progress, In Review) from your project loaded." });
      } else {
        form.setValue('currentTasksText', '');
        toast({ title: "No Active Tasks", description: "No tasks found in 'To Do', 'In Progress', or 'In Review' for the active project." });
      }
    } catch (error) {
      console.error("Failed to fetch project tasks:", error);
      toast({ variant: "destructive", title: "Error Loading Tasks", description: "Could not load tasks." });
    } finally {
      setIsFetchingProjectTasks(false);
    }
  };

  const onSubmit = async (data: ScopeCreepInput) => {
    setIsSubmittingToAI(true);
    setAiResponse(null);
    try {
      const response = await detectScopeCreep(data);
      setAiResponse(response);
      toast({
        title: 'Scope Analysis Complete!',
        description: 'The AI has analyzed the sprint scope.',
      });
    } catch (error) {
      console.error('AI Scope Creep Analysis Error:', error);
      toast({
        variant: 'destructive',
        title: 'AI Error',
        description: 'Could not analyze scope. Please try again.',
      });
      setAiResponse({ analysisReport: "Error generating analysis.", creepLevel: "None", recommendations: "An unexpected error occurred." });
    } finally {
      setIsSubmittingToAI(false);
    }
  };
  
  const getCreepLevelColor = (level: ScopeCreepOutput['creepLevel'] | undefined) => {
    switch (level) {
      case "None": return "text-green-600 dark:text-green-500";
      case "Low": return "text-yellow-600 dark:text-yellow-500";
      case "Moderate": return "text-orange-600 dark:text-orange-500";
      case "High": return "text-red-600 dark:text-red-500";
      default: return "text-foreground";
    }
  };


  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <Card className="max-w-3xl mx-auto shadow-xl bg-card/90 backdrop-blur-sm">
          <CardHeader className="text-center border-b pb-6">
            <div className="mx-auto bg-primary/10 p-3 rounded-full mb-4 inline-block">
              <ShieldAlert className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">AI Scope Creep Detector</CardTitle>
            <CardDescription>
              Analyze your sprint for potential scope creep. Load current tasks or paste manually.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="p-6 space-y-6">
                <FormField
                  control={form.control}
                  name="currentTasksText"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between items-center mb-1">
                        <FormLabel>Current Sprint Tasks</FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleFetchCurrentProjectTasks}
                          disabled={isFetchingProjectTasks || authLoading || !isAuthenticated || !user}
                        >
                          {isFetchingProjectTasks ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <DownloadCloud className="mr-2 h-4 w-4" />
                          )}
                          Load Current Tasks
                        </Button>
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder="Paste all tasks currently in the sprint. Include details like priority and estimates if available. Or use the button above."
                          {...field}
                          rows={6}
                          className="text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="originalTasksText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Original Sprint Tasks (Optional Baseline)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Paste the tasks originally committed to at the start of the sprint. This helps the AI detect newly added items."
                          {...field}
                          rows={4}
                          className="text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sprintGoal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sprint Goal (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Launch V1 of user authentication" {...field} />
                      </FormControl>
                      <FormMessage />
                       <p className="text-xs text-muted-foreground pt-1">
                            A clear goal helps the AI assess task relevance.
                        </p>
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="border-t p-6">
                <Button type="submit" className="w-full sm:w-auto" disabled={isSubmittingToAI || !form.formState.isValid}>
                  {isSubmittingToAI ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldAlert className="mr-2 h-4 w-4" />
                  )}
                  Analyze Scope Creep
                </Button>
              </CardFooter>
            </form>
          </Form>

          {aiResponse && (
            <div className="p-6 border-t">
              <Separator className="my-6" />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-6 w-6 text-primary" />
                    Scope Analysis Report
                  </CardTitle>
                  <CardDescription className={cn("font-semibold text-lg", getCreepLevelColor(aiResponse.creepLevel))}>
                    Scope Creep Level: {aiResponse.creepLevel}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap bg-muted/50 p-4 rounded-md text-sm font-mono overflow-x-auto">
                    {aiResponse.analysisReport}
                  </pre>
                </CardContent>
              </Card>

              {aiResponse.recommendations && (
                <Card className="mt-6 border-accent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-accent-foreground">
                       <AlertTriangle className="h-6 w-6 text-accent" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap bg-accent/10 p-4 rounded-md text-sm font-mono overflow-x-auto">
                        {aiResponse.recommendations}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

    
