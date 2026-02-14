/**
 * Live Portfolio Table Component
 * 
 * Enhanced portfolio table with real-time price streaming and live P&L updates.
 * Uses usePortfolioLivePrices for SSE streaming from /api/market/stream.
 * 
 * Features:
 * - Toggle between Live Mode (streaming) and Static Mode (cached)
 * - Live bid/ask columns when streaming is active
 * - Color-coded P&L with animated updates
 * - Streaming status indicator (connected/disconnected)
 * - Responsive design with mobile card view and desktop table view
 */

'use client';

import { useState, useMemo } from 'react';
import { Position, Strategy } from '@/types/position';
import { LivePosition, usePortfolioLivePrices } from '@/lib/hooks/usePortfolioLivePrices';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Trash2,
  Edit3,
  XCircle,
  RefreshCw,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Wifi,
  WifiOff,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type SortField = 'ticker' | 'expirationDate' | 'dte' | 'unrealizedPnl' | 'strategy' | 'status' | 'currentPrice';
type SortDirection = 'asc' | 'desc';

interface LivePortfolioTableProps {
  positions: Position[];
  loading?: boolean;
  onEdit?: (position: Position) => void;
  onClose?: (position: Position) => void;
  onRoll?: (position: Position) => void;
  onDelete?: (positionId: number) => void;
  onRefresh?: () => void;
  /** Default live mode state */
  defaultLiveMode?: boolean;
}

interface PositionWithLive extends Position {
  liveData?: LivePosition;
}

export function LivePortfolioTable({
  positions = [],
  loading = false,
  onEdit,
  onClose,
  onRoll,
  onDelete,
  onRefresh,
  defaultLiveMode = true,
}: LivePortfolioTableProps) {
  // Live mode toggle state
  const [liveMode, setLiveMode] = useState(defaultLiveMode);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('expirationDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Use live prices hook
  const {
    livePositions,
    isStreaming,
    isConnected,
    error: liveError,
    lastUpdated,
    stockSymbols,
  } = usePortfolioLivePrices(positions, liveMode);

  // Merge position data with live data
  const positionsWithLive: PositionWithLive[] = useMemo(() => {
    const liveMap = new Map(livePositions.map(lp => [lp.id, lp]));
    return positions.map(position => ({
      ...position,
      liveData: liveMap.get(position.id),
    }));
  }, [positions, livePositions]);

  // Sort positions
  const sortedPositions = useMemo(() => {
    return [...positionsWithLive].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker);
          break;
        case 'strategy':
          comparison = a.strategy.localeCompare(b.strategy);
          break;
        case 'expirationDate':
          comparison = new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
          break;
        case 'dte':
          comparison = a.dte - b.dte;
          break;
        case 'unrealizedPnl':
          comparison = (a.liveData?.unrealizedPnl ?? a.unrealizedPNL ?? 0) - 
                       (b.liveData?.unrealizedPnl ?? b.unrealizedPNL ?? 0);
          break;
        case 'currentPrice':
          comparison = (a.liveData?.currentPrice ?? a.currentPrice ?? 0) - 
                       (b.liveData?.currentPrice ?? b.currentPrice ?? 0);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [positionsWithLive, sortField, sortDirection]);

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Delete handler
  const handleDelete = async (position: Position) => {
    if (!onDelete) return;
    if (!confirm(`Delete ${position.ticker} ${position.strategy} position?`)) return;

    setDeletingId(position.id);
    try {
      await onDelete(position.id);
    } finally {
      setDeletingId(null);
    }
  };

  // Format P&L value with color
  const formatPnl = (pnl: number | null | undefined, percent?: number | null): { text: string; color: string; isLive: boolean } => {
    if (pnl === null || pnl === undefined) {
      return { text: 'N/A', color: 'text-muted-foreground', isLive: false };
    }

    const isProfit = pnl >= 0;
    const percentStr = percent !== undefined && percent !== null
      ? ` (${isProfit ? '+' : ''}${percent.toFixed(1)}%)`
      : '';

    return {
      text: `${isProfit ? '+' : ''}$${pnl.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${percentStr}`,
      color: isProfit ? 'text-green-600' : 'text-red-600',
      isLive: true,
    };
  };

  // Format price from live data
  const formatPrice = (price: number | null | undefined, bid?: number, ask?: number): { text: string; isLive: boolean } => {
    if (price === null || price === undefined) {
      return { text: '—', isLive: false };
    }

    // If we have bid/ask, show range indicator
    if (bid !== undefined && ask !== undefined) {
      return {
        text: `$${price.toFixed(2)}`,
        isLive: true,
      };
    }

    return {
      text: `$${price.toFixed(2)}`,
      isLive: false,
    };
  };

  // Status indicator component
  const StatusIndicator = () => {
    if (!liveMode) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <WifiOff className="h-4 w-4" />
          <span>Static Mode</span>
        </div>
      );
    }

    if (isStreaming) {
      return (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <Activity className="h-4 w-4 animate-pulse" />
          <span>Live Streaming</span>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </div>
      );
    }

    if (isConnected) {
      return (
        <div className="flex items-center gap-2 text-yellow-600 text-sm">
          <Wifi className="h-4 w-4" />
          <span>Connecting...</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-red-500 text-sm">
        <WifiOff className="h-4 w-4" />
        <span>Disconnected</span>
      </div>
    );
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronUp className="h-4 w-4 text-muted-foreground" />;
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="h-4 w-4" />
      : <ChevronDown className="h-4 w-4" />;
  };

  // Strategy badge color
  const getStrategyColor = (strategy: Strategy): string => {
    switch (strategy) {
      case 'Cash Secured Put':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Covered Call':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Bull Put Spread':
      case 'Put Credit Spread':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Call Credit Spread':
      case 'Call Debit Spread':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Put Debit Spread':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'Iron Condor':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Status dot color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'open':
        return 'bg-green-500';
      case 'closed':
        return 'bg-gray-500';
      case 'rolled':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };

  // DTE level styling
  const getDTELevel = (dte: number): string => {
    if (dte <= 7) return 'text-red-600 font-bold';
    if (dte <= 21) return 'text-orange-600';
    return '';
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state
  if (positions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No open positions found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <CardHeader className="pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg">Positions</CardTitle>
            <StatusIndicator />
          </div>
          
          <div className="flex items-center gap-4">
            {/* Live Mode Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="live-mode"
                checked={liveMode}
                onCheckedChange={setLiveMode}
              />
              <Label htmlFor="live-mode" className="text-sm cursor-pointer">
                Live Mode
              </Label>
            </div>

            {/* Refresh button */}
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
                Refresh
              </Button>
            )}

            {/* Symbol count */}
            {liveMode && stockSymbols.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {stockSymbols.length} symbol{stockSymbols.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Error message */}
        {liveError && liveMode && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
            {liveError.message}
          </div>
        )}
      </CardHeader>

      {/* Mobile Card View */}
      <div className="space-y-4 md:hidden">
        {sortedPositions.map((position) => {
          const pnlStyle = formatPnl(
            position.liveData?.unrealizedPnl ?? position.unrealizedPNL,
            position.liveData?.pnlPercent
          );
          const priceStyle = formatPrice(
            position.liveData?.currentPrice ?? position.currentPrice,
            position.liveData?.liveBid,
            position.liveData?.liveAsk
          );

          return (
            <Card
              key={position.id}
              className={cn(
                'border-l-4',
                position.itm ? 'border-l-red-500' : 'border-l-green-500'
              )}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{position.ticker}</span>
                      <Badge variant="outline" className={getStrategyColor(position.strategy)}>
                        {position.strategy}
                      </Badge>
                      {pnlStyle.isLive && (
                        <Activity className="h-3 w-3 text-green-500 animate-pulse" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Strike: ${position.shortStrike.toFixed(2)}
                      {position.longStrike && `/${position.longStrike.toFixed(2)}`}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={cn('font-bold', pnlStyle.color)}>
                      {pnlStyle.text}
                    </div>
                    <div className={cn('text-sm', getDTELevel(position.dte))}>
                      {position.dte} DTE
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <span className="text-muted-foreground">Credit: </span>
                    <span>${position.entryCreditPerContract.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current: </span>
                    <span className={cn(priceStyle.isLive && 'text-green-600 font-medium')}>
                      {priceStyle.text}
                    </span>
                  </div>
                  {liveMode && position.liveData?.liveBid !== undefined && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Live Bid/Ask: </span>
                      <span className="text-xs">
                        ${position.liveData.liveBid?.toFixed(2)} / ${position.liveData.liveAsk?.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Contracts: </span>
                    <span>{position.contracts}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expires: </span>
                    <span>{position.expirationDate}</span>
                  </div>
                </div>

                {position.itm && (
                  <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    In-The-Money
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t">
                  {position.status === 'open' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit?.(position)}
                        className="flex-1"
                      >
                        <Edit3 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onClose?.(position)}
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Close
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(position)}
                    disabled={deletingId === position.id}
                    className="px-2"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <div className="w-2 h-2 rounded-full bg-gray-300" />
              </TableHead>
              
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('ticker')}>
                  Ticker
                  <SortIcon field="ticker" />
                </Button>
              </TableHead>

              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('strategy')}>
                  Strategy
                  <SortIcon field="strategy" />
                </Button>
              </TableHead>

              <TableHead className="text-right">Contracts</TableHead>

              <TableHead className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleSort('expirationDate')} className="ml-auto">
                  Expiration
                  <SortIcon field="expirationDate" />
                </Button>
              </TableHead>

              <TableHead className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleSort('dte')} className="ml-auto">
                  DTE
                  <SortIcon field="dte" />
                </Button>
              </TableHead>

              <TableHead className="text-right">Entry Credit</TableHead>

              {/* Live columns - show when in live mode */}
              {liveMode && (
                <>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('currentPrice')} className="ml-auto">
                      Current
                      <SortIcon field="currentPrice" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right text-xs text-muted-foreground">Bid/Ask</TableHead>
                </>
              )}
              {!liveMode && (
                <TableHead className="text-right">Current</TableHead>
              )}

              <TableHead className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleSort('unrealizedPnl')} className="ml-auto">
                  P&L
                  <SortIcon field="unrealizedPnl" />
                </Button>
              </TableHead>

              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {sortedPositions.map((position) => {
              const pnlStyle = formatPnl(
                position.liveData?.unrealizedPnl ?? position.unrealizedPNL,
                position.liveData?.pnlPercent
              );
              const priceStyle = formatPrice(
                position.liveData?.currentPrice ?? position.currentPrice,
                position.liveData?.liveBid,
                position.liveData?.liveAsk
              );

              return (
                <TableRow
                  key={position.id}
                  className={cn(
                    position.dte <= 7 && 'bg-red-50/50',
                    position.itm && 'bg-orange-50/50',
                    pnlStyle.isLive && 'transition-colors duration-300'
                  )}
                >
                  <TableCell>
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        getStatusColor(position.status)
                      )}
                    />
                  </TableCell>

                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {position.ticker}
                      {pnlStyle.isLive && (
                        <Activity className="h-3 w-3 text-green-500 animate-pulse" />
                      )}
                      {position.itm && (
                        <span className="text-xs" title="In-The-Money">🔴</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className={cn('text-xs', getStrategyColor(position.strategy))}>
                      {position.strategy}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">{position.contracts}</TableCell>

                  <TableCell className="text-right">
                    {position.expirationDate}
                  </TableCell>

                  <TableCell className={cn('text-right', getDTELevel(position.dte))}>
                    {position.dte}
                    {position.dte <= 21 && position.dte > 7 && (
                      <span className="ml-1 text-xs" title="Consider rolling">🔄</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    ${position.entryCreditPerContract.toFixed(2)}
                  </TableCell>

                  {/* Current price column */}
                  <TableCell
                    className={cn(
                      'text-right',
                      priceStyle.isLive && 'text-green-600 font-medium'
                    )}
                  >
                    {priceStyle.text}
                  </TableCell>

                  {/* Live bid/ask column */}
                  {liveMode && (
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {position.liveData?.liveBid !== undefined && position.liveData?.liveAsk !== undefined ? (
                        <span>
                          ${position.liveData.liveBid.toFixed(2)} / ${position.liveData.liveAsk.toFixed(2)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  )}

                  {/* P&L column */}
                  <TableCell className={cn('text-right font-medium', pnlStyle.color)}>
                    {pnlStyle.text}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {position.status === 'open' && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onEdit?.(position)}
                            title="Edit"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onClose?.(position)}
                            title="Close"
                            className="text-red-500 hover:text-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onRoll?.(position)}
                            title="Roll"
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(position)}
                        disabled={deletingId === position.id}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Footer info */}
      {liveMode && stockSymbols.length > 0 && (
        <div className="mt-4 p-3 bg-muted rounded-md text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Streaming {stockSymbols.length} symbol(s):</span>
            <span className="font-mono text-xs">{stockSymbols.join(', ')}</span>
            {isStreaming && (
              <span className="text-green-600 flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Real-time updates active
              </span>
            )}
          </div>
          <p className="mt-1 text-xs">
            Option symbols identified but not streamed (requires Alpaca paid tier).
          </p>
        </div>
      )}
    </div>
  );
}

export default LivePortfolioTable;
