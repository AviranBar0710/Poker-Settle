"use client"

import { useState, useEffect } from "react"
import { Player } from "@/types/player"
import { Transaction } from "@/types/transaction"
import {
  getBuyinsByPlayer,
  getCashoutsByPlayer,
  saveTransaction,
} from "@/lib/storage"
import { generateTransactionId } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

type PlayerTableProps = {
  players: Player[]
  sessionId: string
  currency: string
  isFinalized: boolean
  onTransactionUpdate?: () => void
}

export function PlayerTable({
  players,
  sessionId,
  currency,
  isFinalized,
  onTransactionUpdate,
}: PlayerTableProps) {
  // Calculate player summaries
  const playerSummaries = players.map((player) => {
    const buyins = getBuyinsByPlayer(sessionId, player.id)
    const cashouts = getCashoutsByPlayer(sessionId, player.id)
    const totalBuyins = buyins.reduce((sum, buyin) => sum + buyin.amount, 0)
    const totalCashouts = cashouts.reduce(
      (sum, cashout) => sum + cashout.amount,
      0
    )
    const pl = totalCashouts - totalBuyins
    return {
      player,
      totalBuyins,
      totalCashouts,
      pl,
    }
  })

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Player Name</TableHead>
          <TableHead className="text-right">Buy-ins</TableHead>
          <TableHead className="text-right">Cash-outs</TableHead>
          <TableHead className="text-right">Profit/Loss</TableHead>
          <TableHead className="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {playerSummaries.map((summary) => (
          <PlayerRow
            key={summary.player.id}
            player={summary.player}
            sessionId={sessionId}
            currency={currency}
            isFinalized={isFinalized}
            totalBuyins={summary.totalBuyins}
            totalCashouts={summary.totalCashouts}
            pl={summary.pl}
            onTransactionUpdate={onTransactionUpdate}
          />
        ))}
      </TableBody>
    </Table>
  )
}

type PlayerRowProps = {
  player: Player
  sessionId: string
  currency: string
  isFinalized: boolean
  totalBuyins: number
  totalCashouts: number
  pl: number
  onTransactionUpdate?: () => void
}

function PlayerRow({
  player,
  sessionId,
  currency,
  isFinalized,
  totalBuyins,
  totalCashouts,
  pl,
  onTransactionUpdate,
}: PlayerRowProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [buyins, setBuyins] = useState<Transaction[]>([])
  const [cashouts, setCashouts] = useState<Transaction[]>([])
  const [buyinAmount, setBuyinAmount] = useState("")
  const [cashoutAmount, setCashoutAmount] = useState("")
  const [isAddingBuyin, setIsAddingBuyin] = useState(false)
  const [isAddingCashout, setIsAddingCashout] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const playerBuyins = getBuyinsByPlayer(sessionId, player.id)
      setBuyins(playerBuyins)
      const playerCashouts = getCashoutsByPlayer(sessionId, player.id)
      setCashouts(playerCashouts)
    }
  }, [isOpen, sessionId, player.id])

  const reloadBuyins = () => {
    const playerBuyins = getBuyinsByPlayer(sessionId, player.id)
    setBuyins(playerBuyins)
  }

  const reloadCashouts = () => {
    const playerCashouts = getCashoutsByPlayer(sessionId, player.id)
    setCashouts(playerCashouts)
  }

  const handleAddBuyin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const amount = parseFloat(buyinAmount)
    if (isNaN(amount) || amount <= 0) return

    setIsAddingBuyin(true)
    const transaction: Transaction = {
      id: generateTransactionId(),
      sessionId,
      playerId: player.id,
      type: "buyin",
      amount,
      createdAt: new Date().toISOString(),
    }
    saveTransaction(transaction)
    setBuyinAmount("")
    reloadBuyins()
    onTransactionUpdate?.()
    setIsAddingBuyin(false)
  }

  const handleAddCashout = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const amount = parseFloat(cashoutAmount)
    if (isNaN(amount) || amount < 0) return

    setIsAddingCashout(true)
    const transaction: Transaction = {
      id: generateTransactionId(),
      sessionId,
      playerId: player.id,
      type: "cashout",
      amount,
      createdAt: new Date().toISOString(),
    }
    saveTransaction(transaction)
    setCashoutAmount("")
    reloadCashouts()
    onTransactionUpdate?.()
    setIsAddingCashout(false)
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const plColor =
    pl > 0.01
      ? "text-green-600 font-semibold"
      : pl < -0.01
      ? "text-red-600 font-semibold"
      : "text-gray-600"

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{player.name}</TableCell>
        <TableCell className="text-right">
          {currency} {totalBuyins.toFixed(2)}
        </TableCell>
        <TableCell className="text-right">
          {currency} {totalCashouts.toFixed(2)}
        </TableCell>
        <TableCell className={cn("text-right", plColor)}>
          {pl > 0 ? "+" : ""}
          {currency} {pl.toFixed(2)}
        </TableCell>
        <TableCell>
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow>
          <TableCell colSpan={5} className="p-0">
            <div className="p-4 space-y-4 bg-muted/30">
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Buy-ins</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!isFinalized && (
                      <form onSubmit={handleAddBuyin} className="space-y-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="Amount"
                          value={buyinAmount}
                          onChange={(e) => setBuyinAmount(e.target.value)}
                          min="0.01"
                          step="0.01"
                          required
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isAddingBuyin}
                        >
                          Add Buy-in
                        </Button>
                      </form>
                    )}
                    {buyins.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No buy-ins recorded
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {buyins.map((buyin) => (
                          <div
                            key={buyin.id}
                            className="flex justify-between text-sm py-1"
                          >
                            <span>
                              {currency} {buyin.amount.toFixed(2)}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {formatTimestamp(buyin.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Cash-outs</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!isFinalized && (
                      <form
                        onSubmit={handleAddCashout}
                        className="space-y-2"
                      >
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="Amount"
                          value={cashoutAmount}
                          onChange={(e) => setCashoutAmount(e.target.value)}
                          min="0"
                          step="0.01"
                          required
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isAddingCashout}
                        >
                          Add Cash-out
                        </Button>
                      </form>
                    )}
                    {cashouts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No cash-outs recorded
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {cashouts.map((cashout) => (
                          <div
                            key={cashout.id}
                            className="flex justify-between text-sm py-1"
                          >
                            <span>
                              {currency} {cashout.amount.toFixed(2)}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {formatTimestamp(cashout.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

