
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
import { Loader2, DownloadCloud, MessageSquareText, CheckCircle, AlertTriangle, ListChecks } from 'lucide-react';
import { type SprintRetrospectiveInput, type SprintRetrospectiveOutput, generateSprintRetrospective } from '@/ai/flows/retrospective-generator-flow';
import { getTasksByProjectId } from '@/lib/actions/taskActions';
import type { Task } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

const SprintRetrospectiveClientInputSchema = z.object({
  tasksJson: z.string().min(1, "Tasks JSON cannot be empty. Load or paste tasks for the sprint."),
  sprintGoal: z.string().optional(),
  teamSentiment: z.string().optional(),
  additionalNotes: z.string().optional(),
});

const getUserScopedKey = (baseKey: string, userId?: string): string => {
  if (!userId) return `${baseKey}-unauthenticated`;
  return `${baseKey}-${userId}`;
};

export default function RetrospectiveGeneratorPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [aiResponse, setAiResponse] = useState<SprintRetrospectiveOutput | null>(null);
  const [isSubmittingToAI, setIsSubmittingToAI] = useState(false);
  const [isFetchingProjectTasks, setIsFetchingProjectTasks] = useState(false);

  const form = useForm<SprintRetrospectiveInput>({
    resolver: zodResolver(SprintRetrospectiveClientInputSchema),
    defaultValues: {
      tasksJson: '',
      sprintGoal: '',
      teamSentiment: '',
      additionalNotes: '',
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/retrospective-generator');
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
       // For retrospective, all tasks (Done, In Progress, To Do) can be relevant
      const relevantTasks = projectTasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        category: task.category,
        assignee: task.assignee,
        priority: task.priority,
        effort: task.effort,
        createdAt: task.createdAt.toISOString(), // Ensure date is in a consistent format
      }));

      if (relevantTasks.length > 0) {
        form.setValue('tasksJson', JSON.stringify(relevantTasks, null, 2));
        toast({ title: "Tasks Loaded", description: "All tasks from your active project loaded as JSON. Edit as needed for your sprint retrospective." });
      } else {
        form.setValue('tasksJson', '[]');
        toast({ title: "No Tasks Found", description: "No tasks found for the active project." });
      }
    } catch (error) {
      console.error("Failed to fetch project tasks:", error);
      toast({ variant: "destructive", title: "Error Loading Tasks", description: "Could not load tasks." });
    } finally {
      setIsFetchingProjectTasks(false);
    }
  };

  const onSubmit = async (data: SprintRetrospectiveInput) => {
    setIsSubmittingToAI(true);
    setAiResponse(null);
    try {
      // Basic JSON validation before sending to AI
      JSON.parse(data.tasksJson);
    } catch (e) {
        toast({ variant: 'destructive', title: 'Invalid JSON', description: 'The tasks data is not valid JSON. Please check the format or reload tasks.' });
        setIsSubmittingToAI(false);
        return;
    }

    try {
      const response = await generateSprintRetrospective(data);
      setAiResponse(response);
      toast({
        title: 'Retrospective Generated!',
        description: 'The AI has generated a sprint retrospective.',
      });
    } catch (error) {
      console.error('AI Retrospective Generation Error:', error);
      toast({
        variant: 'destructive',
        title: 'AI Error',
        description: 'Could not generate retrospective. Please try again.',
      });
    } finally {
      setIsSubmittingToAI(false);
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
        <Card className="max-w-4xl mx-auto shadow-xl bg-card/90 backdrop-blur-sm">
          <CardHeader className="text-center border-b pb-6">
            <div className="mx-auto bg-primary/10 p-3 rounded-full mb-4 inline-block">
              <MessageSquareText className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">AI Sprint Retrospective Generator</CardTitle>
            <CardDescription>
              Provide sprint data to generate a retrospective. Load tasks from your active project or paste manually.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="p-6 space-y-6">
                <FormField
                  control={form.control}
                  name="tasksJson"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between items-center mb-1">
                        <FormLabel>Sprint Tasks Data (JSON Array)</FormLabel>
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
                          Load Project Tasks
                        </Button>
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder='Paste tasks related to the sprint as JSON array, or click "Load Project Tasks". E.g., [{"id":"1","title":"Task A","status":"Done",...}]'
                          {...field}
                          rows={8}
                          className="text-sm font-mono"
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
                        <Input placeholder="e.g., Successfully launch the new user dashboard" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="teamSentiment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team Sentiment (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="E.g., Team was highly motivated but some felt rushed towards the end."
                          {...field}
                          rows={2}
                          className="text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="additionalNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Notes/Observations (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="E.g., Key dependencies were delivered late. Positive feedback received on Feature X demo."
                          {...field}
                          rows={3}
                          className="text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="border-t p-6">
                <Button type="submit" className="w-full sm:w-auto" disabled={isSubmittingToAI || !form.formState.isValid}>
                  {isSubmittingToAI ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquareText className="mr-2 h-4 w-4" />
                  )}
                  Generate Retrospective
                </Button>
              </CardFooter>
            </form>
          </Form>

          {isSubmittingToAI && (
            <div className="p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="mt-2 text-muted-foreground">AI is generating retrospective...</p>
            </div>
          )}

          {aiResponse && !isSubmittingToAI && (
            <div className="p-6 border-t space-y-8">
              <Separator />
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-semibold">Sprint Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground bg-muted/50 p-4 rounded-md">{aiResponse.sprintSummary}</p>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-green-500">
                  <CardHeader>
                    <CardTitle className="flex items-center text-green-700 dark:text-green-500"><CheckCircle className="h-6 w-6 mr-2"/>What Went Well</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-2 text-sm pl-2">
                      {aiResponse.whatWentWell.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-amber-500">
                  <CardHeader>
                    <CardTitle className="flex items-center text-amber-700 dark:text-amber-500"><AlertTriangle className="h-6 w-6 mr-2"/>What Could Be Improved</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <ul className="list-disc list-inside space-y-2 text-sm pl-2">
                      {aiResponse.whatCouldBeImproved.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                  </CardContent>
                </Card>
              </div>
              
              <Card className="border-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center text-blue-700 dark:text-blue-500"><ListChecks className="h-6 w-6 mr-2"/>Action Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-2 text-sm pl-2">
                    {aiResponse.actionItems.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                </CardContent>
              </Card>

            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
