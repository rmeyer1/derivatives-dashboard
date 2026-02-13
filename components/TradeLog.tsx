"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, FileDown } from "lucide-react"
import { cn } from "@/lib/utils"

export type TradeEvent = {
  id: number
  ticker: string
  strategy: string
  eventType: 'open' | 'close' | 'roll' | 'assigned'
  eventDate: string
  entryPrice: number
  exitPrice: number | null
  contracts: number
  pnl: number | null
  realizedPnl: number | null
  notes: string | null
  rolledFromId: number | null
  rolledToId: number | null
  closeReason: string | null
}

interface TradeLogProps {
  trades: TradeEvent[]
  loading?: boolean
}

type SortField = 'eventDate' | 'ticker' | 'strategy' | 'eventType' | 'entryPrice' | 'realizedPnl'
type SortDirection = 'asc' | 'desc'

export default function TradeLog({ trades, loading = false }: TradeLogProps) {
  const [sortField, setSortField] = useState<SortField>('eventDate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'eventDate':
          comparison = new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
          break
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker)
          break
        case 'strategy':
          comparison = a.strategy.localeCompare(b.strategy)
          break
        case 'eventType':
          comparison = a.eventType.localeCompare(b.eventType)
          break
        case 'entryPrice':
          comparison = a.entryPrice - b.entryPrice
          break
        case 'realizedPnl':
          const pnlA = a.realizedPnl ?? 0
          const pnlB = b.realizedPnl ?? 0
          comparison = pnlA - pnlB
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [trades, sortField, sortDirection])

  const getEventTypeBadge = (eventType: TradeEvent['eventType']) => {
    switch (eventType) {
      case 'open':
        return { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Open' }
      case 'close':
        return { color: 'bg-green-100 text-green-800 border-green-200', label: 'Close' }
      case 'roll':
        return { color: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Roll' }
      case 'assigned':
        return { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Assigned' }
      default:
        return { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Unknown' }
    }
  }

  const formatPrice = (price: number | null, prefix = '$') => {
    if (price === null) return '—'
    return `${prefix}${price.toFixed(2)}`
  }

  const formatPNL = (pnl: number | null) => {
    if (pnl === null) return { text: '—', color: 'text-muted-foreground' }
    const isProfit = pnl >= 0
    return {
      text: `${isProfit ? '+' : ''}$${pnl.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`,
      color: isProfit ? 'text-green-600' : 'text-red-600'
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleExport = () => {
    const csvContent = [
      ['ID', 'Date', 'Ticker', 'Strategy', 'Event', 'Entry Price', 'Exit Price', 'Contracts', 'P&L', 'Notes'].join(','),
      ...sortedTrades.map(t => [
        t.id,
        t.eventDate,
        `"${t.ticker}"`,
        `"${t.strategy}"`,
        t.eventType,
        t.entryPrice.toFixed(2),
        t.exitPrice?.toFixed(2) || '',
        t.contracts,
        t.realizedPnl?.toFixed(2) || '',
        `"${t.notes || ''}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trade-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-muted-foreground ml-1" />
    }
    return (
      <ArrowUpDown
        className={cn("h-3 w-3 ml-1", sortDirection === 'desc' && "rotate-180")}
      />
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Trade Log</CardTitle>
          <CardDescription>Complete history of all trade events</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <FileDown className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        {trades.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No trade events found. Adjust your filters or add some trades.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('eventDate')}
                      className="h-8 px-2"
                    >
                      Date
                      <SortIcon field="eventDate" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('ticker')}
                      className="h-8 px-2"
                    >
                      Ticker
                      <SortIcon field="ticker" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('strategy')}
                      className="h-8 px-2"
                    >
                      Strategy
                      <SortIcon field="strategy" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('eventType')}
                      className="h-8 px-2"
                    >
                      Event
                      <SortIcon field="eventType" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Entry</TableHead>
                  <TableHead className="text-right">Exit</TableHead>
                  <TableHead className="text-right">Contracts</TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('realizedPnl')}
                      className="h-8 px-2"
                    >
                      P&L
                      <SortIcon field="realizedPnl" />
                    </Button>
                  </TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTrades.map((trade) => {
                  const pnlStyle = formatPNL(trade.realizedPnl)
                  const badgeStyle = getEventTypeBadge(trade.eventType)

                  return (
                    <TableRow key={trade.id}>
                      <TableCell className="font-medium">
                        {formatDate(trade.eventDate)}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{trade.ticker}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{trade.strategy}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("text-xs capitalize", badgeStyle.color)}
                        >
                          {badgeStyle.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPrice(trade.entryPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPrice(trade.exitPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {trade.contracts}
                      </TableCell>
                      <TableCell className={cn("text-right font-medium", pnlStyle.color)}>
                        {pnlStyle.text}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={trade.notes || undefined}>
                        {trade.notes || '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
