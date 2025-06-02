
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  signup: (name: string, email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MOCK_USER_KEY = 'taskMasterMockUser';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setIsLoading(true); 
    try {
      const storedUser = localStorage.getItem(MOCK_USER_KEY);
      if (storedUser) {
        const parsedUser: User = JSON.parse(storedUser);
        console.log('[AuthContext] Loaded user from localStorage:', JSON.stringify(parsedUser));
        setUser(parsedUser);
      } else {
        console.log('[AuthContext] No user in localStorage.');
      }
    } catch (error) {
      console.error("[AuthContext] Failed to load user from local storage", error);
      localStorage.removeItem(MOCK_USER_KEY); 
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500)); 

    const lowerEmail = email.toLowerCase();
    // Deterministic ID generation
    const generatedId = `mock-user-${lowerEmail.replace(/@/g, '-at-').replace(/[^a-z0-9-]/g, '')}`;
    const derivedName = lowerEmail.split('@')[0] || 'Demo User';
    
    const mockUser: User = {
      id: generatedId,
      email: lowerEmail, 
      name: derivedName,
      avatar: `https://placehold.co/40x40.png?text=${(derivedName).substring(0,2).toUpperCase()}`,
    };
    
    console.log('[AuthContext] Login: Generated/Set mockUser:', JSON.stringify(mockUser));
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
    setUser(mockUser);
    setIsLoading(false);
    
    const redirectPath = searchParams.get('redirect') || '/board';
    router.push(redirectPath);

  }, [router, searchParams]);

  const signup = useCallback(async (name: string, email: string) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const lowerEmail = email.toLowerCase();
    // Deterministic ID generation
    const generatedId = `mock-user-${lowerEmail.replace(/@/g, '-at-').replace(/[^a-z0-9-]/g, '')}`;

    const mockUser: User = {
      id: generatedId,
      email: lowerEmail,
      name, // Use provided name for signup
      avatar: `https://placehold.co/40x40.png?text=${name.substring(0,2).toUpperCase()}`,
    };

    console.log('[AuthContext] Signup: Generated/Set mockUser:', JSON.stringify(mockUser));
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
    setUser(mockUser);
    setIsLoading(false);

    router.push('/board');
  }, [router]);

  const logout = useCallback(() => {
    console.log('[AuthContext] Logout: Clearing user from localStorage and state.');
    localStorage.removeItem(MOCK_USER_KEY);
    setUser(null);
    // Navigate to login and clear any redirect query param
    const loginPath = '/login';
    const currentQuery = new URLSearchParams(window.location.search);
    currentQuery.delete('redirect');
    const queryString = currentQuery.toString();
    router.push(queryString ? `${loginPath}?${queryString}` : loginPath);

  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
