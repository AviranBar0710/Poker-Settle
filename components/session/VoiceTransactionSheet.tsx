"use client"

import * as React from "react"
import { Player } from "@/types/player"
import { supabase } from "@/lib/supabaseClient"
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { parseBestAlternative, type ParsedBuyinCommand } from "@/lib/voice/parseBuyinCommand"
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
import { Loader2, Mic, MicOff, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { getCurrencySymbol, type CurrencyCode } from "@/lib/currency"

/**
 * Voice Transaction Sheet — table manager records a buy-in or cash-out by voice, e.g.
 *   buy-in:   "תוסיף 100 לגיא" / "add 200 to Michael"
 *   cash-out: "גיא יצא עם 450" / "Michael cashed out 300"
 * Flow: listen → parse → review (player + amount, both editable) → confirm → insert transaction.
 * The transaction type comes from the session phase (the `type` prop), not from the spoken verb.
 * Nothing is written without an explicit Confirm tap, so misheard commands are harmless.
 */

type VoiceLang = "he-IL" | "en-US"
const LANG_STORAGE_KEY = "voice-buyin-lang"

export type VoiceTransactionType = "buyin" | "cashout"

const LANGS: { code: VoiceLang; label: string }[] = [
  { code: "he-IL", label: "עברית" },
  { code: "en-US", label: "English" },
]

const COPY: Record<
  VoiceTransactionType,
  { title: string; noun: string; cta: string; examples: Record<VoiceLang, string> }
> = {
  buyin: {
    title: "Voice Buy-in",
    noun: "buy-in",
    cta: "Add Buy-in",
    examples: { "he-IL": "תוסיף 100 לגיא", "en-US": "Add 200 to Michael" },
  },
  cashout: {
    title: "Voice Cash-out",
    noun: "cash-out",
    cta: "Add Cash-out",
    examples: { "he-IL": "גיא יצא עם 450", "en-US": "Michael cashed out 300" },
  },
}

function readStoredLang(): VoiceLang {
  try {
    const v = localStorage.getItem(LANG_STORAGE_KEY)
    if (v === "he-IL" || v === "en-US") return v
  } catch {
    // storage unavailable — fall through
  }
  return "he-IL"
}

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

interface VoiceTransactionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  players: Player[]
  sessionId: string
  clubId: string
  currency: string
  type: VoiceTransactionType
  /** Per-player total already recorded for this type — used to warn about duplicate cash-outs */
  existingTotals?: Record<string, number>
  onSuccess?: () => void
}

export function VoiceTransactionSheet({
  open,
  onOpenChange,
  players,
  sessionId,
  clubId,
  currency,
  type,
  existingTotals = {},
  onSuccess,
}: VoiceTransactionSheetProps) {
  // Sheet is only mounted client-side after a tap, so reading storage in the initializer is safe
  const [lang, setLang] = React.useState<VoiceLang>(readStoredLang)
  const langChangedRef = React.useRef(false)
  const [parsed, setParsed] = React.useState<ParsedBuyinCommand<Player> | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string | null>(null)
  const [amount, setAmount] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [lastAdded, setLastAdded] = React.useState<string | null>(null)
  const keyboardOffset = useKeyboardOffset(open)
  const symbol = getCurrencySymbol(currency as CurrencyCode)
  const copy = COPY[type]

  const handleFinalResult = React.useCallback(
    (alternatives: string[]) => {
      const result = parseBestAlternative(alternatives, players)
      setParsed(result)
      setSelectedPlayerId(result.player?.id ?? null)
      setAmount(result.amount != null ? String(result.amount) : "")
      setSaveError(null)
    },
    [players]
  )

  const speech = useSpeechRecognition({ lang, onFinalResult: handleFinalResult })
  const { start: startListening, abort: abortListening } = speech

  const listen = React.useCallback(() => {
    setParsed(null)
    setSelectedPlayerId(null)
    setAmount("")
    setSaveError(null)
    startListening()
  }, [startListening])

  // After switching language, start listening again with the new recognizer language
  React.useEffect(() => {
    if (langChangedRef.current) {
      langChangedRef.current = false
      listen()
    }
  }, [listen])

  // Start listening as soon as the sheet opens (the open tap is the user gesture);
  // release the mic when it closes.
  React.useEffect(() => {
    if (open) {
      setLastAdded(null)
      listen()
    } else {
      abortListening()
      setParsed(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const changeLang = (code: VoiceLang) => {
    abortListening()
    setLang(code)
    try {
      localStorage.setItem(LANG_STORAGE_KEY, code)
    } catch {
      // ignore
    }
    if (code !== lang) langChangedRef.current = true
  }

  const amountNum = React.useMemo(() => {
    const n = parseFloat(amount.replace(/,/g, ""))
    return Number.isFinite(n) && n > 0 ? n : null
  }, [amount])

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) ?? null
  const canConfirm = !!selectedPlayer && amountNum !== null && !saving

  const confirm = async () => {
    if (!selectedPlayer || amountNum === null) return
    setSaving(true)
    setSaveError(null)
    try {
      const { error } = await supabase.from("transactions").insert({
        id: generateUUID(),
        session_id: sessionId,
        club_id: clubId,
        player_id: selectedPlayer.id,
        type,
        amount: amountNum,
      })
      if (error) {
        setSaveError(error.message ?? `Failed to add ${copy.noun}`)
        return
      }
      const message = `Added ${symbol}${amountNum} ${copy.noun} for ${selectedPlayer.name}`
      onSuccess?.()
      setLastAdded(message)
      setParsed(null)
      setSelectedPlayerId(null)
      setAmount("")
    } catch (err) {
      setSaveError((err as Error)?.message ?? "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  // Players to offer as chips: parser candidates first, then everyone else
  const orderedPlayers = React.useMemo(() => {
    if (!parsed) return players
    const candidateIds = parsed.candidates.map((c) => c.player.id)
    const rest = players.filter((p) => !candidateIds.includes(p.id))
    return [...parsed.candidates.map((c) => c.player), ...rest]
  }, [parsed, players])

  const statusHint = (() => {
    if (!parsed) return null
    switch (parsed.status) {
      case "ambiguous":
        return "Which player did you mean?"
      case "no_player":
        return parsed.nameQuery
          ? `Couldn't find a player named “${parsed.nameQuery}”. Pick one:`
          : "Didn't catch the player's name. Pick one:"
      case "no_amount":
        return "Didn't catch the amount. Enter it below:"
      case "empty":
        return "Didn't catch that. Try again or fill in below:"
      default:
        return null
    }
  })()

  const isListening = speech.status === "listening"
  const existingForSelected = selectedPlayer ? existingTotals[selectedPlayer.id] ?? 0 : 0

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent height="auto" className="flex flex-col max-h-[90vh]">
        <BottomSheetHeader>
          <BottomSheetTitle>{copy.title}</BottomSheetTitle>
          <BottomSheetDescription>
            Say the amount and the player, e.g.{" "}
            <bdi dir="auto" className="font-medium text-foreground">{copy.examples[lang]}</bdi>
          </BottomSheetDescription>
        </BottomSheetHeader>

        <BottomSheetBody
          className="flex-1 min-h-0 overflow-y-auto px-4 pb-4"
          style={{ paddingBottom: `calc(1rem + ${keyboardOffset}px)` }}
        >
          <div className="space-y-5">
            {/* Language toggle */}
            <div className="flex gap-2" role="radiogroup" aria-label="Recognition language">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  role="radio"
                  aria-checked={lang === l.code}
                  onClick={() => changeLang(l.code)}
                  className={cn(
                    "flex-1 min-h-[44px] rounded-full text-sm font-semibold border transition-colors",
                    lang === l.code
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border"
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Mic */}
            <div className="flex flex-col items-center gap-3 py-2">
              <button
                type="button"
                onClick={isListening ? speech.stop : listen}
                disabled={saving}
                aria-label={isListening ? "Stop listening" : "Start listening"}
                className={cn(
                  "relative flex h-20 w-20 items-center justify-center rounded-full transition-transform active:scale-95",
                  isListening ? "bg-destructive text-white" : "bg-primary text-primary-foreground"
                )}
              >
                {isListening && (
                  <span className="absolute inset-0 rounded-full bg-destructive/40 animate-ping motion-reduce:animate-none" />
                )}
                {isListening ? <MicOff className="relative h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </button>
              <p className="text-sm text-muted-foreground min-h-[1.25rem] text-center" aria-live="polite">
                {isListening
                  ? speech.interimTranscript || (lang === "he-IL" ? "מקשיב…" : "Listening…")
                  : parsed
                    ? <>Heard: <bdi dir="auto" className="font-medium text-foreground">{parsed.transcript}</bdi></>
                    : "Tap the mic to speak"}
              </p>
              {speech.status === "error" && speech.error && (
                <p className="text-sm text-destructive text-center" role="alert">
                  {speech.error.message}
                </p>
              )}
              {lastAdded && !parsed && !isListening && (
                <p className="flex items-center gap-1.5 text-sm font-medium text-success" role="status">
                  <Check className="h-4 w-4" />
                  {lastAdded}
                </p>
              )}
            </div>

            {/* Review */}
            {parsed && (
              <div className="space-y-4 pt-2 border-t">
                {statusHint && <p className="text-sm font-medium text-foreground">{statusHint}</p>}

                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Player</span>
                  <div className="flex flex-wrap gap-2">
                    {orderedPlayers.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        dir="auto"
                        onClick={() => setSelectedPlayerId(p.id)}
                        className={cn(
                          "min-h-[44px] px-4 rounded-full text-sm font-semibold border transition-colors",
                          selectedPlayerId === p.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-foreground border-transparent"
                        )}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="voice-transaction-amount" className="text-sm text-muted-foreground">
                    Amount ({symbol})
                  </Label>
                  <Input
                    id="voice-transaction-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, "")
                      const parts = v.split(".")
                      setAmount(parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0])
                    }}
                    placeholder="0"
                    className="h-12 text-lg font-mono"
                    autoComplete="off"
                  />
                </div>

                {type === "cashout" && selectedPlayer && existingForSelected > 0 && (
                  <p className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2" dir="auto">
                    {selectedPlayer.name} already has {symbol}
                    {existingForSelected} cashed out — this will be added on top.
                  </p>
                )}

                {saveError && (
                  <p
                    className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2"
                    role="alert"
                  >
                    {saveError}
                  </p>
                )}
              </div>
            )}
          </div>
        </BottomSheetBody>

        {parsed && (
          <div
            className="flex-shrink-0 px-4 pt-4 border-t bg-background flex gap-2"
            style={{
              paddingBottom: `calc(max(1rem, env(safe-area-inset-bottom)) + ${keyboardOffset}px)`,
            }}
          >
            <Button type="button" variant="outline" onClick={listen} disabled={saving} className="min-h-[48px] gap-2">
              <Mic className="h-4 w-4" />
              Retry
            </Button>
            <Button
              type="button"
              onClick={confirm}
              disabled={!canConfirm}
              className="flex-1 min-h-[48px] text-base font-semibold gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding…
                </>
              ) : selectedPlayer && amountNum !== null ? (
                <span dir="auto" className="truncate">
                  Add {symbol}{amountNum} to {selectedPlayer.name}
                </span>
              ) : (
                copy.cta
              )}
            </Button>
          </div>
        )}
      </BottomSheetContent>
    </BottomSheet>
  )
}
