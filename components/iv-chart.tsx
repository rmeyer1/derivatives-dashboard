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

// Backend API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function IVChart() {
  const [data, setData] = useState<IVDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/iv-data`)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const result: IVDataPoint[] = await response.json()
        setData(result)
        setLoading(false)
      } catch (err) {
        console.error("Error fetching IV data:", err)
        setError("Failed to load IV data")
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <div className="h-80 flex items-center justify-center">Loading IV data...</div>
  }

  if (error) {
    return <div className="h-80 flex items-center justify-center text-red-500">{error}</div>
  }

  if (data.length === 0) {
    return <div className="h-80 flex items-center justify-center text-muted-foreground">No IV data available</div>
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
          <XAxis dataKey="strike" label={{ value: 'Ticker Index', position: 'insideBottom', offset: -5 }} />
          <YAxis 
            label={{ 
              value: 'Implied Volatility %', 
              angle: -90, 
              position: 'insideLeft',
              offset: 10 
            }} 
          />
          <Tooltip 
            formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'IV']}
            labelFormatter={(value) => `Position ${value}`}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="iv" 
            stroke="#ff7300" 
            activeDot={{ r: 8 }} 
            name="30-Day Implied Volatility"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
