"use client"

import { useEffect, ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { useClub } from "@/contexts/ClubContext"

interface OnboardingGuardProps {
  children: ReactNode
}

/**
 * When user is authenticated and has no clubs (needsOnboarding),
 * redirect all app routes to /join. Excludes /join and /auth/callback.
 */
export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { needsOnboarding, loading: clubsLoading } = useClub()

  useEffect(() => {
    if (authLoading || clubsLoading) return
    if (!user) return
    if (!needsOnboarding) return

    if (pathname === "/join" || pathname?.startsWith("/auth/")) return

    router.replace("/join")
  }, [user, authLoading, clubsLoading, needsOnboarding, pathname, router])

  if (user && !authLoading && !clubsLoading && needsOnboarding) {
    if (pathname !== "/join" && !pathname?.startsWith("/auth/")) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground">Redirecting…</p>
        </div>
      )
    }
  }

  return <>{children}</>
}
