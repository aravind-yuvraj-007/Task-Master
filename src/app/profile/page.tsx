
'use client';

import { useEffect }_ from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UserCircle, Mail, LogOut, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-blue-100 flex flex-col items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-lg shadow-xl bg-card/90 backdrop-blur-sm">
        <CardHeader className="text-center border-b pb-6">
          <Avatar className="mx-auto h-24 w-24 mb-4 border-4 border-primary/50">
            <AvatarImage src={user.avatar} alt={user.name} data-ai-hint="user avatar" />
            <AvatarFallback className="text-3xl">
              {user.name?.substring(0, 2).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="text-3xl font-bold">{user.name}</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center">
              <UserCircle className="h-5 w-5 mr-2 text-primary" />
              Account Details
            </h3>
            <div className="p-4 bg-muted/50 rounded-md space-y-2">
              <p><strong className="text-foreground">Name:</strong> {user.name}</p>
              <p><strong className="text-foreground">Email:</strong> {user.email}</p>
              <p><strong className="text-foreground">User ID:</strong> <span className="text-xs">{user.id}</span></p>
            </div>
          </div>

          <div className="space-y-2">
             <Button variant="outline" className="w-full justify-start" disabled>
              <ShieldCheck className="mr-2 h-4 w-4" /> Change Password (Soon)
            </Button>
             <Button variant="outline" className="w-full justify-start" disabled>
              <Mail className="mr-2 h-4 w-4" /> Manage Email Preferences (Soon)
            </Button>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button onClick={logout} variant="destructive" className="w-full sm:flex-1">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
             <Button variant="default" className="w-full sm:flex-1" asChild>
                <Link href="/board">
                    Back to Dashboard
                </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
