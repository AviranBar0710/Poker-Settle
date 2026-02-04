"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Home, BarChart3, History, LogOut, User, LogIn, Menu, X, Users, Plus, ChevronDown, Copy, Check, UserCog, UserPlus, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/AuthContext"
import { useUIState } from "@/contexts/UIStateContext"
import { useClub } from "@/contexts/ClubContext"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoginDialog } from "@/components/LoginDialog"

interface AppShellProps {
  children: React.ReactNode
}

function JoinCodeCopyRow({ joinCode }: { joinCode: string }) {
  const [copied, setCopied] = useState(false)
  const [fallbackMode, setFallbackMode] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const showCopiedFeedback = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(joinCode)
      showCopiedFeedback()
      return
    } catch {
      /* clipboard failed */
    }
    try {
      const input = inputRef.current
      if (input) {
        input.focus()
        input.select()
        input.setSelectionRange(0, joinCode.length)
        const ok = document.execCommand("copy")
        if (ok) {
          showCopiedFeedback()
          return
        }
      }
    } catch {
      /* execCommand fallback failed */
    }
    setFallbackMode(true)
  }

  return (
    <div className="px-4 py-3 border-b flex flex-col gap-2 bg-muted/30">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Join Code</p>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={inputRef}
          readOnly
          value={joinCode}
          aria-label="Club join code"
          className="font-mono text-sm font-semibold px-2.5 py-1.5 rounded-full bg-muted border border-border w-auto min-w-0 max-w-[180px] touch-manipulation outline-none focus:ring-0"
        />
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 min-h-[44px] min-w-[44px] h-10 w-10 p-0 touch-manipulation"
          onClick={handleCopy}
          type="button"
          aria-label={copied ? "Copied" : "Copy join code"}
        >
          {copied ? (
            <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium" role="status">
              <Check className="h-4 w-4 shrink-0" />
              Copied
            </span>
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>
      {fallbackMode && (
        <p className="text-xs text-muted-foreground">Tap and hold to copy</p>
      )}
    </div>
  )
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()
  const { activeClub, clubs, loading: clubsLoading, setActiveClub, createClub } = useClub()
  const { isSidebarOpen, openSidebar, closeSidebar, closeAllOverlays } = useUIState()
  const isDesktop = useIsDesktop()
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [showClubSwitcher, setShowClubSwitcher] = useState(false)
  const [showCreateClubDialog, setShowCreateClubDialog] = useState(false)
  const [newClubName, setNewClubName] = useState("")
  const [isCreatingClub, setIsCreatingClub] = useState(false)

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

        {/* Club Switcher (only when logged in and has at least one club; hidden during onboarding) */}
        {user && !clubsLoading && clubs.length > 0 && (
          <div className="px-4 pt-4 pb-2 border-b">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between text-left font-normal"
                onClick={() => setShowClubSwitcher(!showClubSwitcher)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">
                    {activeClub ? activeClub.name : "Select Club"}
                  </span>
                </div>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", showClubSwitcher && "rotate-180")} />
              </Button>
              
              {showClubSwitcher && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  {/* Join Code (owner/admin only) */}
                  {activeClub && (activeClub.role === "owner" || activeClub.role === "admin") && activeClub.joinCode && (
                    <JoinCodeCopyRow joinCode={activeClub.joinCode} />
                  )}
                  {clubs.map((club) => (
                    <button
                      key={club.id}
                      onClick={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        
                        const previousClubId = activeClub?.id
                        const isOnSessionPage = pathname?.startsWith("/session/")
                        
                        if (isOnSessionPage && previousClubId !== club.id) {
                          router.push("/sessions")
                        }
                        
                        await setActiveClub(club.id)
                        setShowClubSwitcher(false)
                        closeSidebar()
                        
                        if (isOnSessionPage && previousClubId !== club.id) {
                          setTimeout(() => {
                            if (pathname?.startsWith("/session/")) {
                              router.push("/sessions")
                            }
                          }, 100)
                        }
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors",
                        activeClub?.id === club.id && "bg-primary/10 text-primary font-medium"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{club.name}</span>
                        {club.role === "owner" && (
                          <Badge variant="secondary" className="ml-2 text-xs">Owner</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                  <div className="border-t mt-1 space-y-0">
                    {(activeClub?.role === "owner" || activeClub?.role === "admin") && (
                      <>
                        <Link
                          href="/club/members"
                          onClick={() => {
                            setShowClubSwitcher(false)
                            closeSidebar()
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-accent transition-colors text-left"
                        >
                          <UserCog className="h-4 w-4 shrink-0 text-muted-foreground" />
                          Manage members
                        </Link>
                        {activeClub?.slug === "base44" && (
                          <Link
                            href="/club/link-players"
                            onClick={() => {
                              setShowClubSwitcher(false)
                              closeSidebar()
                            }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-accent transition-colors text-left"
                          >
                            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                            Link players
                          </Link>
                        )}
                      </>
                    )}
                    <Link
                      href="/join"
                      onClick={() => {
                        setShowClubSwitcher(false)
                        closeSidebar()
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-accent transition-colors text-left text-primary"
                    >
                      <UserPlus className="h-4 w-4 shrink-0" />
                      Join a club
                    </Link>
                    <button
                      onClick={() => {
                        setShowClubSwitcher(false)
                        setShowCreateClubDialog(true)
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 text-primary"
                    >
                      <Plus className="h-4 w-4" />
                      Create New Club
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || 
              (item.href === "/stats" && pathname?.startsWith("/stats")) ||
              (item.href === "/sessions" && pathname?.startsWith("/sessions")) ||
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
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background border">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary ring-2 ring-primary/20">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Logged in</p>
                  <p className="text-sm font-medium truncate text-foreground">{user.email}</p>
                </div>
              </div>
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

        {/* Create Club Dialog */}
        <Dialog 
          open={showCreateClubDialog} 
          onOpenChange={(open) => {
            setShowCreateClubDialog(open)
            if (!open) {
              setNewClubName("")
            }
          }}
        >
          <DialogContent 
            className="!flex !flex-col p-0 gap-0 !max-h-[90vh] md:!max-w-lg md:!max-h-[85vh] md:p-6 md:gap-4 md:rounded-lg !bottom-0 !left-0 !right-0 !top-auto !translate-y-0 rounded-t-lg rounded-b-none md:!left-[50%] md:!top-[50%] md:!right-auto md:!bottom-auto md:!translate-x-[-50%] md:!translate-y-[-50%] md:!rounded-lg"
            onOpenAutoFocus={(e) => {
              if (!isDesktop) {
                e.preventDefault()
              }
            }}
          >
            <form 
              onSubmit={async (e) => {
                e.preventDefault()
                if (!newClubName.trim()) return
                setIsCreatingClub(true)
                const isOnSessionPage = pathname?.startsWith("/session/")
                
                // If creating a new club while on a session page, redirect immediately
                if (isOnSessionPage) {
                  router.push("/sessions")
                }
                
                const club = await createClub(newClubName.trim())
                if (club) {
                  await setActiveClub(club.id)
                  setShowCreateClubDialog(false)
                  setNewClubName("")
                  
                  // Double-check redirect in case router.push didn't work immediately
                  if (isOnSessionPage) {
                    setTimeout(() => {
                      if (pathname?.startsWith("/session/")) {
                        router.push("/sessions")
                      }
                    }, 100)
                  }
                }
                setIsCreatingClub(false)
              }} 
              className="flex flex-col h-full min-h-0"
            >
              <div className="flex-shrink-0 px-4 pt-5 pb-4 border-b md:border-b-0 md:p-0 md:pb-0">
                <DialogHeader className="md:text-left">
                  <DialogTitle className="text-xl md:text-lg font-semibold">Create New Club</DialogTitle>
                  <DialogDescription className="text-sm mt-1.5 text-muted-foreground md:mt-0">
                    Create a new club to organize your poker sessions.
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 md:flex-none md:min-h-auto md:overflow-visible md:p-0">
                <div className="space-y-2">
                  <Label htmlFor="club-name" className="text-sm font-semibold block text-foreground">
                    Club Name
                  </Label>
                  <Input
                    id="club-name"
                    type="text"
                    placeholder="e.g., Friday Night Game Club"
                    value={newClubName}
                    onChange={(e) => setNewClubName(e.target.value)}
                    disabled={isCreatingClub}
                    className="h-12 md:h-10 text-base md:text-sm"
                    autoFocus={false}
                  />
                </div>
              </div>

              <div className="flex-shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 border-t bg-background md:border-t-0 md:bg-transparent md:p-0 md:pt-4 md:pb-0">
                <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end md:gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowCreateClubDialog(false)
                      setNewClubName("")
                    }}
                    disabled={isCreatingClub}
                    className="h-11 md:h-10 order-2 md:order-1 text-base md:text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCreatingClub || !newClubName.trim()}
                    className="h-12 md:h-10 order-1 md:order-2 md:min-w-[140px] text-base md:text-sm font-medium"
                  >
                    {isCreatingClub ? "Creating..." : "Create Club"}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto md:ml-0 pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}

