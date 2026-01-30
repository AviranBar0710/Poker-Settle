"use client"

import { useEffect, ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

interface AuthGuardProps {
  children: ReactNode
}

const PROTECTED_PATTERNS = ["/sessions", "/stats", "/join", "/club"]
const PROTECTED_PREFIX = "/session/"

/**
 * Redirect unauthenticated users from protected routes to / (Login Gate).
 * Allow / and /auth/*.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (authLoading) return
    if (user) return

    if (pathname === "/" || pathname?.startsWith("/auth/")) return

    const isProtected =
      PROTECTED_PATTERNS.some((p) => pathname === p || pathname?.startsWith(p + "/")) ||
      pathname?.startsWith(PROTECTED_PREFIX)
    if (!isProtected) return

    router.replace("/")
  }, [user, authLoading, pathname, router])

  if (!user && !authLoading) {
    if (pathname === "/" || pathname?.startsWith("/auth/")) {
      return <>{children}</>
    }
    const isProtected =
      PROTECTED_PATTERNS.some((p) => pathname === p || pathname?.startsWith(p + "/")) ||
      pathname?.startsWith(PROTECTED_PREFIX)
    if (isProtected) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground">Redirecting…</p>
        </div>
      )
    }
  }

  return <>{children}</>
}
