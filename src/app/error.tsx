
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Unhandled error:", error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
      <div className="bg-card p-6 sm:p-8 rounded-lg shadow-xl max-w-md w-full">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-xl sm:text-2xl font-bold text-destructive mb-3">Oops! Something went wrong.</h1>
        <p className="text-muted-foreground mb-6 text-sm sm:text-base">
          We encountered an unexpected error. Please try again, or contact support if the problem persists.
        </p>
        <Button
          onClick={() => reset()}
          className="w-full sm:w-auto"
        >
          Try again
        </Button>
      </div>
    </div>
  )
}
