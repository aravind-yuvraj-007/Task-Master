
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, Settings, ShieldCheck, LayoutGrid, RadioTower, Loader2 } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import type { Project } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { addProject as addProjectAction } from '@/lib/actions/projectActions';

const projectSetupSchema = z.object({
  projectName: z.string().min(3, "Project name must be at least 3 characters").max(50),
  projectKey: z.string().min(2, "Key must be 2-5 characters").max(5).regex(/^[A-Z0-9]+$/, "Key must be uppercase letters/numbers"),
  projectDescription: z.string().max(200, "Description must be 200 characters or less").optional(),
});

type ProjectSetupFormValues = z.infer<typeof projectSetupSchema>;

const getUserScopedKey = (baseKey: string, userId?: string): string => {
  if (!userId) return `${baseKey}-unauthenticated`;
  return `${baseKey}-${userId}`;
};

export default function ProjectSetupPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/project-setup');
    }
  }, [authLoading, isAuthenticated, router]);

  const form = useForm<ProjectSetupFormValues>({
    resolver: zodResolver(projectSetupSchema),
    defaultValues: {
      projectName: "",
      projectKey: "",
      projectDescription: "",
    },
  });

  const onSubmit = async (data: ProjectSetupFormValues) => {
    if (!user || !user.id) {
        toast({ variant: "destructive", title: "Error", description: "You must be logged in to create a project." });
        return;
    }
    
    const leadName = user.name || "Current User";
    const leadAvatar = user.avatar || `https://placehold.co/32x32.png?text=${leadName.substring(0, 2).toUpperCase()}`;

    const newProjectData: Project = {
      id: `proj-${crypto.randomUUID()}`, // Client generates ID
      name: data.projectName,
      key: data.projectKey.toUpperCase(),
      description: data.projectDescription || "",
      type: "Team-managed software", 
      lead: leadName,
      leadAvatar: leadAvatar,
      ownerId: user.id, 
    };

    const createdProject = await addProjectAction(newProjectData, user.id);

    if (createdProject) {
      const activeProjectIdKey = getUserScopedKey('taskMasterActiveProjectId', user.id);
      localStorage.setItem(activeProjectIdKey, createdProject.id);

      toast({
        title: "Project Created!",
        description: `Project "${createdProject.name}" was created successfully in Firestore.`,
        action: <CheckCircle className="h-5 w-5 text-green-500" />,
      });
      router.push("/board");
    } else {
      toast({
        variant: "destructive",
        title: "Firestore Error",
        description: "Could not save the project to the backend. Please check server logs and try again.",
      });
    }
  };
  
  if (authLoading || !isAuthenticated) {
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
      <div className="flex-grow bg-gradient-to-br from-background to-blue-100 flex flex-col items-center justify-center p-4 md:p-8">
        <Card className="w-full max-w-2xl shadow-xl bg-card/90 backdrop-blur-sm">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-semibold">Create New Project</CardTitle>
              <Button variant="ghost" size="icon" asChild>
                <Link href="/board">
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Back to Task Board</span>
                </Link>
              </Button>
            </div>
            <CardDescription>Fill in the details to set up your new project. It will be saved to Firestore.</CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center">
                    <RadioTower className="h-5 w-5 mr-2 text-primary" />
                    Project Details
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Give your project a name, a unique key (2-5 uppercase letters/numbers, e.g., "PROJ"), and an optional description.
                  </p>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="projectName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Name</FormLabel>
                          <FormControl>
                            <Input placeholder="E.g., My Awesome Project" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="projectKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Key</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="E.g., MAP (2-5 chars, A-Z, 0-9)" 
                              {...field} 
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="projectDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="A brief description of your project" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center">
                    <ShieldCheck className="h-5 w-5 mr-2 text-primary" />
                    Project Type (Coming Soon)
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose between Team-managed or Company-managed projects. This feature is planned. For now, projects are 'Team-managed software'.
                  </p>
                  <div className="flex space-x-4">
                    <Button variant="outline" className="flex-1" disabled>Team-managed</Button>
                    <Button variant="outline" className="flex-1" disabled>Company-managed</Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center">
                    <LayoutGrid className="h-5 w-5 mr-2 text-primary" />
                    Project Template (Coming Soon)
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select a template like Scrum, Kanban, or Bug Tracking. More templates will be available later.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Button variant="outline" disabled>Scrum</Button>
                    <Button variant="outline" disabled>Kanban</Button>
                    <Button variant="outline" disabled>Bug Tracking</Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t p-6">
                <Button type="submit" className="w-full sm:w-auto" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Project"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
