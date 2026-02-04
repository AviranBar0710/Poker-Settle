"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChecklistItem {
  label: string
  ok: boolean
  warning?: boolean
  /** If true, warning state still allows finalize */
  optional?: boolean
}

interface FinalizationChecklistProps {
  items: ChecklistItem[]
  warningText?: string
  className?: string
}

export function FinalizationChecklist({
  items,
  warningText = "Once finalized, the session is locked and cannot be edited.",
  className,
}: FinalizationChecklistProps) {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-lg">Ready to finalize?</CardTitle>
        <CardDescription>{warningText}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li
              key={idx}
              className={cn(
                "flex items-center gap-3 text-sm",
                item.ok ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {item.ok ? (
                <Check className="h-5 w-5 text-green-600 dark:text-green-500 shrink-0" />
              ) : item.warning ? (
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0" />
              ) : (
                <span className="w-5 h-5 rounded-full border-2 border-muted shrink-0" />
              )}
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
