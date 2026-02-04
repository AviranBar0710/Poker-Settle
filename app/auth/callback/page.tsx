"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { Loader2, Mail, RotateCcw } from "lucide-react"

const TIMEOUT_MS = 8000
const RESEND_COOLDOWN_SEC = 20

const IS_DEV = typeof window !== "undefined" && process.env.NODE_ENV === "development"

function devLog(msg: string, data?: Record<string, unknown>) {
  if (IS_DEV) {
    if (data) console.log(`[auth/callback] ${msg}`, data)
    else console.log(`[auth/callback] ${msg}`)
  }
}

function hasHashTokens(): boolean {
  if (typeof window === "undefined") return false
  const h = window.location.hash || ""
  return h.includes("access_token") || h.includes("refresh_token")
}

type CallbackState =
  | "loading"
  | "exchanging"
  | "success"
  | "pkce_missing"
  | "error"
  | "timeout"

function isPkceVerifierError(err: { message?: string } | null): boolean {
  const m = (err?.message ?? "").toLowerCase()
  return m.includes("verifier") || m.includes("pkce")
}

function LoadingView() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="text-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent mx-auto" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  )
}

function ErrorView({
  title,
  message,
  onBack,
}: {
  title: string
  message?: string | null
  onBack: () => void
}) {
  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="text-center space-y-4 max-w-sm w-full">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
        <Button onClick={onBack} className="w-full sm:w-auto" size="lg">
          Back to Home
        </Button>
      </div>
    </div>
  )
}

function TimeoutView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="text-center space-y-4 max-w-sm w-full">
        <h1 className="text-lg font-semibold text-foreground">
          Login failed (timeout)
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign-in took too long. Please try again.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={onBack} variant="default" size="lg" className="w-full sm:w-auto">
            Try again
          </Button>
          <Button onClick={onBack} variant="outline" size="lg" className="w-full sm:w-auto">
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  )
}

function PkceMissingView({
  onBack,
  onSendLink,
}: {
  onBack: () => void
  onSendLink: (email: string) => Promise<void>
}) {
  const isDesktop = useIsDesktop()
  const [email, setEmail] = useState("")
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle")
  const [resendError, setResendError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [sentEmail, setSentEmail] = useState("")

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(
      () => setResendCooldown((c) => Math.max(0, c - 1)),
      1000
    )
    return () => clearInterval(t)
  }, [resendCooldown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResendError(null)
    const trimmed = email.trim()
    if (!trimmed) {
      setResendError("Please enter your email address")
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmed)) {
      setResendError("Please enter a valid email address")
      return
    }
    setResendState("sending")
    try {
      await onSendLink(trimmed)
      setSentEmail(trimmed)
      setResendState("sent")
      setResendCooldown(RESEND_COOLDOWN_SEC)
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to send link")
      setResendState("idle")
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || !sentEmail) return
    setResendError(null)
    setResendState("sending")
    try {
      await onSendLink(sentEmail)
      setResendState("sent")
      setResendCooldown(RESEND_COOLDOWN_SEC)
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to send link")
      setResendState("sent")
    }
  }

  const resending = resendState === "sending" && !!sentEmail
  const sent = resendState === "sent" || resending

  if (sent) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center space-y-4 max-w-sm w-full">
          <div className="rounded-full bg-primary/10 p-3 w-fit mx-auto">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            Check your email
          </h1>
          <p className="text-sm text-muted-foreground">
            We sent a magic link to{" "}
            <span className="font-medium text-foreground">{sentEmail}</span>.
            Open it in <strong>this browser</strong> to log in.
          </p>
          {resendError && (
            <div
              className="text-sm px-3 py-2 rounded-md text-destructive bg-destructive/10 border border-destructive/20"
              role="alert"
            >
              {resendError}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button
              onClick={onBack}
              className="w-full"
              size="lg"
              disabled={resending}
            >
              Back to Home
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              disabled={resendCooldown > 0 || resending}
              className="w-full gap-2"
            >
              {resending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : resendCooldown > 0 ? (
                <>Resend in {resendCooldown}s</>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Resend link
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="text-center space-y-4 max-w-sm w-full">
        <h1 className="text-lg font-semibold text-foreground">
          Open link in same browser
        </h1>
        <p className="text-sm text-muted-foreground">
          This link must be opened in the same browser or device where you
          requested it.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-2">
            <Label htmlFor="callback-resend-email" className="text-sm font-medium">
              Send new magic link
            </Label>
            <Input
              id="callback-resend-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (resendError) setResendError(null)
              }}
              disabled={resendState === "sending"}
              autoComplete="email"
              className="h-11"
              autoFocus={false}
            />
          </div>
          {resendError && (
            <div
              className="text-sm px-3 py-2 rounded-md text-destructive bg-destructive/10 border border-destructive/20"
              role="alert"
            >
              {resendError}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={resendState === "sending"}
            >
              {resendState === "sending" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending…
                </>
              ) : (
                "Send new magic link"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onBack}
              disabled={resendState === "sending"}
              className="w-full"
            >
              Back to Home
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AuthCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirected = useRef(false)
  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null)
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)

  const [state, setState] = useState<CallbackState>("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const goHome = useCallback(() => {
    if (redirected.current) return
    redirected.current = true
    devLog("redirect", { to: "/" })
    // Hard redirect to Home so new users always land on Dashboard (or /join via OnboardingGuard)
    if (typeof window !== "undefined") {
      window.location.replace("/")
    } else {
      router.replace("/")
    }
  }, [router])

  const sendMagicLink = useCallback(async (email: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const redirectTo = `${origin}/auth/callback`
    devLog("signInWithOtp", { email: email.replace(/(.{2}).*(@.*)/, "$1***$2"), redirectTo })
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    })
    if (error) throw new Error(error.message)
  }, [])

  useEffect(() => {
    const code = searchParams.get("code")
    const hash = hasHashTokens()

    const clearTimer = () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current)
        timeoutId.current = null
      }
    }

    const done = (next: CallbackState, msg?: string | null) => {
      clearTimer()
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
        subscriptionRef.current = null
      }
      setErrorMessage(msg ?? null)
      setState(next)
    }

    if (IS_DEV && typeof window !== "undefined") {
      devLog("location", {
        href: window.location.href,
        hasCode: !!code,
        hasHashTokens: hash,
      })
    }

    timeoutId.current = setTimeout(() => {
      if (redirected.current) return
      devLog("timeout", { afterMs: TIMEOUT_MS })
      done("timeout")
    }, TIMEOUT_MS)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (redirected.current) return
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (s) {
          devLog("session from listener", { event, userId: s.user?.id })
          clearTimer()
          goHome()
        }
      }
    })
    subscriptionRef.current = subscription

    const runPkceFallback = async (): Promise<boolean> => {
      const { data: d1 } = await supabase.auth.getSession()
      if (d1.session) {
        devLog("fallback getSession", { userId: d1.session.user?.id })
        return true
      }
      try {
        const { error } = await supabase.auth.refreshSession()
        if (error) {
          devLog("fallback refreshSession error", { message: error.message })
          return false
        }
        const { data: d2 } = await supabase.auth.getSession()
        if (d2.session) {
          devLog("fallback after refreshSession", { userId: d2.session.user?.id })
          return true
        }
      } catch (e) {
        const msg = (e as Error)?.message ?? ""
        devLog("fallback refreshSession catch", { message: msg })
        return false
      }
      return false
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (redirected.current) return
      if (IS_DEV) devLog("getSession", { hasSession: !!session, userId: session?.user?.id })
      if (session) {
        clearTimer()
        goHome()
        return
      }
      if (code) {
        setState("exchanging")
        devLog("pkce exchange", { hasCode: true })

        supabase.auth
          .exchangeCodeForSession(code)
          .then(async ({ data, error }) => {
            if (redirected.current) return
            if (error) {
              devLog("exchange error", {
                message: error.message,
                code: error.code,
                pkce: isPkceVerifierError(error),
              })
              if (isPkceVerifierError(error)) {
                const ok = await runPkceFallback()
                if (redirected.current) return
                if (ok) {
                  clearTimer()
                  goHome()
                } else {
                  done("pkce_missing")
                }
              } else {
                done("error", error.message ?? "Login failed")
              }
              return
            }
            devLog("exchange success", { userId: data.session?.user?.id })
            clearTimer()
            goHome()
          })
          .catch(async (err) => {
            if (redirected.current) return
            devLog("exchange catch", { message: (err as Error)?.message })
            if (isPkceVerifierError(err as { message?: string })) {
              const ok = await runPkceFallback()
              if (redirected.current) return
              if (ok) {
                clearTimer()
                goHome()
              } else {
                done("pkce_missing")
              }
            } else {
              done("error", (err as Error)?.message ?? "Login failed")
            }
          })
        return
      }
      devLog("hash/initial session flow", { hasCode: false })
    })

    return () => {
      clearTimer()
      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = null
    }
  }, [searchParams, goHome])

  if (state === "pkce_missing") {
    return (
      <PkceMissingView
        onBack={goHome}
        onSendLink={sendMagicLink}
      />
    )
  }

  if (state === "error") {
    return (
      <ErrorView
        title="Login failed"
        message={errorMessage}
        onBack={goHome}
      />
    )
  }

  if (state === "timeout") {
    return <TimeoutView onBack={goHome} />
  }

  return <LoadingView />
}

/**
 * Post-login entrypoint: always redirect to Home (/).
 * PKCE code_verifier is stored in localStorage; it is often missing when magic links
 * are opened from Gmail app, iOS Mail, redirectors, or incognito — causing
 * exchangeCodeForSession to fail. We support both hash tokens and ?code=, and
 * on PKCE verifier missing we run getSession + refreshSession fallback before
 * showing "same browser" / resend UI.
 */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <AuthCallbackInner />
    </Suspense>
  )
}
