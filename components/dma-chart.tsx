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
import { DMADataPoint } from "@/types/dashboard"

export default function DMAChart() {
  const [data, setData] = useState<DMADataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/dma-data")
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const result: DMADataPoint[] = await response.json()
        setData(result)
        setLoading(false)
      } catch (err) {
        console.error("Error fetching DMA data:", err)
        setError("Failed to load DMA data")
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <div className="h-80 flex items-center justify-center">Loading DMA data...</div>
  }

  if (error) {
    return <div className="h-80 flex items-center justify-center text-red-500">{error}</div>
  }

  if (data.length === 0) {
    return <div className="h-80 flex items-center justify-center text-muted-foreground">No DMA data available</div>
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
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#8884d8" 
            activeDot={{ r: 8 }} 
            name="20-Day Moving Average"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
