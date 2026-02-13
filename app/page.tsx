'use client'

import { useState, useCallback, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Plus, TrendingUp, TrendingDown, Wallet, AlertTriangle, Globe, Bot, Bell, BellOff } from "lucide-react"
import { AddPositionForm } from "@/components/add-position-form"
import { EditPositionDialog } from "@/components/edit-position-dialog"
import { ClosePositionDialog } from "@/components/close-position-dialog"
import { RollPositionDialog } from "@/components/roll-position-dialog"
import { ITMAlertBoard } from "@/components/itm-alert-board"
import { AgentActionsLog } from "@/components/agent-actions-log"
import { QuickTaskQueue } from "@/components/quick-task-queue"
import { ApprovalFlows } from "@/components/approval-flows"
import { AgentNotificationIcon } from "@/components/agent-notification-badge"
import IVRankHeatmap from "@/components/iv-rank-heatmap"
import EarningsCalendar from "@/components/earnings-calendar"
import MacroSnapshot from "@/components/macro-snapshot"
import StrategySuggestions from "@/components/strategy-suggestions"
import TradeJournal from "@/components/trade-journal"
import CompactMode from "@/components/compact-mode"
import QuickActions from "@/components/quick-actions"
import { MobileNav } from "@/components/mobile-nav"
import { ModeToggle } from "@/components/mode-toggle"
import { DataExport } from "@/components/data-export"
import { ResizableDashboard } from "@/components/resizable-dashboard"
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help"
import { 
  Position, 
  CreatePositionRequest, 
  PortfolioSummary as PortfolioSummaryType
} from '@/types/position'
import { ApprovalsResponse } from '@/types/agent'
import { useNotifications } from "@/lib/hooks/useNotifications"
import { useDashboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts"
import { useToast } from "@/hooks/use-toast"
import dynamic from 'next/dynamic'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

// Dynamically import PortfolioTable to avoid SSR issues
const PortfolioTable = dynamic(() => import("@/components/portfolio-table"), {
  ssr: false,
  loading: () => <div className="p-8 text-center">Loading table...</div>
})

type MobileTab = 'dashboard' | 'positions' | 'alerts' | 'journal' | 'agent'

export default function Dashboard() {
  const { toast } = useToast()
  
  // Mobile state
  const [mobileTab, setMobileTab] = useState<MobileTab>('dashboard')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  
  // Position CRUD state
  const [positions, setPositions] = useState<Position[]>([])
  const [summary, setSummary] = useState<PortfolioSummaryType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Dialog states
  const [isAddPositionOpen, setIsAddPositionOpen] = useState(false)
  const [editPosition, setEditPosition] = useState<Position | null>(null)
  const [closePosition, setClosePosition] = useState<Position | null>(null)
  const [rollPosition, setRollPosition] = useState<Position | null>(null)
  
  // Agent state
  const [activeAgentTab, setActiveAgentTab] = useState('approvals')
  const [pendingApprovals, setPendingApprovals] = useState(0)
  
  // UX Polish state
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Notifications
  const {
    permission,
    supported,
    subscribed,
    subscribe,
    unsubscribe
  } = useNotifications('default')

  // Fetch pending approval count
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const response = await fetch('/api/agent/approvals')
        if (response.ok) {
          const data: ApprovalsResponse = await response.json()
          setPendingApprovals(data.pendingCount)
        }
      } catch {
        // Ignore errors
      }
    }
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [])

  // Toast display
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

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
    setToastMessage('Position added successfully!')
    toast({
      title: "Position Added",
      description: `${data.ticker} ${data.strategy} position created.`,
    })
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
    setToastMessage('Position closed successfully!')
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
    setToastMessage('Position rolled successfully!')
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
    setToastMessage('Position deleted!')
  }

  const handleAcknowledgeAlert = async (positionId: number) => {
    await handleUpdatePosition(positionId, { acknowledgmentFlag: true })
  }

  // Quick action handlers
  const handleAckAllAlerts = () => {
    const itmCount = summary?.itmAlertsCount || 0
    if (itmCount > 0) {
      setToastMessage(`Acknowledged ${itmCount} alert${itmCount !== 1 ? 's' : ''}`)
    }
  }

  const handleAddNote = () => {
    setToastMessage('Note feature coming soon!')
  }

  const handleNotificationToggle = async () => {
    if (subscribed) {
      await unsubscribe()
      setToastMessage('Notifications disabled')
    } else {
      await subscribe()
      if (permission === 'granted') {
        setToastMessage('Notifications enabled!')
      }
    }
  }
  
  const handleExport = useCallback(() => {
    // Trigger export via DataExport component
    const exportButton = document.querySelector('[aria-label="Export data"]') as HTMLElement
    exportButton?.click()
  }, [])

  // Setup keyboard shortcuts
  const shortcuts = useDashboardShortcuts({
    onRefresh: fetchData,
    onExport: handleExport,
    onAddPosition: () => setIsAddPositionOpen(true),
    onShowHelp: () => setShowShortcuts(true),
  })

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

  // Show compact view when on mobile positions tab
  const showCompactMode = mobileTab === 'positions'

  return (
    <div className="pb-20 md:pb-0">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg">
          {toastMessage}
        </div>
      )}

      <div className="container mx-auto py-4 md:py-8 px-4">
        {/* Header */}
        <div className={showCompactMode ? "hidden md:block" : "mb-4 md:mb-6"}>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-xl md:text-3xl font-bold">Derivatives Trading Dashboard</h1>
              <p className="text-muted-foreground text-sm md:text-base">Real-time portfolio monitoring and analytics</p>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              {supported && (
                <Button 
                  onClick={handleNotificationToggle}
                  variant="ghost" 
                  size="sm"
                  className="h-10 w-10 md:h-9 md:w-auto md:px-3"
                >
                  {subscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                  <span className="hidden md:inline ml-2">{subscribed ? 'On' : 'Off'}</span>
                </Button>
              )}
              <AgentNotificationIcon />
              <DataExport data={positions || []} filename="portfolio" />
              <ModeToggle />
              <KeyboardShortcutsHelp shortcuts={shortcuts} />
              <Button 
                onClick={() => setIsAddPositionOpen(true)} 
                variant="default" 
                size="sm"
                className="h-10 md:h-9"
              >
                <Plus className="mr-0 md:mr-2 h-4 w-4" />
                <span className="hidden md:inline">Add Position</span>
                <span className="md:hidden">Add</span>
                {pendingApprovals > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs">
                    {pendingApprovals}
                  </Badge>
                )}
              </Button>
              <Button 
                onClick={fetchData} 
                variant="outline" 
                size="sm"
                disabled={loading}
                className="h-10 md:h-9"
              >
                <RefreshCw className={cn("mr-0 md:mr-2 h-4 w-4", loading && "animate-spin")} />
                <span className="hidden md:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className={cn("mb-4", showCompactMode && "hidden md:block")}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Portfolio Summary Cards - Desktop */}
        {summary && (
          <div className={cn("hidden md:grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6", showCompactMode && "md:hidden")}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">BP at Risk</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${summary.totalBPAtRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-muted-foreground">Buying power tied up</p>
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
                )} />
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
                <p className="text-xs text-muted-foreground">vs max profit potential</p>
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
                <p className="text-xs text-muted-foreground">≤ 7 DTE</p>
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
                <p className="text-xs text-muted-foreground">Positions ITM</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Risk Distribution Bar - Desktop */}
        {Object.keys(riskDistribution).length > 0 && totalCollateral > 0 && (
          <Card className={cn("hidden md:block mb-6", showCompactMode && "md:hidden")}>
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

        {/* Market Context Panel - Desktop */}
        <div className={cn("hidden md:block mb-6", showCompactMode && "md:hidden")}>
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold">Market Context</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <IVRankHeatmap />
            <EarningsCalendar />
            <MacroSnapshot />
            <StrategySuggestions />
          </div>
        </div>

        {/* Mobile Content */}
        <div className="md:hidden">
          {mobileTab === 'dashboard' && summary && (
            <div>
              <div className="grid gap-3 grid-cols-2 mb-4">
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs text-muted-foreground">BP at Risk</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-1">
                    <div className="text-lg font-bold">
                      ${summary.totalBPAtRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs text-muted-foreground">Premium</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-1">
                    <div className="text-lg font-bold text-green-600">
                      +${summary.totalPremiumCollected.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <CompactMode positions={positions.filter(p => p.status === 'open')} loading={loading} />
            </div>
          )}

          {mobileTab === 'positions' && (
            <CompactMode 
              positions={positions.filter(p => p.status === 'open')} 
              loading={loading}
              onEdit={setEditPosition}
              onClose={setClosePosition}
              onRoll={setRollPosition}
            />
          )}

          {mobileTab === 'alerts' && (
            <ITMAlertBoard 
              onAcknowledge={handleAcknowledgeAlert}
              refreshInterval={30000}
            />
          )}

          {mobileTab === 'journal' && (
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base">Trade Journal</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <TradeJournal />
              </CardContent>
            </Card>
          )}

          {mobileTab === 'agent' && (
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Tabs value={activeAgentTab} onValueChange={setActiveAgentTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="approvals" className="flex-1">
                      Approvals
                      {pendingApprovals > 0 && (
                        <Badge variant="destructive" className="ml-1 text-xs">
                          {pendingApprovals}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="tasks" className="flex-1">Tasks</TabsTrigger>
                  </TabsList>
                  <TabsContent value="approvals" className="mt-4">
                    <ApprovalFlows />
                  </TabsContent>
                  <TabsContent value="tasks" className="mt-4">
                    <QuickTaskQueue />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Desktop Content */}
        <div className={cn("hidden md:block", showCompactMode && "md:hidden")}>
          {/* Resizable Dashboard Layout */}
          <ResizableDashboard 
            positions={positions.filter(p => p.status === 'open')} 
            isLoading={loading}
          />
        </div>
      </div>

      {/* Mobile Components */}
      <QuickActions 
        onAcknowledgeAll={handleAckAllAlerts}
        onAddNote={handleAddNote}
        pendingAlerts={summary?.itmAlertsCount || 0}
      />

      <MobileNav 
        activeTab={mobileTab}
        onTabChange={setMobileTab}
        alertsCount={summary?.itmAlertsCount || 0}
        pendingApprovals={pendingApprovals}
      />

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
