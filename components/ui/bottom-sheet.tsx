"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"

/**
 * Mobile-first Bottom Sheet component
 * 
 * Contract compliance:
 * - Bottom sheet only (no center modals)
 * - Visible drag handle at top
 * - No X close button (mobile_ux_contract.md)
 * - Slides up from bottom only
 * - Dimmed backdrop with tap-to-dismiss
 */

const BottomSheet = DialogPrimitive.Root

const BottomSheetTrigger = DialogPrimitive.Trigger

const BottomSheetClose = DialogPrimitive.Close

const BottomSheetPortal = DialogPrimitive.Portal

const BottomSheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
BottomSheetOverlay.displayName = "BottomSheetOverlay"

/**
 * Drag Handle - visible indicator for swipe-to-dismiss
 * Per mobile_ui_contract.md: Every bottom sheet MUST display a visible drag handle
 */
const BottomSheetDragHandle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "mx-auto mt-3 mb-2 h-1.5 w-12 flex-shrink-0 rounded-full bg-muted-foreground/30",
      className
    )}
    aria-hidden="true"
    {...props}
  />
))
BottomSheetDragHandle.displayName = "BottomSheetDragHandle"

interface BottomSheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /**
   * Height variant for the sheet
   * - "half": 50vh (default)
   * - "auto": fit content with max-height
   * - "full": 90vh
   */
  height?: "half" | "auto" | "full"
}

const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  BottomSheetContentProps
>(({ className, children, height = "half", ...props }, ref) => {
  const heightClasses = {
    half: "h-[50vh]",
    auto: "max-h-[85vh]",
    full: "h-[90vh]",
  }

  return (
    <BottomSheetPortal>
      <BottomSheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Base positioning - fixed to bottom
          "fixed inset-x-0 bottom-0 z-50",
          // Sizing
          "w-full",
          heightClasses[height],
          // Visual styling
          "rounded-t-2xl border-t bg-background shadow-lg",
          // Layout
          "flex flex-col",
          // Animation - slide from bottom only (mobile_ui_contract.md)
          "duration-200 ease-out",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className
        )}
        // No close button - per mobile_ux_contract.md: Close (X) button at TOP is forbidden
        {...props}
      >
        <BottomSheetDragHandle />
        {children}
      </DialogPrimitive.Content>
    </BottomSheetPortal>
  )
})
BottomSheetContent.displayName = "BottomSheetContent"

const BottomSheetHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col px-4 pb-4", className)}
    {...props}
  />
))
BottomSheetHeader.displayName = "BottomSheetHeader"

const BottomSheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
BottomSheetTitle.displayName = "BottomSheetTitle"

const BottomSheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
BottomSheetDescription.displayName = "BottomSheetDescription"

const BottomSheetBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-y-auto", className)}
    {...props}
  />
))
BottomSheetBody.displayName = "BottomSheetBody"

export {
  BottomSheet,
  BottomSheetPortal,
  BottomSheetOverlay,
  BottomSheetClose,
  BottomSheetTrigger,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetBody,
  BottomSheetDragHandle,
}
