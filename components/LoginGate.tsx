"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogIn } from "lucide-react"
import { LoginDialog } from "@/components/LoginDialog"

export function LoginGate() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || undefined
  const [showLogin, setShowLogin] = useState(false)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 md:p-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Poker Settle
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            To join a club, you must log in first.
          </p>
        </div>
        <div className="space-y-4">
          <Button
            size="lg"
            className="w-full h-12 text-base font-semibold"
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
