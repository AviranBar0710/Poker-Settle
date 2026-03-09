"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Users, User, Search, Check, X } from "lucide-react"

export type ClubMember = {
  userId: string
  displayName: string
  email: string | null
}

interface PlayerMemberComboboxProps {
  clubId: string
  value: string
  onChange: (name: string) => void
  selectedProfileId: string | null
  onSelectMember: (profileId: string | null, displayName: string) => void
  /** Profile IDs of players already in the session */
  excludeProfileIds: string[]
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  /** Render the member list as an always-visible scrollable list (for full-screen mobile picker) */
  fullScreenList?: boolean
  /** Multi-select mode: toggle members, add guests as chips */
  multiSelect?: boolean
  /** Selected members (profileId + displayName) when multiSelect */
  selectedMembers?: Array<{ profileId: string; displayName: string }>
  /** Selected guest names when multiSelect */
  selectedGuests?: string[]
  /** Called when selection changes in multiSelect mode */
  onSelectionChange?: (members: Array<{ profileId: string; displayName: string }>, guests: string[]) => void
}

export function PlayerMemberCombobox({
  clubId,
  value,
  onChange,
  selectedProfileId,
  onSelectMember,
  excludeProfileIds,
  disabled = false,
  autoFocus = false,
  className,
  onKeyDown,
  fullScreenList = false,
  multiSelect = false,
  selectedMembers = [],
  selectedGuests = [],
  onSelectionChange,
}: PlayerMemberComboboxProps) {
  const [members, setMembers] = useState<ClubMember[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const internalListRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!clubId) return
    let cancelled = false

    async function fetchMembers() {
      const { data, error } = await supabase.rpc("get_club_members_with_profiles", {
        p_club_id: clubId,
      })
      if (cancelled) return
      if (error) {
        console.error("[PlayerMemberCombobox] RPC error:", error)
        return
      }

      const rows: ClubMember[] = (data || []).map((m: any) => ({
        userId: m.user_id,
        displayName: m.display_name || m.email || "Member",
        email: m.email || null,
      }))
      setMembers(rows)
    }

    fetchMembers()
    return () => { cancelled = true }
  }, [clubId])

  const filteredMembers = members.filter((m) => {
    if (excludeProfileIds.includes(m.userId)) return false
    if (!value.trim()) return true
    const q = value.toLowerCase()
    return (
      m.displayName.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q))
    )
  })

  const handleSelect = useCallback((member: ClubMember) => {
    if (multiSelect && onSelectionChange) {
      const isSelected = selectedMembers.some((m) => m.profileId === member.userId)
      if (isSelected) {
        onSelectionChange(
          selectedMembers.filter((m) => m.profileId !== member.userId),
          selectedGuests
        )
      } else {
        onSelectionChange(
          [...selectedMembers, { profileId: member.userId, displayName: member.displayName }],
          selectedGuests
        )
      }
      setHighlightIndex(-1)
    } else {
      onSelectMember(member.userId, member.displayName)
      onChange(member.displayName)
      setIsOpen(false)
      setHighlightIndex(-1)
    }
  }, [multiSelect, onSelectionChange, selectedMembers, selectedGuests, onSelectMember, onChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    if (!multiSelect && selectedProfileId) {
      onSelectMember(null, newValue)
    }
    setIsOpen(true)
    setHighlightIndex(-1)
  }

  const handleInputFocus = () => {
    if (!multiSelect && !selectedProfileId) setIsOpen(true)
    if (multiSelect) setIsOpen(true)
  }

  const handleAddGuest = useCallback(() => {
    const name = value.trim()
    if (!name || !onSelectionChange) return
    if (selectedGuests.includes(name)) return
    onSelectionChange(selectedMembers, [...selectedGuests, name])
    onChange("")
  }, [value, selectedMembers, selectedGuests, onSelectionChange, onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (multiSelect && e.key === "Enter" && value.trim()) {
      e.preventDefault()
      handleAddGuest()
      return
    }
    if (isOpen && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightIndex((prev) => Math.min(prev + 1, filteredMembers.length - 1))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightIndex((prev) => Math.max(prev - 1, 0))
        return
      }
      if (e.key === "Enter" && highlightIndex >= 0) {
        e.preventDefault()
        handleSelect(filteredMembers[highlightIndex])
        return
      }
      if (e.key === "Escape") {
        setIsOpen(false)
        setHighlightIndex(-1)
        return
      }
    }
    onKeyDown?.(e)
  }

  const showDropdown = fullScreenList && multiSelect
    ? filteredMembers.length > 0
    : fullScreenList
      ? !selectedProfileId && filteredMembers.length > 0
      : isOpen && !selectedProfileId && filteredMembers.length > 0

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && internalListRef.current) {
      const items = internalListRef.current.children
      if (items[highlightIndex]) {
        (items[highlightIndex] as HTMLElement).scrollIntoView({ block: "nearest" })
      }
    }
  }, [highlightIndex])

  // Close dropdown on outside click (skip in fullScreenList mode)
  useEffect(() => {
    if (fullScreenList) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [fullScreenList])

  // Selected member card (fullscreen single-select) or chips (fullscreen multi-select)
  const selectedMemberCard = fullScreenList && multiSelect && (selectedMembers.length > 0 || selectedGuests.length > 0) ? (
    <div className="mt-3 flex-shrink-0 flex flex-wrap gap-2">
      {selectedMembers.map((m) => (
        <div
          key={m.profileId}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border-2 border-primary/30"
        >
          <span className="font-bold text-sm truncate max-w-[120px]">{m.displayName}</span>
          <button
            type="button"
            onClick={() => onSelectionChange?.(selectedMembers.filter((x) => x.profileId !== m.profileId), selectedGuests)}
            className="p-0.5 rounded-full hover:bg-primary/20 text-primary"
            aria-label={`Remove ${m.displayName}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {selectedGuests.map((name) => (
        <div
          key={name}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/60 border border-border"
        >
          <span className="font-medium text-sm truncate max-w-[120px]">{name}</span>
          <button
            type="button"
            onClick={() => onSelectionChange?.(selectedMembers, selectedGuests.filter((g) => g !== name))}
            className="p-0.5 rounded-full hover:bg-muted text-muted-foreground"
            aria-label={`Remove ${name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  ) : fullScreenList && !multiSelect && selectedProfileId ? (() => {
    const member = members.find((m) => m.userId === selectedProfileId)
    if (!member) return null
    return (
      <div className="mt-3 flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-primary/5 border-2 border-primary/30">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/15 text-primary shrink-0">
            <Users className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[15px] truncate">{member.displayName}</p>
            {member.email && member.email !== member.displayName && (
              <p className="text-sm text-muted-foreground truncate">{member.email}</p>
            )}
          </div>
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground shrink-0">
            <Check className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    )
  })() : null

  const memberListContent = showDropdown ? (
    <ul
      ref={internalListRef}
      className={cn(
        fullScreenList
          ? "flex-1 min-h-0 overflow-y-auto mt-3 space-y-1.5"
          : "mt-1 max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-lg"
      )}
      role="listbox"
    >
      {filteredMembers.map((member, idx) => {
        const isSelected = multiSelect && selectedMembers.some((m) => m.profileId === member.userId)
        return (
          <li
            key={member.userId}
            role="option"
            aria-selected={idx === highlightIndex || isSelected}
            className={cn(
              "flex items-center cursor-pointer transition-colors",
              fullScreenList
                ? "gap-3 px-4 py-3.5 min-h-[52px] rounded-xl bg-muted/40 active:bg-accent/70"
                : "gap-2 px-3 py-2.5 text-sm",
              isSelected && "bg-primary/10 border-2 border-primary/30",
              idx === highlightIndex && !isSelected
                ? "bg-accent text-accent-foreground"
                : !fullScreenList && !isSelected && "hover:bg-accent/50 active:bg-accent/70"
            )}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSelect(member)}
            onMouseEnter={() => setHighlightIndex(idx)}
          >
            <div className={cn(
              "flex items-center justify-center rounded-full shrink-0",
              fullScreenList ? "h-10 w-10" : "h-7 w-7",
              isSelected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
            )}>
              {isSelected ? (
                <Check className={fullScreenList ? "h-4.5 w-4.5" : "h-3.5 w-3.5"} />
              ) : (
                <Users className={fullScreenList ? "h-4.5 w-4.5" : "h-3.5 w-3.5"} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn(
                "truncate",
                fullScreenList ? "font-bold text-[15px]" : "font-medium"
              )}>{member.displayName}</p>
              {member.email && member.email !== member.displayName && (
                <p className={cn(
                  "truncate",
                  fullScreenList ? "text-sm text-muted-foreground" : "text-xs text-muted-foreground"
                )}>{member.email}</p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  ) : fullScreenList && multiSelect && filteredMembers.length === 0 && value.trim() ? (
    <div className="flex-1 flex flex-col items-center justify-center px-4 gap-3">
      <p className="text-sm text-muted-foreground text-center">
        No members found. Add as guest.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddGuest}
        className="rounded-xl"
      >
        Add &quot;{value.trim()}&quot; as Guest
      </Button>
    </div>
  ) : fullScreenList && !multiSelect && !selectedProfileId && filteredMembers.length === 0 && value.trim() ? (
    <div className="flex-1 flex items-center justify-center px-4">
      <p className="text-sm text-muted-foreground text-center">
        No members found. The name will be added as a guest.
      </p>
    </div>
  ) : null

  return (
    <div ref={containerRef} className={cn(fullScreenList && "flex flex-col flex-1 min-h-0")}>
      <div className={cn("relative flex-shrink-0", fullScreenList && "px-0")}>
        {fullScreenList && (
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground pointer-events-none" />
        )}
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search member or add guest"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(
            "md:h-10 md:text-sm",
            fullScreenList
              ? "h-12 text-base rounded-xl border-border/60 pl-11 pr-20"
              : "h-12 text-base pr-24",
            className
          )}
          autoComplete="off"
        />
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 pointer-events-none",
          fullScreenList ? "right-4" : "right-2"
        )}>
          {selectedProfileId ? (
            <Badge variant="default" className="text-[10px] gap-1 px-1.5 py-0.5">
              <Users className="h-3 w-3" />
              Member
            </Badge>
          ) : value.trim() ? (
            <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0.5">
              <User className="h-3 w-3" />
              Guest
            </Badge>
          ) : null}
        </div>
      </div>

      {multiSelect && fullScreenList && value.trim() && (
        <div className="flex-shrink-0 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddGuest}
            className="rounded-xl h-9"
          >
            Add &quot;{value.trim()}&quot; as Guest
          </Button>
        </div>
      )}

      {selectedMemberCard}
      {memberListContent}
    </div>
  )
}
