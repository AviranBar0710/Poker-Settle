"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { User, Session as SupabaseSession } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabaseClient"

interface AuthContextType {
  user: User | null
  session: SupabaseSession | null
  loading: boolean
  signIn: (email: string) => Promise<{ error: Error | null }>
  /** Request OTP (6-digit code) — no magic link, no PKCE. */
  requestOtp: (email: string) => Promise<{ error: Error | null }>
  /** Verify OTP and establish session. */
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>
  /** Sign in with Google OAuth. Redirects to Google, then back to /auth/callback. */
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<SupabaseSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    // Catch unhandled auth errors (refresh token, network fetch failures)
    // These can be thrown by Supabase's internal fetch/refresh before our handlers run
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const err = event?.reason
      const msg = String(err?.message || err?.error_description || err || "")
      const errName = String(err?.name || "")
      const isRefreshTokenError =
        msg.includes("Invalid Refresh Token") ||
        msg.includes("Refresh Token Not Found") ||
        msg.includes("refresh_token_not_found") ||
        msg.includes("token_not_found")
      const isNetworkFetchError =
        errName === "AuthRetryableFetchError" ||
        msg === "Load failed" ||
        msg === "Failed to fetch" ||
        msg.includes("Load failed")
      if (isRefreshTokenError) {
        event.preventDefault()
        console.warn("Caught invalid refresh token, clearing session:", msg)
        supabase.auth.signOut({ scope: "local" }).catch(() => {})
        setSession(null)
        setUser(null)
        setLoading(false)
      } else if (isNetworkFetchError) {
        event.preventDefault()
        console.warn("Auth fetch failed (network), proceeding without session:", msg)
        setSession(null)
        setUser(null)
        setLoading(false)
      }
    }
    window.addEventListener("unhandledrejection", handleUnhandledRejection)

    // Set a maximum timeout to prevent infinite loading
    timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn("Auth session check timed out, proceeding without session")
        setLoading(false)
      }
    }, 10000) // 10 second timeout

    // Global error handler for unhandled auth errors
    const handleAuthError = (err: any) => {
      if (!mounted) return false

      const errorMessage = err?.message || err?.error_description || err?.error?.message || String(err || "")
      const errName = String(err?.name || "")
      const isRefreshTokenError =
        errorMessage.includes("refresh_token_not_found") ||
        errorMessage.includes("Invalid Refresh Token") ||
        errorMessage.includes("Refresh Token Not Found") ||
        errorMessage.includes("refresh_token") ||
        err?.code === "refresh_token_not_found" ||
        err?.status === 401 ||
        err?.statusCode === 401 ||
        (err?.error as any)?.code === "refresh_token_not_found" ||
        errorMessage.includes("token_not_found")
      const isNetworkFetchError =
        errName === "AuthRetryableFetchError" ||
        errorMessage === "Load failed" ||
        errorMessage === "Failed to fetch" ||
        errorMessage.includes("Load failed")

      if (isRefreshTokenError) {
        console.warn("Invalid refresh token detected globally, clearing session:", errorMessage)
        supabase.auth.signOut({ scope: "local" }).catch(() => {})
        setSession(null)
        setUser(null)
        setLoading(false)
        return true
      }
      if (isNetworkFetchError) {
        console.warn("Auth fetch failed (network), proceeding without session:", errorMessage)
        setSession(null)
        setUser(null)
        setLoading(false)
        return true
      }
      return false
    }

    // Get initial session with error handling
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!mounted) return
        
        clearTimeout(timeoutId)
        
        if (error) {
          // Use global error handler
          const handled = handleAuthError(error)
          if (!handled) {
            console.error("Error getting session:", error)
            setSession(null)
            setUser(null)
          }
        } else {
          setSession(session)
          setUser(session?.user ?? null)
        }
        setLoading(false)
      })
      .catch((err) => {
        if (!mounted) return
        
        clearTimeout(timeoutId)
        
        // Use global error handler
        const handled = handleAuthError(err)
        if (!handled) {
          console.error("Unexpected error getting session:", err)
          setSession(null)
          setUser(null)
        }
        setLoading(false)
      })

    // Listen for auth changes with error handling
    let subscription: { unsubscribe: () => void } | null = null
    
    try {
      const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return
        
        try {
          // Handle invalid refresh token errors
          if (event === 'TOKEN_REFRESHED' && !session) {
            // Token refresh failed - clear invalid session
            console.warn("Token refresh failed, clearing invalid session")
            try {
              await supabase.auth.signOut({ scope: 'local' })
            } catch (err) {
              console.error("Error signing out after token refresh failure:", err)
            }
            setSession(null)
            setUser(null)
            setLoading(false)
            return
          }
          
          // Handle signed out events (including from invalid tokens)
          if (event === 'SIGNED_OUT') {
            setSession(null)
            setUser(null)
            setLoading(false)
            return
          }
          
          // Check for error events that might indicate token issues
          if (event === 'SIGNED_IN' && !session) {
            // Signed in event but no session - might indicate token issue
            console.warn("Signed in event but no session, clearing auth state")
            try {
              await supabase.auth.signOut({ scope: 'local' })
            } catch (err) {
              // Ignore cleanup errors
            }
            setSession(null)
            setUser(null)
            setLoading(false)
            return
          }
          
          setSession(session)
          setUser(session?.user ?? null)
          setLoading(false)
        } catch (err: any) {
          // Catch any errors during auth state change
          if (!mounted) return
          
          // Use global error handler
          const handled = handleAuthError(err)
          if (!handled) {
            console.error("Error in auth state change:", err)
            // Don't crash the app, just log and set loading to false
            setLoading(false)
          }
        }
      })
      
      subscription = authSubscription
    } catch (err: any) {
      // Catch any errors during subscription setup
      console.error("Error setting up auth state listener:", err)
      const handled = handleAuthError(err)
      if (!handled) {
        setLoading(false)
      }
    }

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
      if (subscription) {
        try {
          subscription.unsubscribe()
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    }
  }, [])

  /** Email OTP (6-digit code). No magic link, no emailRedirectTo, no PKCE. */
  const requestOtp = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      })
      return { error }
    } catch (err) {
      return { error: err as Error }
    }
  }

  const signIn = async (email: string) => requestOtp(email)

  const verifyOtp = async (email: string, token: string) => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      })
      return { error }
    } catch (err) {
      return { error: err as Error }
    }
  }

  const signInWithGoogle = async () => {
    try {
      // Pre-flight: verify Supabase is reachable before redirecting (avoids ERR_NAME_NOT_RESOLVED on mobile)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (supabaseUrl && anonKey && typeof window !== "undefined") {
        try {
          const ctrl = new AbortController()
          const timeout = setTimeout(() => ctrl.abort(), 5000)
          const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
            method: "GET",
            headers: { apikey: anonKey },
            signal: ctrl.signal,
          })
          clearTimeout(timeout)
          if (!res.ok) {
            return {
              error: new Error(
                "Supabase is unreachable. Check if your project is paused in the Supabase Dashboard (Project Settings → General → Restore project)."
              ),
            }
          }
        } catch (preflightErr) {
          const msg = (preflightErr as Error)?.message ?? ""
          const isDnsOrNetwork =
            msg.includes("Failed to fetch") ||
            msg.includes("Load failed") ||
            msg.includes("ERR_NAME_NOT_RESOLVED") ||
            msg.includes("NetworkError") ||
            msg.includes("aborted")
          return {
            error: new Error(
              isDnsOrNetwork
                ? "Cannot reach Supabase. Try: 1) Use WiFi instead of cellular 2) Unpause your project in Supabase Dashboard 3) Check supabase.co is reachable in your browser"
                : "Supabase is unreachable. Check your network and ensure your project is not paused."
            ),
          }
        }
      }

      // Preserve any redirect URL from localStorage
      const storedRedirect = typeof window !== "undefined" ? localStorage.getItem("auth_redirect") : null
      const redirectTo = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`

      console.log("🔵 [AUTH] signInWithGoogle called:", {
        hasStoredRedirect: !!storedRedirect,
        storedRedirect,
        redirectTo,
      })

      // Verify auth_redirect is still in localStorage before OAuth redirect
      if (typeof window !== "undefined" && storedRedirect) {
        console.log("🔵 [AUTH] Verifying auth_redirect before OAuth:", localStorage.getItem("auth_redirect"))
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          // Note: redirect URL will be preserved via localStorage, not query param
          // because OAuth flow doesn't preserve custom query params
        },
      })
      return { error }
    } catch (err) {
      return { error: err as Error }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, requestOtp, verifyOtp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

