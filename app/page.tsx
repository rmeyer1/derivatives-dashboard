'use client'

import { useState, useCallback, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Plus, TrendingUp, TrendingDown, Wallet, AlertTriangle } from "lucide-react"
import { AddPositionForm } from "@/components/add-position-form"
import { EditPositionDialog } from "@/components/edit-position-dialog"
import { ClosePositionDialog } from "@/components/close-position-dialog"
import { RollPositionDialog } from "@/components/roll-position-dialog"
import { ITMAlertBoard } from "@/components/itm-alert-board"
import { 
  Position, 
  CreatePositionRequest, 
  PortfolioSummary as PortfolioSummaryType,
  ITMAlert
} from '@/types/position'
import dynamic from 'next/dynamic'
import { Alert, AlertDescription } from "@/components/ui/alert"

// Dynamically import PortfolioTable to avoid SSR issues
const PortfolioTable = dynamic(() => import("@/components/portfolio-table"), {
  ssr: false,
  loading: () => <div className="p-8 text-center">Loading table...</div>
})

export default function Dashboard() {
  const [positions, setPositions] = useState<Position[]>([])
  const [summary, setSummary] = useState<PortfolioSummaryType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Dialog states
  const [isAddPositionOpen, setIsAddPositionOpen] = useState(false)
  const [editPosition, setEditPosition] = useState<Position | null>(null)
  const [closePosition, setClosePosition] = useState<Position | null>(null)
  const [rollPosition, setRollPosition] = useState<Position | null>(null)

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const [positionsRes, summaryRes] = await Promise.all([
        fetch('/api/positions'),
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

  // Calculate risk distribution
  const riskDistribution = positions
    .filter(p => p.status === 'open')
    .reduce((acc, p) => {
      const category = p.strategy.includes('Spread') ? 'Spreads' 
        : p.strategy === 'Cash Secured Put' ? 'CSP' 
        : p.strategy === 'Covered Call' ? 'CC' 
        : 'Other'
      
      acc[category] = (acc[category] || 0) + (p.collateralRequired || 0)
      return acc
    }, {} as Record<string, number>)

  const totalCollateral = Object.values(riskDistribution).reduce((a, b) => a + b, 0)

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
            onClick={fetchData} 
            variant="outline" 
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
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

      {/* Portfolio Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">BP at Risk</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${summary.totalBPAtRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Buying power tied up
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Premium Collected</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                +${summary.totalPremiumCollected.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground">
                From {summary.positionsCount} open position{summary.positionsCount !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unrealized P&L</CardTitle>
              <TrendingDown className={cn(
                "h-4 w-4",
                summary.unrealizedPNL >= 0 ? "text-green-600" : "text-red-600"
              )} /
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                summary.unrealizedPNL >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {summary.unrealizedPNL >= 0 ? '+' : ''}
                ${summary.unrealizedPNL.toLocaleString(undefined, { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                vs max profit potential
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {positions.filter(p => p.status === 'open' && p.dte <= 7).length}
              </div>
              <p className="text-xs text-muted-foreground">
                ≤ 7 DTE
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ITM Alerts</CardTitle>
              <AlertTriangle className={cn(
                "h-4 w-4",
                summary.itmAlertsCount > 0 ? "text-red-500" : "text-muted-foreground"
              )} />
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                summary.itmAlertsCount > 0 ? "text-red-600" : ""
              )}>
                {summary.itmAlertsCount}
              </div>
              <p className="text-xs text-muted-foreground">
                Positions ITM
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Risk Distribution Bar */}
      {Object.keys(riskDistribution).length > 0 && totalCollateral > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-8 rounded-full overflow-hidden">
              {riskDistribution.CSP && riskDistribution.CSP > 0 && (
                <div 
                  className="bg-blue-500 h-full flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(riskDistribution.CSP / totalCollateral) * 100}%` }}
                  title={`CSP: $${riskDistribution.CSP.toLocaleString()}`}
                >
                  {riskDistribution.CSP / totalCollateral > 0.15 && `CSP ${((riskDistribution.CSP / totalCollateral) * 100).toFixed(0)}%`}
                </div>
              )}
              {riskDistribution.CC && riskDistribution.CC > 0 && (
                <div 
                  className="bg-green-500 h-full flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(riskDistribution.CC / totalCollateral) * 100}%` }}
                  title={`CC: $${riskDistribution.CC.toLocaleString()}`}
                >
                  {riskDistribution.CC / totalCollateral > 0.15 && `CC ${((riskDistribution.CC / totalCollateral) * 100).toFixed(0)}%`}
                </div>
              )}
              {riskDistribution.Spreads && riskDistribution.Spreads > 0 && (
                <div 
                  className="bg-purple-500 h-full flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(riskDistribution.Spreads / totalCollateral) * 100}%` }}
                  title={`Spreads: $${riskDistribution.Spreads.toLocaleString()}`}
                >
                  {riskDistribution.Spreads / totalCollateral > 0.15 && `Spreads ${((riskDistribution.Spreads / totalCollateral) * 100).toFixed(0)}%`}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-4 text-sm">
              {riskDistribution.CSP > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>CSP: ${riskDistribution.CSP.toLocaleString(undefined, {maximumFractionDigits: 0})} ({((riskDistribution.CSP / totalCollateral) * 100).toFixed(1)}%)</span>
                </div>
              )}
              {riskDistribution.CC > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>CC: ${riskDistribution.CC.toLocaleString(undefined, {maximumFractionDigits: 0})} ({((riskDistribution.CC / totalCollateral) * 100).toFixed(1)}%)</span>
                </div>
              )}
              {riskDistribution.Spreads > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span>Spreads: ${riskDistribution.Spreads.toLocaleString(undefined, {maximumFractionDigits: 0})} ({((riskDistribution.Spreads / totalCollateral) * 100).toFixed(1)}%)</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="portfolio" className="space-y-4">
        <TabsList>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="itm-alerts">
            ITM Alerts
            {summary?.itmAlertsCount > 0 && (
              <Badge variant="destructive" className="ml-1">{summary.itmAlertsCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Open Positions</CardTitle>
              <CardDescription>
                Manage your current options positions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PortfolioTable 
                positions={positions.filter(p => p.status === 'open')} 
                loading={loading}
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

import { cn } from "@/lib/utils"
