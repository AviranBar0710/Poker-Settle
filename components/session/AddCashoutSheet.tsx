"use client"

import * as React from "react"
import { Player } from "@/types/player"
import { Transaction } from "@/types/transaction"
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
import { Loader2, Check, Pencil, Trash2 } from "lucide-react"
import { getCurrencySymbol } from "@/lib/currency"
import { cn } from "@/lib/utils"

/**
 * Add Cash-out Sheet — Mobile-only bottom sheet.
 * Contract: docs/agent_project_skills.md, docs/mobile_ux_contract.md, docs/mobile_ui_contract.md
 * - Bottom sheet, auto height, drag handle, no X
 * - One primary CTA, sticky footer, numeric input, optional quick amounts
 * - Validation: amount > current balance → invalid
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

interface AddCashoutSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: Player | null
  sessionId: string
  clubId: string
  currency: string
  /** Current balance (total buy-ins - total cash-outs) for validation */
  currentBalance: number
  /** Last 3 amounts used in this session (common amounts) */
  recentAmounts?: number[]
  /** This player's existing cash-outs — enables fix/delete when the manager made a mistake */
  existingCashouts?: Transaction[]
  onSuccess?: () => void
  onToast?: (message: string) => void
}

export function AddCashoutSheet({
  open,
  onOpenChange,
  player,
  sessionId,
  clubId,
  currency,
  currentBalance,
  recentAmounts = [],
  existingCashouts = [],
  onSuccess,
  onToast,
}: AddCashoutSheetProps) {
  const [amount, setAmount] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [successAmount, setSuccessAmount] = React.useState<number | null>(null)
  /** When set, the sheet updates this existing cash-out instead of inserting */
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const keyboardOffset = useKeyboardOffset(open)

  const reset = React.useCallback(() => {
    setAmount("")
    setError(null)
    setLoading(false)
    setSuccessAmount(null)
    setEditingId(null)
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

  // No balance restriction - player can cash out any positive amount
  // (they might have won chips and have more than their buy-ins)
  const invalid = num === null || num === undefined || num <= 0
  const canSubmit = !invalid && !loading

  const submitAmount = React.useCallback(
    async (value: number) => {
      if (!player) return
      setError(null)
      setLoading(true)
      try {
        const { error: err } = editingId
          ? await supabase
              .from("transactions")
              .update({ amount: value })
              .eq("id", editingId)
          : await supabase.from("transactions").insert({
              id: generateUUID(),
              session_id: sessionId,
              club_id: clubId,
              player_id: player.id,
              type: "cashout",
              amount: value,
            })
        if (err) {
          setError(err.message ?? (editingId ? "Failed to update cash-out" : "Failed to add cash-out"))
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
    [player, sessionId, clubId, editingId, onSuccess, onOpenChange]
  )

  const handleStartEdit = (tx: Transaction) => {
    setEditingId(tx.id)
    setAmount(tx.amount.toFixed(2).replace(/\.00$/, ""))
    setError(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setAmount("")
    setError(null)
  }

  const handleDelete = async (tx: Transaction) => {
    if (!window.confirm(`Delete cash-out of ${getCurrencySymbol(currency as "USD" | "ILS" | "EUR")}${tx.amount.toFixed(2)}?`)) return
    setError(null)
    setLoading(true)
    const { error: err } = await supabase.from("transactions").delete().eq("id", tx.id)
    setLoading(false)
    if (err) {
      setError(err.message ?? "Failed to delete cash-out")
      return
    }
    if (editingId === tx.id) handleCancelEdit()
    onToast?.("Cash-out deleted")
    onSuccess?.()
  }

  const handleQuickAmount = (value: number) => {
    setError(null)
    submitAmount(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!player || !canSubmit || num === null || num === undefined || num <= 0)
      return
    await submitAmount(num)
  }

  if (!player) return null

  const formattedBalance = `${getCurrencySymbol(currency as "USD" | "ILS" | "EUR")}${currentBalance.toFixed(2)}`

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent height="auto" className="flex flex-col max-h-[85vh]">
        {successAmount != null ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="rounded-full bg-success/15 p-4 mb-4">
              <Check className="h-12 w-12 text-success" />
            </div>
            <p className="text-lg font-semibold">{editingId ? "Cash-out updated!" : "Cash-out added!"}</p>
            <p className="text-muted-foreground mt-1">
              {player.name} · {getCurrencySymbol(currency as "USD" | "ILS" | "EUR")}{successAmount.toFixed(2)}
            </p>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <BottomSheetHeader>
            <BottomSheetTitle>{editingId ? "Fix Cash-out" : "Add Cash-out"}</BottomSheetTitle>
            <BottomSheetDescription>
              {player.name} · Balance {formattedBalance}
            </BottomSheetDescription>
          </BottomSheetHeader>

          <BottomSheetBody
            className="flex-1 min-h-0 overflow-y-auto px-4 pb-4"
            style={{ paddingBottom: `calc(1rem + ${keyboardOffset}px)` }}
          >
            <div className="space-y-4">
              {/* Existing cash-outs — tap ✎ to fix a mistake, 🗑 to remove */}
              {existingCashouts.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Recorded cash-outs
                  </span>
                  {existingCashouts.map((tx) => (
                    <div
                      key={tx.id}
                      className={cn(
                        "flex items-center gap-2 rounded-tile border bg-background/45 px-3 py-2",
                        editingId === tx.id && "border-primary/40 bg-primary/10"
                      )}
                    >
                      <span className="flex-1 font-mono text-base font-semibold tabular-nums">
                        {getCurrencySymbol(currency as "USD" | "ILS" | "EUR")}
                        {tx.amount.toFixed(2)}
                      </span>
                      {editingId === tx.id ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={loading}
                          className="h-10 px-3 text-sm text-muted-foreground"
                        >
                          Cancel
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEdit(tx)}
                          disabled={loading}
                          className="h-10 w-10"
                          aria-label="Fix this cash-out"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(tx)}
                        disabled={loading}
                        className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                        aria-label="Delete this cash-out"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Common amounts from session (if any) */}
              {!editingId && recentAmounts.length > 0 && (
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

              {/* Quick amounts - primary, tap to submit instantly (hidden while fixing) */}
              {!editingId && (
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
                      {currency}
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Custom amount - secondary (primary while fixing) */}
              <div className={cn("space-y-2", !editingId && "pt-2 border-t")}>
                <Label htmlFor="add-cashout-amount" className="text-sm text-muted-foreground">
                  {editingId ? "Corrected amount" : "Or enter custom amount"}
                </Label>
                <Input
                  ref={inputRef}
                  id="add-cashout-amount"
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
                  {editingId ? "Updating…" : "Adding…"}
                </>
              ) : editingId ? (
                "Update Cash-out"
              ) : (
                "Add Cash-out"
              )}
            </Button>
          </div>
        </form>
        )}
      </BottomSheetContent>
    </BottomSheet>
  )
}
