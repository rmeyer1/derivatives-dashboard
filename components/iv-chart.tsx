"use client"

import { useState, useEffect } from "react"
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts"
import { IVDataPoint } from "@/types/dashboard"

// Mock data for IV curve
const mockIVData: IVDataPoint[] = [
  { strike: 160, iv: 28.5 },
  { strike: 165, iv: 26.2 },
  { strike: 170, iv: 24.8 },
  { strike: 175, iv: 23.5 },
  { strike: 180, iv: 22.5 },
  { strike: 185, iv: 23.2 },
  { strike: 190, iv: 24.5 },
  { strike: 195, iv: 26.8 },
  { strike: 200, iv: 29.5 },
]

export default function IVChart() {
  const [data, setData] = useState<IVDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setData(mockIVData)
      setLoading(false)
    }, 500)
  }, [])

  if (loading) {
    return <div className="h-80 flex items-center justify-center">Loading chart data...</div>
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="strike" label={{ value: 'Strike Price', position: 'insideBottom', offset: -5 }} />
          <YAxis 
            label={{ 
              value: 'Implied Volatility %', 
              angle: -90, 
              position: 'insideLeft',
              offset: 10 
            }} 
          />
          <Tooltip 
            formatter={(value) => [`${value}%`, 'IV']}
            labelFormatter={(value) => `$${value}`}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="iv" 
            stroke="#ff7300" 
            activeDot={{ r: 8 }} 
            name="Implied Volatility"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}