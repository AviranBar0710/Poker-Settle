"use client"

import * as React from "react"
import { Player } from "@/types/player"
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetBody,
} from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

/**
 * Remove Player confirmation — Mobile-only bottom sheet.
 * One primary destructive CTA; Cancel secondary. Touch targets ≥48px.
 */

interface RemovePlayerConfirmSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: Player | null
  onConfirm: () => Promise<boolean>
}

export function RemovePlayerConfirmSheet({
  open,
  onOpenChange,
  player,
  onConfirm,
}: RemovePlayerConfirmSheetProps) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleConfirm = async () => {
    if (!player) return
    setError(null)
    setLoading(true)
    try {
      const success = await onConfirm()
      if (success) onOpenChange(false)
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to remove player")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) setError(null)
    onOpenChange(next)
  }

  if (!player) return null

  return (
    <BottomSheet open={open} onOpenChange={handleOpenChange}>
      <BottomSheetContent height="auto" className="flex flex-col max-h-[85vh">
        <BottomSheetHeader>
          <BottomSheetTitle>Remove Player</BottomSheetTitle>
          <BottomSheetDescription>
            Remove {player.name}? This will remove the player from this session.
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody className="px-4 pb-4">
          {error && (
            <p
              className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 mb-4"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirm}
              disabled={loading}
              className="w-full min-h-[48px] text-base font-semibold gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Removing…
                </>
              ) : (
                "Remove Player"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
              className="w-full min-h-[48px] text-base text-muted-foreground"
            >
              Cancel
            </Button>
          </div>
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  )
}
