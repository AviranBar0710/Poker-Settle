"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Thin wrapper around the browser Web Speech API (SpeechRecognition).
 * Supported in Chrome (desktop + Android), Edge and Safari (iOS 14.5+). Requires HTTPS or localhost.
 * One utterance per start(): results come back as an n-best list of transcripts.
 */

// Minimal typings — vendor-prefixed constructors aren't in lib.dom
interface RecognitionResultEvent {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }>
}

interface RecognitionErrorEvent {
  error: string
}

interface RecognitionInstance {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: RecognitionResultEvent) => void) | null
  onerror: ((e: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

type RecognitionConstructor = new () => RecognitionInstance

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** True once mounted in a browser that supports speech recognition */
export function useSpeechRecognitionSupported(): boolean {
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    setSupported(getRecognitionConstructor() !== null)
  }, [])
  return supported
}

export type SpeechStatus = "idle" | "listening" | "error"

export interface SpeechError {
  code: string
  message: string
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser settings and try again.",
  "service-not-allowed": "Speech recognition isn't allowed in this browser (on iPhone, enable Siri & Dictation).",
  "no-speech": "Didn't hear anything — tap the mic and try again.",
  "audio-capture": "No microphone found.",
  network: "Speech recognition needs an internet connection.",
  "language-not-supported": "This language isn't supported by your browser's speech recognition.",
}

interface UseSpeechRecognitionOptions {
  lang: string
  /** Called with all recognition alternatives (best first) once the utterance is final */
  onFinalResult: (alternatives: string[]) => void
}

export function useSpeechRecognition({ lang, onFinalResult }: UseSpeechRecognitionOptions) {
  const isSupported = useSpeechRecognitionSupported()
  const [status, setStatus] = useState<SpeechStatus>("idle")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [error, setError] = useState<SpeechError | null>(null)
  const recognitionRef = useRef<RecognitionInstance | null>(null)
  const onFinalRef = useRef(onFinalResult)
  useEffect(() => {
    onFinalRef.current = onFinalResult
  }, [onFinalResult])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const abort = useCallback(() => {
    const r = recognitionRef.current
    if (r) {
      r.onresult = null
      r.onerror = null
      r.onend = null
      r.abort()
    }
    recognitionRef.current = null
    setStatus("idle")
    setInterimTranscript("")
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionConstructor()
    if (!Ctor) {
      setError({ code: "unsupported", message: "Voice commands aren't supported in this browser. Try Chrome or Safari." })
      setStatus("error")
      return
    }
    abort()

    const recognition = new Ctor()
    recognition.lang = lang
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 5

    let delivered = false

    recognition.onresult = (event) => {
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const alternatives = Array.from({ length: result.length }, (_, k) => result[k].transcript.trim()).filter(Boolean)
          if (alternatives.length && !delivered) {
            delivered = true
            setInterimTranscript(alternatives[0])
            onFinalRef.current(alternatives)
          }
        } else {
          interim += result[0].transcript
        }
      }
      if (interim) setInterimTranscript(interim)
    }

    recognition.onerror = (event) => {
      if (event.error === "aborted") return
      setError({ code: event.error, message: ERROR_MESSAGES[event.error] ?? `Speech recognition error: ${event.error}` })
      setStatus("error")
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setStatus((s) => (s === "listening" ? "idle" : s))
    }

    recognitionRef.current = recognition
    setError(null)
    setInterimTranscript("")
    setStatus("listening")
    try {
      recognition.start()
    } catch (err) {
      setError({ code: "start-failed", message: (err as Error)?.message ?? "Couldn't start the microphone." })
      setStatus("error")
    }
  }, [lang, abort])

  // Always release the microphone on unmount
  useEffect(() => abort, [abort])

  return { isSupported, status, interimTranscript, error, start, stop, abort }
}
