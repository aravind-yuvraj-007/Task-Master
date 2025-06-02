
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Navbar } from '@/components/navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2, Lightbulb, DraftingCompass, AlertTriangle, DownloadCloud, ListChecks, ThumbsDown } from 'lucide-react';
import { type SprintPlanInput, type SprintPlanOutput, suggestSprintPlan } from '@/ai/flows/sprint-planner-flow';
import { getTasksByProjectId } from '@/lib/actions/taskActions';
import type { Task } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

const SprintPlanInputClientSchema = z.object({
  tasksText: z.string().min(1, "Tasks text cannot be empty.").describe('A textual list of all upcoming tasks. Each task should be on a new line in the format: <Task Title> – <Priority: High/Medium/Low> – <Story Points: number>.'),
  sprintDuration: z.string().optional().describe("The duration of the sprint (e.g., '2 weeks', '10 working days')."),
  teamSize: z.string().optional().describe("The size or composition of the team (e.g., '5 developers', '3 devs, 1 QA')."),
  teamStoryPointCapacity: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? undefined : Number(val),
    z.number({ invalid_type_error: "Story point capacity must be a number." }).nonnegative("Story points must be non-negative.").optional()
  ).describe("The total story point capacity for the team for this sprint (as a number)."),
  sprintGoal: z.string().optional().describe('An optional overall goal for the sprint to help focus task selection.'),
});

const getUserScopedKey = (baseKey: string, userId?: string): string => {
  if (!userId) return `${baseKey}-unauthenticated`;
  return `${baseKey}-${userId}`;
};


export default function SprintPlannerPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [aiResponse, setAiResponse] = useState<SprintPlanOutput | null>(null);
  const [isSubmittingToAI, setIsSubmittingToAI] = useState(false);
  const [isFetchingProjectTasks, setIsFetchingProjectTasks] = useState(false);

  const form = useForm<SprintPlanInput>({ // SprintPlanInput is from the flow
    resolver: zodResolver(SprintPlanInputClientSchema), // Resolved against client schema
    defaultValues: {
      tasksText: '',
      sprintDuration: '2 weeks',
      teamSize: '3 developers',
      teamStoryPointCapacity: undefined, 
      sprintGoal: '',
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/sprint-planner');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleFetchProjectTasks = async () => {
    if (!user || !user.id) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in to load project tasks." });
      return;
    }

    setIsFetchingProjectTasks(true);
    const activeProjectIdKey = getUserScopedKey('taskMasterActiveProjectId', user.id);
    const activeProjectId = localStorage.getItem(activeProjectIdKey);

    if (!activeProjectId) {
      toast({ variant: "destructive", title: "No Active Project", description: "Please select a project on the board page first." });
      setIsFetchingProjectTasks(false);
      return;
    }

    try {
      const projectTasks = await getTasksByProjectId(activeProjectId, user.id);

      if (projectTasks && projectTasks.length > 0) {
        const todoTasks = projectTasks.filter(task => task.status === 'To Do');
        
        if (todoTasks.length > 0) {
          const formattedTasks = todoTasks
            .map(task => {
              const title = task.title || "Untitled Task";
              const priority = task.priority || 'N/A';
              const effort = task.effort || 0;
              return `${title} – ${priority} – ${effort}`;
            })
            .join('\n');
          form.setValue('tasksText', formattedTasks);
          toast({ title: "Tasks Loaded", description: `'To Do' tasks from your active project have been loaded. Format: Title – Priority – Story Points.` });
        } else {
          form.setValue('tasksText', '');
          toast({ title: "No 'To Do' Tasks", description: "No tasks found in the 'To Do' column of your active project." });
        }
      } else {
        form.setValue('tasksText', '');
        toast({ title: "No Tasks Found", description: "No tasks found for the active project in Firestore." });
      }
    } catch (error) {
      console.error("[SprintPlannerPage] handleFetchProjectTasks: Failed to fetch project tasks:", error);
      toast({ variant: "destructive", title: "Error Loading Tasks", description: "Could not load tasks. Check console logs." });
    } finally {
      setIsFetchingProjectTasks(false);
    }
  };


  const onSubmit = async (data: SprintPlanInput) => {
    setIsSubmittingToAI(true);
    setAiResponse(null); // Clear previous response
    try {
      // The 'data' object from RHF (after Zod validation) already has 
      // teamStoryPointCapacity correctly typed as number | undefined.
      // No need for redundant re-processing in a 'submissionData' object for this field.
      const response = await suggestSprintPlan(data); // Pass data directly
      setAiResponse(response);
      toast({
        title: 'Sprint Plan Suggested!',
        description: 'The AI has generated a sprint plan for you.',
      });
    } catch (error) {
      console.error('[SprintPlannerPage] onSubmit AI Sprint Plan Error:', error);
      let errorMessage = 'Could not generate sprint plan. Please try again.';
      if (error instanceof Error) {
         if (error.message.includes("503") || error.message.toLowerCase().includes("model is overloaded") || error.message.toLowerCase().includes("service unavailable")) {
            errorMessage = `The AI service is currently overloaded or unavailable (${error.message.match(/50\d|overloaded|unavailable/i)?.[0] || 'Error'}). Please try again in a few moments.`;
        } else if (error.message.startsWith("AI_EMPTY_RESPONSE:") || error.message.startsWith("AI_FORMAT_ERROR:")) {
            errorMessage = error.message; // Use the specific error message from the flow
        } else {
            errorMessage = error.message || errorMessage;
        }
      }
      toast({
        variant: 'destructive',
        title: 'AI Error',
        description: errorMessage,
      });
      setAiResponse(null); // Ensure aiResponse is null on error
    } finally {
      setIsSubmittingToAI(false);
    }
  };
  
  const parseSprintPlanSection = (planText: string, sectionHeading: string): string[] => {
    const sectionRegex = new RegExp(`## ${sectionHeading}\\s*([\\s\\S]*?)(?=##|$)`, 'i');
    const match = planText.match(sectionRegex);
    if (match && match[1]) {
      return match[1].trim().split('\n').map(line => line.replace(/^- /, '').trim()).filter(line => line.length > 0);
    }
    return [];
  };

  const parseWarningsOrSuggestions = (warningsText: string | undefined): string[] => {
    if (!warningsText) return [];
    return warningsText.replace(/## Warnings & Suggestions\s*/i, '').trim().split('\n').map(line => line.replace(/^- /, '').trim()).filter(line => line.length > 0);
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
              <DraftingCompass className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">AI Sprint Planner</CardTitle>
            <CardDescription>
              Input tasks, team/sprint details, and goal. Load 'To Do' tasks from your current project.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="p-6 space-y-6">
                <FormField
                  control={form.control}
                  name="tasksText"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between items-center mb-1">
                        <FormLabel>Upcoming Tasks</FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleFetchProjectTasks}
                          disabled={isFetchingProjectTasks || authLoading || !isAuthenticated || !user}
                        >
                          {isFetchingProjectTasks ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <DownloadCloud className="mr-2 h-4 w-4" />
                          )}
                          Load Project 'To Do's
                        </Button>
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder="Paste tasks here, one per line. Format: Task Title – Priority – Story Points (e.g., Implement login – High – 5)"
                          {...field}
                          rows={8}
                          className="text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground pt-1">
                        Example: "Fix login bug – Critical – 3\nDevelop profile page – High – 8\nUpdate docs – Low – 1"
                      </p>
                    </FormItem>
                  )}
                />
                <div className="grid md:grid-cols-3 gap-4">
                    <FormField
                    control={form.control}
                    name="sprintDuration"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Sprint Duration</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., 2 weeks" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="teamSize"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Team Size/Composition</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., 5 developers" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                      control={form.control}
                      name="teamStoryPointCapacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Team Story Point Capacity</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="e.g., 40 (optional)" 
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
                    name="sprintGoal"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Sprint Goal (Optional)</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Launch V1 of billing feature" {...field} />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground pt-1">
                            A clear goal helps the AI prioritize tasks.
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
                    <Lightbulb className="mr-2 h-4 w-4" />
                  )}
                  Suggest Sprint Plan
                </Button>
              </CardFooter>
            </form>
          </Form>

          {isSubmittingToAI && (
            <div className="p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="mt-2 text-muted-foreground">AI is drafting your sprint plan...</p>
            </div>
          )}

          {aiResponse && !isSubmittingToAI && (
            <div className="p-6 border-t space-y-6">
              <Separator/>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ListChecks className="h-6 w-6 text-primary" />
                    Selected for Sprint
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {parseSprintPlanSection(aiResponse.sprintPlan, "Sprint Plan").length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-2">
                      {parseSprintPlanSection(aiResponse.sprintPlan, "Sprint Plan").map((item, index) => <li key={`plan-${index}`}>{item}</li>)}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">The AI did not suggest any tasks for the sprint based on the input.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ThumbsDown className="h-6 w-6 text-muted-foreground" />
                    Deferred Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {parseSprintPlanSection(aiResponse.sprintPlan, "Deferred Tasks").length > 0 ? (
                     <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-2">
                      {parseSprintPlanSection(aiResponse.sprintPlan, "Deferred Tasks").map((item, index) => <li key={`defer-${index}`}>{item}</li>)}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">N/A</p>
                  )}
                </CardContent>
              </Card>
              
              {aiResponse.warningsOrSuggestions && (
                 <Card className="border-amber-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-500 text-lg">
                       <AlertTriangle className="h-6 w-6" />
                      Warnings & Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                     {parseWarningsOrSuggestions(aiResponse.warningsOrSuggestions).length > 0 ? (
                        <ul className="list-disc list-inside space-y-1 text-sm text-amber-800 dark:text-amber-300 pl-2">
                          {parseWarningsOrSuggestions(aiResponse.warningsOrSuggestions).map((item, index) => <li key={`warn-${index}`}>{item}</li>)}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No specific warnings or suggestions provided by the AI.</p>
                      )}
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
