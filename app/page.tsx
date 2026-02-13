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
import { ITMAlertBoard } from "@/components/ITMAlertBoard"
import { RiskDistributionChart } from "@/components/RiskDistributionChart"
import { DTETimeline } from "@/components/DTETimeline"
import { 
  Position,
  PortfolioSummary, 
  ITMAlert,
  RiskDistribution,
  DTEPosition
} from '@/types/position'
import { useLivePrices } from '@/lib/hooks/useLivePrices'
import { cn } from "@/lib/utils"

// Dynamically import PortfolioTable to avoid SSR issues
import dynamic from 'next/dynamic'
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

  const handleAcknowledge = async (positionId: number) => {
    try {
      const response = await fetch(`/api/positions/${positionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledgmentFlag: true })
      })
      
      if (!response.ok) {
        throw new Error('Failed to acknowledge')
      }
      
      // Refresh data
      await fetchData()
    } catch (err) {
      console.error('Error acknowledging alert:', err)
    }
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
        <Card className="mb-4 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Portfolio Summary Cards - 4 cards responsive grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        {/* Total BP at Risk */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total BP at Risk</CardTitle>
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
            <CardTitle className="text-sm font-medium">Unrealized P&amp;L</CardTitle>
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
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="itm-alerts">
          <ITMAlertBoard 
            onAcknowledge={handleAcknowledge}
            refreshInterval={30000}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
