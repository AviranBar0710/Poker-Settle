"use client"

import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

type Step = "setup" | "buyins" | "cashouts" | "results" | "share"

const steps: { id: Step; label: string }[] = [
  { id: "setup", label: "Setup" },
  { id: "buyins", label: "Buy-ins" },
  { id: "cashouts", label: "Cash-outs" },
  { id: "results", label: "Results" },
  { id: "share", label: "Share" },
]

export function Stepper({
  currentStep,
  onStepClick,
  isFinalized,
}: {
  currentStep: Step
  onStepClick: (step: Step) => void
  isFinalized: boolean
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep)

  return (
    <div className="flex items-center justify-between w-full">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const isClickable = isFinalized || isCompleted || isCurrent

        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <button
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full border transition-all",
                  isCompleted
                    ? "bg-primary/5 border-primary/30 text-primary"
                    : isCurrent
                    ? "bg-primary/10 border-primary/50 text-primary"
                    : "bg-background border-muted/50 text-muted-foreground",
                  isClickable && "cursor-pointer hover:bg-muted/50",
                  !isClickable && "cursor-not-allowed opacity-40"
                )}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="text-[10px] font-medium">{index + 1}</span>
                )}
              </button>
              <span
                className={cn(
                  "mt-1 text-[10px] font-medium",
                  isCurrent ? "text-foreground" : "text-muted-foreground/70"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 mx-1.5 -mt-3",
                  isCompleted ? "bg-primary/20" : "bg-muted/50"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

