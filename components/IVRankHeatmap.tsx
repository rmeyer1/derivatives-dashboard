"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface IVRankItem {
  ticker: string;
  ivRank: number; // 0-100
  ivPercentile: number; // 0-100
  currentIV: number;
  iv52WeekHigh: number;
  iv52WeekLow: number;
  impliedMove: number; // expected move %
  lastUpdated: string;
}

interface IVRankResponse {
  data: IVRankItem[];
  timestamp: string;
}

export default function IVRankHeatmap() {
  const [data, setData] = useState<IVRankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/market/iv-ranks');
        if (!response.ok) {
          throw new Error(`Failed to fetch IV ranks: ${response.status}`);
        }
        const result: IVRankResponse = await response.json();
        setData(result.data || []);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching IV ranks:", err);
        setError("Failed to load IV rank data");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getIVRankColor = (ivRank: number): string => {
    // Color scale: Low IV (green) → Medium (yellow) → High (red)
    if (ivRank <= 20) return "bg-emerald-500 hover:bg-emerald-600";
    if (ivRank <= 40) return "bg-emerald-400 hover:bg-emerald-500";
    if (ivRank <= 60) return "bg-yellow-400 hover:bg-yellow-500";
    if (ivRank <= 80) return "bg-orange-400 hover:bg-orange-500";
    return "bg-red-500 hover:bg-red-600";
  };

  const getIVRankLabel = (ivRank: number): string => {
    if (ivRank <= 20) return "Very Low";
    if (ivRank <= 40) return "Low";
    if (ivRank <= 60) return "Medium";
    if (ivRank <= 80) return "High";
    return "Very High";
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">IV Rank Heatmap</CardTitle>
            </div>
          </div>
          <CardDescription>Implied Volatility Rank for watchlist</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
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
            <Activity className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg">IV Rank Heatmap</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-red-500 text-sm text-center py-4">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">IV Rank Heatmap</CardTitle>
            </div>
            <div className="text-xs text-muted-foreground">
              {data.length} symbols
            </div>
          </div>
          <CardDescription>Implied Volatility Rank (0-100) for watchlist</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No IV rank data available
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {data.map((item) => (
                <Tooltip key={item.ticker}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "relative p-3 rounded-lg cursor-pointer transition-all",
                        getIVRankColor(item.ivRank),
                        "text-white"
                      )}
                    >
                      <div className="font-bold text-center">{item.ticker}</div>
                      <div className="text-center text-xs opacity-90">
                        {item.ivRank}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-bold">{item.ticker}</p>
                      <p className="text-xs">IV Rank: <span className="font-semibold">{item.ivRank}</span> ({getIVRankLabel(item.ivRank)})</p>
                      <p className="text-xs">IV Percentile: {item.ivPercentile}</p>
                      <p className="text-xs">Current IV: {formatPercent(item.currentIV)}</p>
                      <p className="text-xs">52wk Range: {formatPercent(item.iv52WeekLow)} - {formatPercent(item.iv52WeekHigh)}</p>
                      <p className="text-xs">Expected Move: ±{formatPercent(item.impliedMove)}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
          
          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-muted-foreground">Low IV:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-emerald-500" />
              <span className="text-muted-foreground">0-40</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-yellow-400" />
              <span className="text-muted-foreground">40-60</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-orange-400" />
              <span className="text-muted-foreground">60-80</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-red-500" />
              <span className="text-muted-foreground">80-100</span>
            </div>
            <span className="text-muted-foreground">High IV</span>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
