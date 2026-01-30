"use client"

import { useState, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Transaction } from "@/types/transaction"

interface UseSessionTransactionsParams {
  sessionId: string
}

interface UseSessionTransactionsReturn {
  // State
  transactions: Transaction[]
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
  transactionUpdateCounter: number
  
  // Handlers
  reloadTransactions: () => Promise<void>
}

export function useSessionTransactions({
  sessionId,
}: UseSessionTransactionsParams): UseSessionTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionUpdateCounter, setTransactionUpdateCounter] = useState(0)

  // DEBUG: Reload transactions from Supabase
  const reloadTransactions = useCallback(async () => {
    console.log("🔵 [DEBUG] Reloading transactions from Supabase for session:", sessionId)
    
    try {
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })

      if (transactionsError) {
        console.error("🔴 [DEBUG] Reload transactions ERROR:", transactionsError)
        return
      }

      if (transactionsData) {
        const transactions: Transaction[] = transactionsData.map((t) => ({
          id: t.id,
          sessionId: t.session_id,
          playerId: t.player_id,
          type: t.type as "buyin" | "cashout",
          amount: parseFloat(t.amount.toString()),
          createdAt: t.created_at,
        }))
        setTransactions(transactions)
        setTransactionUpdateCounter((prev) => prev + 1)
      }
    } catch (err) {
      console.error("🔴 [DEBUG] Unexpected error reloading transactions:", err)
    }
  }, [sessionId])

  return {
    // State
    transactions,
    setTransactions,
    transactionUpdateCounter,
    
    // Handlers
    reloadTransactions,
  }
}
