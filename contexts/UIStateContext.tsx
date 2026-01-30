"use client"

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react"

type OverlayType = "sidebar" | "dialog" | "bottomSheet" | null

interface UIStateContextType {
  activeOverlay: OverlayType
  isSidebarOpen: boolean
  isDialogOpen: boolean
  isBottomSheetOpen: boolean
  openSidebar: () => void
  closeSidebar: () => void
  openDialog: () => void
  closeDialog: () => void
  openBottomSheet: () => void
  closeBottomSheet: () => void
  closeAllOverlays: () => void
}

const UIStateContext = createContext<UIStateContextType | undefined>(undefined)

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>(null)

  const openSidebar = useCallback(() => {
    setActiveOverlay("sidebar")
  }, [])

  const closeSidebar = useCallback(() => {
    setActiveOverlay((prev) => prev === "sidebar" ? null : prev)
  }, [])

  const openDialog = useCallback(() => {
    setActiveOverlay("dialog")
  }, [])

  const closeDialog = useCallback(() => {
    setActiveOverlay((prev) => prev === "dialog" ? null : prev)
  }, [])

  const openBottomSheet = useCallback(() => {
    setActiveOverlay("bottomSheet")
  }, [])

  const closeBottomSheet = useCallback(() => {
    setActiveOverlay((prev) => prev === "bottomSheet" ? null : prev)
  }, [])

  const closeAllOverlays = useCallback(() => {
    setActiveOverlay(null)
  }, [])

  // Cleanup body scroll lock for sidebar (Radix Dialog handles its own scroll lock)
  useEffect(() => {
    if (activeOverlay === "sidebar") {
      // Lock body scroll on mobile when sidebar is open
      if (window.innerWidth < 768) {
        const originalOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
          document.body.style.overflow = originalOverflow
        }
      }
    }
  }, [activeOverlay])

  return (
    <UIStateContext.Provider
      value={{
        activeOverlay,
        isSidebarOpen: activeOverlay === "sidebar",
        isDialogOpen: activeOverlay === "dialog",
        isBottomSheetOpen: activeOverlay === "bottomSheet",
        openSidebar,
        closeSidebar,
        openDialog,
        closeDialog,
        openBottomSheet,
        closeBottomSheet,
        closeAllOverlays,
      }}
    >
      {children}
    </UIStateContext.Provider>
  )
}

export function useUIState() {
  const context = useContext(UIStateContext)
  if (context === undefined) {
    throw new Error("useUIState must be used within a UIStateProvider")
  }
  return context
}

