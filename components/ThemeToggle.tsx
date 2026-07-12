"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

type ThemePreference = "light" | "system" | "dark"

const OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "system", label: "System" },
  { id: "dark", label: "Dark" },
]

function applyTheme(pref: ThemePreference) {
  const light =
    pref === "light" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: light)").matches)
  const el = document.documentElement
  el.classList.toggle("light", light)
  el.classList.toggle("dark", !light)
}

/**
 * Light / System / Dark segmented control (Profile → Appearance).
 * Persists to localStorage("theme"); the pre-paint script in app/layout.tsx
 * applies the same value on every load. Default: dark (brand).
 */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem("theme") as ThemePreference | null
    setPref(stored === "light" || stored === "system" ? stored : "dark")
  }, [])

  // Follow OS changes live while in "system" mode
  useEffect(() => {
    if (pref !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: light)")
    const onChange = () => applyTheme("system")
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [pref])

  const select = (next: ThemePreference) => {
    setPref(next)
    localStorage.setItem("theme", next)
    applyTheme(next)
  }

  return (
    <div className="flex gap-1 rounded-full border bg-background/45 p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => select(opt.id)}
          aria-pressed={pref === opt.id}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-bold transition-colors min-h-[36px]",
            pref === opt.id
              ? "bg-gradient-to-br from-primary to-primary-deep text-primary-foreground"
              : "text-muted-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
