"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface EarningsEvent {
  ticker: string;
  earningsDate: string;
  earningsTime: "before_open" | "after_close" | "unknown";
  expectedEPS: number | null;
  consensusEPS: number | null;
  hasPosition: boolean;
  daysToEarnings: number;
  impliedMove: number; // Expected move %
  lastYearSurprise?: number | null;
}

interface EarningsResponse {
  data: EarningsEvent[];
  timestamp: string;
}

export default function EarningsCalendar() {
  const [data, setData] = useState<EarningsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/market/earnings');
        if (!response.ok) {
          throw new Error(`Failed to fetch earnings: ${response.status}`);
        }
        const result: EarningsResponse = await response.json();
        setData(result.data || []);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching earnings:", err);
        setError("Failed to load earnings data");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatEarningsTime = (time: string): string => {
    switch (time) {
      case "before_open":
        return "Pre-Market";
      case "after_close":
        return "After Close";
      default:
        return "TBD";
    }
  };

  const getEarningsTimeColor = (time: string): string => {
    switch (time) {
      case "before_open":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "after_close":
        return "bg-purple-100 text-purple-800 border-purple-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getUrgencyColor = (days: number): string => {
    if (days <= 1) return "text-red-600 font-bold";
    if (days <= 3) return "text-orange-600";
    if (days <= 7) return "text-yellow-600";
    return "text-muted-foreground";
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  const upcomingEarnings = data
    .filter(e => e.daysToEarnings >= 0)
    .sort((a, b) => a.daysToEarnings - b.daysToEarnings);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-lg">Earnings Calendar</CardTitle>
          </div>
          <CardDescription>Upcoming earnings for your positions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
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
            <Calendar className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-lg">Earnings Calendar</CardTitle>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-lg">Earnings Calendar</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {upcomingEarnings.length} upcoming
          </Badge>
        </div>
        <CardDescription>Upcoming earnings for your positions</CardDescription>
      </CardHeader>
      <CardContent>
        {upcomingEarnings.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No upcoming earnings in the next 30 days
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {upcomingEarnings.map((event) => (
              <div
                key={event.ticker}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  event.daysToEarnings <= 2 
                    ? "border-red-200 bg-red-50/50" 
                    : event.daysToEarnings <= 5
                    ? "border-yellow-200 bg-yellow-50/50"
                    : "border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-lg">{event.ticker}</span>
                    {event.hasPosition && (
                      <Badge variant="secondary" className="text-[10px] w-fit">
                        Position
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex flex-col text-xs">
                    <span className={cn("flex items-center gap-1", getUrgencyColor(event.daysToEarnings))}>
                      <Clock className="h-3 w-3" />
                      {event.daysToEarnings === 0 ? "TODAY" : 
                       event.daysToEarnings === 1 ? "Tomorrow" :
                       `${event.daysToEarnings} days`}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(event.earningsDate).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", getEarningsTimeColor(event.earningsTime))}
                  >
                    {formatEarningsTime(event.earningsTime)}
                  </Badge>
                  
                  {event.impliedMove > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      ±{formatPercent(event.impliedMove)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Alert for near earnings */}
        {upcomingEarnings.some(e => e.daysToEarnings <= 2 && e.hasPosition) && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-amber-800">
              You have positions with earnings within 2 days. Consider rolling or closing.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
