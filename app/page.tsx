'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PortfolioTable from "@/components/portfolio-table"
import DMAChart from "@/components/dma-chart"
import IVChart from "@/components/iv-chart"
import AlertPanel from "@/components/alert-panel"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Dashboard() {
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
                <div className="text-2xl font-bold">$124,567.89</div>
                <p className="text-xs text-muted-foreground">+2.5% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">P&L Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+$1,234.56</div>
                <p className="text-xs text-muted-foreground">+1.2% from yesterday</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">24</div>
                <p className="text-xs text-muted-foreground">3 expiring this week</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg IV</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">24.5%</div>
                <p className="text-xs text-muted-foreground">+3.2% from last week</p>
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
              <PortfolioTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>DMA Analysis</CardTitle>
                <CardDescription>
                  20-day moving average from historical price data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DMAChart />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Implied Volatility Curve</CardTitle>
                <CardDescription>
                  30-day implied volatility across portfolio positions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <IVChart />
              </CardContent>
            </Card>
          </div>
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