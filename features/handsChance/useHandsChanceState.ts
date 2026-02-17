import { useState, useEffect } from "react"
import { normalizeCard } from "./utils"
import { calculateOdds, canCalculate } from "./oddsCalc"
import type { SelectedSlot, PlayerResult } from "./types"

const INITIAL_PLAYER_SLOT: SelectedSlot = { type: "player", playerIndex: 0, cardIndex: 0 }

export function useHandsChanceState() {
  // 6 players, each with 2 cards
  const [players, setPlayers] = useState<string[][]>([
    ["", ""],
    ["", ""],
    ["", ""],
    ["", ""],
    ["", ""],
    ["", ""],
  ])

  // Board: 5 cards (flop, turn, river)
  const [board, setBoard] = useState<string[]>(["", "", "", "", ""])

  // Selected slot for card assignment - auto-select Player 1 on mount for immediate card entry
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot>(INITIAL_PLAYER_SLOT)

  // Results - auto-calculated on players/board change
  const [results, setResults] = useState<PlayerResult[]>([])
  const [error, setError] = useState<string | null>(null)

  // Auto odds: recalculate whenever players or board changes
  useEffect(() => {
    if (!canCalculate(players)) {
      setResults([])
      setError(null)
      return
    }
    const { results: r, error: e } = calculateOdds(players, board)
    setError(e)
    setResults(r ?? [])
  }, [players, board])

  // Get all used cards
  const getUsedCards = (): string[] => {
    const used: string[] = []
    players.forEach((playerCards) => {
      playerCards.forEach((card) => {
        if (card && card.length >= 2) {
          used.push(normalizeCard(card))
        }
      })
    })
    board.forEach((card) => {
      if (card && card.length >= 2) {
        used.push(normalizeCard(card))
      }
    })
    return used
  }

  // Check if card is used
  const isCardUsed = (card: string): boolean => {
    const normalized = normalizeCard(card)
    const used = getUsedCards()
    return used.some((usedCard) => normalizeCard(usedCard) === normalized)
  }

  // Find next empty player slot
  const findNextEmptyPlayerSlot = (startPlayerIndex: number, startCardIndex: number): SelectedSlot | null => {
    // Check remaining slots in current player
    for (let cardIndex = startCardIndex + 1; cardIndex < 2; cardIndex++) {
      if (!players[startPlayerIndex][cardIndex] || players[startPlayerIndex][cardIndex].length < 2) {
        return { type: "player", playerIndex: startPlayerIndex, cardIndex }
      }
    }
    // Check other players
    for (let playerIndex = startPlayerIndex + 1; playerIndex < players.length; playerIndex++) {
      for (let cardIndex = 0; cardIndex < 2; cardIndex++) {
        if (!players[playerIndex][cardIndex] || players[playerIndex][cardIndex].length < 2) {
          return { type: "player", playerIndex, cardIndex }
        }
      }
    }
    // Check from beginning
    for (let playerIndex = 0; playerIndex < startPlayerIndex; playerIndex++) {
      for (let cardIndex = 0; cardIndex < 2; cardIndex++) {
        if (!players[playerIndex][cardIndex] || players[playerIndex][cardIndex].length < 2) {
          return { type: "player", playerIndex, cardIndex }
        }
      }
    }
    return null
  }

  // Find next empty board slot
  const findNextEmptyBoardSlot = (startIndex: number): SelectedSlot | null => {
    for (let i = startIndex + 1; i < board.length; i++) {
      if (!board[i] || board[i].length < 2) {
        return { type: "board", index: i }
      }
    }
    return null
  }

  // Handle card selection from grid
  const handleCardSelect = (card: string) => {
    const normalized = normalizeCard(card)

    // If card is already used, ignore (picker disables used cards)
    if (isCardUsed(card)) return

    // If no slot selected, do nothing
    if (!selectedSlot) return

    // Assign card to selected slot
    if (selectedSlot.type === "player") {
      const newPlayers = [...players]
      newPlayers[selectedSlot.playerIndex] = [...newPlayers[selectedSlot.playerIndex]]
      newPlayers[selectedSlot.playerIndex][selectedSlot.cardIndex] = normalized
      setPlayers(newPlayers)

      // After 2 players filled, focus community cards
      const filledPlayerCount = newPlayers.filter(
        (p) => (p[0]?.length ?? 0) >= 2 && (p[1]?.length ?? 0) >= 2
      ).length

      let nextSlot: SelectedSlot | null
      if (filledPlayerCount >= 2) {
        nextSlot = findNextEmptyBoardSlot(-1)
      } else {
        nextSlot = findNextEmptyPlayerSlot(selectedSlot.playerIndex, selectedSlot.cardIndex)
        if (!nextSlot) {
          nextSlot = findNextEmptyBoardSlot(-1)
        }
      }
      setSelectedSlot(nextSlot ?? null)
    } else {
      const newBoard = [...board]
      newBoard[selectedSlot.index] = normalized
      setBoard(newBoard)
      
      // Auto-advance to next empty board slot
      const nextSlot = findNextEmptyBoardSlot(selectedSlot.index)
      setSelectedSlot(nextSlot)
    }

    setError(null)
  }

  // Handle player seat click - select first empty slot or last if both filled
  const handlePlayerSeatClick = (playerIndex: number) => {
    const playerCards = players[playerIndex]
    const firstEmpty = playerCards.findIndex((card) => !card || card.length < 2)
    
    if (firstEmpty !== -1) {
      // Select first empty slot
      setSelectedSlot({ type: "player", playerIndex, cardIndex: firstEmpty })
    } else {
      // Both filled, select last slot
      setSelectedSlot({ type: "player", playerIndex, cardIndex: 1 })
    }
    setError(null)
  }

  // Handle slot click - if clicking the already-selected slot that has a card, clear it
  const handleSlotClick = (slot: SelectedSlot) => {
    if (!slot) { setSelectedSlot(null); return }

    const isAlreadySelected =
      selectedSlot &&
      ((slot.type === "player" &&
        selectedSlot.type === "player" &&
        selectedSlot.playerIndex === slot.playerIndex &&
        selectedSlot.cardIndex === slot.cardIndex) ||
        (slot.type === "board" &&
          selectedSlot.type === "board" &&
          selectedSlot.index === slot.index))

    if (isAlreadySelected) {
      // Clear the card from this slot
      if (slot.type === "player") {
        const card = players[slot.playerIndex][slot.cardIndex]
        if (card && card.length >= 2) {
          const newPlayers = [...players]
          newPlayers[slot.playerIndex] = [...newPlayers[slot.playerIndex]]
          newPlayers[slot.playerIndex][slot.cardIndex] = ""
          setPlayers(newPlayers)
        }
      } else if (slot.type === "board") {
        const card = board[slot.index]
        if (card && card.length >= 2) {
          const newBoard = [...board]
          newBoard[slot.index] = ""
          setBoard(newBoard)
        }
      }
      return
    }

    setSelectedSlot(slot)
    setError(null)
  }

  // Reset all data - auto-select Player 1 slot 0 for immediate card entry
  const handleReset = () => {
    setPlayers([["", ""], ["", ""], ["", ""], ["", ""], ["", ""], ["", ""]])
    setBoard(["", "", "", "", ""])
    setResults([])
    setSelectedSlot(INITIAL_PLAYER_SLOT)
    setError(null)
  }

  return {
    players,
    board,
    selectedSlot,
    results,
    error,
    setError,
    isCardUsed,
    handleCardSelect,
    handlePlayerSeatClick,
    handleSlotClick,
    handleReset,
  }
}
