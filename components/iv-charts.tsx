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
  ReferenceLine,
} from "recharts";

// Backend API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface IVData {
  date: string;
  iv: number;
  iv_52wk_high?: number;
  iv_52wk_low?: number;
}

interface IVByTicker {
  [ticker: string]: IVData[];
}

export default function IVCharts() {
  const [data, setData] = useState<IVByTicker>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/iv-data-by-ticker`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        setData(result.tickers || {});
        setLoading(false);
      } catch (err) {
        console.error("Error fetching IV data:", err);
        setError("Failed to load IV data");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        Loading IV data...
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
        No IV data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tickers.map((ticker) => {
        const tickerData = data[ticker];
        const high52wk = tickerData[0]?.iv_52wk_high;
        const low52wk = tickerData[0]?.iv_52wk_low;
        const avgIV =
          tickerData.reduce((sum, d) => sum + d.iv, 0) / tickerData.length;

        return (
          <div key={ticker} className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{ticker} - Implied Volatility History</h3>
              <div className="text-sm text-muted-foreground">
                Avg: {(avgIV * 100).toFixed(1)}%
                {high52wk && low52wk && (
                  <span className="ml-2">
                    | 52wk Range: {(low52wk * 100).toFixed(1)}% -{" "}
                    {(high52wk * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
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
                    dataKey="date"
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis
                    tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                    domain={[
                      (dataMin: number) =>
                        Math.max(0, dataMin * 0.9),
                      (dataMax: number) => dataMax * 1.1,
                    ]}
                  />
                  <Tooltip
                    labelFormatter={(value) => `Date: ${value}`}
                    formatter={(value: number, name: string) => [
                      `${(value * 100).toFixed(1)}%`,
                      name === "iv" ? "Implied Volatility" : name,
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="iv"
                    stroke="#ff7300"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Implied Volatility"
                  />
                  {high52wk && (
                    <ReferenceLine
                      y={high52wk}
                      stroke="red"
                      strokeDasharray="3 3"
                      label="52wk High"
                    />
                  )}
                  {low52wk && (
                    <ReferenceLine
                      y={low52wk}
                      stroke="green"
                      strokeDasharray="3 3"
                      label="52wk Low"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
