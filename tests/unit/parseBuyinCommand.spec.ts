import { test, expect } from "@playwright/test"
import { parseBuyinCommand, parseBestAlternative, phoneticKey } from "../../lib/voice/parseBuyinCommand"

/**
 * Pure unit tests for the voice buy-in parser (no browser needed).
 * Run only these with: npx playwright test tests/unit --project=chromium
 */

const hebrewPlayers = [
  { id: "1", name: "גיא" },
  { id: "2", name: "מיכאל" },
  { id: "3", name: "ליאור" },
  { id: "4", name: "אביב כהן" },
]

const englishPlayers = [
  { id: "1", name: "Guy" },
  { id: "2", name: "Michael" },
  { id: "3", name: "Lior" },
  { id: "4", name: "Aviran Bar" },
  { id: "5", name: "Yossi" },
]

const cases: Array<[string, typeof hebrewPlayers, number, string]> = [
  // Hebrew speech, Hebrew names
  ["תוסיף 100 לגיא", hebrewPlayers, 100, "1"],
  ["תוסיף 200 למיכאל", hebrewPlayers, 200, "2"],
  ["הוסף מאתיים למיכאל", hebrewPlayers, 200, "2"],
  ["תוסיף מאה וחמישים לגיא", hebrewPlayers, 150, "1"],
  ["תוסיף חמש מאות לליאור", hebrewPlayers, 500, "3"],
  ["תוסיף 100 ש״ח לאביב", hebrewPlayers, 100, "4"],
  ["גיא 300", hebrewPlayers, 300, "1"],
  ["תוסיף לגיא 100", hebrewPlayers, 100, "1"],
  ["תוסיף אלף לגיא", hebrewPlayers, 1000, "1"],
  ["תוסיף ₪1,000 למיכאל", hebrewPlayers, 1000, "2"],
  // Hebrew speech, English names (cross-script)
  ["תוסיף 100 לגיא", englishPlayers, 100, "1"],
  ["תוסיף 200 למיכאל", englishPlayers, 200, "2"],
  ["תוסיף 50 ליוסי", englishPlayers, 50, "5"],
  ["תוסיף 100 לאבירן", englishPlayers, 100, "4"],
  // English speech
  ["add 100 to Guy", englishPlayers, 100, "1"],
  ["Add 200 to Michael", englishPlayers, 200, "2"],
  ["add two hundred and fifty for Lior", englishPlayers, 250, "3"],
  ["Michael 100", englishPlayers, 100, "2"],
  ["add a hundred to Aviran", englishPlayers, 100, "4"],
  ["give Yossi 2 thousand", englishPlayers, 2000, "5"],
  ["add $300 to guy please", englishPlayers, 300, "1"],
]

for (const [transcript, players, amount, playerId] of cases) {
  test(`parses "${transcript}" (${players[0].name.match(/[a-z]/i) ? "en" : "he"} names)`, () => {
    const result = parseBuyinCommand(transcript, players)
    expect(result.status, JSON.stringify(result)).toBe("ok")
    expect(result.amount).toBe(amount)
    expect(result.player?.id).toBe(playerId)
  })
}

test("reports missing amount", () => {
  const result = parseBuyinCommand("תוסיף לגיא", hebrewPlayers)
  expect(result.status).toBe("no_amount")
  expect(result.player?.id).toBe("1")
})

test("reports unknown player", () => {
  const result = parseBuyinCommand("add 100 to Bartholomew", englishPlayers)
  expect(result.status).toBe("no_player")
  expect(result.amount).toBe(100)
})

test("flags ambiguous names", () => {
  const result = parseBuyinCommand("add 100 to Dan", [
    { id: "a", name: "Dan Cohen" },
    { id: "b", name: "Dan Levi" },
  ])
  expect(result.status).toBe("ambiguous")
  expect(result.candidates.map((c) => c.player.id).sort()).toEqual(["a", "b"])
})

test("picks the best of several recognition alternatives", () => {
  const result = parseBestAlternative(["add 100 to gay", "add 100 to Guy"], englishPlayers)
  expect(result.status).toBe("ok")
  expect(result.player?.id).toBe("1")
})

test("phonetic keys line up across scripts", () => {
  expect(phoneticKey("מיכאל")).toBe(phoneticKey("Michael"))
  expect(phoneticKey("גיא")).toBe(phoneticKey("Guy"))
  expect(phoneticKey("אבירן")).toBe(phoneticKey("Aviran"))
})

const cashoutCases: Array<[string, typeof hebrewPlayers, number, string]> = [
  ["גיא יצא עם 450", hebrewPlayers, 450, "1"],
  ["מיכאל סיים עם שלוש מאות", hebrewPlayers, 300, "2"],
  ["לליאור נשארו 700", hebrewPlayers, 700, "3"],
  ["קאש אאוט 250 לגיא", englishPlayers, 250, "1"],
  ["יש למיכאל 600", englishPlayers, 600, "2"],
  ["Michael cashed out 300", englishPlayers, 300, "2"],
  ["Guy has 450 left", englishPlayers, 450, "1"],
  ["cash out Lior with 1,200", englishPlayers, 1200, "3"],
  ["Yossi finished with five hundred", englishPlayers, 500, "5"],
]

for (const [transcript, players, amount, playerId] of cashoutCases) {
  test(`parses cash-out "${transcript}"`, () => {
    const result = parseBuyinCommand(transcript, players)
    expect(result.status, JSON.stringify(result)).toBe("ok")
    expect(result.amount).toBe(amount)
    expect(result.player?.id).toBe(playerId)
  })
}
