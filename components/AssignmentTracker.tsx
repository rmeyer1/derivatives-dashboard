"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ArrowUpDown, Lock } from "lucide-react"
import { cn } from "@/lib/utils"

export type Assignment = {
  id: number
  ticker: string
  assignmentDate: string
  strikePrice: number
  contracts: number
  costBasis: number
  stockPriceAtAssignment: number | null
  currentStockPrice: number | null
  unrealizedPnl: number | null
  stillHeld: boolean
  notes: string | null
}

interface AssignmentTrackerProps {
  assignments: Assignment[]
  loading?: boolean
  onMarkClosed?: (id: number) => void
}

type SortField = 'assignmentDate' | 'ticker' | 'strikePrice' | 'costBasis' | 'unrealizedPnl'
type SortDirection = 'asc' | 'desc'

export default function AssignmentTracker({
  assignments,
  loading = false,
  onMarkClosed,
}: AssignmentTrackerProps) {
  const [sortField, setSortField] = useState<SortField>('assignmentDate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [closedIds, setClosedIds] = useState<Set<number>>(new Set())

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'assignmentDate':
          comparison = new Date(a.assignmentDate).getTime() - new Date(b.assignmentDate).getTime()
          break
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker)
          break
        case 'strikePrice':
          comparison = a.strikePrice - b.strikePrice
          break
        case 'costBasis':
          comparison = a.costBasis - b.costBasis
          break
        case 'unrealizedPnl':
          const pnlA = a.unrealizedPnl ?? 0
          const pnlB = b.unrealizedPnl ?? 0
          comparison = pnlA - pnlB
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [assignments, sortField, sortDirection])

  const handleMarkClosed = (id: number) => {
    setClosedIds(prev => new Set(Array.from(prev).concat([id])))
    onMarkClosed?.(id)
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return '—'
    return `$${price.toFixed(2)}`
  }

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  const formatPNL = (pnl: number | null) => {
    if (pnl === null) return { text: '—', color: 'text-muted-foreground' }
    const isProfit = pnl >= 0
    return {
      text: `${isProfit ? '+' : ''}${formatCurrency(pnl)}`,
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

  const totalCostBasis = assignments.reduce((sum, a) => sum + a.costBasis, 0)
  const totalUnrealizedPnl = assignments.reduce((sum, a) => sum + (a.unrealizedPnl || 0), 0)
  const totalShares = assignments.reduce((sum, a) => sum + (a.contracts * 100), 0)

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
    <div className="space-y-6">
      {assignments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Positions</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Lock className="h-5 w-5 text-orange-500" />
                {assignments.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {totalShares.toLocaleString()} shares total
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Cost Basis</CardDescription>
              <CardTitle className="text-2xl">
                {formatCurrency(totalCostBasis)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Combined for all positions
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unrealized P&L</CardDescription>
              <CardTitle className={cn("text-2xl", totalUnrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600')}>
                {totalUnrealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnl)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {totalUnrealizedPnl >= 0 ? 'In profit' : 'In loss'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assigned Positions (CSP)</CardTitle>
          <CardDescription>
            Track your assigned Cash Secured Puts with cost basis and current P&L
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No assigned positions found. CSP assignments will appear here.
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
                        onClick={() => handleSort('assignmentDate')}
                        className="h-8 px-2"
                      >
                        Assignment Date
                        <SortIcon field="assignmentDate" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('strikePrice')}
                        className="h-8 px-2"
                      >
                        Strike
                        <SortIcon field="strikePrice" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Contracts</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('costBasis')}
                        className="h-8 px-2"
                      >
                        Cost Basis
                        <SortIcon field="costBasis" />
                      </Button>
                    </TableHead>
                    
                    <TableHead className="text-right">Current Price</TableHead>
                    
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('unrealizedPnl')}
                        className="h-8 px-2"
                      >
                        Unrealized P&L
                        <SortIcon field="unrealizedPnl" />
                      </Button>
                    </TableHead>
                    
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAssignments.map((assignment) => {
                    const pnlStyle = formatPNL(assignment.unrealizedPnl)
                    const isClosed = closedIds.has(assignment.id)
                    const shares = assignment.contracts * 100

                    return (
                      <TableRow 
                        key={assignment.id}
                        className={cn(isClosed && "opacity-50")}
                      >
                        <TableCell className="font-semibold">
                          {assignment.ticker}
                        </TableCell>
                        
                        <TableCell>
                          {formatDate(assignment.assignmentDate)}
                        </TableCell>
                        
                        <TableCell className="text-right">
                          {formatPrice(assignment.strikePrice)}
                        </TableCell>
                        
                        <TableCell className="text-right">
                          {assignment.contracts}
                        </TableCell>
                        
                        <TableCell className="text-right">
                          {shares.toLocaleString()}
                        </TableCell>
                        
                        <TableCell className="text-right">
                          {formatCurrency(assignment.costBasis)}
                        </TableCell>
                        
                        <TableCell className="text-right">
                          {formatPrice(assignment.currentStockPrice)}
                        </TableCell>
                        
                        <TableCell className={cn("text-right font-medium", pnlStyle.color)}>
                          {pnlStyle.text}
                        </TableCell>
                        
                        <TableCell className="text-right">
                          {isClosed ? (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Closed
                            </Badge>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
                                <Lock className="h-3 w-3" />
                                Holding
                              </Badge>
                              {onMarkClosed && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => handleMarkClosed(assignment.id)}
                                  title="Mark as closed"
                                >
                                  Close
                                </Button>
                              )}
                            </div>
                          )}
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
    </div>
  )
}
