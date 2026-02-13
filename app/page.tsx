'use client'

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PortfolioTable from "@/components/portfolio-table"
import DMAChart from "@/components/dma-chart"
import IVChart from "@/components/iv-chart"
import DMACharts from "@/components/dma-charts"
import IVCharts from "@/components/iv-charts"
import AlertPanel from "@/components/alert-panel"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useDashboardData } from "@/lib/hooks/useDashboardData"
import { formatLastUpdated } from "@/lib/utils/marketHours"
import TradeJournal from "@/components/TradeJournal"

export default function Dashboard() {
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

  // Determine the earliest last updated time
  const getLastUpdatedTime = () => {
    const times = Object.values(lastUpdated).filter(Boolean) as number[];
    return times.length > 0 ? Math.min(...times) : null;
  };

  const lastUpdatedTime = getLastUpdatedTime();
  const isStale = lastUpdatedTime && (Date.now() - lastUpdatedTime) > 60000; // 60 seconds

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Derivatives Trading Dashboard</h1>
          <p className="text-muted-foreground">Real-time portfolio monitoring and analytics</p>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={refetchAll} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {lastUpdatedTime && (
            <span className="text-sm text-muted-foreground">
              Last updated: {formatLastUpdated(lastUpdatedTime)}
            </span>
          )}
        </div>
      </div>

      {(isLoading || isStale) && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-4">
          {isLoading ? "Loading data..." : "Data is stale (older than 60s)"}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error.message || "Failed to load data"}
        </div>
      )}

      <Tabs defaultValue="portfolio" className="space-y-4">
        <TabsList>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="journal">Trade Journal</TabsTrigger>
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
              <PortfolioTable initialPositions={positions || []} loading={isLoading} />
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

        <TabsContent value="journal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trade Journal & History</CardTitle>
              <CardDescription>
                Track all your trades, analyze strategy performance, and manage assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TradeJournal />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
