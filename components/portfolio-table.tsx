"use client"

import { useState, useEffect } from "react"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { PortfolioItem } from "@/types/dashboard"

// Backend API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface PortfolioTableProps {
  initialPositions?: PortfolioItem[]
  loading?: boolean
}

export default function PortfolioTable({ initialPositions, loading: initialLoading }: PortfolioTableProps) {
  const [positions, setPositions] = useState<PortfolioItem[]>(initialPositions || [])
  const [loading, setLoading] = useState(initialLoading !== undefined ? initialLoading : true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If initialPositions provided, use those
    if (initialPositions && initialPositions.length > 0) {
      setPositions(initialPositions)
      setLoading(false)
      return
    }

    // Otherwise fetch directly from backend
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/positions`, {
          cache: "no-store",
        })
        
        if (!response.ok) {
          throw new Error(`Backend error: ${response.status}`)
        }
        
        const data: PortfolioItem[] = await response.json()
        setPositions(data)
        setLoading(false)
      } catch (err) {
        console.error("Error fetching positions:", err)
        setError("Failed to load positions data")
        setLoading(false)
      }
    }

    fetchData()
  }, [initialPositions])

  if (loading) {
    return <div>Loading portfolio data...</div>
  }

  if (error) {
    return <div className="text-red-500">{error}</div>
  }

  if (positions.length === 0) {
    return <div className="text-muted-foreground">No positions found</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Symbol</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Strike</TableHead>
          <TableHead>Expiration</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead className="text-right">Avg Price</TableHead>
          <TableHead className="text-right">Market Price</TableHead>
          <TableHead className="text-right">P&L</TableHead>
          <TableHead className="text-right">IV %</TableHead>
          <TableHead className="text-right">Delta</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {positions.map((position) => (
          <TableRow key={position.id}>
            <TableCell className="font-medium">{position.symbol}</TableCell>
            <TableCell>{position.type}</TableCell>
            <TableCell>${position.strike.toFixed(2)}</TableCell>
            <TableCell>{new Date(position.expiration).toLocaleDateString()}</TableCell>
            <TableCell className="text-right">{position.quantity}</TableCell>
            <TableCell className="text-right">${position.avgPrice.toFixed(2)}</TableCell>
            <TableCell className="text-right">${position.marketPrice.toFixed(2)}</TableCell>
            <TableCell className={`text-right ${position.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
              ${position.pnl.toFixed(2)}
            </TableCell>
            <TableCell className="text-right">{(position.iv * 100).toFixed(1)}%</TableCell>
            <TableCell className={`text-right ${position.delta >= 0 ? "text-green-600" : "text-red-600"}`}>
              {position.delta.toFixed(2)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
