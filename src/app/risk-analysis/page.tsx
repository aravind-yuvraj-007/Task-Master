
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Navbar } from '@/components/navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2, Activity, ShieldCheck, DownloadCloud, AlertTriangle, UserCheck, ListChecks } from 'lucide-react';
import { type RiskAnalysisInput, type RiskAnalysisOutput, analyzeSprintRisks } from '@/ai/flows/risk-analysis-flow';
import { getTasksByProjectId } from '@/lib/actions/taskActions';
import type { Task } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';


const RiskAnalysisClientInputSchema = z.object({
  tasksJson: z.string().min(1, "Tasks JSON cannot be empty. Load or paste tasks."),
  teamContext: z.string().optional(),
});

const getUserScopedKey = (baseKey: string, userId?: string): string => {
  if (!userId) return `${baseKey}-unauthenticated`;
  return `${baseKey}-${userId}`;
};

export default function RiskAnalysisPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [aiResponse, setAiResponse] = useState<RiskAnalysisOutput | null>(null);
  const [isSubmittingToAI, setIsSubmittingToAI] = useState(false);
  const [isFetchingProjectTasks, setIsFetchingProjectTasks] = useState(false);

  const form = useForm<RiskAnalysisInput>({
    resolver: zodResolver(RiskAnalysisClientInputSchema),
    defaultValues: {
      tasksJson: '',
      teamContext: '',
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/risk-analysis');
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
      const relevantTasks = projectTasks.filter(
        task => task.status === 'To Do' || task.status === 'In Progress' || task.status === 'In Review'
      ).map(task => ({ // Map to schema expected by AI
        id: task.id,
        title: task.title,
        status: task.status,
        assignee: task.assignee,
        priority: task.priority,
        effort: task.effort,
      }));

      if (relevantTasks.length > 0) {
        form.setValue('tasksJson', JSON.stringify(relevantTasks, null, 2));
        toast({ title: "Tasks Loaded", description: "Active tasks (To Do, In Progress, In Review) from your project loaded as JSON." });
      } else {
        form.setValue('tasksJson', '[]');
        toast({ title: "No Active Tasks", description: "No tasks found in 'To Do', 'In Progress', or 'In Review' for the active project." });
      }
    } catch (error) {
      console.error("Failed to fetch project tasks:", error);
      toast({ variant: "destructive", title: "Error Loading Tasks", description: "Could not load tasks." });
    } finally {
      setIsFetchingProjectTasks(false);
    }
  };

  const onSubmit = async (data: RiskAnalysisInput) => {
    setIsSubmittingToAI(true);
    setAiResponse(null);
    try {
      // Validate JSON structure before sending to AI
      JSON.parse(data.tasksJson); 
    } catch (e) {
        toast({ variant: 'destructive', title: 'Invalid JSON', description: 'The tasks data is not valid JSON. Please check the format or reload tasks.' });
        setIsSubmittingToAI(false);
        return;
    }

    try {
      const response = await analyzeSprintRisks(data);
      setAiResponse(response);
      toast({
        title: 'Risk Analysis Complete!',
        description: 'The AI has analyzed the project risks.',
      });
    } catch (error) {
      console.error('AI Risk Analysis Error:', error);
      toast({
        variant: 'destructive',
        title: 'AI Error',
        description: 'Could not analyze risks. Please try again.',
      });
    } finally {
      setIsSubmittingToAI(false);
    }
  };
  
  const getRiskLevelBadgeVariant = (level: RiskAnalysisOutput['memberRiskAnalysis'][0]['riskLevel'] | undefined) => {
    switch (level) {
      case "Critical": return "destructive";
      case "High": return "destructive"; // Consider a less intense red or custom orange
      case "Medium": return "default"; // Default is primary, maybe outline with yellow border?
      case "Low": return "secondary";
      default: return "outline";
    }
  };
   const getRiskLevelClass = (level: string | undefined) => {
    switch (level) {
      case 'Critical': return 'text-red-700 dark:text-red-500 font-bold';
      case 'High': return 'text-red-600 dark:text-red-400 font-semibold';
      case 'Medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'Low': return 'text-green-600 dark:text-green-400';
      default: return 'text-muted-foreground';
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
              <Activity className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">AI Sprint Risk Analysis</CardTitle>
            <CardDescription>
              Identify potential blockers and overloaded team members. Load tasks from your active project.
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
                        <FormLabel>Tasks Data (JSON Array)</FormLabel>
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
                          Load Active Project Tasks
                        </Button>
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder='Paste tasks as JSON array, or click "Load Active Project Tasks". E.g., [{"id":"1","title":"Task A","status":"To Do","assignee":"User1","priority":"High"}]'
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
                  name="teamContext"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team Context (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Provide any relevant context about your team, e.g., 'Team of 3 developers, 1 QA. Sprint duration 2 weeks. One developer is part-time.'"
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
                    <Activity className="mr-2 h-4 w-4" />
                  )}
                  Analyze Risks
                </Button>
              </CardFooter>
            </form>
          </Form>

          {isSubmittingToAI && (
            <div className="p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="mt-2 text-muted-foreground">AI is analyzing risks...</p>
            </div>
          )}

          {aiResponse && !isSubmittingToAI && (
            <div className="p-6 border-t space-y-8">
              <Separator />
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center"><ShieldCheck className="h-6 w-6 mr-2 text-primary"/>Overall Assessment</h3>
                <p className="text-muted-foreground bg-muted/50 p-4 rounded-md">{aiResponse.overallAssessment}</p>
              </div>

              {aiResponse.memberRiskAnalysis && aiResponse.memberRiskAnalysis.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><UserCheck className="h-5 w-5 mr-2 text-primary"/>Member Risk Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Risk Level</TableHead>
                          <TableHead>Risk Factors</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aiResponse.memberRiskAnalysis.map((member, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{member.memberIdOrName}</TableCell>
                            <TableCell>
                              <Badge variant={getRiskLevelBadgeVariant(member.riskLevel)} className={cn(getRiskLevelClass(member.riskLevel))}>
                                {member.riskLevel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                                <ul className="list-disc list-inside text-xs">
                                    {member.riskFactors.map((factor, i) => <li key={i}>{factor}</li>)}
                                </ul>
                                {member.relevantTasksSummary.length > 0 && (
                                   <div className="mt-1 text-xs text-muted-foreground">
                                      Key Tasks: {member.relevantTasksSummary.map(t => `${t.title} (${t.priority || 'N/A'})`).join(', ')}
                                   </div>
                                )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {aiResponse.taskRiskAnalysis && aiResponse.taskRiskAnalysis.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><ListChecks className="h-5 w-5 mr-2 text-primary"/>High-Risk Task Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task Title</TableHead>
                          <TableHead>Risk Level</TableHead>
                          <TableHead>Risk Factors</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aiResponse.taskRiskAnalysis.map((task, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{task.taskTitle} <span className="text-xs text-muted-foreground">({task.taskId})</span></TableCell>
                            <TableCell>
                               <Badge variant={getRiskLevelBadgeVariant(task.riskLevel)} className={cn(getRiskLevelClass(task.riskLevel))}>
                                {task.riskLevel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                                <ul className="list-disc list-inside text-xs">
                                    {task.riskFactors.map((factor, i) => <li key={i}>{factor}</li>)}
                                </ul>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
              
              {aiResponse.recommendations && aiResponse.recommendations.length > 0 && (
                 <Card className="border-accent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-accent-foreground">
                       <AlertTriangle className="h-6 w-6 text-accent" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="bg-accent/10 p-4 rounded-md">
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        {aiResponse.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                    </ul>
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
