"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogIn } from "lucide-react"
import { LoginDialog } from "@/components/LoginDialog"

export function LoginGate() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Loading…</p></div>}>
      <LoginGateInner />
    </Suspense>
  )
}

function LoginGateInner() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || undefined
  const [showLogin, setShowLogin] = useState(false)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-3">
          {/* Suit-cluster hero — DESIGN_SYSTEM.md §4 screen 1 */}
          <div aria-hidden="true" className="relative mx-auto h-32 w-36 select-none">
            <span className="absolute left-1/2 top-0 -translate-x-1/2 text-7xl leading-none text-primary/90">
              ♠
            </span>
            <span className="absolute bottom-1 left-1 -rotate-12 text-5xl leading-none text-primary/35">
              ♣
            </span>
            <span className="absolute bottom-1 right-1 rotate-12 text-5xl leading-none text-destructive/35">
              ♦
            </span>
          </div>
          <h1 className="text-hero tracking-tight text-foreground [text-wrap:balance]">
            Let&apos;s get started
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Sign in to settle your poker games
          </p>
        </div>
        <div className="space-y-4">
          <Button
            size="lg"
            className="w-full text-base"
            onClick={() => setShowLogin(true)}
          >
            <LogIn className="h-5 w-5 mr-2" />
            Log in
          </Button>
          <p className="text-xs text-muted-foreground">
            We send a 6-digit code to your email. No password.
          </p>
        </div>
      </div>
      <LoginDialog
        open={showLogin}
        onOpenChange={setShowLogin}
        redirectTo={redirectTo}
      />
    </div>
  )
}
