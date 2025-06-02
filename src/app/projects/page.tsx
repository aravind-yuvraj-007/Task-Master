
'use client';

import type { Project } from '@/types';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Search, Wrench, Ellipsis, ChevronLeft, ChevronRight, FolderPlus, Inbox, ListFilter, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/navbar';
import { getProjectsByUserId } from '@/lib/actions/projectActions';
// Removed: import { db } from '@/lib/firebase'; 

const ITEMS_PER_PAGE = 5;

const getUserScopedKey = (baseKey: string, userId?: string): string => {
  if (!userId) return `${baseKey}-unauthenticated`;
  return `${baseKey}-${userId}`;
};

export default function ProjectsPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [backendError, setBackendError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/projects');
    }
  }, [authLoading, isAuthenticated, router]);
  
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      setIsLoadingProjects(true);
      setBackendError(null);

      // Client-side check for db validity removed as it's not reliable for server actions
      // and `db` is no longer directly exported.
      // Errors from server actions will be caught by `backendError` state.

      getProjectsByUserId(user.id)
        .then(userProjects => {
          if (userProjects) { 
            setProjects(userProjects);
          } else {
            setProjects([]);
            setBackendError("Failed to load projects from the backend. The server action may have failed. Please check server logs.");
            toast({
              variant: 'destructive',
              title: 'Error Loading Projects',
              description: 'Could not retrieve projects. Check server logs for details.',
            });
          }
        })
        .catch(error => { 
          console.error('Error fetching projects via action:', error);
          setProjects([]);
          setBackendError("An unexpected error occurred while fetching projects.");
          toast({
            variant: 'destructive',
            title: 'Fetch Error',
            description: 'Could not load projects due to a network or unexpected error.',
          });
        })
        .finally(() => {
          setIsLoadingProjects(false);
        });

    } else if (!authLoading && isAuthenticated && !user?.id) {
      setIsLoadingProjects(false);
      setProjects([]);
      setBackendError("User ID is missing. Cannot load projects.");
       toast({
          variant: 'destructive',
          title: 'User Error',
          description: 'User ID is missing. Cannot load projects.',
        });
    } else if (!authLoading && !isAuthenticated) {
      setIsLoadingProjects(false); 
    }
  }, [toast, isAuthenticated, user, authLoading, router]);

  const handleProjectClick = (projectId: string) => {
    if (user?.id) {
      const activeProjectIdKey = getUserScopedKey('taskMasterActiveProjectId', user.id);
      localStorage.setItem(activeProjectIdKey, projectId);
      router.push('/board');
    } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Cannot switch project. User not identified.',
        });
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(project =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.key.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  const totalPages = Math.ceil(filteredProjects.length / ITEMS_PER_PAGE);
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProjects.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProjects, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
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
      <div className="flex-grow bg-gradient-to-br from-background to-blue-50 p-4 sm:p-6 md:p-8">
        <Card className="max-w-5xl mx-auto shadow-xl bg-card/90 backdrop-blur-sm">
          <CardHeader className="border-b">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="text-3xl font-bold">Projects</CardTitle>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href="/project-setup">
                    <FolderPlus className="mr-2 h-4 w-4" /> Create project
                  </Link>
                </Button>
                <Button variant="outline" disabled>
                  Templates (Soon)
                </Button>
              </div>
            </div>
            <CardDescription className="mt-1">
              View and manage all your projects in one place. Data is loaded from Firestore.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects by name or key..."
                  value={searchTerm}
                  onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}}
                  className="pl-10 w-full"
                />
              </div>
              <Select disabled>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <div className="flex items-center">
                  <ListFilter className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Filter (Soon)" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoadingProjects ? (
                <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
                    Loading projects from backend...
                </div>
            ) : backendError ? (
                 <div className="text-center py-10 text-destructive bg-destructive/10 p-4 rounded-md">
                    <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
                    <p className="text-lg font-semibold">Backend Error</p>
                    <p>{backendError}</p>
                </div>
            ) : paginatedProjects.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Inbox className="mx-auto h-12 w-12 mb-4" />
                <p className="text-lg font-semibold">No projects found.</p>
                {projects.length > 0 && searchTerm && <p>Try adjusting your search or filter.</p>}
                {projects.length === 0 && !searchTerm && <p>Get started by creating a new project.</p>}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Key</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Lead</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedProjects.map((project) => (
                        <TableRow key={project.id} className="hover:bg-muted/50">
                          <TableCell>
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-amber-500" disabled>
                              <Star className="h-4 w-4" />
                              <span className="sr-only">Favorite</span>
                            </Button>
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => handleProjectClick(project.id)}
                              className="flex items-center gap-2 font-medium text-primary hover:underline"
                            >
                              <Wrench className="h-4 w-4 text-muted-foreground" />
                              {project.name}
                            </button>
                          </TableCell>
                          <TableCell>{project.key}</TableCell>
                          <TableCell>{project.type || 'N/A'}</TableCell>
                          <TableCell className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={project.leadAvatar || `https://placehold.co/32x32.png?text=${project.lead?.substring(0,2).toUpperCase() || 'PL'}`} alt={project.lead || 'Project Lead'} data-ai-hint="user avatar"/>
                              <AvatarFallback>{project.lead?.substring(0,2).toUpperCase() || "PL"}</AvatarFallback>
                            </Avatar>
                            {project.lead || 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" disabled>
                              <Ellipsis className="h-4 w-4" />
                              <span className="sr-only">Project options</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center space-x-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNumber => (
                      <Button
                          key={pageNumber}
                          variant={currentPage === pageNumber ? "default" : "outline"}
                          size="sm"
                          className="w-9 h-9 p-0"
                          onClick={() => handlePageChange(pageNumber)}
                        >
                          {pageNumber}
                        </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
