# Stats / Leaderboard display contract

This document defines how the Stats/Leaderboard screen must be presented for readability and compatibility. The implementation lives in [app/stats/page.tsx](../app/stats/page.tsx).

## Purpose

- **Readability:** Leaderboard data is easy to scan and compare.
- **Compatibility:** Works on iOS, Android, and all major browsers using standard CSS.

## Layout

- **Mobile (default / narrow viewport):** Card-based list. One player per card. Cards stacked vertically with clear separation. No table on mobile.
- **Desktop (md breakpoint and up):** Table with columns: Rank, Player, Sessions, Total P/L, Avg P/L per session, Biggest win session. Table header may be sticky when the list is long.

## Data readability

- **Labels** (e.g. "Total P/L", "Sessions") are secondary: smaller size, muted color (`text-xs text-muted-foreground`). Keep a clear gap between label and value (e.g. `mb-1` on label).
- **Values** are primary: use `tabular-nums` (and/or monospace) so digits align when scanning. Minimum `text-sm` on mobile.
- **P/L semantics:** Always show sign (+ or −) and numeric value. Use color as reinforcement only: green = positive, red = negative, muted = zero. Do not rely on color alone (accessibility).

## Spacing and touch

- Card padding and gaps between cards must give breathing room; avoid cramped content.
- Interactive elements (tabs, "Back to Dashboard") must meet minimum touch target (44–48px height) per [mobile_ux_contract.md](mobile_ux_contract.md) / [mobile_ui_contract.md](mobile_ui_contract.md).

## Compatibility

- Use standard Tailwind/CSS only. No `-webkit-` or experimental features required for this screen.
- Safe-area padding for notches/home indicators should follow the rest of the app (e.g. existing layout padding).
