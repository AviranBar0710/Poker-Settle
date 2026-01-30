"use client"

import * as React from "react"
import { Player } from "@/types/player"
import { cn } from "@/lib/utils"
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetBody,
} from "@/components/ui/bottom-sheet"
import { Pencil, Plus, Minus, List, Trash2 } from "lucide-react"

/**
 * PlayerActionsSheet - Mobile-first player action menu
 * 
 * Contract compliance:
 * - Bottom sheet, half-height (mobile_ui_contract.md #8)
 * - Drag handle visible (mobile_ui_contract.md #9)
 * - No X close button (mobile_ux_contract.md #2)
 * - Touch targets ≥48px (mobile_ui_contract.md #5)
 * - Active/pressed states only, no hover (mobile_ui_contract.md #6)
 * - One action per row (mobile_ui_contract.md #7)
 * - No primary CTA - this is a decision screen
 * - "Remove Player" is destructive and visually weaker (task spec)
 */

export type PlayerActionType = 
  | "edit-name"
  | "add-buyin"
  | "add-cashout"
  | "view-transactions"
  | "remove-player"

interface PlayerActionsSheetProps {
  /** Whether the sheet is open */
  open: boolean
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void
  /** The player to show actions for */
  player: Player | null
  /** Current balance (total buy-ins - total cash-outs) formatted string */
  formattedBalance: string
  /** Callback when an action is selected */
  onAction?: (action: PlayerActionType, player: Player) => void
  /** Currency symbol for display */
  currency?: string
  /** Show "Add Cash-out" only after user has started chip entry (or has cash-outs) */
  allowCashOut?: boolean
}

/**
 * Action row component with proper touch targets and states
 * 
 * Contract compliance:
 * - Height ≥48px (min-h-12 = 48px)
 * - Full-width tappable
 * - Active/pressed state (active:bg-accent)
 * - No hover state on mobile
 */
interface ActionRowProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  variant?: "default" | "destructive"
}

function ActionRow({ icon, label, onClick, variant = "default" }: ActionRowProps) {
  const isDestructive = variant === "destructive"
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Layout
        "flex w-full items-center gap-4 px-4",
        // Touch target: min-height 48px (mobile_ui_contract.md #5)
        "min-h-[48px] py-3",
        // Text styling
        "text-left text-base",
        // Active/pressed state (mobile_ui_contract.md #6)
        // No hover states - touch only
        "transition-colors duration-100",
        "active:bg-accent active:scale-[0.98]",
        // Focus state for accessibility
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Variant styling
        isDestructive 
          ? "text-destructive/80" // Visually weaker per task spec
          : "text-foreground"
      )}
    >
      <span 
        className={cn(
          "flex h-6 w-6 items-center justify-center flex-shrink-0",
          isDestructive ? "text-destructive/70" : "text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span className={cn(
        "flex-1",
        isDestructive ? "font-normal" : "font-medium" // Weaker weight for destructive
      )}>
        {label}
      </span>
    </button>
  )
}

export function PlayerActionsSheet({
  open,
  onOpenChange,
  player,
  formattedBalance,
  onAction,
  currency = "$",
  allowCashOut = false,
}: PlayerActionsSheetProps) {
  
  // Handler factory for actions
  const handleAction = (action: PlayerActionType) => {
    if (!player) return
    
    // Stub handlers - placeholder for next screen navigation
    console.log(`[PlayerActionsSheet] Action: ${action}`, { playerId: player.id, playerName: player.name })
    
    // Call the onAction callback if provided
    onAction?.(action, player)
    
    // Close sheet after action selection
    onOpenChange(false)
  }

  // Guard: don't render if no player
  if (!player) return null

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent height="half">
        {/* Player Summary - Read-only, informational only */}
        <BottomSheetHeader>
          <BottomSheetTitle>{player.name}</BottomSheetTitle>
          <BottomSheetDescription>
            Balance: {formattedBalance}
          </BottomSheetDescription>
        </BottomSheetHeader>

        {/* Action List - One action per row */}
        <BottomSheetBody>
          <div className="flex flex-col">
            {/* 1. Edit Name */}
            <ActionRow
              icon={<Pencil className="h-5 w-5" />}
              label="Edit Name"
              onClick={() => handleAction("edit-name")}
            />

            {/* 2. Add Buy-in */}
            <ActionRow
              icon={<Plus className="h-5 w-5" />}
              label="Add Buy-in"
              onClick={() => handleAction("add-buyin")}
            />

            {/* 3. Add Cash-out — only after Start chip entry (or ready_to_finalize) */}
            {allowCashOut && (
              <ActionRow
                icon={<Minus className="h-5 w-5" />}
                label="Add Cash-out"
                onClick={() => handleAction("add-cashout")}
              />
            )}

            {/* 4. View Transactions */}
            <ActionRow
              icon={<List className="h-5 w-5" />}
              label="View Transactions"
              onClick={() => handleAction("view-transactions")}
            />

            {/* Separator before destructive action */}
            <div className="my-2 mx-4 border-t border-border" />

            {/* 5. Remove Player - Destructive and visually weaker */}
            <ActionRow
              icon={<Trash2 className="h-5 w-5" />}
              label="Remove Player"
              onClick={() => handleAction("remove-player")}
              variant="destructive"
            />
          </div>
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  )
}
