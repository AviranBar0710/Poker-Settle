"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, XCircle, AlertCircle, Lock } from "lucide-react"

type JoinStatus =
  | "loading"
  | "not_authenticated"
  | "validating"
  | "invalid_token"
  | "invite_disabled"
  | "not_club_member"
  | "session_finalized"
  | "stage_blocked"
  | "error"

export default function JoinSessionPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const token = params.token as string
  const [status, setStatus] = useState<JoinStatus>("loading")

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionName, setSessionName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  const [authTimeout, setAuthTimeout] = useState(false)
  const hasInitiatedJoin = useRef(false)
  const lastTokenRef = useRef<string | null>(null)
  const redirectingRef = useRef(false) // Flag to prevent timeouts after redirect starts
  const overallTimeoutRef = useRef<NodeJS.Timeout | null>(null) // Store overall timeout ref
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile device
  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkMobile = () => {
        const isMobileDevice = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        setIsMobile(isMobileDevice)
        console.log("🔵 [JOIN] Mobile detection:", isMobileDevice, { width: window.innerWidth, userAgent: navigator.userAgent.substring(0, 50) })
      }
      checkMobile()
      window.addEventListener("resize", checkMobile)
      return () => window.removeEventListener("resize", checkMobile)
    }
  }, [])

  // Timeout for auth loading - be VERY aggressive on mobile
  useEffect(() => {
    if (!authLoading) {
      setAuthTimeout(false)
      return
    }

    // Ultra-short timeout for mobile (1 second), longer for desktop (3 seconds)
    const timeoutMs = isMobile ? 1000 : 3000
    console.log(`🔵 [JOIN] Setting auth timeout: ${timeoutMs}ms (mobile: ${isMobile})`)
    
    const timeout = setTimeout(() => {
      console.warn(`🔴 [JOIN] Auth loading timeout (${timeoutMs}ms) - showing login prompt`)
      setAuthTimeout(true)
      // On mobile, immediately show login prompt if auth is taking too long
      if (isMobile && !user) {
        console.log("🔵 [JOIN] Mobile auth timeout - forcing login prompt")
        setStatus("not_authenticated")
      }
    }, timeoutMs)

    return () => clearTimeout(timeout)
  }, [authLoading, isMobile, user])

  // Timeout for overall loading state (backup timeout)
  useEffect(() => {
    if (status !== "loading" && status !== "validating") {
      setLoadingTimeout(false)
      if (overallTimeoutRef.current) {
        clearTimeout(overallTimeoutRef.current)
        overallTimeoutRef.current = null
      }
      return
    }

    // Don't set timeout if we're already redirecting
    if (redirectingRef.current) {
      return
    }

    overallTimeoutRef.current = setTimeout(() => {
      // Don't fire timeout if redirect already started
      if (redirectingRef.current) {
        console.log("🔵 [JOIN] Overall timeout fired but redirect already started, ignoring")
        return
      }
      console.warn("🔴 [JOIN] Overall loading timeout - showing error")
      setLoadingTimeout(true)
      // Only set error if still loading (don't override if already changed)
      setStatus((prev) => {
        if (prev === "loading" || prev === "validating") {
          return "error"
        }
        return prev
      })
      setErrorMessage("Loading timed out. Please check your connection and try again.")
      hasInitiatedJoin.current = false
    }, 12000) // 12 second backup timeout (shorter than RPC timeout)

    return () => {
      if (overallTimeoutRef.current) {
        clearTimeout(overallTimeoutRef.current)
        overallTimeoutRef.current = null
      }
    }
  }, [status])


  // Main join logic
  useEffect(() => {
    console.log("🔵 [JOIN] Effect running:", { 
      token: token?.substring(0, 10) + "...", 
      authLoading, 
      authTimeout,
      hasUser: !!user,
      status 
    })

    // Reset join flag only when token actually changes
    if (token !== lastTokenRef.current) {
      console.log("🔵 [JOIN] Token changed, resetting state")
      hasInitiatedJoin.current = false
      lastTokenRef.current = token
      setStatus("loading") // Reset to loading when token changes
    }

    // Check token first (before auth check)
    if (!token) {
      console.error("🔴 [JOIN] No token provided")
      setStatus("invalid_token")
      return
    }

    // If auth timed out, show login prompt immediately
    if (authTimeout) {
      console.log("🔵 [JOIN] Auth timeout - showing login prompt immediately")
      setStatus("not_authenticated")
      return
    }

    // On mobile, be VERY aggressive - if auth is loading and no user, show login immediately
    // Don't wait for timeout - mobile networks can be slow/unreliable
    if (authLoading && isMobile && !user) {
      console.log("🔵 [JOIN] Mobile detected + auth loading + no user - showing login IMMEDIATELY")
      setStatus("not_authenticated")
      return
    }

    // If auth is loading on desktop, wait for timeout
    if (authLoading) {
      console.log("🔵 [JOIN] Auth loading (desktop), waiting for timeout")
      return
    }

    // Auth finished loading - check if user exists
    if (!user) {
      console.log("🔵 [JOIN] Auth finished, no user - showing login prompt")
      setStatus("not_authenticated")
      return
    }

    console.log("🔵 [JOIN] User authenticated, proceeding with validation")

    // Prevent multiple join attempts
    if (hasInitiatedJoin.current) {
      console.log("🔵 [JOIN] Already initiated, skipping")
      return
    }

    // Mark that we're initiating join
    hasInitiatedJoin.current = true
    let mounted = true
    let timeoutId: NodeJS.Timeout | null = null

    console.log("🔵 [JOIN] Initiating token validation")

    // Set timeout to prevent infinite loading
    timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn("🔴 [JOIN] Request timeout - showing error")
        setStatus("error")
        setErrorMessage("Request timed out. Please check your connection and try again.")
        hasInitiatedJoin.current = false
      }
    }, 10000) // 10 second timeout

    const joinSession = async () => {
      if (!mounted) return
      
      setStatus("validating")
      setErrorMessage(null)

      try {
        console.log("🔵 [JOIN] Starting token validation for token:", token.substring(0, 10) + "...")
        
        // Validate token only (no auto-join) - user will manually join via session page
        const { data, error } = await supabase.rpc("validate_session_token", {
          p_token: token,
        })

        console.log("🔵 [JOIN] RPC response:", { 
          hasData: !!data, 
          hasError: !!error, 
          dataType: Array.isArray(data) ? 'array' : typeof data,
          dataLength: Array.isArray(data) ? data.length : 'N/A',
          data,
          error 
        })
        
        // Log the actual data structure for debugging
        if (data && Array.isArray(data) && data.length > 0) {
          console.log("🔵 [JOIN] RPC data[0]:", JSON.stringify(data[0], null, 2))
        } else if (data) {
          console.log("🔵 [JOIN] RPC data (not array):", JSON.stringify(data, null, 2))
        }

        // Clear ALL timeouts IMMEDIATELY on response (before any other checks)
        if (timeoutId) {
          console.log("🔵 [JOIN] Clearing RPC timeout")
          clearTimeout(timeoutId)
          timeoutId = null
        }
        if (overallTimeoutRef.current) {
          console.log("🔵 [JOIN] Clearing overall timeout")
          clearTimeout(overallTimeoutRef.current)
          overallTimeoutRef.current = null
        }

        // Check for error
        if (error) {
          console.log("🔴 [JOIN] RPC returned error, handling...")
          // Log full error details for debugging
          const errorInfo: any = error ? {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: (error as any)?.code,
            status: (error as any)?.status,
            statusCode: (error as any)?.statusCode,
          } : {
            message: "Unknown error - no error object returned",
            data: data,
            hasData: !!data,
          }
          
          // Try to stringify the entire error object
          try {
            if (error) {
              console.error("Error validating token:", JSON.stringify(error, Object.getOwnPropertyNames(error)))
              console.error("Error details:", errorInfo)
            } else {
              console.error("Error validating token: No error object, but no data returned")
              console.error("Response:", { data, error })
            }
          } catch (e) {
            console.error("Error validating token (raw):", error)
            if (error) {
              console.error("Error validating token (keys):", Object.keys(error))
            }
            console.error("Error details:", errorInfo)
            console.error("Stringify error:", e)
          }
          
          // Extract error message from various possible properties
          const errorMessage = error ? (
            error.message || 
            error.details || 
            error.hint || 
            (error as any)?.code ||
            (error as any)?.status ||
            "Failed to validate invite link"
          ) : "Failed to validate invite link - no response from server"
          
          // Check if it's a function not found error (migration not run)
          if (
            error?.message?.includes("function") && 
            (error.message.includes("validate_session_token") || 
             error.message.includes("does not exist") ||
             error.message.includes("Could not find a function"))
          ) {
            console.error("🔴 [JOIN] Function not found - migration may not be run")
            setStatus("error")
            setErrorMessage("Invite system not configured. Please contact support.")
            hasInitiatedJoin.current = false
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
            return
          }
          
          // Check if it's a pgcrypto issue or invalid token format
          if (
            error &&
            ((error as any)?.code === "P0001" || 
            error.message?.includes("digest") || 
            error.message?.includes("function") ||
            error.message?.includes("pgcrypto"))
          ) {
            setStatus("error")
            setErrorMessage("Invalid invite link format. Please request a new link.")
          } else {
            setStatus("error")
            setErrorMessage(errorMessage || "Failed to validate invite link. Please try again.")
          }
          hasInitiatedJoin.current = false
          return
        }

        if (!data || data.length === 0) {
          console.error("🔴 [JOIN] No data returned from RPC")
          setStatus("error")
          setErrorMessage("Invalid response from server. The invite system may not be configured.")
          hasInitiatedJoin.current = false
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          return
        }

        console.log("🔵 [JOIN] Processing RPC data:", data)
        const result = data[0]
        const resultStatus = result?.status as string
        const resultSessionId = result?.session_id as string | null
        const resultSessionName = result?.session_name as string | null

        console.log("🔵 [JOIN] Result:", { resultStatus, resultSessionId, resultSessionName })

        // Handle valid response IMMEDIATELY - before any other checks
        if (resultStatus === "valid" && resultSessionId) {
          // Set redirect flag to prevent timeouts
          redirectingRef.current = true
          
          // Clear all timeouts again (defensive)
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
          if (overallTimeoutRef.current) {
            clearTimeout(overallTimeoutRef.current)
            overallTimeoutRef.current = null
          }
          
          const redirectUrl = `/session/${resultSessionId}`
          console.log("✅ [JOIN] Token valid - IMMEDIATE redirect to:", redirectUrl)
          
          // Clear any pending redirect from sessionStorage
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("pending_redirect")
          }
          
          // IMMEDIATE redirect - synchronous, no React state updates, no checks
          // This MUST happen before any return statements
          window.location.replace(redirectUrl)
          
          // Return immediately - don't process anything else
          return
        }

        // For non-valid statuses, continue with normal processing
        if (!mounted) {
          console.log("🔵 [JOIN] Component unmounted, but status is:", resultStatus)
          return
        }

        setSessionId(resultSessionId)
        setSessionName(resultSessionName)
        console.log("🔵 [JOIN] Set session ID and name, processing status:", resultStatus)

        console.log("🔵 [JOIN] Processing status switch, resultStatus:", resultStatus)
        switch (resultStatus) {
          case "invalid_token":
            setStatus("invalid_token")
            break
          case "invite_disabled":
            setStatus("invite_disabled")
            break
          case "not_club_member":
            setStatus("not_club_member")
            break
          case "session_finalized":
            // Redirect to view finalized session
            if (resultSessionId) {
              redirectingRef.current = true
              if (overallTimeoutRef.current) {
                clearTimeout(overallTimeoutRef.current)
                overallTimeoutRef.current = null
              }
              console.log("🔵 [JOIN] Session finalized, redirecting to:", `/session/${resultSessionId}`)
              window.location.replace(`/session/${resultSessionId}`)
            } else {
              setStatus("session_finalized")
            }
            break
          case "stage_blocked":
            // Redirect to view session (read-only)
            if (resultSessionId) {
              redirectingRef.current = true
              if (overallTimeoutRef.current) {
                clearTimeout(overallTimeoutRef.current)
                overallTimeoutRef.current = null
              }
              console.log("🔵 [JOIN] Stage blocked, redirecting to:", `/session/${resultSessionId}`)
              window.location.replace(`/session/${resultSessionId}`)
            } else {
              setStatus("stage_blocked")
            }
            break
          case "not_authenticated":
            setStatus("not_authenticated")
            break
          default:
            console.error("🔴 [JOIN] Unknown status:", resultStatus)
            setStatus("error")
            setErrorMessage(`Unknown status: ${resultStatus}`)
            hasInitiatedJoin.current = false
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
        }
        
        // Ensure we clear the join flag after processing
        console.log("🔵 [JOIN] Finished processing result, clearing join flag")
        hasInitiatedJoin.current = false
      } catch (err) {
        if (!mounted) return
        console.error("🔴 [JOIN] Unexpected error validating token:", err)
        setStatus("error")
        setErrorMessage(err instanceof Error ? err.message : "Failed to validate invite link")
        hasInitiatedJoin.current = false
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    }

    joinSession()

    return () => {
      mounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      // Reset redirecting flag on unmount
      redirectingRef.current = false
    }
  }, [token, user, authLoading, authTimeout, isMobile, status, router])

  const handleLogin = () => {
    // Store the join URL in localStorage so we can redirect back after login
    const joinUrl = `/session/join/${token}`
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_redirect", joinUrl)
      console.log("🔵 [JOIN] Stored auth_redirect:", joinUrl)
      console.log("🔵 [JOIN] Verified storage:", localStorage.getItem("auth_redirect"))
    }
    // Redirect to home page which will show login dialog
    // Also pass redirect in URL for non-OAuth flows
    router.push(`/?redirect=${encodeURIComponent(joinUrl)}`)
  }

  const handleGoToSession = () => {
    if (sessionId) {
      router.push(`/session/${sessionId}`)
    }
  }

  // Don't show AppShell navigation for join page - it's a standalone flow
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-lg">
        {status === "loading" || status === "validating" ? (
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center space-y-2">
                <CardTitle className="text-xl">Join Session</CardTitle>
                <p className="text-muted-foreground text-sm">
                  {status === "loading" 
                    ? authLoading && !authTimeout
                      ? isMobile 
                        ? "Please log in to continue"
                        : "Checking authentication..."
                      : authTimeout
                      ? "Please log in to continue"
                      : "Loading..."
                    : "Validating invite link..."}
                </p>
                {(status === "loading" && (authTimeout || (isMobile && authLoading && !user))) && (
                  <div className="mt-4 space-y-2">
                    <Alert>
                      <AlertDescription className="text-xs">
                        {isMobile 
                          ? "Please log in to join this session."
                          : "Authentication is taking longer than expected. Please log in to join this session."}
                      </AlertDescription>
                    </Alert>
                    <Button 
                      onClick={handleLogin} 
                      className="w-full"
                      size="sm"
                    >
                      Log In to Join Session
                    </Button>
                  </div>
                )}
                {loadingTimeout && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertDescription className="text-xs">
                      Taking longer than expected. The invite system may not be configured. Please try refreshing or contact support.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </CardContent>
        ) : (
          <>
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl">Join Session</CardTitle>
              <CardDescription className="mt-2">
                {status === "not_authenticated"
                  ? "Please log in to join this session"
                  : status === "invalid_token"
                  ? "Invalid invite link"
                  : status === "invite_disabled"
                  ? "Invite link disabled"
                  : status === "not_club_member"
                  ? "Club membership required"
                  : status === "session_finalized"
                  ? "Session finalized"
                  : status === "stage_blocked"
                  ? "Session in progress"
                  : "Validating invite link..."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {status === "not_authenticated" ? (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You need to be logged in to join this session.
                  </AlertDescription>
                </Alert>
                <Button onClick={handleLogin} className="w-full">
                  Log In to Join Session
                </Button>
              </div>
            ) : status === "invalid_token" ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-6 space-y-3">
                  <XCircle className="h-16 w-16 text-destructive" />
                  <p className="text-lg font-semibold text-center">Invalid Invite Link</p>
                  <p className="text-sm text-muted-foreground text-center">
                    This invite link is invalid or has expired. Please request a new link from the session organizer.
                  </p>
                </div>
                <Button onClick={() => router.push("/")} variant="outline" className="w-full" size="lg">
                  Go to Dashboard
                </Button>
              </div>
            ) : status === "invite_disabled" ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-6 space-y-3">
                  <XCircle className="h-16 w-16 text-destructive" />
                  <p className="text-lg font-semibold text-center">Invite Disabled</p>
                  <p className="text-sm text-muted-foreground text-center">
                    Invite links have been disabled for this session. Please contact the session organizer.
                  </p>
                </div>
                <Button onClick={() => router.push("/")} variant="outline" className="w-full" size="lg">
                  Go to Dashboard
                </Button>
              </div>
            ) : status === "not_club_member" ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-6 space-y-3">
                  <AlertCircle className="h-16 w-16 text-destructive" />
                  <p className="text-lg font-semibold text-center">Club Membership Required</p>
                  <p className="text-sm text-muted-foreground text-center">
                    You must be a member of this club to join the session. Please join the club first or contact the session organizer.
                  </p>
                </div>
                <Button onClick={() => router.push("/")} variant="outline" className="w-full" size="lg">
                  Go to Dashboard
                </Button>
              </div>
            ) : status === "session_finalized" ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-6 space-y-3">
                  <Lock className="h-16 w-16 text-muted-foreground" />
                  <p className="text-lg font-semibold text-center">Session Finalized</p>
                  <p className="text-sm text-muted-foreground text-center">
                    This session has been finalized. You can view it but cannot join as a new player.
                  </p>
                </div>
                {sessionId && (
                  <Button onClick={handleGoToSession} variant="outline" className="w-full" size="lg">
                    View Session
                  </Button>
                )}
              </div>
            ) : status === "stage_blocked" ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-6 space-y-3">
                  <Lock className="h-16 w-16 text-muted-foreground" />
                  <p className="text-lg font-semibold text-center">Session In Progress</p>
                  <p className="text-sm text-muted-foreground text-center">
                    This session has already started. New players cannot join at this stage.
                  </p>
                </div>
                {sessionId && (
                  <Button onClick={handleGoToSession} variant="outline" className="w-full" size="lg">
                    View Session
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-6 space-y-3">
                  <XCircle className="h-16 w-16 text-destructive" />
                  <p className="text-lg font-semibold text-center">Error</p>
                  <p className="text-sm text-muted-foreground text-center">
                    {errorMessage || "An unexpected error occurred. Please try again."}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={() => {
                      hasInitiatedJoin.current = false
                      setStatus("loading")
                      setErrorMessage(null)
                    }} 
                    variant="default" 
                    className="w-full" 
                    size="lg"
                  >
                    Try Again
                  </Button>
                  <Button onClick={() => router.push("/")} variant="outline" className="w-full" size="lg">
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
