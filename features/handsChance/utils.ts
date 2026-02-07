// Normalize card input (10 -> T for Ten)
export const normalizeCard = (value: string): string => {
  return value.toUpperCase().trim().replace(/10/g, "T")
}

// Convert card to library format (rank uppercase, suit lowercase)
export const toLibraryFormat = (card: string): string => {
  if (card.length < 2) return card
  const rank = card[0].toUpperCase()
  const suit = card[card.length - 1].toLowerCase()
  return rank + suit
}
