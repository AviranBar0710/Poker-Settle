"use client"

import { useState, useRef, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Check, Loader2, RefreshCw, X } from "lucide-react"
import { formatDateDDMMYYYY } from "@/lib/utils"

interface InvitePlayersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  inviteEnabled?: boolean
  inviteTokenCreatedAt?: string
  inviteTokenRegeneratedAt?: string
  inviteToken?: string | null // Pass existing token if available
  onTokenGenerated?: (token: string) => void
}

export function InvitePlayersDialog({
  open,
  onOpenChange,
  sessionId,
  inviteEnabled = false,
  inviteTokenCreatedAt,
  inviteTokenRegeneratedAt,
  inviteToken: propInviteToken,
  onTokenGenerated,
}: InvitePlayersDialogProps) {
  const [inviteToken, setInviteToken] = useState<string | null>(propInviteToken || null)
  
  // Update local state when prop changes
  useEffect(() => {
    if (propInviteToken) {
      setInviteToken(propInviteToken)
    }
  }, [propInviteToken])
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fallbackMode, setFallbackMode] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load existing token if available (from parent state)
  const inviteLink = inviteToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/session/join/${inviteToken}`
    : null

  const showCopiedFeedback = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!inviteLink) return

    try {
      await navigator.clipboard.writeText(inviteLink)
      showCopiedFeedback()
      return
    } catch {
      /* clipboard failed */
    }
    try {
      const input = inputRef.current
      if (input) {
        input.focus()
        input.select()
        input.setSelectionRange(0, inviteLink.length)
        const ok = document.execCommand("copy")
        if (ok) {
          showCopiedFeedback()
          return
        }
      }
    } catch {
      /* execCommand fallback failed */
    }
    setFallbackMode(true)
  }

  const generateToken = async (isRegenerate = false) => {
    if (isRegenerate) {
      setIsRegenerating(true)
    } else {
      setIsGenerating(true)
    }
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc("generate_session_invite_token_rpc", {
        p_session_id: sessionId,
      })

      if (rpcError) {
        setError(rpcError.message || "Failed to generate invite link")
        return
      }

      if (!data || data.length === 0) {
        setError("Invalid response from server")
        return
      }

      const result = data[0]
      if (result.status === "error") {
        setError(result.error_message || "Failed to generate invite link")
        return
      }

      if (result.status === "success" && result.token) {
        setInviteToken(result.token)
        onTokenGenerated?.(result.token)
      } else {
        setError("Failed to generate invite link")
      }
    } catch (err) {
      console.error("Error generating invite token:", err)
      setError(err instanceof Error ? err.message : "Failed to generate invite link")
    } finally {
      setIsGenerating(false)
      setIsRegenerating(false)
    }
  }

  const handleGenerate = () => {
    generateToken(false)
  }

  const handleRegenerate = () => {
    if (
      confirm(
        "Regenerating will invalidate the current invite link. Are you sure you want to continue?"
      )
    ) {
      generateToken(true)
    }
  }

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    console.log("🔵 [INVITE DIALOG] Open change:", newOpen)
    if (!newOpen) {
      setError(null)
      setFallbackMode(false)
      setCopied(false)
    }
    onOpenChange(newOpen)
  }
  
  // Log when dialog opens
  useEffect(() => {
    if (open) {
      console.log("🔵 [INVITE DIALOG] Dialog opened, sessionId:", sessionId)
    }
  }, [open, sessionId])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Players</DialogTitle>
          <DialogDescription>
            Share this link with players in your club to invite them to join this session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!inviteLink && !isGenerating ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  No invite link has been generated yet. Click the button below to create one.
                </AlertDescription>
              </Alert>
              <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Invite Link"
                )}
              </Button>
            </div>
          ) : inviteLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Invite Link
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    ref={inputRef}
                    readOnly
                    value={inviteLink}
                    aria-label="Session invite link"
                    className="font-mono text-sm flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    type="button"
                    aria-label={copied ? "Copied" : "Copy invite link"}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {copied && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Copied to clipboard!
                  </p>
                )}
              </div>

              {(inviteTokenCreatedAt || inviteTokenRegeneratedAt) && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {inviteTokenCreatedAt && (
                    <p>Created: {formatDateDDMMYYYY(inviteTokenCreatedAt)}</p>
                  )}
                  {inviteTokenRegeneratedAt && (
                    <p>Last regenerated: {formatDateDDMMYYYY(inviteTokenRegeneratedAt)}</p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="flex-1"
                >
                  {isRegenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regenerate Link
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
