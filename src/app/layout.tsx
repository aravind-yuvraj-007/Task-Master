
import type {Metadata} from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Navbar } from '@/components/navbar'; // We might add this later if needed globally
import { Toaster } from "@/components/ui/toaster"; // Global toaster

export const metadata: Metadata = {
  title: 'TaskMaster',
  description: 'Manage your tasks efficiently with TaskMaster',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <AuthProvider>
          {/* Navbar can be rendered conditionally by child layouts/pages or globally here */}
          {/* For now, specific pages will manage their layout including Navbar */}
          <div className="flex-grow">
            {children}
          </div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
