"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Mail, RotateCcw, ArrowLeft } from "lucide-react"

const RESEND_COOLDOWN_SEC = 20

type LoginState =
  | "email"
  | "sending"
  | "code"
  | "verifying"
  | "success"
  | "error"

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose?: () => void
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function LoginDialog({ open, onOpenChange, onClose }: LoginDialogProps) {
  const router = useRouter()
  const isDesktop = useIsDesktop()
  const { requestOtp, verifyOtp, signInWithGoogle } = useAuth()

  const [state, setState] = useState<LoginState>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sentEmail, setSentEmail] = useState("")
  const [resendCooldown, setResendCooldown] = useState(0)
  const [googleLoading, setGoogleLoading] = useState(false)

  const reset = useCallback(() => {
    setState("email")
    setEmail("")
    setCode("")
    setErrorMessage(null)
    setSentEmail("")
    setResendCooldown(0)
    setGoogleLoading(false)
  }, [])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        reset()
        onClose?.()
      }
      onOpenChange(next)
    },
    [onOpenChange, onClose, reset]
  )

  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(
      () => setResendCooldown((c) => Math.max(0, c - 1)),
      1000
    )
    return () => clearInterval(t)
  }, [resendCooldown])

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    const trimmed = email.trim()
    if (!trimmed) {
      setErrorMessage("Please enter your email address")
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmed)) {
      setErrorMessage("Please enter a valid email address")
      return
    }
    setState("sending")
    const { error } = await requestOtp(trimmed)
    if (error) {
      const msg = error.message ?? "Failed to send code"
      const isRateLimit = /rate limit|too many requests|too_many_requests/i.test(msg)
      setErrorMessage(
        isRateLimit
          ? "Too many login attempts. Please wait 15–30 minutes before trying again, or try a different email address."
          : msg
      )
      setState("error")
    } else {
      setSentEmail(trimmed)
      setState("code")
      setResendCooldown(RESEND_COOLDOWN_SEC)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    const trimmed = code.replace(/\s/g, "")
    if (!trimmed || trimmed.length < 6) {
      setErrorMessage("Please enter the 6-digit code")
      return
    }
    setState("verifying")
    const { error } = await verifyOtp(sentEmail, trimmed)
    if (error) {
      setErrorMessage(error.message ?? "Invalid code")
      setState("code")
    } else {
      setState("success")
      // Hard redirect to Home so new users always land on Dashboard (or /join via OnboardingGuard)
      if (typeof window !== "undefined") {
        window.location.replace("/")
      } else {
        router.replace("/")
      }
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || !sentEmail) return
    setErrorMessage(null)
    setState("sending")
    const { error } = await requestOtp(sentEmail)
    if (error) {
      const msg = error.message ?? "Failed to resend"
      const isRateLimit = /rate limit|too many requests|too_many_requests/i.test(msg)
      setErrorMessage(
        isRateLimit
          ? "Too many attempts. Please wait 15–30 minutes before resending."
          : msg
      )
      setState("code")
    } else {
      setState("code")
      setResendCooldown(RESEND_COOLDOWN_SEC)
    }
  }

  const handleChangeEmail = () => {
    setState("email")
    setErrorMessage(null)
    setSentEmail("")
    setCode("")
    setResendCooldown(0)
  }

  const handleGoogleSignIn = async () => {
    setErrorMessage(null)
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    setGoogleLoading(false)
    if (error) {
      setErrorMessage(error.message ?? "Failed to sign in with Google")
      setState("error")
    }
    // On success, signInWithGoogle redirects to Google - user leaves the page
  }

  const sending = state === "sending"
  const verifying = state === "verifying"
  const success = state === "success"
  const resending = sending && !!sentEmail
  const isCodeScreen =
    state === "code" || verifying || (sending && !!sentEmail)
  const isEmailScreen =
    state === "email" || (sending && !sentEmail) || state === "error"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="!flex !flex-col p-0 gap-0 !max-h-[90vh] md:!max-w-lg md:!max-h-[85vh] md:p-6 md:gap-4 md:rounded-lg !bottom-0 !left-0 !right-0 !top-auto !translate-y-0 rounded-t-lg rounded-b-none md:!left-[50%] md:!top-[50%] md:!right-auto md:!bottom-auto md:!translate-x-[-50%] md:!translate-y-[-50%] md:!rounded-lg"
        onOpenAutoFocus={(e) => {
          if (!isDesktop) e.preventDefault()
        }}
      >
        {success ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Redirecting…</p>
          </div>
        ) : isCodeScreen ? (
          <form onSubmit={handleVerify} className="flex flex-col h-full min-h-0">
            <div className="flex-shrink-0 px-4 pt-5 pb-4 border-b md:border-b-0 md:p-0 md:pb-0">
              <DialogHeader className="md:text-left">
                <div className="flex justify-center md:justify-start mb-3">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <DialogTitle className="text-xl md:text-lg font-semibold text-center md:text-left">
                  Enter code
                </DialogTitle>
                <DialogDescription className="text-sm mt-1.5 text-muted-foreground text-center md:text-left md:mt-0">
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-foreground">{sentEmail}</span>
                  . Check your spam folder if you don&apos;t see it.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 md:flex-none md:min-h-auto md:overflow-visible md:p-0 md:py-4">
              <div className="space-y-2">
                <Label
                  htmlFor="login-dialog-otp"
                  className="text-sm font-semibold block text-foreground"
                >
                  Code
                </Label>
                <Input
                  id="login-dialog-otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6)
                    setCode(v)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  disabled={verifying}
                  autoComplete="one-time-code"
                  className="h-12 md:h-10 text-base md:text-sm font-mono tracking-[0.3em] text-center"
                  autoFocus={false}
                />
              </div>
              {errorMessage && (
                <div
                  className="text-sm px-3 py-2 rounded-md text-destructive bg-destructive/10 border border-destructive/20"
                  role="alert"
                >
                  {errorMessage}
                </div>
              )}
            </div>
            <div className="flex-shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 border-t bg-background md:border-t-0 md:bg-transparent md:p-0 md:pt-4 md:pb-0 space-y-2">
              <Button
                type="submit"
                disabled={verifying || resending || code.length < 6}
                className="w-full h-12 text-base font-semibold gap-2"
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 h-11 text-sm"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || verifying || resending}
                >
                  {resending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      Sending…
                    </>
                  ) : resendCooldown > 0 ? (
                    <>Resend in {resendCooldown}s</>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-1.5" />
                      Resend code
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-11 text-sm text-muted-foreground"
                  onClick={handleChangeEmail}
                  disabled={verifying || resending}
                >
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Change email
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSendCode} className="flex flex-col h-full min-h-0">
            <div className="flex-shrink-0 px-4 pt-5 pb-4 border-b md:border-b-0 md:p-0 md:pb-0">
              <DialogHeader className="md:text-left">
                <DialogTitle className="text-xl md:text-lg font-semibold">
                  Log in
                </DialogTitle>
                <DialogDescription className="text-sm mt-1.5 text-muted-foreground md:mt-0">
                  Use Google or enter your email for a 6-digit code.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 md:flex-none md:min-h-auto md:overflow-visible md:p-0 md:py-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={sending || googleLoading}
                className="w-full h-12 gap-2 border-2 text-base font-medium"
              >
                {googleLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Connecting…
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    Continue with Google
                  </>
                )}
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>
              {sending && (
                <p className="text-sm text-muted-foreground flex items-center gap-2" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </p>
              )}
              <div className="space-y-2">
                <Label
                  htmlFor="login-dialog-email"
                  className="text-sm font-semibold block text-foreground"
                >
                  Email
                </Label>
                <Input
                  id="login-dialog-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  disabled={sending}
                  autoComplete="email"
                  className="h-12 md:h-10 text-base md:text-sm"
                  autoFocus={false}
                />
              </div>
              {errorMessage && (
                <div
                  className="text-sm px-3 py-2 rounded-md text-destructive bg-destructive/10 border border-destructive/20"
                  role="alert"
                >
                  {errorMessage}
                </div>
              )}
            </div>
            <div className="flex-shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 border-t bg-background md:border-t-0 md:bg-transparent md:p-0 md:pt-4 md:pb-0">
              <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end md:gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={sending}
                  className="h-11 md:h-10 order-2 md:order-1 text-base md:text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={sending}
                  className="h-12 md:h-10 order-1 md:order-2 md:min-w-[140px] text-base md:text-sm font-medium w-full md:w-auto gap-2"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send code"
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
