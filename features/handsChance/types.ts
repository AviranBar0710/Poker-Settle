export interface PlayerResult {
  playerIndex: number
  win: number
  tie: number
  equity: number
}

export type SelectedSlot =
  | { type: "player"; playerIndex: number; cardIndex: number }
  | { type: "board"; index: number }
  | null
