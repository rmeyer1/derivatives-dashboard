"use client"

import { useState, useMemo } from "react"
import { Position } from '@/types/position'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { 
  RefreshCw, 
  ArrowUpDown,
  AlertTriangle
} from "lucide-react"
import { cn } from "@/lib/utils"

type SortField = 'ticker' | 'strategy' | 'dte' | 'unrealizedPNL' | 'entryCreditPerContract'
type SortDirection = 'asc' | 'desc'

interface PortfolioTableProps {
  positions: Position[]
  loading?: boolean
}

export default function PortfolioTable({ 
  positions, 
  loading = false
}: PortfolioTableProps) {
  const [sortField, setSortField] = useState<SortField>('dte')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker)
          break
        case 'strategy':
          comparison = a.strategy.localeCompare(b.strategy)
          break
        case 'dte':
          comparison = a.dte - b.dte
          break
        case 'unrealizedPNL':
          const pnlA = a.unrealizedPNL ?? 0
          const pnlB = b.unrealizedPNL ?? 0
          comparison = pnlA - pnlB
          break
        case 'entryCreditPerContract':
          comparison = a.entryCreditPerContract - b.entryCreditPerContract
          break
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [positions, sortField, sortDirection])

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

  const getStrategyColor = (strategy: string): string => {
    switch (strategy) {
      case 'Cash Secured Put':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'Covered Call':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'Bull Put Spread':
      case 'Put Credit Spread':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'Call Credit Spread':
      case 'Call Debit Spread':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'Put Debit Spread':
        return 'bg-pink-100 text-pink-800 border-pink-200'
      case 'Iron Condor':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getDTELevel = (dte: number): string => {
    if (dte <= 7) return 'text-red-600 font-bold'
    if (dte <= 21) return 'text-orange-600'
    return ''
  }

  const formatPNL = (pnl: number | null): { text: string; color: string } => {
    if (pnl === null) return { text: 'N/A', color: 'text-muted-foreground' }
    
    const isProfit = pnl >= 0
    return {
      text: `${isProfit ? '+' : ''}$${pnl.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`,
      color: isProfit ? 'text-green-600' : 'text-red-600'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (positions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No open positions found.
      </div>
    )
  }

  // Mobile view: Cards
  const MobileView = () => (
    <div className="space-y-4 md:hidden">
      {sortedPositions.map((position) => {
        const pnlStyle = formatPNL(position.unrealizedPNL)
        
        return (
          <Card 
            key={position.id} 
            className={cn(
              "border-l-4",
              position.itm ? "border-l-red-500" : "border-l-green-500"
            )}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{position.ticker}</span>
                    {position.itm && (
                      <Badge variant="destructive" className="text-xs">
                        ITM
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("text-xs mt-1", getStrategyColor(position.strategy))}>
                    {position.strategy}
                  </Badge>
                </div>
                
                <div className="text-right">
                  <div className={cn("font-bold", pnlStyle.color)}>
                    {pnlStyle.text}
                  </div>
                  <div className={cn("text-sm", getDTELevel(position.dte))}>
                    {position.dte} DTE
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                  <span className="text-muted-foreground">Strike: </span>
                  <span>${position.shortStrike.toFixed(2)}</span>
                  {position.longStrike && `/$${position.longStrike.toFixed(2)}`}
                </div>
                <div>
                  <span className="text-muted-foreground">Credit: </span>
                  <span>${position.entryCreditPerContract.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Contracts: </span>
                  <span>{position.contracts}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Expires: </span>
                  <span className="text-xs">{position.expirationDate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Current: </span>
                  <span>{position.currentPrice ? `$${position.currentPrice.toFixed(2)}` : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Stock: </span>
                  <span>${position.stockPrice?.toFixed(2) ?? 'N/A'}</span>
                </div>
              </div>
              
              {position.itm && (
                <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {position.itmPercent.toFixed(1)}% ITM
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )

  // Desktop view: Table
  const DesktopView = () => (
    <div className="hidden md:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <div className="w-2 h-2 rounded-full bg-gray-300" />
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
            
            <TableHead className="text-right">Contracts</TableHead>
            
            <TableHead className="text-right">Strike</TableHead>
            
            <TableHead className="text-right">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort('dte')}
                className="h-8 px-2"
              >
                DTE
                <SortIcon field="dte" />
              </Button>
            </TableHead>
            
            <TableHead className="text-right">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort('entryCreditPerContract')}
                className="h-8 px-2"
              >
                Entry Credit
                <SortIcon field="entryCreditPerContract" />
              </Button>
            </TableHead>
            
            <TableHead className="text-right">Current Price</TableHead>
            
            <TableHead className="text-right">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort('unrealizedPNL')}
                className="h-8 px-2"
              >
                P&L
                <SortIcon field="unrealizedPNL" />
              </Button>
            </TableHead>
            
            <TableHead>Stock Price</TableHead>
          </TableRow>
        </TableHeader>
        
        <TableBody>
          {sortedPositions.map((position) => {
            const pnlStyle = formatPNL(position.unrealizedPNL)
            
            return (
              <TableRow 
                key={position.id}
                className={cn(
                  position.dte <= 7 && "bg-red-50/50",
                  position.itm && "bg-orange-50/50"
                )}
              >
                <TableCell>
                  <div 
                    className={cn(
                      "w-2 h-2 rounded-full",
                      position.status === 'open' ? 'bg-green-500' : 'bg-gray-400'
                    )} 
                  />
                </TableCell>
                
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {position.ticker}
                    {position.itm && (
                      <Badge variant="destructive" className="text-xs">
                        ITM
                      </Badge>
                    )}
                  </div>
                </TableCell>
                
                <TableCell>
                  <Badge variant="outline" className={cn("text-xs", getStrategyColor(position.strategy))}>
                    {position.strategy}
                  </Badge>
                </TableCell>
                
                <TableCell className="text-right">{position.contracts}</TableCell>
                
                <TableCell className="text-right">
                  ${position.shortStrike.toFixed(2)}
                  {position.longStrike && `/$${position.longStrike.toFixed(2)}`}
                </TableCell>
                
                <TableCell className={cn("text-right", getDTELevel(position.dte))}>
                  {position.dte}
                  {position.dte <= 21 && position.dte > 7 && (
                    <span className="ml-1 text-xs" title="Consider rolling">🔄</span>
                  )}
                  {position.dte <= 7 && (
                    <span className="ml-1 text-xs" title="Critical">⚠️</span>
                  )}
                </TableCell>
                
                <TableCell className="text-right">
                  ${position.entryCreditPerContract.toFixed(2)}
                </TableCell>
                
                <TableCell className="text-right">
                  {position.currentPrice 
                    ? `$${position.currentPrice.toFixed(2)}` 
                    : '—'}
                </TableCell>
                
                <TableCell className={cn("text-right font-medium", pnlStyle.color)}>
                  {pnlStyle.text}
                </TableCell>
                
                <TableCell className="text-sm text-muted-foreground">
                  ${position.stockPrice?.toFixed(2) ?? 'N/A'}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )

  return (
    <>
      <MobileView />
      <DesktopView />
    </>
  )
}
