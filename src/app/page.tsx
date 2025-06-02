
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Rocket, LayoutDashboard, FolderPlus, ListChecks, LogIn, UserPlus, CheckSquare } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/navbar"; // Import Navbar

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar /> 
      <main className="flex-grow bg-gradient-to-br from-background to-blue-100 flex flex-col items-center justify-center p-4 text-center">
        <Card className="w-full max-w-xl bg-card/80 backdrop-blur-sm shadow-2xl">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full mb-6 inline-block">
              <Rocket className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-4xl sm:text-5xl font-bold text-foreground">
              Welcome to TaskMaster
            </CardTitle>
            <CardDescription className="text-lg sm:text-xl text-muted-foreground mt-3">
              Your ultimate solution for streamlined project and task management. <br className="hidden sm:inline"/>
              Organize, track, and accomplish your goals with ease.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-center justify-center p-6">
            {isLoading ? (
              <div className="h-11 w-40 bg-muted rounded-md animate-pulse"></div>
            ) : isAuthenticated ? (
              <>
                <Button size="lg" className="w-full sm:w-auto" asChild>
                  <Link href="/board">
                    <LayoutDashboard className="mr-2 h-5 w-5" /> Go to Dashboard
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
                  <Link href="/projects">
                    <ListChecks className="mr-2 h-5 w-5" /> View All Projects
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button size="lg" className="w-full sm:w-auto" asChild>
                  <Link href="/signup">
                    <UserPlus className="mr-2 h-5 w-5" /> Get Started Free
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
                  <Link href="/login">
                    <LogIn className="mr-2 h-5 w-5" /> Log In
                  </Link>
                </Button>
                 <Button variant="secondary" size="lg" className="w-full sm:w-auto" asChild>
                    <Link href="/board">
                        <CheckSquare className="mr-2 h-5 w-5" /> View Demo Board
                    </Link>
                 </Button>
              </>
            )}
          </CardContent>
        </Card>
        <footer className="mt-12 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} TaskMaster. Built with Firebase Studio.</p>
        </footer>
      </main>
    </div>
  );
}
