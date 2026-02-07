"use client"

import { useRef } from "react"
import Link from "next/link"
import { AppShell } from "@/components/layout/AppShell"
import { Button } from "@/components/ui/button"
import { RotateCcw, Loader2, Home } from "lucide-react"
import { useHandsChanceState } from "./useHandsChanceState"
import { calculateOdds, canCalculate } from "./oddsCalc"
import { PokerTable } from "./PokerTable"
import { CardGrid } from "./CardGrid"
import { OddsPanel } from "./OddsPanel"

export function HandsChancePage() {
  const resultsRef = useRef<HTMLDivElement>(null)
  const isProcessingRef = useRef(false)

  const {
    players,
    board,
    selectedSlot,
    results,
    isCalculating,
    error,
    setResults,
    setIsCalculating,
    setError,
    isCardUsed,
    handleCardSelect,
    handlePlayerSeatClick,
    handleSlotClick,
    handleReset,
  } = useHandsChanceState()

  // Calculate odds with performance improvements
  const handleCalculate = () => {
    // Prevent double clicks
    if (isProcessingRef.current || isCalculating) {
      return
    }

    isProcessingRef.current = true
    setIsCalculating(true)
    setError(null)
    setResults([])

    // Use setTimeout 0 to avoid UI freeze
    setTimeout(() => {
      const { results: calculatedResults, error: calcError } = calculateOdds(players, board)
      
      if (calcError) {
        setError(calcError)
        setIsCalculating(false)
        isProcessingRef.current = false
      } else {
        setResults(calculatedResults)
        setIsCalculating(false)
        isProcessingRef.current = false

        // Smooth scroll to results after calculation
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        }, 100)
      }
    }, 0)
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-6 space-y-6 max-w-2xl relative">
        {/* Spinner Overlay */}
        {isCalculating && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card rounded-lg p-6 shadow-lg flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Calculating odds...</p>
            </div>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-title mb-2">Hands Chance</h1>
            <p className="text-body text-muted-foreground">
              Calculate poker hand odds for up to 4 players
            </p>
          </div>
          <Link href="/">
            <Button
              variant="outline"
              className="h-10 px-4"
              size="sm"
            >
              <Home className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <PokerTable
          players={players}
          board={board}
          selectedSlot={selectedSlot}
          onPlayerSeatClick={handlePlayerSeatClick}
          onSlotClick={handleSlotClick}
        />

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleReset}
            variant="outline"
            className="flex-1 h-12 text-base"
            size="lg"
            disabled={isCalculating}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleCalculate}
            disabled={!canCalculate(players) || isCalculating}
            className="flex-1 h-12 text-base"
            size="lg"
          >
            {isCalculating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Calculating...
              </>
            ) : (
              "Calculate Odds"
            )}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div ref={resultsRef}>
          <OddsPanel results={results} selectedSlot={selectedSlot} />
        </div>

        <CardGrid
          selectedSlot={selectedSlot}
          isCardUsed={isCardUsed}
          onCardSelect={handleCardSelect}
        />
      </div>
    </AppShell>
  )
}
