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

export default function PortfolioTable() {
  const [positions, setPositions] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/positions")
        const data: PortfolioItem[] = await response.json()
        setPositions(data)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching positions:", error)
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <div>Loading portfolio data...</div>
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
            <TableCell className="text-right">{position.iv.toFixed(1)}%</TableCell>
            <TableCell className={`text-right ${position.delta >= 0 ? "text-green-600" : "text-red-600"}`}>
              {position.delta.toFixed(2)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}