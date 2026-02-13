"use client"

import { useState, useCallback } from "react"
import { RefreshCw } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { DataExport } from "@/components/data-export"
import { ResizableDashboard } from "@/components/resizable-dashboard"
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help"
import { useDashboardData } from "@/lib/hooks/useDashboardData"
import { useDashboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts"
import { formatLastUpdated } from "@/lib/utils/marketHours"
import { useToast } from "@/hooks/use-toast"

export default function Dashboard() {
  const { toast } = useToast()
  const {
    positions,
    ivData,
    dmaData,
    alerts,
    lastUpdated,
    isLoading,
    error,
    refetchAll
  } = useDashboardData();

  const [showShortcuts, setShowShortcuts] = useState(false)

  // Determine the earliest last updated time
  const getLastUpdatedTime = () => {
    const times = Object.values(lastUpdated).filter(Boolean) as number[];
    return times.length > 0 ? Math.min(...times) : null;
  };

  const lastUpdatedTime = getLastUpdatedTime();
  const isStale = lastUpdatedTime && (Date.now() - lastUpdatedTime) > 60000; // 60 seconds

  // Define actions for keyboard shortcuts
  const handleAddPosition = useCallback(() => {
    toast({
      title: "Add Position",
      description: "Add position functionality coming soon!",
    })
  }, [toast])

  const handleExport = useCallback(() => {
    // Trigger export via DataExport component
    const exportButton = document.querySelector('[aria-label="Export data"]') as HTMLElement
    exportButton?.click()
  }, [])

  // Setup keyboard shortcuts
  const shortcuts = useDashboardShortcuts({
    onRefresh: refetchAll,
    onExport: handleExport,
    onAddPosition: handleAddPosition,
    onShowHelp: () => setShowShortcuts(true),
  })

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Derivatives Trading Dashboard</h1>
          <p className="text-muted-foreground">Real-time portfolio monitoring and analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={refetchAll} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <DataExport data={positions || []} filename="portfolio" />
          <ModeToggle />
          <KeyboardShortcutsHelp shortcuts={shortcuts} />
          {lastUpdatedTime && (
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Last updated: {formatLastUpdated(lastUpdatedTime)}
            </span>
          )}
        </div>
      </div>

      {/* Alerts */}
      {(isLoading || isStale) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded mb-4">
          {isLoading ? "Loading data..." : "Data is stale (older than 60s)"}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
          Error: {error.message || "Failed to load data"}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
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
            <div className={`text-2xl font-bold ${(positions?.reduce((sum, p) => sum + p.pnl, 0) || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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
            <p className="text-xs text-muted-foreground">
              Across all positions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Resizable Dashboard */}
      <ResizableDashboard positions={positions || []} isLoading={isLoading} />
    </div>
  )
}
