'use client';

import { useEffect, useState } from 'react';
import { ITMAlert } from '@/types/position';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  CheckCircle, 
  TrendingDown, 
  Shield,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ITMAlertBoardProps {
  onAcknowledge: (positionId: number) => Promise<void>;
  refreshInterval?: number; // milliseconds
}

export function ITMAlertBoard({ onAcknowledge, refreshInterval = 30000 }: ITMAlertBoardProps) {
  const [alerts, setAlerts] = useState<ITMAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/alerts/itm');
      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }
      const data = await response.json();
      setAlerts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    
    // Set up polling
    const interval = setInterval(fetchAlerts, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const handleAcknowledge = async (positionId: number) => {
    setAcknowledgingId(positionId);
    try {
      await onAcknowledge(positionId);
      // Remove the alert from the local state
      setAlerts(prev => prev.filter(a => a.positionId !== positionId));
    } catch (err) {
      setError('Failed to acknowledge alert');
    } finally {
      setAcknowledgingId(null);
    }
  };

  const getSeverityColor = (itmPercent: number, dte: number) => {
    if (itmPercent > 10) return 'bg-red-500';
    if (itmPercent > 5 || dte <= 7) return 'bg-orange-500';
    return 'bg-yellow-500';
  };

  const getSeverityLabel = (itmPercent: number, dte: number) => {
    if (itmPercent > 10) return 'Deep ITM';
    if (itmPercent > 5) return 'Moderately ITM';
    if (dte <= 7) return 'Near Expiry';
    return 'Slightly ITM';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            ITM Alerts
            <RefreshCw className="h-4 w-4 animate-spin ml-auto" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading alerts...&lt;/div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            ITM Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            ITM Alerts
            <Badge variant="secondary" className="ml-2">0</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-muted-foreground p-4 bg-green-50 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span>No ITM alerts. All positions are out-of-the-money.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          ITM Alerts
          <Badge variant="destructive" className="ml-2">{alerts.length}</Badge>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchAlerts}
            className="ml-auto"
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => {
          const isExpanded = expandedId === alert.positionId;
          const severityColor = getSeverityColor(alert.itmPercent, alert.dte);
          const severityLabel = getSeverityLabel(alert.itmPercent, alert.dte);
          
          // Calculate percentage ITM
          const distanceFromStrike = alert.stockPrice && alert.shortStrike
            ? Math.abs(alert.stockPrice - alert.shortStrike)
            : 0;
          
          return (
            <Card 
              key={alert.positionId} 
              className={cn(
                "border-l-4 transition-all duration-200",
                isExpanded ? "shadow-md" : ""
              )}
              style={{ borderLeftColor: severityColor.replace('bg-', '#').replace('500', '500') }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold">{alert.ticker}</span>
                      <Badge variant="outline" className="text-xs">
                        {alert.strategy}
                      </Badge>
                      <Badge 
                        className={cn("text-white text-xs", severityColor)}
                      >
                        {severityLabel}
                      </Badge>
                    </div>
                    
                    <div className="mt-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-red-500" />
                          Strike: ${alert.shortStrike.toFixed(2)}
                        </span>
                        <span className="text-muted-foreground">•&lt;/span>
                        <span className="text-muted-foreground">
                          Stock: ${alert.stockPrice?.toFixed(2) ?? 'N/A'}
                        </span>
                        <span className="text-muted-foreground">•&lt;/span>
                        <span className={cn(
                          alert.dte <= 7 ? 'text-red-600 font-medium' : ''
                        )}>
                          {alert.dte} DTE
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground">ITM Depth: </span>
                        <span className="font-medium text-red-600">
                          {alert.itmPercent.toFixed(1)}%
                        </span>
                        <span className="text-muted-foreground ml-1">
                          (${distanceFromStrike.toFixed(2)} below strike)
                        </span>
                      </div>
                    </div>
                    
                    {alert.managementPlan && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Plan: </span>
                        <span className="font-medium">{alert.managementPlan}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : alert.positionId)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAcknowledge(alert.positionId)}
                      disabled={acknowledgingId === alert.positionId}
                    >
                      {acknowledgingId === alert.positionId ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Ack
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t text-sm space-y-2">
                    <Alert className="bg-yellow-50 border-yellow-200">
                      <AlertDescription className="text-yellow-800">
                        <div className="font-medium mb-1">Management Suggestions:</div>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Consider rolling to a later expiration</li>
                          <li>Evaluate buying back the position</li>
                          {alert.dte <= 7 && <li>Position expires soon - take action</li>}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
