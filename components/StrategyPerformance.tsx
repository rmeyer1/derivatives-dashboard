"use client"

import { useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type StrategyPerformanceData = {
  strategy: string
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  avgRoc: number | null
  totalPnl: number
  avgTradePnl: number
}

interface StrategyPerformanceProps {
  data: StrategyPerformanceData[]
  loading?: boolean
}

const COLORS = [
  '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899',
  '#6366f1', '#14b8a6', '#f59e0b', '#64748b',
]

export default function StrategyPerformance({ data, loading = false }: StrategyPerformanceProps) {
  const chartData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      winRateNum: parseFloat(item.winRate.toFixed(1)),
      avgRocNum: item.avgRoc ? parseFloat(item.avgRoc.toFixed(1)) : 0,
    }))
  }, [data])

  const totals = useMemo(() => {
    const totalTrades = data.reduce((sum, item) => sum + item.totalTrades, 0)
    const winningTrades = data.reduce((sum, item) => sum + item.winningTrades, 0)
    const totalPnl = data.reduce((sum, item) => sum + item.totalPnl, 0)
    const avgWinRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0
    
    const validRocValues = data.filter(item => item.avgRoc !== null).map(item => item.avgRoc!)
    const avgRoc = validRocValues.length > 0 
      ? validRocValues.reduce((sum, val) => sum + val, 0) / validRocValues.length 
      : 0

    return {
      totalTrades,
      winningTrades,
      losingTrades: totalTrades - winningTrades,
      winRate: avgWinRate,
      totalPnl,
      avgRoc,
    }
  }, [data])

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const getPnlColor = (value: number) => {
    return value >= 0 ? 'text-green-600' : 'text-red-600'
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Trades</CardDescription>
            <CardTitle className="text-3xl">{totals.totalTrades}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {totals.winningTrades} wins / {totals.losingTrades} losses
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overall Win Rate</CardDescription>
            <CardTitle className={cn("text-3xl", getPnlColor(totals.winRate - 50))}>
              {formatPercent(totals.winRate)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {totals.winRate >= 50 ? 'Above 50%' : 'Below 50%'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total P&L</CardDescription>
            <CardTitle className={cn("text-3xl", getPnlColor(totals.totalPnl))}>
              {formatCurrency(totals.totalPnl)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {totals.totalPnl >= 0 ? 'Profitable' : 'Negative'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg ROC</CardDescription>
            <CardTitle className={cn("text-3xl", getPnlColor(totals.avgRoc))}>
              {formatPercent(totals.avgRoc)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Return on Capital
            </div>
          </CardContent>
        </Card>
      </div>

      {data.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Win Rate by Strategy</CardTitle>
              <CardDescription>Percentage of profitable trades per strategy</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="strategy" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft' }}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Win Rate']}
                      labelStyle={{ color: '#000' }}
                    />
                    
                    <Bar dataKey="winRateNum" name="Win Rate %">
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trade Distribution</CardTitle>
              <CardDescription>Number of trades by strategy</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="totalTrades"
                      nameKey="strategy"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ strategy, totalTrades }) => `${strategy}: ${totalTrades}`}
                      labelLine={false}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [value, 'Trades']}
                      labelStyle={{ color: '#000' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Strategy Performance Details</CardTitle>
          <CardDescription>Complete breakdown by strategy type</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No closed trades found. Complete some trades to see performance metrics.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Strategy</TableHead>
                    <TableHead className="text-right">Trades</TableHead>
                    <TableHead className="text-right">Wins</TableHead>
                    <TableHead className="text-right">Losses</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                    <TableHead className="text-right">Avg ROC</TableHead>
                    <TableHead className="text-right">Total P&L</TableHead>
                    <TableHead className="text-right">Avg Trade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.strategy}>
                      <TableCell className="font-medium">{item.strategy}</TableCell>
                      <TableCell className="text-right">{item.totalTrades}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {item.winningTrades}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {item.losingTrades}
                      </TableCell>
                      <TableCell className={cn("text-right font-semibold", getPnlColor(item.winRate - 50))}>
                        {formatPercent(item.winRate)}
                      </TableCell>
                      <TableCell className={cn("text-right", getPnlColor(item.avgRoc || 0))}>
                        {item.avgRoc !== null ? formatPercent(item.avgRoc) : 'N/A'}
                      </TableCell>
                      <TableCell className={cn("text-right font-semibold", getPnlColor(item.totalPnl))}>
                        {formatCurrency(item.totalPnl)}
                      </TableCell>
                      <TableCell className={cn("text-right", getPnlColor(item.avgTradePnl))}>
                        {formatCurrency(item.avgTradePnl)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
