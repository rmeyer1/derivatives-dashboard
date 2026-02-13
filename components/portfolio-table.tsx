"use client"

import { useState, useMemo } from "react"
import { Position, Strategy } from '@/types/position'
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
  Trash2, 
  Edit3, 
  XCircle, 
  RefreshCw, 
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from "lucide-react"
import { cn } from "@/lib/utils"

type SortField = 'ticker' | 'expirationDate' | 'dte' | 'unrealizedPNL' | 'strategy' | 'status'
type SortDirection = 'asc' | 'desc'

interface PortfolioTableProps {
  positions: Position[]
  loading?: boolean
  onEdit?: (position: Position) => void
  onClose?: (position: Position) => void
  onRoll?: (position: Position) => void
  onDelete?: (positionId: number) => void
}

export default function PortfolioTable({ 
  positions = [], 
  loading = false,
  onEdit,
  onClose,
  onRoll,
  onDelete
}: PortfolioTableProps) {
  const [sortField, setSortField] = useState<SortField>('expirationDate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [deletingId, setDeletingId] = useState<number | null>(null)

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
        case 'expirationDate':
          comparison = new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()
          break
        case 'dte':
          comparison = a.dte - b.dte
          break
        case 'unrealizedPNL':
          comparison = (a.unrealizedPNL ?? 0) - (b.unrealizedPNL ?? 0)
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [positions, sortField, sortDirection])

  const handleDelete = async (position: Position) => {
    if (!onDelete) return
    if (!confirm(`Delete ${position.ticker} ${position.strategy} position?`)) return
    
    setDeletingId(position.id)
    try {
      await onDelete(position.id)
    } finally {
      setDeletingId(null)
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronUp className="h-4 w-4 text-muted-foreground" />
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-4 w-4" /> 
      : <ChevronDown className="h-4 w-4" />
  }

  const getStrategyColor = (strategy: Strategy): string => {
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

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'open':
        return 'bg-green-500'
      case 'closed':
        return 'bg-gray-500'
      case 'rolled':
        return 'bg-blue-500'
      default:
        return 'bg-gray-400'
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
          <Card key={position.id} className={cn(
            "border-l-4",
            position.itm ? "border-l-red-500" : "border-l-green-500"
          )}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{position.ticker}</span>
                    <Badge variant="outline" className={getStrategyColor(position.strategy)}>
                      {position.strategy}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Strike: ${position.shortStrike.toFixed(2)}
                    {position.longStrike && `/${position.longStrike.toFixed(2)}`}
                  </div>
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
                  <span className="text-muted-foreground">Credit: </span>
                  <span>${position.entryCreditPerContract.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Current: </span>
                  <span>{position.currentPrice ? `$${position.currentPrice.toFixed(2)}` : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Contracts: </span>
                  <span>{position.contracts}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Expires: </span>
                  <span>{position.expirationDate}</span>
                </div>
              </div>
              
              {position.itm && (
                <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  In-The-Money
                </div>
              )}
              
              <div className="flex gap-2 pt-2 border-t">
                {position.status === 'open' && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => onEdit?.(position)}
                      className="flex-1"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => onClose?.(position)}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Close
                    </Button>
                  </>
                )}
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => handleDelete(position)}
                  disabled={deletingId === position.id}
                  className="px-2"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
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
              <Button variant="ghost" size="sm" onClick={() => handleSort('ticker')}>
                Ticker
                <SortIcon field="ticker" />
              </Button>
            </TableHead>
            
            <TableHead>
              <Button variant="ghost" size="sm" onClick={() => handleSort('strategy')}>
                Strategy
                <SortIcon field="strategy" />
              </Button>
            </TableHead>
            
            <TableHead className="text-right">Contracts</TableHead>
            
            <TableHead className="text-right">
              <Button variant="ghost" size="sm" onClick={() => handleSort('expirationDate')} className="ml-auto">
                Expiration
                <SortIcon field="expirationDate" />
              </Button>
            </TableHead>
            
            <TableHead className="text-right">
              <Button variant="ghost" size="sm" onClick={() => handleSort('dte')} className="ml-auto">
                DTE
                <SortIcon field="dte" />
              </Button>
            </TableHead>
            
            <TableHead className="text-right">Credit</TableHead>
            
            <TableHead className="text-right">Current</TableHead>
            
            <TableHead className="text-right">
              <Button variant="ghost" size="sm" onClick={() => handleSort('unrealizedPNL')} className="ml-auto">
                P&L
                <SortIcon field="unrealizedPNL" />
              </Button>
            </TableHead>
            
            <TableHead className="text-center">Actions</TableHead>
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
                      getStatusColor(position.status)
                    )} 
                  />
                </TableCell>
                
                <TableCell className="font-medium">
                  {position.ticker}
                  {position.itm && (
                    <span className="ml-1" title="In-The-Money">🔴</span>
                  )}
                </TableCell>
                
                <TableCell>
                  <Badge variant="outline" className={cn("text-xs", getStrategyColor(position.strategy))}>
                    {position.strategy}
                  </Badge>
                </TableCell>
                
                <TableCell className="text-right">{position.contracts}</TableCell>
                
                <TableCell className="text-right">
                  {position.expirationDate}
                </TableCell>
                
                <TableCell className={cn("text-right", getDTELevel(position.dte))}>
                  {position.dte}
                  {position.dte <= 21 && position.dte > 7 && (
                    <span className="ml-1 text-xs" title="Consider rolling">🔄</span>
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
                
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    {position.status === 'open' && (
                      <>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => onEdit?.(position)}
                          title="Edit"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => onClose?.(position)}
                          title="Close"
                          className="text-red-500 hover:text-red-700"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                        
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => onRoll?.(position)}
                          title="Roll"
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => handleDelete(position)}
                      disabled={deletingId === position.id}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
