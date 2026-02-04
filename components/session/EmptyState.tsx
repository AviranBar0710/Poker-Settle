"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: string
  title: string
  description: string
  action?: React.ReactNode
  /** When true, hide action on mobile (sticky footer has the CTA) */
  hideActionOnMobile?: boolean
  className?: string
}

export function EmptyState({
  icon = "🎲",
  title,
  description,
  action,
  hideActionOnMobile = false,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardContent className="py-12 px-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <span className="text-4xl" aria-hidden>
            {icon}
          </span>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {action && (
            <div className={cn("pt-2", hideActionOnMobile && "hidden md:block")}>
              {action}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
