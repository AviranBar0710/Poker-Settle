"use client"

import * as React from "react"
import { Player } from "@/types/player"
import { supabase } from "@/lib/supabaseClient"
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset"
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetBody,
} from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { getCurrencySymbol } from "@/lib/currency"

/**
 * Add Buy-in Sheet — Mobile-only bottom sheet.
 * Contract: docs/agent_project_skills.md, docs/mobile_ux_contract.md, docs/mobile_ui_contract.md
 * - Bottom sheet, auto height, drag handle, no X
 * - One primary CTA, sticky footer, numeric input, optional quick amounts
 * - Touch targets ≥48px, keyboard never covers input/CTA
 */

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const QUICK_AMOUNTS = [100, 200, 500]

interface AddBuyinSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: Player | null
  sessionId: string
  clubId: string
  currency: string
  /** Last 3 amounts used in this session (common amounts) */
  recentAmounts?: number[]
  onSuccess?: () => void
  onToast?: (message: string) => void
}

export function AddBuyinSheet({
  open,
  onOpenChange,
  player,
  sessionId,
  clubId,
  currency,
  recentAmounts = [],
  onSuccess,
  onToast,
}: AddBuyinSheetProps) {
  const [amount, setAmount] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [successAmount, setSuccessAmount] = React.useState<number | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const keyboardOffset = useKeyboardOffset(open)

  const reset = React.useCallback(() => {
    setAmount("")
    setError(null)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    if (open) {
      reset()
      // No auto-focus: keyboard opens only when user taps the input field
    }
  }, [open, reset])

  const num = React.useMemo(() => {
    const v = amount.trim().replace(/,/g, "")
    const n = parseFloat(v)
    return v === "" ? null : isNaN(n) ? undefined : n
  }, [amount])

  const invalid = num === null || num === undefined || num <= 0
  const canSubmit = !invalid && !loading

  const submitAmount = React.useCallback(
    async (value: number) => {
      if (!player) return
      setError(null)
      setLoading(true)
      try {
        const id = generateUUID()
        const { error: err } = await supabase.from("transactions").insert({
          id,
          session_id: sessionId,
          club_id: clubId,
          player_id: player.id,
          type: "buyin",
          amount: value,
        })
        if (err) {
          setError(err.message ?? "Failed to add buy-in")
          setLoading(false)
          return
        }
        onSuccess?.()
        setSuccessAmount(value)
        setLoading(false)
        setTimeout(() => onOpenChange(false), 800)
      } catch (err) {
        setError((err as Error)?.message ?? "Something went wrong")
        setLoading(false)
      }
    },
    [player, sessionId, clubId, onSuccess, onOpenChange]
  )

  const handleQuickAmount = (value: number) => {
    setError(null)
    submitAmount(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!player || !canSubmit || num === null || num === undefined || num <= 0) return

    setError(null)
    setLoading(true)

    try {
      const id = generateUUID()
      const { error: err } = await supabase.from("transactions").insert({
        id,
        session_id: sessionId,
        club_id: clubId,
        player_id: player.id,
        type: "buyin",
        amount: num,
      })

      if (err) {
        setError(err.message ?? "Failed to add buy-in")
        setLoading(false)
        return
      }

      onSuccess?.()
      setLoading(false)
      setSuccessAmount(num)
      setTimeout(() => onOpenChange(false), 800)
    } catch (err) {
      setError((err as Error)?.message ?? "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (!player) return null

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent height="auto" className="flex flex-col max-h-[85vh]">
        {successAmount != null ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="rounded-full bg-green-500/20 p-4 mb-4">
              <Check className="h-12 w-12 text-green-600 dark:text-green-500" />
            </div>
            <p className="text-lg font-semibold">Buy-in added!</p>
            <p className="text-muted-foreground mt-1">
              {player.name} · {currency} {successAmount.toFixed(2)}
            </p>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <BottomSheetHeader>
            <BottomSheetTitle>Add Buy-in</BottomSheetTitle>
            <BottomSheetDescription>{player.name}</BottomSheetDescription>
          </BottomSheetHeader>

          <BottomSheetBody
            className="flex-1 min-h-0 overflow-y-auto px-4 pb-4"
            style={{ paddingBottom: `calc(1rem + ${keyboardOffset}px)` }}
          >
            <div className="space-y-4">
              {/* Common amounts from session (if any) */}
              {recentAmounts.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Recently used
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {recentAmounts
                      .filter((v) => !QUICK_AMOUNTS.includes(v))
                      .map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleQuickAmount(value)}
                          disabled={loading}
                          className={cn(
                            "min-h-[68px] min-w-[80px] flex-1 px-4 rounded-xl text-lg font-semibold",
                            "bg-muted text-foreground",
                            "active:scale-[0.98]",
                            "transition-transform duration-100"
                          )}
                        >
                          {getCurrencySymbol(currency as "USD" | "ILS" | "EUR")}
                          {value}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Quick amounts - primary, tap to submit instantly */}
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Quick amount (tap to add)
                </span>
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleQuickAmount(value)}
                      disabled={loading}
                      className={cn(
                        "min-h-[68px] min-w-[80px] flex-1 px-4 rounded-xl text-lg font-semibold",
                        "bg-primary text-primary-foreground",
                        "active:scale-[0.98]",
                        "transition-transform duration-100"
                      )}
                    >
                      {getCurrencySymbol(currency as "USD" | "ILS" | "EUR")}
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom amount - secondary */}
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="add-buyin-amount" className="text-sm text-muted-foreground">
                  Or enter custom amount
                </Label>
                <Input
                  ref={inputRef}
                  id="add-buyin-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, "")
                    const parts = v.split(".")
                    const filtered =
                      parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0]
                    setAmount(filtered)
                    if (error) setError(null)
                  }}
                  onFocus={() => {
                    requestAnimationFrame(() => {
                      inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })
                    })
                  }}
                  disabled={loading}
                  className="h-12 text-lg font-mono opacity-90"
                  autoComplete="off"
                />
              </div>

              {error && (
                <p
                  className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </div>
          </BottomSheetBody>

          <div
            className="flex-shrink-0 px-4 pt-4 border-t bg-background"
            style={{
              paddingBottom: `calc(max(1rem, env(safe-area-inset-bottom)) + ${keyboardOffset}px)`,
            }}
          >
            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full min-h-[48px] text-base font-semibold gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add Buy-in"
              )}
            </Button>
          </div>
        </form>
        )}
      </BottomSheetContent>
    </BottomSheet>
  )
}
