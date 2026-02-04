"use client"

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Backend API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface DMAData {
  time: string;
  close: number;
  dma_50?: number;
  dma_200?: number;
}

interface DMAByTicker {
  [ticker: string]: DMAData[];
}

export default function DMACharts() {
  const [data, setData] = useState<DMAByTicker>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/dma-data-by-ticker`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        setData(result.tickers || {});
        setLoading(false);
      } catch (err) {
        console.error("Error fetching DMA data:", err);
        setError("Failed to load DMA data");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        Loading DMA data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-80 flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  const tickers = Object.keys(data);

  if (tickers.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-muted-foreground">
        No DMA data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tickers.map((ticker) => {
        const tickerData = data[ticker];
        const has200DMA = tickerData.some(d => d.dma_200 !== undefined);
        
        return (
          <div key={ticker} className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">{ticker} - Moving Averages</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={tickerData}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => `Date: ${value}`}
                    formatter={(value: number, name: string) => [
                      `$${value.toFixed(2)}`,
                      name,
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="close"
                    stroke="#333333"
                    strokeWidth={2}
                    dot={false}
                    name="Close Price"
                  />
                  <Line
                    type="monotone"
                    dataKey="dma_50"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    name="50-Day DMA"
                  />
                  {has200DMA && (
                    <Line
                      type="monotone"
                      dataKey="dma_200"
                      stroke="#dc2626"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="5 5"
                      name="200-Day DMA"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              Showing 50-day DMA {has200DMA && "and 200-day DMA"} for {tickerData.length} trading days
            </div>
          </div>
        );
      })}
    </div>
  );
}
