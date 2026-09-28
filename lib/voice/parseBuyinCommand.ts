/**
 * Voice buy-in command parser (Hebrew + English).
 *
 * Turns a speech transcript such as
 *   "תוסיף 100 לגיא", "הוסף מאתיים למיכאל", "add 200 to Michael", "Guy two hundred"
 * into { amount, player } by:
 *   1. Extracting the amount (digits or number words, in either language)
 *   2. Dropping command/filler words ("add", "תוסיף", "to", "שקלים", ...)
 *   3. Fuzzy-matching what's left against the session's player names,
 *      including cross-script matching (Hebrew speech ↔ English player names)
 *
 * Pure functions only — no React, no browser APIs — so it can be unit tested.
 */

export interface VoicePlayer {
  id: string
  name: string
}

export interface PlayerMatch<P extends VoicePlayer = VoicePlayer> {
  player: P
  score: number
}

export type ParseStatus = "ok" | "ambiguous" | "no_amount" | "no_player" | "empty"

export interface ParsedBuyinCommand<P extends VoicePlayer = VoicePlayer> {
  status: ParseStatus
  transcript: string
  amount: number | null
  /** The part of the transcript we treated as the player's name */
  nameQuery: string
  /** Best match (set when status is "ok") */
  player: P | null
  /** Top candidates, best first (useful when status is "ambiguous" or "no_player") */
  candidates: PlayerMatch<P>[]
}

/** Minimum similarity (0..1) for a name to count as a match */
export const MATCH_THRESHOLD = 0.6
/** If the runner-up is within this margin of the best match, ask the user to pick */
const AMBIGUITY_MARGIN = 0.08

// ---------------------------------------------------------------------------
// Text normalisation
// ---------------------------------------------------------------------------

const HEBREW_FINALS: Record<string, string> = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" }

/** Lowercase, strip Hebrew niqqud / Latin diacritics, unify quote marks and final letters */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // Latin diacritics
    .replace(/[֑-ׇ]/g, "") // Hebrew niqqud & cantillation
    .replace(/[׳`´‘’]/g, "'")
    .replace(/[״“”]/g, '"')
    .replace(/[ךםןףץ]/g, (c) => HEBREW_FINALS[c])
    .toLowerCase()
    .trim()
}

function tokenize(input: string): string[] {
  return normalizeText(input)
    // Keep digits, letters, apostrophes (ג'), quotes (ש"ח), dots/commas inside numbers
    .replace(/[^\p{L}\p{N}'".,\-₪$€]+/gu, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[-'".,]+|[-'.,]+$/g, "")) // trim stray punctuation (keep trailing " for ש"ח)
    .filter(Boolean)
}

const HEBREW_RE = /[א-ת]/

// ---------------------------------------------------------------------------
// Phonetic key (lets "גיא" match "Guy" and "מיכאל" match "Michael")
// ---------------------------------------------------------------------------

const HEBREW_PHONETIC: Record<string, string> = {
  "א": "", "ב": "b", "ג": "g", "ד": "d", "ה": "", "ו": "", "ז": "z", "ח": "k",
  "ט": "t", "י": "", "כ": "k", "ל": "l", "מ": "m", "נ": "n", "ס": "s", "ע": "",
  "פ": "p", "צ": "c", "ק": "k", "ר": "r", "ש": "s", "ת": "t",
}

function hebrewPhonetic(word: string): string {
  let out = ""
  for (let i = 0; i < word.length; i++) {
    const ch = word[i]
    const next = word[i + 1]
    if (next === "'") {
      // Geresh: ג' = J, ז' = Zh, צ' = Ch
      if (ch === "ג") { out += "j"; i++; continue }
      if (ch === "ז") { out += "j"; i++; continue }
      if (ch === "צ") { out += "k"; i++; continue }
    }
    if (ch === "ו") {
      // Word-initial ו or double וו is a consonant (V); otherwise a vowel
      if (i === 0 || next === "ו") { out += "b"; if (next === "ו") i++; continue }
      continue
    }
    out += HEBREW_PHONETIC[ch] ?? ""
  }
  return out
}

function latinPhonetic(word: string): string {
  const w = word
    .replace(/[^a-z]/g, "")
    .replace(/ph/g, "p")
    .replace(/(ch|kh|ck)/g, "k")
    .replace(/sh/g, "s")
    .replace(/th/g, "t")
    .replace(/(tz|ts)/g, "c")
    .replace(/x/g, "ks")
    .replace(/[cq]/g, "k")
    .replace(/[vw]/g, "b")
    .replace(/f/g, "p")
    .replace(/[aeiouyh]/g, "")
  return w
}

/** Consonant skeleton shared by Hebrew and Latin spellings of a name */
export function phoneticKey(text: string): string {
  const key = normalizeText(text)
    .split(/\s+/)
    .map((w) => (HEBREW_RE.test(w) ? hebrewPhonetic(w) : latinPhonetic(w)))
    .join("")
  return key.replace(/(.)\1+/g, "$1") // collapse doubled consonants (Yossi → s)
}

// ---------------------------------------------------------------------------
// Similarity
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

function compact(text: string): string {
  return normalizeText(text).replace(/[^\p{L}\p{N}]/gu, "")
}

/** Score how well a spoken name matches one player name (0..1) */
function scoreName(spoken: string, playerName: string): number {
  const s = compact(spoken)
  const p = compact(playerName)
  if (!s || !p) return 0

  let best = similarity(s, p)

  // Phonetic comparison — the main path for Hebrew speech ↔ English names.
  // Slightly discounted since the skeleton is lossy.
  const sk = phoneticKey(spoken)
  const pk = phoneticKey(playerName)
  if (sk && pk) best = Math.max(best, similarity(sk, pk) * 0.92)

  return best
}

function scorePlayer(spoken: string, playerName: string): number {
  let best = scoreName(spoken, playerName)
  // Allow saying just the first (or last) name of a multi-word player name
  const parts = normalizeText(playerName).split(/\s+/).filter(Boolean)
  if (parts.length > 1) {
    for (const part of parts) best = Math.max(best, scoreName(spoken, part) * 0.95)
  }
  return best
}

// ---------------------------------------------------------------------------
// Amount extraction
// ---------------------------------------------------------------------------

type NumberWord = { value: number; kind: "unit" | "hundred" | "thousand" | "hundreds" | "thousands" }

const NUMBER_WORDS: Record<string, NumberWord> = {}
const unit = (words: string[], value: number) => words.forEach((w) => (NUMBER_WORDS[w] = { value, kind: "unit" }))

// English
unit(["zero"], 0)
unit(["one"], 1); unit(["two"], 2); unit(["three"], 3); unit(["four"], 4); unit(["five"], 5)
unit(["six"], 6); unit(["seven"], 7); unit(["eight"], 8); unit(["nine"], 9); unit(["ten"], 10)
unit(["eleven"], 11); unit(["twelve"], 12); unit(["thirteen"], 13); unit(["fourteen"], 14)
unit(["fifteen"], 15); unit(["sixteen"], 16); unit(["seventeen"], 17); unit(["eighteen"], 18)
unit(["nineteen"], 19); unit(["twenty"], 20); unit(["thirty"], 30); unit(["forty"], 40)
unit(["fifty"], 50); unit(["sixty"], 60); unit(["seventy"], 70); unit(["eighty"], 80); unit(["ninety"], 90)
NUMBER_WORDS["hundred"] = { value: 100, kind: "hundreds" }
NUMBER_WORDS["hundreds"] = { value: 100, kind: "hundreds" }
NUMBER_WORDS["thousand"] = { value: 1000, kind: "thousands" }
NUMBER_WORDS["grand"] = { value: 1000, kind: "thousands" }

// Hebrew (masculine, feminine and construct forms)
unit(["אפס"], 0)
unit(["אחד", "אחת"], 1); unit(["שניים", "שנים", "שתיים", "שתים", "שני", "שתי"], 2)
unit(["שלוש", "שלושה", "שלושת"], 3); unit(["ארבע", "ארבעה", "ארבעת"], 4)
unit(["חמש", "חמישה", "חמשת"], 5); unit(["שש", "שישה", "ששת"], 6)
unit(["שבע", "שבעה", "שבעת"], 7); unit(["שמונה", "שמונת"], 8)
unit(["תשע", "תשעה", "תשעת"], 9); unit(["עשר", "עשרה", "עשרת"], 10)
unit(["עשרים"], 20); unit(["שלושים"], 30); unit(["ארבעים"], 40); unit(["חמישים"], 50)
unit(["שישים"], 60); unit(["שבעים"], 70); unit(["שמונים"], 80); unit(["תשעים"], 90)
NUMBER_WORDS["מאה"] = { value: 100, kind: "hundred" }
NUMBER_WORDS["מאתיים"] = { value: 200, kind: "hundred" }
NUMBER_WORDS["מאות"] = { value: 100, kind: "hundreds" }
NUMBER_WORDS["אלף"] = { value: 1000, kind: "thousands" }
NUMBER_WORDS["אלפים"] = { value: 1000, kind: "thousands" }
NUMBER_WORDS["אלפיים"] = { value: 2000, kind: "thousand" }
// Normalise final letters in keys so lookups after normalizeText() hit
for (const key of Object.keys(NUMBER_WORDS)) {
  const norm = normalizeText(key)
  if (norm !== key) NUMBER_WORDS[norm] = NUMBER_WORDS[key]
}

function lookupNumberWord(token: string): NumberWord | null {
  if (NUMBER_WORDS[token]) return NUMBER_WORDS[token]
  // Hebrew conjunction prefix: "וחמישים" (and fifty)
  if (token.length > 1 && token[0] === "ו" && NUMBER_WORDS[token.slice(1)]) return NUMBER_WORDS[token.slice(1)]
  return null
}

const CURRENCY_RE = /[₪$€]|ש"ח|שח/g

function parseNumericToken(token: string): number | null {
  // Strip currency symbols and a Hebrew one-letter prefix glued on with or without a hyphen (ב-100, ל100)
  let t = token.replace(CURRENCY_RE, "").replace(/^[בלו]-?(?=\d)/, "")
  let multiplier = 1
  if (/^\d+(\.\d+)?k$/.test(t)) { multiplier = 1000; t = t.slice(0, -1) }
  if (!/^\d{1,3}(,\d{3})+(\.\d+)?$|^\d+(\.\d+)?$/.test(t)) return null
  const n = parseFloat(t.replace(/,/g, "")) * multiplier
  return Number.isFinite(n) ? n : null
}

interface AmountSpan { value: number; start: number; end: number } // end is exclusive

/** Find the first amount in the token list (digits or number words) */
function findAmount(tokens: string[]): AmountSpan | null {
  for (let i = 0; i < tokens.length; i++) {
    const numeric = parseNumericToken(tokens[i])
    if (numeric !== null) {
      let end = i + 1
      let value = numeric
      // "2 thousand" / "2 אלף"
      const next = tokens[end] && lookupNumberWord(tokens[end])
      if (next && next.kind === "thousands") { value *= 1000; end++ }
      else if (next && next.kind === "hundreds") { value *= 100; end++ }
      return { value, start: i, end }
    }

    const word = lookupNumberWord(tokens[i])
    const isArticle = (tokens[i] === "a" || tokens[i] === "an") &&
      !!tokens[i + 1] && ["hundreds", "thousands"].includes(lookupNumberWord(tokens[i + 1])?.kind ?? "")
    if (!word && !isArticle) continue

    // Accumulate a run of number words: "two hundred and fifty", "מאה וחמישים", "שלושת אלפים"
    let total = 0
    let current = 0
    let j = i
    let consumedAny = false
    while (j < tokens.length) {
      const tok = tokens[j]
      if ((tok === "a" || tok === "an") && j === i) { current = 1; j++; continue }
      if (tok === "and" && consumedAny && tokens[j + 1] && lookupNumberWord(tokens[j + 1])) { j++; continue }
      const w = lookupNumberWord(tok)
      if (!w) break
      consumedAny = true
      if (w.kind === "unit") current += w.value
      else if (w.kind === "hundred") current += w.value
      else if (w.kind === "hundreds") current = (current || 1) * 100
      else if (w.kind === "thousand") { total += w.value; current = 0 }
      else if (w.kind === "thousands") { total += (current || 1) * 1000; current = 0 }
      j++
    }
    const value = total + current
    if (consumedAny && value > 0) return { value, start: i, end: j }
  }
  return null
}

// ---------------------------------------------------------------------------
// Filler words
// ---------------------------------------------------------------------------

const FILLER_WORDS = new Set(
  [
    // English
    "add", "adds", "added", "adding", "please", "plus", "give", "gave", "put", "buy", "buys", "bought",
    "buyin", "buy-in", "in", "rebuy", "re-buy", "to", "for", "of", "the", "a", "an", "chips", "chip",
    "dollars", "dollar", "bucks", "shekels", "shekel", "nis", "ils", "euro", "euros", "more", "another",
    "extra", "player", "hey", "ok", "okay", "now", "record", "set", "on", "with", "and",
    // Hebrew
    "תוסיף", "תוסיפי", "תוסיפו", "הוסף", "הוסיפי", "הוסיפו", "להוסיף", "תוסיפ", "הוספ", "תכניס", "תכניסי",
    "תרשום", "תרשמי", "רשום", "רשמי", "תן", "תני", "תנו", "עוד", "את", "של", "שקל", "שקלים", "ש\"ח",
    "שח", "ש", "צ'יפים", "ציפים", "צ'יפ", "ציפ", "זיטונים", "קנייה", "קניה", "כניסה", "ריביי", "בייאין",
    "ביין", "באיין", "בבקשה", "תודה", "אחי", "עבור", "בשביל", "קנה", "קנתה", "נכנס", "נכנסה", "שים",
    "תשים", "תשימי", "פלוס", "דולר", "דולרים", "יורו", "אוקיי", "טוב", "לשחקנ", "שחקנ", "שחקן", "ל", "ו",
  ].map(normalizeText)
)

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Rank players against a spoken name */
export function rankPlayers<P extends VoicePlayer>(spokenName: string, players: P[]): PlayerMatch<P>[] {
  const words = tokenize(spokenName)
  if (!words.length) return []

  // Variants of what was said: as-is, and with a leading Hebrew "ל" (to) stripped
  // from the first word — "לגיא" → "גיא". We keep both since names can start with ל (ליאור).
  const variants = new Set<string>([words.join(" ")])
  if (HEBREW_RE.test(words[0]) && words[0].startsWith("ל") && words[0].length > 1) {
    variants.add([words[0].slice(1), ...words.slice(1)].join(" "))
  }
  if (HEBREW_RE.test(words[0]) && words[0].startsWith("ול") && words[0].length > 2) {
    variants.add([words[0].slice(2), ...words.slice(1)].join(" "))
  }

  return players
    .map((player) => {
      let score = 0
      for (const v of variants) score = Math.max(score, scorePlayer(v, player.name))
      return { player, score }
    })
    .sort((a, b) => b.score - a.score)
}

/**
 * Parse a single transcript into a buy-in command.
 */
export function parseBuyinCommand<P extends VoicePlayer>(transcript: string, players: P[]): ParsedBuyinCommand<P> {
  const base: ParsedBuyinCommand<P> = {
    status: "empty",
    transcript,
    amount: null,
    nameQuery: "",
    player: null,
    candidates: [],
  }
  const tokens = tokenize(transcript)
  if (!tokens.length) return base

  const amountSpan = findAmount(tokens)
  const rest = amountSpan ? [...tokens.slice(0, amountSpan.start), ...tokens.slice(amountSpan.end)] : tokens
  const nameTokens = rest.filter((t) => !FILLER_WORDS.has(t) && parseNumericToken(t) === null)
  const nameQuery = nameTokens.join(" ")

  const ranked = nameQuery ? rankPlayers(nameQuery, players) : []
  const candidates = ranked.filter((m) => m.score >= MATCH_THRESHOLD * 0.8).slice(0, 4)
  const result: ParsedBuyinCommand<P> = {
    ...base,
    amount: amountSpan && amountSpan.value > 0 ? amountSpan.value : null,
    nameQuery,
    candidates,
  }

  const best = ranked[0]
  if (!best || best.score < MATCH_THRESHOLD) {
    result.status = result.amount === null && !nameQuery ? "empty" : "no_player"
    return result
  }
  const runnerUp = ranked[1]
  if (runnerUp && runnerUp.score >= MATCH_THRESHOLD && best.score - runnerUp.score < AMBIGUITY_MARGIN) {
    result.status = "ambiguous"
    result.candidates = ranked.filter((m) => m.score >= MATCH_THRESHOLD && best.score - m.score < AMBIGUITY_MARGIN)
    return result
  }

  result.player = best.player
  result.status = result.amount === null ? "no_amount" : "ok"
  return result
}

const STATUS_RANK: Record<ParseStatus, number> = { ok: 4, ambiguous: 3, no_amount: 2, no_player: 1, empty: 0 }

/**
 * Parse several recognition alternatives (speech engines return an n-best list)
 * and return the most useful interpretation.
 */
export function parseBestAlternative<P extends VoicePlayer>(transcripts: string[], players: P[]): ParsedBuyinCommand<P> {
  let best: ParsedBuyinCommand<P> | null = null
  for (const t of transcripts) {
    const parsed = parseBuyinCommand(t, players)
    if (
      !best ||
      STATUS_RANK[parsed.status] > STATUS_RANK[best.status] ||
      (parsed.status === best.status && (parsed.candidates[0]?.score ?? 0) > (best.candidates[0]?.score ?? 0))
    ) {
      best = parsed
    }
    if (parsed.status === "ok" && (parsed.candidates[0]?.score ?? 0) >= 0.9) break
  }
  return best ?? parseBuyinCommand("", players)
}
