'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DTEPosition {
  id: number;
  ticker: string;
  strategy: string;
  expirationDate: string;
  shortStrike: number;
  longStrike?: number | null;
  dte: number;
  contracts: number;
}

interface DTETimelineProps {
  positions: DTEPosition[];
  loading?: boolean;
}

export function DTETimeline({ positions, loading = false }: DTETimelineProps) {
  const timelinePositions = useMemo(() => {
    return positions
      .filter(p => p.dte <= 60 && p.dte >= 0)
      .sort((a, b) => a.dte - b.dte);
  }, [positions]);

  const groupedByDTE = useMemo(() => {
    const critical = timelinePositions.filter(p => p.dte <= 7);
    const warning = timelinePositions.filter(p => p.dte > 7 && p.dte <= 21);
    const normal = timelinePositions.filter(p => p.dte > 21);
    return { critical, warning, normal };
  }, [timelinePositions]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">DTE Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center">
            <div className="animate-pulse space-y-2 w-full">
              <div className="h-8 bg-gray-200 rounded w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!timelinePositions || timelinePositions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">DTE Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground">
            No positions expiring within 60 days
          </div>
        </CardContent>
      </Card>
    );
  }

  const getPositionColor = (dte: number): string => {
    if (dte <= 7) return 'bg-red-500';
    if (dte <= 21) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const PositionMarker = ({ position }: { position: DTEPosition }) => (
    <div
      title={`${position.ticker} ${position.strategy} - ${position.dte} DTE`}
      className={cn(
        'inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium text-white cursor-pointer',
        'transition-all duration-200 hover:scale-110',
        getPositionColor(position.dte)
      )}
    >
      {position.ticker}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">DTE Timeline</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-red-500 text-red-600">
              <AlertTriangle className="h-3 w-3 mr-1" />≤7d
            </Badge>
            <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
              <Clock className="h-3 w-3 mr-1" />8-21d
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative pt-6 pb-2">
          <div className="h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full opacity-30" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Today</span>
            <span>7 days</span>
            <span>21 days</span>
            <span>60 days</span>
          </div>
        </div>

        {groupedByDTE.critical.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm font-medium text-red-600">Critical (≤7 days)</span>
              <Badge variant="destructive" className="ml-auto">{groupedByDTE.critical.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {groupedByDTE.critical.map(p => (
                <PositionMarker key={p.id} position={p} />
              ))}
            </div>
          </div>
        )}

        {groupedByDTE.warning.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-sm font-medium text-yellow-600">Approaching Roll (8-21 days)</span>
              <Badge variant="outline" className="ml-auto border-yellow-500 text-yellow-600">{groupedByDTE.warning.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {groupedByDTE.warning.map(p => (
                <PositionMarker key={p.id} position={p} />
              ))}
            </div>
          </div>
        )}

        {groupedByDTE.normal.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-600">Normal (&gt;21 days)</span>
              <Badge variant="outline" className="ml-auto border-green-500 text-green-600">{groupedByDTE.normal.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {groupedByDTE.normal.map(p => (
                <PositionMarker key={p.id} position={p} />
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total: {timelinePositions.length}</span>
            <span className="font-medium">Expiring Next 60 Days</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
