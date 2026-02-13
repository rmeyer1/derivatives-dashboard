'use client'

import { useState, useCallback, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  AlertTriangle,
  Plus,
  DollarSign,
  BarChart3
} from "lucide-react"
import { AddPositionForm } from "@/components/add-position-form"
import { EditPositionDialog } from "@/components/edit-position-dialog"
import { ClosePositionDialog } from "@/components/close-position-dialog"
import { RollPositionDialog } from "@/components/roll-position-dialog"
import { ITMAlertBoard } from "@/components/itm-alert-board"
import { RiskDistributionChart } from "@/components/RiskDistributionChart"
import { DTETimeline } from "@/components/DTETimeline"
import { 
  Position,
  CreatePositionRequest, 
  PortfolioSummary, 
  ITMAlert,
  RiskDistribution,
  DTEPosition
} from '@/types/position'
import { useLivePrices } from '@/lib/hooks/useLivePrices'
import dynamic from 'next/dynamic'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

// Dynamically import PortfolioTable to avoid SSR issues
const PortfolioTable = dynamic(() => import("@/components/portfolio-table"), {
  ssr: false,
  loading: () => (
    <div className="p-8 text-center">
      <Skeleton className="h-8 w-48 mx-auto" />
    </div>
  )
})

export default function Dashboard() {
  const [positions, setPositions] = useState<Position[]>([])
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Dialog states
  const [isAddPositionOpen, setIsAddPositionOpen] = useState(false)
  const [editPosition, setEditPosition] = useState<Position | null>(null)
  const [closePosition, setClosePosition] = useState<Position | null>(null)
  const [rollPosition, setRollPosition] = useState<Position | null>(null)

  // Fetch live prices
  const { 
    data: livePrices, 
    isLoading: pricesLoading,
    refetch: refetchPrices 
  } = useLivePrices({ 
    intervalMs: 60000 // 1 minute polling
  })

  // Fetch data function
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const [positionsRes, summaryRes] = await Promise.all([
        fetch('/api/positions?status=open'),
        fetch('/api/portfolio/summary')
      ])
      
      if (!positionsRes.ok) {
        throw new Error('Failed to fetch positions')
      }
      
      const positionsData = await positionsRes.json()
      setPositions(positionsData)
      
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json()
        setSummary(summaryData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Update positions with live prices when available
  useEffect(() => {
    if (livePrices) {
      setPositions(prev => {
        const priceMap = new Map(livePrices.map(p => [p.positionId, p]))
        return prev.map(pos => {
          const priceData = priceMap.get(pos.id)
          if (priceData) {
            return {
              ...pos,
              currentPrice: priceData.currentPrice ?? pos.currentPrice,
              stockPrice: priceData.stockPrice ?? pos.stockPrice
            }
          }
          return pos
        })
      })
    }
  }, [livePrices])

  // Handlers
  const handleAddPosition = async (data: CreatePositionRequest) => {
    const response = await fetch('/api/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: data.ticker,
        strategy: data.strategy,
        contracts: data.contracts,
        shortStrike: data.shortStrike,
        longStrike: data.longStrike,
        entryCreditPerContract: data.entryCreditPerContract,
        expirationDate: data.expirationDate,
        notes: data.notes,
        entryPriceUnderlying: data.entryPriceUnderlying
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to add position')
    }

    await fetchData()
  }

  const handleUpdatePosition = async (id: number, data: any) => {
    const response = await fetch(`/api/positions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update position')
    }

    await fetchData()
  }

  const handleClosePosition = async (
    id: number, 
    closeDebitPerContract: number, 
    closeDate?: string
  ) => {
    const response = await fetch(`/api/positions/${id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closeDebitPerContract, closeDate })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to close position')
    }

    await fetchData()
  }

  const handleRollPosition = async (id: number, data: any) => {
    const response = await fetch(`/api/positions/${id}/roll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newShortStrike: data.newShortStrike,
        newLongStrike: data.newLongStrike,
        newExpirationDate: data.newExpirationDate,
        newEntryCredit: data.newEntryCredit,
        newContracts: data.newContracts
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to roll position')
    }

    await fetchData()
  }

  const handleDeletePosition = async (id: number) => {
    const response = await fetch(`/api/positions/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete position')
    }

    await fetchData()
  }

  const handleAcknowledgeAlert = async (positionId: number) => {
    await handleUpdatePosition(positionId, { acknowledgmentFlag: true })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPNL = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: value >= 0 ? 'always' : 'auto'
    }).format(value)
  }

  // Calculate unrealized PNL live
  const liveUnrealizedPNL = positions.reduce((total, pos) => {
    if (pos.currentPrice !== null) {
      return total + ((pos.entryCreditPerContract - pos.currentPrice) * pos.contracts * 100)
    }
    return total
  }, 0)

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Derivatives Trading Dashboard</h1>
          <p className="text-muted-foreground">Real-time portfolio monitoring and analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setIsAddPositionOpen(true)} 
            variant="default" 
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Position
          </Button>
          <Button 
            onClick={() => {
              fetchData()
              refetchPrices()
            }} 
            variant="outline" 
            size="sm"
            disabled={loading || pricesLoading}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", (loading || pricesLoading) && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Portfolio Summary Cards - 5 cards responsive grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 mb-6">
        {/* Total BP at Risk */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">BP at Risk</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary?.totalBPAtRisk || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Buying power tied up
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Premium Collected */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Premium Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">
                  +{formatCurrency(summary?.totalPremiumCollected || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  From {summary?.positionsCount || 0} open position{summary?.positionsCount !== 1 ? 's' : ''}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Unrealized P&L */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unrealized P&L</CardTitle>
            <div className={cn(
              "h-4 w-4 rounded-full",
              (liveUnrealizedPNL || summary?.unrealizedPNL || 0) >= 0 ? "bg-green-500" : "bg-red-500"
            )} />
          </CardHeader>
          <CardContent>
            {loading && pricesLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className={cn(
                  "text-2xl font-bold",
                  (liveUnrealizedPNL || summary?.unrealizedPNL || 0) >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatPNL(liveUnrealizedPNL || summary?.unrealizedPNL || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  vs entry credit
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summary?.expiringSoonCount || positions.filter(p => p.dte <= 7).length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  ≤ 7 DTE
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* ITM Alert Count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ITM Alerts</CardTitle>
            <AlertTriangle className={cn(
              "h-4 w-4",
              (summary?.itmAlertsCount || 0) > 0 ? "text-red-500" : "text-muted-foreground"
            )} />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className={cn(
                  "text-2xl font-bold",
                  (summary?.itmAlertsCount || 0) > 0 ? "text-red-600" : ""
                )}>
                  {summary?.itmAlertsCount || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Positions ITM
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section - Risk Distribution and DTE Timeline */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <RiskDistributionChart 
          data={summary?.risk_distribution || []} 
          loading={loading} 
        />
        <DTETimeline 
          positions={positions} 
          loading={loading} 
        />
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="portfolio" className="space-y-4">
        <TabsList>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="itm-alerts">
            ITM Alerts
            {(summary?.itmAlertsCount || 0) > 0 && (
              <Badge variant="destructive" className="ml-1">{summary?.itmAlertsCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Open Positions</CardTitle>
                  <CardDescription>
                    Manage your current options positions
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {
                    fetchData()
                    refetchPrices()
                  }}
                  variant="outline"
                  size="sm"
                  disabled={loading || pricesLoading}
                >
                  <RefreshCw className={cn("mr-2 h-4 w-4", (loading || pricesLoading) && "animate-spin")} />
                  Refresh Prices
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <PortfolioTable 
                positions={positions} 
                loading={loading || pricesLoading}
                onEdit={setEditPosition}
                onClose={setClosePosition}
                onRoll={setRollPosition}
                onDelete={handleDeletePosition}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="itm-alerts">
          <ITMAlertBoard 
            onAcknowledge={handleAcknowledgeAlert}
            refreshInterval={30000}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddPositionForm 
        isOpen={isAddPositionOpen} 
        onClose={() => setIsAddPositionOpen(false)}
        onSubmit={handleAddPosition}
      />

      <EditPositionDialog
        position={editPosition}
        isOpen={!!editPosition}
        onClose={() => setEditPosition(null)}
        onSubmit={handleUpdatePosition}
      />

      <ClosePositionDialog
        position={closePosition}
        isOpen={!!closePosition}
        onClose={() => setClosePosition(null)}
        onSubmit={handleClosePosition}
      />

      <RollPositionDialog
        position={rollPosition}
        isOpen={!!rollPosition}
        onClose={() => setRollPosition(null)}
        onSubmit={handleRollPosition}
      />
    </div>
  )
}
