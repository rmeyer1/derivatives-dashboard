"use client"

import * as React from "react"
import { Responsive as ResponsiveGridLayout } from "react-grid-layout"
import type { Layout, ResponsiveLayouts } from "react-grid-layout"
import { GripVertical } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import PortfolioTable from "./portfolio-table"
import DMACharts from "./dma-charts"
import IVCharts from "./iv-charts"
import AlertPanel from "./alert-panel"

// Import react-grid-layout styles
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"

interface ResizableDashboardProps {
  positions: any[]
  isLoading: boolean
}

interface DashboardLayouts {
  lg: Layout
  md: Layout
  sm: Layout
}

const defaultLayouts: Dashboardlayouts = {
  lg: [
    { i: "portfolio", x: 0, y: 0, w: 12, h: 16, minW: 6, minH: 8 },
    { i: "dma", x: 0, y: 16, w: 6, h: 12, minW: 4, minH: 8 },
    { i: "iv", x: 6, y: 16, w: 6, h: 12, minW: 4, minH: 8 },
    { i: "alerts", x: 0, y: 28, w: 12, h: 10, minW: 4, minH: 6 },
  ] as Layout,
  md: [
    { i: "portfolio", x: 0, y: 0, w: 10, h: 16, minW: 6, minH: 8 },
    { i: "dma", x: 0, y: 16, w: 5, h: 12, minW: 4, minH: 8 },
    { i: "iv", x: 5, y: 16, w: 5, h: 12, minW: 4, minH: 8 },
    { i: "alerts", x: 0, y: 28, w: 10, h: 10, minW: 4, minH: 6 },
  ] as Layout,
  sm: [
    { i: "portfolio", x: 0, y: 0, w: 6, h: 16, minW: 4, minH: 8 },
    { i: "dma", x: 0, y: 16, w: 6, h: 12, minW: 4, minH: 8 },
    { i: "iv", x: 0, y: 28, w: 6, h: 12, minW: 4, minH: 8 },
    { i: "alerts", x: 0, y: 40, w: 6, h: 10, minW: 4, minH: 6 },
  ] as Layout,
}

const STORAGE_KEY = "derivatives-dashboard-layout"

export function ResizableDashboard({
  positions,
  isLoading,
}: ResizableDashboardProps) {
  const [mounted, setMounted] = React.useState(false)
  const [layouts, setLayouts] = React.useState<DashboardLayouts>(defaultLayouts)

  // Load layouts from localStorage on mount
  React.useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setLayouts(parsed)
      } catch (e) {
        console.error("Failed to parse saved layout:", e)
      }
    }
  }, [])

  // Save layouts to localStorage when they change
  const handleLayoutChange = (
    currentLayout: Layout,
    allLayouts: ResponsiveLayouts
  ) => {
    setLayouts(allLayouts as DashboardLayouts)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allLayouts))
  }

  if (!mounted) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <PortfolioTable initialPositions={positions} loading={isLoading} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768 }}
      cols={{ lg: 12, md: 10, sm: 6 }}
      rowHeight={30}
      onLayoutChange={handleLayoutChange}
      draggableHandle=".drag-handle"
      isResizable={true}
      isDraggable={true}
    >
      <div key="portfolio">
        <Card className="h-full overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Portfolio Positions</CardTitle>
            <div className="drag-handle cursor-move p-1">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="h-[calc(100%-60px)] overflow-auto">
            <PortfolioTable initialPositions={positions} loading={isLoading} />
          </CardContent>
        </Card>
      </div>

      <div key="dma">
        <Card className="h-full overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>DMA Analysis</CardTitle>
            <div className="drag-handle cursor-move p-1">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="h-[calc(100%-60px)] overflow-auto">
            <DMACharts />
          </CardContent>
        </Card>
      </div>

      <div key="iv">
        <Card className="h-full overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Implied Volatility</CardTitle>
            <div className="drag-handle cursor-move p-1">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="h-[calc(100%-60px)] overflow-auto">
            <IVCharts />
          </CardContent>
        </Card>
      </div>

      <div key="alerts">
        <Card className="h-full overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Alerts</CardTitle>
            <div className="drag-handle cursor-move p-1">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="h-[calc(100%-60px)] overflow-auto">
            <AlertPanel />
          </CardContent>
        </Card>
      </div>
    </ResponsiveGridLayout>
  )
}
