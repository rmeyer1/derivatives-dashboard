"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Filter, History, TrendingUp, FileCheck } from "lucide-react"
import TradeLog from "./trade-log"
import StrategyPerformance from "./strategy-performance"
import AssignmentTracker from "./assignment-tracker"

interface AssignmentData {
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

interface StrategyPerfData {
  strategy: string
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  avgRoc: number | null
  totalPnl: number
  avgTradePnl: number
}

interface TradeEventData {
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

interface FilterState {
  fromDate: string
  toDate: string
  strategy: string
  ticker: string
}

export default function TradeJournal() {
  const [tradeHistory, setTradeHistory] = useState<TradeEventData[]>([])
  const [strategyPerformance, setStrategyPerformance] = useState<StrategyPerfData[]>([])
  const [assignments, setAssignments] = useState<AssignmentData[]>([])
  const [availableStrategies, setAvailableStrategies] = useState<string[]>([])
  const [availableTickers, setAvailableTickers] = useState<string[]>([])
  
  const [loading, setLoading] = useState({
    trades: false,
    performance: false,
    assignments: false,
    filters: false,
  })
  
  const [error, setError] = useState<string | null>(null)
  
  const [filters, setFilters] = useState<FilterState>({
    fromDate: '',
    toDate: '',
    strategy: '',
    ticker: '',
  })
  
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        setLoading(prev => ({ ...prev, filters: true }))
        const response = await fetch('/api/trades/filters')
        if (!response.ok) throw new Error('Failed to fetch filters')
        const data = await response.json()
        setAvailableStrategies(data.strategies || [])
        setAvailableTickers(data.tickers || [])
      } catch (err) {
        console.error('Error fetching filter options:', err)
      } finally {
        setLoading(prev => ({ ...prev, filters: false }))
      }
    }
    fetchFilters()
  }, [])
  
  const fetchTradeHistory = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, trades: true }))
      setError(null)
      
      const params = new URLSearchParams()
      if (filters.fromDate) params.append('from', filters.fromDate)
      if (filters.toDate) params.append('to', filters.toDate)
      if (filters.strategy) params.append('strategy', filters.strategy)
      if (filters.ticker) params.append('ticker', filters.ticker)
      
      const response = await fetch(`/api/trades/history?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch trade history')
      const data = await response.json()
      setTradeHistory(data)
    } catch (err) {
      console.error('Error fetching trade history:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(prev => ({ ...prev, trades: false }))
    }
  }, [filters])
  
  const fetchStrategyPerformance = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, performance: true }))
      setError(null)
      
      const params = new URLSearchParams()
      if (filters.fromDate) params.append('from', filters.fromDate)
      if (filters.toDate) params.append('to', filters.toDate)
      
      const response = await fetch(`/api/trades/performance?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch strategy performance')
      const data = await response.json()
      setStrategyPerformance(data)
    } catch (err) {
      console.error('Error fetching strategy performance:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(prev => ({ ...prev, performance: false }))
    }
  }, [filters.fromDate, filters.toDate])
  
  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, assignments: true }))
      setError(null)
      
      const params = new URLSearchParams()
      if (filters.ticker) params.append('ticker', filters.ticker)
      
      const response = await fetch(`/api/assignments?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch assignments')
      const data = await response.json()
      setAssignments(data)
    } catch (err) {
      console.error('Error fetching assignments:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(prev => ({ ...prev, assignments: false }))
    }
  }, [filters.ticker])
  
  useEffect(() => {
    fetchTradeHistory()
    fetchStrategyPerformance()
    fetchAssignments()
  }, [fetchTradeHistory, fetchStrategyPerformance, fetchAssignments])
  
  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }
  
  const handleResetFilters = () => {
    setFilters({
      fromDate: '',
      toDate: '',
      strategy: '',
      ticker: '',
    })
  }
  
  const handleApplyFilters = () => {
    fetchTradeHistory()
    fetchStrategyPerformance()
    fetchAssignments()
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromDate" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                From
              </Label>
              <Input
                id="fromDate"
                type="date"
                value={filters.fromDate}
                onChange={(e) => handleFilterChange('fromDate', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="toDate" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                To
              </Label>
              <Input
                id="toDate"
                type="date"
                value={filters.toDate}
                onChange={(e) => handleFilterChange('toDate', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Strategy</Label>
              <Select
                value={filters.strategy}
                onValueChange={(value) => handleFilterChange('strategy', value === 'all' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All strategies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All strategies</SelectItem>
                  {availableStrategies.map((strategy) => (
                    <SelectItem key={strategy} value={strategy}>
                      {strategy}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input
                value={filters.ticker}
                onChange={(e) => handleFilterChange('ticker', e.target.value.toUpperCase())}
                placeholder="e.g., AAPL"
              />
            </div>
            
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={handleResetFilters}
                className="flex-1"
              >
                Reset
              </Button>
              <Button
                onClick={handleApplyFilters}
                className="flex-1"
                disabled={loading.trades || loading.performance || loading.assignments}
              >
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-red-600">
            Error: {error}
          </CardContent>
        </Card>
      )}
      
      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Trade History
            <span className="ml-1 text-xs bg-muted px-2 py-0.5 rounded-full">
              {tradeHistory.length}
            </span>
          </TabsTrigger>
          
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Performance
            <span className="ml-1 text-xs bg-muted px-2 py-0.5 rounded-full">
              {strategyPerformance.length}
            </span>
          </TabsTrigger>
          
          <TabsTrigger value="assignments" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Assignments
            <span className="ml-1 text-xs bg-muted px-2 py-0.5 rounded-full">
              {assignments.length}
            </span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="history" className="mt-6">
          <TradeLog trades={tradeHistory} loading={loading.trades} />
        </TabsContent>
        
        <TabsContent value="performance" className="mt-6">
          <StrategyPerformance data={strategyPerformance} loading={loading.performance} />
        </TabsContent>
        
        <TabsContent value="assignments" className="mt-6">
          <AssignmentTracker
            assignments={assignments}
            loading={loading.assignments}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
