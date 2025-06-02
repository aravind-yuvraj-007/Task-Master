
'use client';

import Link from 'next/link';
import { Rocket, LayoutDashboard, FolderKanban, UserCircle, LogOut, LogIn, UserPlus, ClipboardList, ShieldAlert, Activity, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Navbar() {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const pathname = usePathname();

  const navLinks = [
    { href: '/board', label: 'Board', icon: LayoutDashboard },
    { href: '/projects', label: 'Projects', icon: FolderKanban },
    { href: '/sprint-planner', label: 'Sprint Planner', icon: ClipboardList },
    { href: '/scope-creep-detector', label: 'Scope Detector', icon: ShieldAlert },
    { href: '/risk-analysis', label: 'Risk Analysis', icon: Activity },
    { href: '/retrospective-generator', label: 'Retrospective', icon: ClipboardCheck },
  ];

  if (isLoading) {
    return (
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold text-foreground">TaskMaster</span>
          </div>
          <div className="h-8 w-20 bg-muted rounded animate-pulse"></div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Rocket className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold text-foreground hidden sm:inline">TaskMaster</span>
        </Link>

        {isAuthenticated && user && (
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Button
                key={link.href}
                variant="ghost"
                asChild
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  pathname === link.href && "text-foreground bg-muted"
                )}
              >
                <Link href={link.href}>
                  <link.icon className="mr-2 h-4 w-4" />
                  {link.label}
                </Link>
              </Button>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatar} alt={user.name} data-ai-hint="user avatar" />
                    <AvatarFallback>{user.name?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                 {/* Mobile nav links */}
                <div className="md:hidden">
                  {navLinks.map((link) => (
                    <DropdownMenuItem key={link.href} asChild className={cn(pathname === link.href && "bg-muted")}>
                      <Link href={link.href}>
                        <link.icon className="mr-2 h-4 w-4" />
                        {link.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                   <DropdownMenuSeparator />
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <UserCircle className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
             !pathname.includes('/login') && !pathname.includes('/signup') && (
                <div className="flex items-center gap-2">
                <Button variant="outline" asChild>
                    <Link href="/login">
                    <LogIn className="mr-2 h-4 w-4" /> Log In
                    </Link>
                </Button>
                <Button asChild>
                    <Link href="/signup">
                    <UserPlus className="mr-2 h-4 w-4" /> Sign Up
                    </Link>
                </Button>
                </div>
            )
          )}
        </div>
      </div>
    </header>
  );
}
