"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

/**
 * Uniform list row (layout_guide.md §1): tinted round avatar + name/subtitle
 * stack + right-aligned slot (typically signed money). Replaces tables and
 * ad-hoc row markup in leaderboard, history, transactions, and members lists.
 */
export function ListRow({
  avatar,
  title,
  subtitle,
  right,
  href,
  onClick,
  className,
}: {
  /** Content of the 36px tinted circle: initials, rank, or a small icon. */
  avatar: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Right-aligned slot, typically bold tabular-nums money in success/danger. */
  right?: React.ReactNode
  href?: string
  onClick?: () => void
  className?: string
}) {
  const interactive = Boolean(href || onClick)

  const inner = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-tile border bg-background/45 px-3 py-3",
        interactive && "active:scale-[0.985] transition-transform",
        className
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {avatar}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        {subtitle != null && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {right != null && <div className="shrink-0 text-right">{right}</div>}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {inner}
      </button>
    )
  }
  return inner
}
