'use client'

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PortfolioTable from "@/components/portfolio-table"
import DMACharts from "@/components/dma-charts"
import IVCharts from "@/components/iv-charts"
import AlertPanel from "@/components/alert-panel"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Bell, BellOff } from "lucide-react"
import { useDashboardData } from "@/lib/hooks/useDashboardData"
import { useNotifications } from "@/lib/hooks/useNotifications"
import { formatLastUpdated } from "@/lib/utils/marketHours"
import CompactMode from "@/components/CompactMode"
import QuickActions from "@/components/QuickActions"
import { MobileNav } from "@/components/MobileNav"

type MobileTab = 'dashboard' | 'positions' | 'alerts' | 'journal'

export default function Dashboard() {
  const [mobileTab, setMobileTab] = useState<MobileTab>('dashboard')
  const [pendingAlerts, setPendingAlerts] = useState(0)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  
  const {
    positions,
    ivData,
    dmaData,
    alerts,
    lastUpdated,
    isLoading,
    error,
    refetchAll
  } = useDashboardData()

  const {
    permission,
    supported,
    subscribed,
    loading: notificationsLoading,
    requestPermission,
    subscribe,
    unsubscribe
  } = useNotifications('default')

  // Count pending alerts
  useEffect(() => {
    if (alerts) {
      setPendingAlerts(alerts.filter(a => !a.read).length)
    }
  }, [alerts])

  // Toast display
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  // Handle ack all alerts
  const handleAckAllAlerts = () => {
    setToastMessage(`Acknowledged ${pendingAlerts} alert${pendingAlerts !== 1 ? 's' : ''}`)
    setPendingAlerts(0)
  }

  // Handle add note
  const handleAddNote = () => {
    setToastMessage('Note dialog opened!')
  }

  // Handle notification subscription
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

  // Determine the earliest last updated time
  const getLastUpdatedTime = () => {
    const times = Object.values(lastUpdated).filter(Boolean) as number[]
    return times.length > 0 ? Math.min(...times) : null
  }

  const lastUpdatedTime = getLastUpdatedTime()
  const isStale = lastUpdatedTime && (Date.now() - lastUpdatedTime) > 60000

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
          <div className="flex justify-between items-start md:items-center">
            <div>
              <h1 className="text-xl md:text-3xl font-bold">Derivatives Trading Dashboard</h1>
              <p className="text-muted-foreground text-sm md:text-base">Real-time portfolio monitoring and analytics</p>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              {supported && (
                <Button 
                  onClick={handleNotificationToggle}
                  variant="ghost" 
                  size="sm"
                  className="h-10 w-10 md:h-9 md:w-auto md:px-3"
                >
                  {subscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                  <span className="hidden md:inline">{subscribed ? 'On' : 'Off'}</span>
                </Button>
              )}
              <Button onClick={refetchAll} variant="outline" size="sm" className="h-10 md:h-9">
                <RefreshCw className="mr-0 md:mr-2 h-4 w-4" />
                <span className="hidden md:inline">Refresh</span>
              </Button>
              {lastUpdatedTime && (
                <span className="hidden md:inline text-sm text-muted-foreground">
                  Last updated: {formatLastUpdated(lastUpdatedTime)}
                </span>
              )}
            </div>
          </div>
        </div>

        {(isLoading || isStale) && (
          <div className={showCompactMode ? "hidden md:block" : "mb-4"}>
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
              {isLoading ? "Loading data..." : "Data is stale (older than 60s)"}
            </div>
          </div>
        )}

        {error && (
          <div className={showCompactMode ? "hidden md:block" : "mb-4"}>
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              Error: {error.message || "Failed to load data"}
            </div>
          </div>
        )}

        {/* Mobile Content */}
        <div className="md:hidden">
          {mobileTab === 'dashboard' && (
            <div>
              <div className="grid gap-3 grid-cols-2 mb-4">
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs text-muted-foreground">Total Value</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-1">
                    <div className="text-lg font-bold">
                      {isLoading ? "..." : `$${(positions?.reduce((sum, p) => sum + (p.marketPrice * p.quantity), 0) || 0).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs text-muted-foreground">P&L Today</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-1">
                    <div className={`text-lg font-bold ${(positions?.reduce((sum, p) => sum + p.pnl, 0) || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {isLoading ? "..." : `${(positions?.reduce((sum, p) => sum + p.pnl, 0) || 0) >= 0 ? '+' : ''}$${(positions?.reduce((sum, p) => sum + p.pnl, 0) || 0).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <CompactMode positions={positions || []} loading={isLoading} />
            </div>
          )}

          {mobileTab === 'positions' && (
            <CompactMode positions={positions || []} loading={isLoading} />
          )}

          {mobileTab === 'alerts' && (
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base">Alerts &amp; Notifications</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <AlertPanel />
              </CardContent>
            </Card>
          )}

          {mobileTab === 'journal' && (
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base">Trade Journal</CardTitle>
                <CardDescription>Coming soon...</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm text-muted-foreground">
                  Trade journal functionality will be available in a future update.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Desktop Content */}
        <div className="hidden md:block">
          <Tabs defaultValue="portfolio" className="space-y-4">
            <TabsList>
              <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
              <TabsTrigger value="charts">Charts</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>

            <TabsContent value="portfolio" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {isLoading ? "..." : `$${(positions?.reduce((sum, p) => sum + (p.marketPrice * p.quantity), 0) || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(positions?.length || 0)} position{(positions?.length !== 1 ? 's' : '')}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">P&L Today</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${(positions?.reduce((sum, p) => sum + p.pnl, 0) || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {isLoading ? "..." : `${(positions?.reduce((sum, p) => sum + p.pnl, 0) || 0) >= 0 ? '+' : ''}$${(positions?.reduce((sum, p) => sum + p.pnl, 0) || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {positions && positions.length > 0 ? 
                        `${(((positions?.reduce((sum, p) => sum + p.pnl, 0) || 0) / (positions?.reduce((sum, p) => sum + (p.marketPrice * p.quantity), 0) || 1)) * 100).toFixed(2)}%` : 
                        '-'
                      }
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{isLoading ? "..." : (positions?.length || 0)}</div>
                    <p className="text-xs text-muted-foreground">
                      {(positions?.filter(p => {
                        const now = new Date();
                        const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                        const expDate = new Date(p.expiration);
                        return expDate <= oneWeekFromNow && expDate >= now;
                      }).length || 0) > 0 ? 
                        `${positions?.filter(p => {
                          const now = new Date();
                          const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                          const expDate = new Date(p.expiration);
                          return expDate <= oneWeekFromNow && expDate >= now;
                        }).length || 0} expiring this week` : 
                        'None expiring soon'
                      }
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg IV</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {isLoading ? "..." : `${((positions?.reduce((sum, p) => sum + p.iv, 0) || 0) / (positions?.length || 1) * 100).toFixed(1)}%`}
                    </div>
                    <p className="text-xs text-muted-foreground">Across all positions</p>
                  </CardContent>
                </Card>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Positions</CardTitle>
                  <CardDescription>Current options positions and performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <PortfolioTable initialPositions={positions || []} loading={isLoading} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="charts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>DMA Analysis by Ticker</CardTitle>
                  <CardDescription>50-day and 200-day moving averages for each position</CardDescription>
                </CardHeader>
                <CardContent>
                  <DMACharts />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Implied Volatility by Ticker</CardTitle>
                  <CardDescription>Historical IV with 52-week high/low reference lines</CardDescription>
                </CardHeader>
                <CardContent>
                  <IVCharts />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="alerts">
              <Card>
                <CardHeader>
                  <CardTitle>Alerts &amp; Notifications</CardTitle>
                  <CardDescription>Real-time alerts for your portfolio positions</CardDescription>
                </CardHeader>
                <CardContent>
                  <AlertPanel />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Mobile Components */}
      <QuickActions 
        onAcknowledgeAll={handleAckAllAlerts}
        onAddNote={handleAddNote}
        pendingAlerts={pendingAlerts}
      />

      <MobileNav 
        activeTab={mobileTab}
        onTabChange={setMobileTab}
        alertsCount={pendingAlerts}
      />
    </div>
  )
}
