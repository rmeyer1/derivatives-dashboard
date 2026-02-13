"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  Lightbulb, 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Target, 
  ArrowRight,
  Info,
  Activity,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";

type StrategyType = "CSP" | "CCS" | "Cash-Secured Put" | "Call Credit Spread";
type SuggestionType = "high_iv" | "low_iv" | "neutral" | "earnings" | "technical";

interface StrategySuggestion {
  id: string;
  ticker: string;
  strategyType: StrategyType;
  suggestionType: SuggestionType;
  confidence: "high" | "medium" | "low";
  ivRank: number;
  delta: number;
  dteRecommendation: number;
  strikeSelection: string;
  premiumEstimate: number;
  rationale: string;
  technicalSignal?: string;
  supportLevel?: number;
  resistanceLevel?: number;
}

interface SuggestionsResponse {
  data: StrategySuggestion[];
  timestamp: string;
}

export default function StrategySuggestions() {
  const [data, setData] = useState<StrategySuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/suggestions');
        if (!response.ok) {
          throw new Error(`Failed to fetch suggestions: ${response.status}`);
        }
        const result: SuggestionsResponse = await response.json();
        setData(result.data || []);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching suggestions:", err);
        setError("Failed to load strategy suggestions");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getStrategyIcon = (type: StrategyType) => {
    switch (type) {
      case "CSP":
      case "Cash-Secured Put":
        return <TrendingDown className="h-4 w-4" />;
      case "CCS":
      case "Call Credit Spread":
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (confidence: string): string => {
    switch (confidence) {
      case "high":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-orange-100 text-orange-800 border-orange-300";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSuggestionTypeLabel = (type: SuggestionType): string => {
    switch (type) {
      case "high_iv":
        return "High IV";
      case "low_iv":
        return "Low IV";
      case "neutral":
        return "Neutral";
      case "earnings":
        return "Earnings";
      case "technical":
        return "Technical";
      default:
        return type;
    }
  };

  const getSuggestionTypeColor = (type: SuggestionType): string => {
    switch (type) {
      case "high_iv":
        return "bg-red-100 text-red-700 border-red-200";
      case "low_iv":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "earnings":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "technical":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(value);
  };

  const filteredSuggestions = selectedType 
    ? data.filter(s => s.suggestionType === selectedType)
    : data;

  const suggestionTypes: SuggestionType[] = Array.from(new Set(data.map(s => s.suggestionType)));

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Strategy Suggestions</CardTitle>
          </div>
          <CardDescription>AI-powered trade ideas based on IV and technicals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
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
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Strategy Suggestions</CardTitle>
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
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Strategy Suggestions</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {data.length} ideas
          </Badge>
        </div>
        <CardDescription>AI-powered trade ideas based on IV rank and technicals</CardDescription>
        
        {/* Filter buttons */}
        {suggestionTypes.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Button 
              variant={selectedType === null ? "default" : "outline"} 
              size="sm"
              onClick={() => setSelectedType(null)}
              className="h-7 text-xs"
            >
              All
            </Button>
            {suggestionTypes.map(type => (
              <Button
                key={type}
                variant={selectedType === type ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType(type)}
                className={cn("h-7 text-xs", selectedType === type ? "" : getSuggestionTypeColor(type))}
              >
                {getSuggestionTypeLabel(type)}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {filteredSuggestions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No strategy suggestions available at this time
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="p-3 rounded-lg border border-border hover:border-primary/50 transition-colors bg-gradient-to-r from-background to-muted/20"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "p-2 rounded-md",
                      suggestion.strategyType.includes("Put") 
                        ? "bg-red-100 text-red-700" 
                        : "bg-green-100 text-green-700"
                    )}>
                      {getStrategyIcon(suggestion.strategyType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{suggestion.ticker}</span>
                        <span className="text-sm text-muted-foreground">
                          {suggestion.strategyType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge 
                          variant="outline" 
                          className={getConfidenceColor(suggestion.confidence)}
                        >
                          {suggestion.confidence} confidence
                        </Badge>
                        <Badge 
                          variant="outline"
                          className={getSuggestionTypeColor(suggestion.suggestionType)}
                        >
                          {getSuggestionTypeLabel(suggestion.suggestionType)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span className="font-bold text-green-600">
                      ~{formatCurrency(suggestion.premiumEstimate)}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Premium/contract
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    <span>IV Rank: {suggestion.ivRank}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    <span>Strike: {suggestion.strikeSelection}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>DTE: {suggestion.dteRecommendation}</span>
                  </div>
                </div>

                <div className="mt-2 p-2 bg-muted/30 rounded text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{suggestion.rationale}</span>
                </div>

                {suggestion.technicalSignal && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Signal:</span>
                    <span className="font-medium">{suggestion.technicalSignal}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Strategy Types:</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-100" />
              <span>CSP (Bullish/Neutral)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-100" />
              <span>CCS (Bearish/Neutral)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
