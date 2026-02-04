"use client"

import { useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"

/**
 * Dedicated logout route.
 * Performs signOut, clears Supabase auth from localStorage, then redirects to Home.
 * Using a separate page ensures the logout flow completes before redirect,
 * fixing issues where signOut + redirect in the same handler left users logged in.
 */
export default function LogoutPage() {
  useEffect(() => {
    let mounted = true

    const performLogout = async () => {
      try {
        await supabase.auth.signOut({ scope: "local" })
      } catch (e) {
        console.warn("signOut error:", e)
      }

      if (!mounted) return

      // Clear Supabase auth keys from localStorage (workaround for session persistence bugs)
      if (typeof window !== "undefined") {
        const keysToRemove: string[] = []
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key && key.startsWith("sb-")) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach((key) => window.localStorage.removeItem(key))
      }

      if (mounted && typeof window !== "undefined") {
        window.location.replace("/")
      }
    }

    performLogout()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent mb-4" />
      <p className="text-sm text-muted-foreground">Signing out…</p>
    </div>
  )
}
