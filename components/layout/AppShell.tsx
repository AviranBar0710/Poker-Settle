"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Home, BarChart3, History, LogOut, User, LogIn, Menu, X, Users, ChevronRight, Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { useUIState } from "@/contexts/UIStateContext"
import { useClub } from "@/contexts/ClubContext"
import { useState, useEffect } from "react"
import { LoginDialog } from "@/components/LoginDialog"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const { activeClub, clubs, loading: clubsLoading } = useClub()
  const { isSidebarOpen, openSidebar, closeSidebar, closeAllOverlays } = useUIState()
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  // Sync login dialog with UI state (close other overlays when login dialog opens)
  useEffect(() => {
    if (showLoginDialog) {
      closeAllOverlays()
    }
  }, [showLoginDialog, closeAllOverlays])

  const handleMenuToggle = (e?: React.MouseEvent) => {
    // Prevent event bubbling to avoid conflicts
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    // Toggle sidebar directly - closeAllOverlays will be called if needed
    if (isSidebarOpen) {
      closeSidebar()
      closeAllOverlays()
    } else {
      // Close any open dialogs/sheets before opening sidebar
      closeAllOverlays()
      openSidebar()
    }
  }

  const handleSignOut = () => {
    // Navigate to dedicated logout route - ensures signOut + storage clear completes before redirect
    if (typeof window !== "undefined") {
      window.location.href = "/auth/logout"
    }
  }

  const navItems = [
    {
      href: "/",
      label: "Home",
      icon: Home,
    },
    {
      href: "/stats",
      label: "Stats",
      icon: BarChart3,
    },
    {
      href: "/sessions",
      label: "Sessions",
      icon: History,
    },
    {
      href: "/tools/hands-chance",
      label: "Hands Chance",
      icon: Calculator,
    },
  ]

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Top Bar - Hamburger button with highest z-index to always be clickable */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 border-b bg-background/95 backdrop-blur-sm z-[110] flex items-center gap-3 px-4 shadow-sm pointer-events-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMenuToggle}
          className="h-9 w-9 p-0 hover:bg-accent relative z-[111] pointer-events-auto touch-none"
          type="button"
          aria-label="Toggle sidebar"
        >
          {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <h1 className="text-lg font-bold tracking-tight text-foreground">
          Poker Settle
        </h1>
      </div>

      {/* Sidebar Overlay (Mobile) - Only visible when sidebar is open */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[105] transition-opacity duration-200 pointer-events-auto"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            closeSidebar()
          }}
          onTouchStart={(e) => {
            e.preventDefault()
            e.stopPropagation()
            closeSidebar()
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "w-64 border-r bg-background flex flex-col min-h-0 overflow-y-auto transition-transform duration-300 ease-in-out shadow-xl",
          "md:translate-x-0 md:static md:z-auto md:shadow-none",
          isSidebarOpen
            ? "fixed left-0 top-0 bottom-0 z-[106] translate-x-0"
            : "fixed left-0 top-0 bottom-0 z-[106] -translate-x-full"
        )}
      >
        {/* App Name */}
        <div className="p-6 border-b bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Poker Settle
          </h1>
        </div>

        {/* Active club — navigates to the dedicated /clubs screen (switch, manage, join, create) */}
        {user && !clubsLoading && clubs.length > 0 && (
          <div className="px-4 pt-4 pb-2 border-b">
            <Link
              href="/clubs"
              onClick={closeSidebar}
              className={cn(
                "flex items-center gap-2 w-full rounded-tile border px-3 py-2.5 text-sm transition-colors hover:bg-accent",
                pathname === "/clubs" && "border-primary/40 bg-primary/10 text-primary"
              )}
            >
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate flex-1 min-w-0 font-medium">
                {activeClub ? activeClub.name : "Select Club"}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || 
              (item.href === "/stats" && pathname?.startsWith("/stats")) ||
              (item.href === "/sessions" && pathname?.startsWith("/sessions")) ||
              (item.href === "/tools/hands-chance" && pathname?.startsWith("/tools/hands-chance")) ||
              (item.href === "/" && pathname?.startsWith("/session"))
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User Info & Logout - flex-shrink-0 keeps it visible when sidebar scrolls */}
        <div className="flex-shrink-0 p-4 border-t bg-muted/30 space-y-3">
          {loading ? (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted animate-pulse">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-muted-foreground">Loading...</p>
              </div>
            </div>
          ) : user ? (
            <>
              <Link
                href="/profile"
                onClick={closeSidebar}
                className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors text-left"
              >
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                Profile
              </Link>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSignOut()
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="w-full justify-start"
              onClick={() => setShowLoginDialog(true)}
            >
              <LogIn className="h-4 w-4 mr-2" />
              Login
            </Button>
          )}
        </div>

        <LoginDialog
          open={showLoginDialog}
          onOpenChange={setShowLoginDialog}
          onClose={closeAllOverlays}
        />

      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto md:ml-0 pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}

