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

// Mock data for DMA chart
const mockDMAData: DMADataPoint[] = [
  { time: "09:30", value: 180.25 },
  { time: "10:00", value: 181.50 },
  { time: "10:30", value: 182.75 },
  { time: "11:00", value: 181.20 },
  { time: "11:30", value: 183.40 },
  { time: "12:00", value: 184.10 },
  { time: "12:30", value: 183.80 },
  { time: "13:00", value: 185.20 },
  { time: "13:30", value: 184.90 },
  { time: "14:00", value: 186.30 },
  { time: "14:30", value: 187.10 },
  { time: "15:00", value: 186.75 },
  { time: "15:30", value: 187.50 },
  { time: "16:00", value: 188.25 },
]

export default function DMAChart() {
  const [data, setData] = useState<DMADataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setData(mockDMAData)
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
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#8884d8" 
            activeDot={{ r: 8 }} 
            name="Delta Adjusted Price"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}