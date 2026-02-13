'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PortfolioTable from "@/components/portfolio-table"
import DMACharts from "@/components/dma-charts"
import IVCharts from "@/components/iv-charts"
import AlertPanel from "@/components/alert-panel"
import { AgentActionsLog } from "@/components/agent-actions-log"
import { QuickTaskQueue } from "@/components/quick-task-queue"
import { ApprovalFlows } from "@/components/approval-flows"
import { AgentNotificationIcon } from "@/components/agent-notification-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { RefreshCw, Bot } from "lucide-react"
import { useDashboardData } from "@/lib/hooks/useDashboardData"
import { formatLastUpdated } from "@/lib/utils/marketHours"
import { ApprovalsResponse } from "@/types/agent"

export default function Dashboard() {
  const [activeAgentTab, setActiveAgentTab] = useState('approvals')
  const [pendingApprovals, setPendingApprovals] = useState(0)
  
  const {
    positions,
    lastUpdated,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetchAll: refetchDashboard
  } = useDashboardData()

  // Fetch pending approval count for badge
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const response = await fetch('/api/agent/approvals')
        if (response.ok) {
          const data: ApprovalsResponse = await response.json()
          setPendingApprovals(data.pendingCount)
        }
      } catch {
        // Ignore errors - badge is decorative
      }
    }
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [])

  const refetchAll = () => {
    refetchDashboard()
    // Agent components have their own refresh logic
  }

  // Determine the earliest last updated time
  const getLastUpdatedTime = () => {
    const times = Object.values(lastUpdated).filter(Boolean) as number[]
    return times.length > 0 ? Math.min(...times) : null
  }

  const lastUpdatedTime = getLastUpdatedTime()
  const isStale = lastUpdatedTime && (Date.now() - lastUpdatedTime) > 60000

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Derivatives Trading Dashboard</h1>
          <p className="text-muted-foreground">Real-time portfolio monitoring and analytics</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/agent" className="hidden md:flex">
            <Button variant="outline" size="sm">
              <Bot className="mr-2 h-4 w-4" />
              Agent
              {pendingApprovals > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">
                  {pendingApprovals}
                </Badge>
              )}
            </Button>
          </Link>
          
          <AgentNotificationIcon />
          
          <Button onClick={refetchAll} variant="outline" size="sm">
            <RefreshCw className={cn("mr-2 h-4 w-4", dashboardLoading && "animate-spin")} />
            Refresh
          </Button>
          
          {lastUpdatedTime && (
            <span className="text-sm text-muted-foreground">
              Last updated: {formatLastUpdated(lastUpdatedTime)}
            </span>
          )}
        </div>
      </div>

      {(dashboardLoading || isStale) && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-4">
          {dashboardLoading ? "Loading data..." : "Data is stale (older than 60s)"}
        </div>
      )}

      {dashboardError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          Error: {dashboardError.message || "Failed to load data"}
        </div>
      )}

      <Tabs defaultValue="portfolio" className="space-y-4">
        <TabsList>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="agent" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agent
            {pendingApprovals > 0 && (
              <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardLoading ? "..." : `$${(positions?.reduce((sum, p) => sum + (p.marketPrice * p.quantity), 0) || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
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
                  {dashboardLoading ? "..." : `${(positions?.reduce((sum, p) => sum + p.pnl, 0) || 0) >= 0 ? '+' : ''}$${(positions?.reduce((sum, p) => sum + p.pnl, 0) || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
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
                <div className="text-2xl font-bold">{dashboardLoading ? "..." : (positions?.length || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  {(positions?.filter(p => {
                    const now = new Date()
                    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
                    const expDate = new Date(p.expiration)
                    return expDate <= oneWeekFromNow && expDate >= now
                  }).length || 0) > 0 ? 
                    `${positions?.filter(p => {
                      const now = new Date()
                      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
                      const expDate = new Date(p.expiration)
                      return expDate <= oneWeekFromNow && expDate >= now
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
                  {dashboardLoading ? "..." : `${((positions?.reduce((sum, p) => sum + p.iv, 0) || 0) / (positions?.length || 1) * 100).toFixed(1)}%`}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all positions
                </p>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Positions</CardTitle>
              <CardDescription>
                Current options positions and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PortfolioTable initialPositions={positions || []} loading={dashboardLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>DMA Analysis by Ticker</CardTitle>
              <CardDescription>
                50-day and 200-day moving averages for each position
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DMACharts />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Implied Volatility by Ticker</CardTitle>
              <CardDescription>
                Historical IV with 52-week high/low reference lines
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IVCharts />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Alerts & Notifications</CardTitle>
              <CardDescription>
                Real-time alerts for your portfolio positions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agent" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Bot className="h-6 w-6" />
                Agent Collaboration
              </h2>
              <p className="text-muted-foreground">
                Work alongside your AI trading assistant
              </p>
            </div>
          </div>
          
          <Tabs value={activeAgentTab} onValueChange={setActiveAgentTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="approvals" className="flex items-center gap-2">
                Trade Approvals
                {pendingApprovals > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {pendingApprovals}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="tasks">
                Task Queue
              </TabsTrigger>
              <TabsTrigger value="activity">
                Activity Log
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="approvals">
              <ApprovalFlows />
            </TabsContent>
            
            <TabsContent value="tasks">
              <QuickTaskQueue />
            </TabsContent>
            
            <TabsContent value="activity">
              <AgentActionsLog />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  )
}
