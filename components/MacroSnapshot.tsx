"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Activity, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MacroData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sparkline: { time: string; value: number }[];
}

interface MacroResponse {
  data: MacroData[];
  timestamp: string;
}

export default function MacroSnapshot() {
  const [data, setData] = useState<MacroData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/market/macro');
        if (!response.ok) {
          throw new Error(`Failed to fetch macro data: ${response.status}`);
        }
        const result: MacroResponse = await response.json();
        setData(result.data || []);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching macro data:", err);
        setError("Failed to load market data");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  const formatPrice = (value: number) => `$${value.toFixed(2)}`;

  // Simple SVG sparkline component
  const Sparkline = ({ data, color }: { data: { time: string; value: number }[], color: string }) => {
    if (!data || data.length < 2) return null;
    
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    
    const width = 100;
    const height = 30;
    const padding = 2;
    
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
      const y = height - ((d.value - min) / range) * (height - 2 * padding) - padding;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-lg">Market Snapshot</CardTitle>
          </div>
          <CardDescription>SPY, QQQ, VIX at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-lg">Market Snapshot</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-red-500 text-sm text-center py-4">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-emerald-500" />
          <CardTitle className="text-lg">Market Snapshot</CardTitle>
        </div>
        <CardDescription>Key market indices and volatility</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No market data available
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {data.map((item) => {
              const isPositive = item.change >= 0;
              const isVIX = item.symbol === 'VIX';
              // For VIX, red means high volatility (bad), green means low (good)
              // For others, green means up, red means down
              const colorClass = isVIX
                ? (isPositive ? 'text-red-600' : 'text-green-600')
                : (isPositive ? 'text-green-600' : 'text-red-600');
              const sparklineColor = isVIX
                ? (isPositive ? '#dc2626' : '#16a34a')
                : (isPositive ? '#16a34a' : '#dc2626');

              return (
                <div 
                  key={item.symbol} 
                  className="p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-bold text-lg">{item.symbol}</span>
                      <p className="text-xs text-muted-foreground">{item.name}</p>
                    </div>
                    <div className={colorClass}>
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>

                  <div className="mb-2">
                    <span className="text-xl font-bold">{formatPrice(item.price)}</span>
                    <span className={cn("text-sm ml-2", colorClass)}>
                      {formatPercent(item.changePercent)}
                    </span>
                  </div>

                  <div className="h-8">
                    <Sparkline data={item.sparkline} color={sparklineColor} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
