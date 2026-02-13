'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, TrendingDown, Shield, RefreshCw, Clock, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ITMAlert {
  positionId: number;
  ticker: string;
  strategy: string;
  shortStrike: number;
  longStrike: number | null;
  stockPrice: number;
  itmPercent: number;
  dte: number;
  urgency: 'critical' | 'warning' | 'normal';
  managementPlan: string | null;
  acknowledgmentFlag: boolean;
  acknowledgmentExpiry: string | null;
  entryCreditPerContract: number;
  contracts: number;
}

interface ITMAlertBoardProps {
  onAcknowledge?: (positionId: number) => Promise<void>;
  refreshInterval?: number;
}

export function ITMAlertBoard({ onAcknowledge, refreshInterval = 60000 }: ITMAlertBoardProps) {
  const [alerts, setAlerts] = useState<ITMAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/alerts/itm?acknowledged=false');
      if (!response.ok) throw new Error('Failed to fetch alerts');
      const data = await response.json();
      const sorted = data.sort((a: ITMAlert, b: ITMAlert) => b.itmPercent - a.itmPercent);
      setAlerts(sorted);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchAlerts, refreshInterval]);

  const handleAcknowledge = async (positionId: number) => {
    setAcknowledgingId(positionId);
    try {
      const response = await fetch(`/api/positions/${positionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledgmentFlag: true })
      });
      if (!response.ok) throw new Error('Failed to acknowledge');
      setAlerts(prev => prev.filter(a => a.positionId !== positionId));
      if (onAcknowledge) await onAcknowledge(positionId);
    } catch (err) {
      setError('Failed to acknowledge alert');
    } finally {
      setAcknowledgingId(null);
    }
  };

  const getSeverityColor = (itmPercent: number, dte: number): string => {
    if (itmPercent > 10 || dte <= 3) return 'bg-red-500';
    if (itmPercent > 5 || dte <= 7) return 'bg-orange-500';
    return 'bg-yellow-500';
  };

  const getSeverityLabel = (itmPercent: number, dte: number): string => {
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
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">Loading alerts...</p>
          </div>
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
            <Badge variant="outline" className="ml-2">0</Badge>
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
          <Button variant="ghost" size="sm" onClick={fetchAlerts} className="ml-auto" disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => {
          const severityColor = getSeverityColor(alert.itmPercent, alert.dte);
          const severityLabel = getSeverityLabel(alert.itmPercent, alert.dte);
          
          return (
            <Card key={alert.positionId} className="border-l-4 transition-all duration-200" style={{ borderLeftColor: severityColor.replace('bg-', '').replace('500', '600') }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold">{alert.ticker}</span>
                      <Badge variant="outline" className="text-xs">{alert.strategy}</Badge>
                      <Badge className={cn("text-white text-xs", severityColor)}>{severityLabel}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-red-500" />
                          Strike: ${alert.shortStrike.toFixed(2)}
                        </span>
                        <span>Stock: ${alert.stockPrice.toFixed(2)}</span>
                        <span className={cn(alert.dte <= 7 && 'text-red-600 font-medium')}>{alert.dte} DTE</span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground">ITM Depth: </span>
                        <span className="font-medium text-red-600">{alert.itmPercent.toFixed(1)}%</span>
                      </div>
                    </div>
                    {alert.managementPlan && (
                      <div className="mt-2 text-sm flex items-start gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div><span className="text-muted-foreground">Plan: </span><span className="font-medium">{alert.managementPlan}</span></div>
                      </div>
                    )}
                    {alert.acknowledgmentExpiry && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Ack expires {new Date(alert.acknowledgmentExpiry).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleAcknowledge(alert.positionId)} disabled={acknowledgingId === alert.positionId}>
                    {acknowledgingId === alert.positionId ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <><CheckCircle className="h-4 w-4 mr-1" />Ack</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
