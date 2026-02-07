import { useState } from "react"
import { normalizeCard } from "./utils"
import type { SelectedSlot, PlayerResult } from "./types"

export function useHandsChanceState() {
  // 4 players, each with 2 cards
  const [players, setPlayers] = useState<string[][]>([
    ["", ""],
    ["", ""],
    ["", ""],
    ["", ""],
  ])

  // Board: 5 cards (flop, turn, river)
  const [board, setBoard] = useState<string[]>(["", "", "", "", ""])

  // Selected slot for card assignment
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot>(null)

  // Results
  const [results, setResults] = useState<PlayerResult[]>([])
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // Remove card from its current location
  const removeCard = (card: string) => {
    const normalized = normalizeCard(card)
    // Remove from players
    for (let i = 0; i < players.length; i++) {
      for (let j = 0; j < players[i].length; j++) {
        if (normalizeCard(players[i][j]) === normalized) {
          const newPlayers = [...players]
          newPlayers[i] = [...newPlayers[i]]
          newPlayers[i][j] = ""
          setPlayers(newPlayers)
          return
        }
      }
    }
    // Remove from board
    for (let i = 0; i < board.length; i++) {
      if (normalizeCard(board[i]) === normalized) {
        const newBoard = [...board]
        newBoard[i] = ""
        setBoard(newBoard)
        return
      }
    }
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
    const used = isCardUsed(card)

    // If card is used and no slot selected, remove it
    if (used && !selectedSlot) {
      removeCard(card)
      setError(null)
      return
    }

    // If no slot selected and card not used, do nothing
    if (!selectedSlot) {
      return
    }

    // Check if card is already in the selected slot
    let currentCard = ""
    if (selectedSlot.type === "player") {
      currentCard = players[selectedSlot.playerIndex][selectedSlot.cardIndex]
    } else {
      currentCard = board[selectedSlot.index]
    }

    // If clicking the same card in the slot, remove it
    if (normalizeCard(currentCard) === normalized) {
      if (selectedSlot.type === "player") {
        const newPlayers = [...players]
        newPlayers[selectedSlot.playerIndex] = [...newPlayers[selectedSlot.playerIndex]]
        newPlayers[selectedSlot.playerIndex][selectedSlot.cardIndex] = ""
        setPlayers(newPlayers)
      } else {
        const newBoard = [...board]
        newBoard[selectedSlot.index] = ""
        setBoard(newBoard)
      }
      setSelectedSlot(null)
      setError(null)
      return
    }

    // If card is used elsewhere, remove it from old location first
    if (used) {
      removeCard(card)
    }

    // Assign card to selected slot
    if (selectedSlot.type === "player") {
      const newPlayers = [...players]
      newPlayers[selectedSlot.playerIndex] = [...newPlayers[selectedSlot.playerIndex]]
      newPlayers[selectedSlot.playerIndex][selectedSlot.cardIndex] = normalized
      setPlayers(newPlayers)
      
      // Auto-advance to next empty player slot
      const nextSlot = findNextEmptyPlayerSlot(selectedSlot.playerIndex, selectedSlot.cardIndex)
      setSelectedSlot(nextSlot)
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

  // Handle slot click
  const handleSlotClick = (slot: SelectedSlot) => {
    setSelectedSlot(slot)
    setError(null)
  }

  // Reset all data
  const handleReset = () => {
    setPlayers([["", ""], ["", ""], ["", ""], ["", ""]])
    setBoard(["", "", "", "", ""])
    setResults([])
    setSelectedSlot(null)
    setError(null)
  }

  return {
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
  }
}
