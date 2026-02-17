"use client"

import { cn } from "@/lib/utils"

const SUIT_LABELS: Record<string, string> = {
  h: "♥",
  d: "♦",
  c: "♣",
  s: "♠",
}

const SUIT_COLORS: Record<string, string> = {
  h: "text-red-600",
  d: "text-red-600",
  c: "text-gray-900",
  s: "text-gray-900",
}

export type CardVariant = "compact" | "normal" | "small"

export type CardState = "default" | "selected" | "locked" | "disabled" | "assigned" | "selectable"

interface CardProps {
  card: string
  variant?: CardVariant
  state?: CardState
  className?: string
}

const variantSizes: Record<CardVariant, string> = {
  compact: "w-[32px] h-[44px] min-w-[32px] min-h-[44px] text-[10px]",
  normal: "w-[52px] h-[72px] min-w-[52px] min-h-[72px] text-sm",
  small: "w-[36px] min-w-[36px] h-10 min-h-[2.5rem] text-[9px]",
}

// Premium card: light face for dark table, soft shadow, subtle elevation
const baseCardStyles =
  "bg-white dark:bg-white/95 border-2 border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)] transition-all duration-100"

const stateStyles: Record<CardState, string> = {
  default:
    "border-gray-200 hover:scale-[1.02] hover:shadow-[0_4px_16px_rgba(0,0,0,0.2)] cursor-pointer",
  selectable:
    "border-gray-200 hover:scale-[1.05] hover:shadow-[0_4px_16px_rgba(0,0,0,0.25)] cursor-pointer ring-1 ring-white/20",
  selected:
    "border-amber-400 ring-2 ring-amber-400/50 cursor-pointer shadow-[0_4px_16px_rgba(251,191,36,0.3)]",
  locked: "border-gray-200 cursor-default",
  disabled:
    "opacity-30 border-gray-300 cursor-not-allowed pointer-events-none grayscale",
  assigned:
    "opacity-35 border-gray-300 cursor-not-allowed pointer-events-none grayscale",
}

export function PokerCard({
  card,
  variant = "normal",
  state = "default",
  className,
}: CardProps) {
  if (!card || card.length < 2) return null

  const rank = card[0].toUpperCase()
  const suit = card[card.length - 1].toLowerCase()
  const suitLabel = SUIT_LABELS[suit] ?? suit
  const suitColor = SUIT_COLORS[suit] ?? "text-foreground"

  return (
    <div
      className={cn(
        "rounded-lg flex flex-col items-center justify-center flex-shrink-0",
        baseCardStyles,
        variantSizes[variant],
        stateStyles[state],
        "active:scale-[0.98]",
        className
      )}
      role="img"
      aria-label={`${rank} of ${suit === "h" ? "hearts" : suit === "d" ? "diamonds" : suit === "c" ? "clubs" : "spades"}`}
    >
      <span className={cn("font-mono font-bold leading-none", suitColor, variant === "normal" ? "text-base" : "")}>{rank}</span>
      <span className={cn("font-sans leading-none", suitColor, variant === "normal" ? "text-xl" : variant === "small" ? "text-sm" : "text-lg")}>
        {suitLabel}
      </span>
    </div>
  )
}
