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

// Backend API URL - can be overridden with env var
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface Position {
  id: string
  symbol: string
  type: string
  strike: number
  expiration: string
  quantity: number
  avgPrice: number
  marketPrice: number
  pnl: number
  iv: number
  delta: number
  gamma: number
  theta: number
  vega: number
}

export default function Dashboard() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/positions`, {
          cache: "no-store",
        })
        
        if (!response.ok) {
          throw new Error(`Backend error: ${response.status}`)
        }
        
        const data = await response.json()
        setPositions(data)
        setLoading(false)
      } catch (err) {
        console.error("Error fetching positions:", err)
        setError("Failed to load positions")
        setLoading(false)
      }
    }

    fetchPositions()
  }, [])

  // Calculate summary statistics from real data
  const totalValue = positions.reduce((sum, p) => sum + (p.marketPrice * p.quantity), 0)
  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0)
  const activePositions = positions.length
  const avgIV = positions.length > 0 
    ? positions.reduce((sum, p) => sum + p.iv, 0) / positions.length 
    : 0

  // Count expiring this week
  const now = new Date()
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const expiringThisWeek = positions.filter(p => {
    const expDate = new Date(p.expiration)
    return expDate <= oneWeekFromNow && expDate >= now
  }).length

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Derivatives Trading Dashboard</h1>
        <p className="text-muted-foreground">Real-time portfolio monitoring and analytics</p>
      </div>

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
                  {loading ? "..." : `$${totalValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                </div>
                <p className="text-xs text-muted-foreground">
                  {positions.length} position{positions.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">P&L Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {loading ? "..." : `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                </div>
                <p className="text-xs text-muted-foreground">
                  {positions.length > 0 ? `${((totalPnL / totalValue) * 100).toFixed(2)}%` : '-'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? "..." : activePositions}</div>
                <p className="text-xs text-muted-foreground">
                  {expiringThisWeek > 0 ? `${expiringThisWeek} expiring this week` : 'None expiring soon'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg IV</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? "..." : `${(avgIV * 100).toFixed(1)}%`}</div>
                <p className="text-xs text-muted-foreground">
                  Across all positions
                </p>
              </CardContent>
            </Card>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              Error: {error}. Make sure backend is running on {API_BASE_URL}
            </div>
          )}
          
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Positions</CardTitle>
              <CardDescription>
                Current options positions and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PortfolioTable initialPositions={positions} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>DMA Analysis by Ticker</CardTitle>
              <CardDescription>
                20-day moving average for each position
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
      </Tabs>
    </div>
  )
}
