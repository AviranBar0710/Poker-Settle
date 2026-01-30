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

export function LoginDialog({ open, onOpenChange, onClose }: LoginDialogProps) {
  const router = useRouter()
  const isDesktop = useIsDesktop()
  const { requestOtp, verifyOtp } = useAuth()

  const [state, setState] = useState<LoginState>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sentEmail, setSentEmail] = useState("")
  const [resendCooldown, setResendCooldown] = useState(0)

  const reset = useCallback(() => {
    setState("email")
    setEmail("")
    setCode("")
    setErrorMessage(null)
    setSentEmail("")
    setResendCooldown(0)
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
      setErrorMessage(error.message ?? "Failed to send code")
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
      router.replace("/")
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || !sentEmail) return
    setErrorMessage(null)
    setState("sending")
    const { error } = await requestOtp(sentEmail)
    if (error) {
      setErrorMessage(error.message ?? "Failed to resend")
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
                  autoFocus={isDesktop}
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
                  Log in with email
                </DialogTitle>
                <DialogDescription className="text-sm mt-1.5 text-muted-foreground md:mt-0">
                  Enter your email to receive a 6-digit code. No password.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 md:flex-none md:min-h-auto md:overflow-visible md:p-0 md:py-4">
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
                  autoFocus={isDesktop}
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
