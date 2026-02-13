'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TradeApproval, 
  ApprovalsResponse, 
  PositionType, 
  TradeType 
} from '@/types/agent';
import { 
  Check, 
  X, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Shield
} from 'lucide-react';

const positionIcons: Record<PositionType, React.ReactNode> = {
  long: <TrendingUp className="h-5 w-5 text-green-500" />,
  short: <TrendingDown className="h-5 w-5 text-red-500" />
};

const tradeTypeLabels: Record<TradeType, string> = {
  call: 'Call',
  put: 'Put',
  stock: 'Stock'
};

const riskColors: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  high: 'bg-red-100 text-red-800 border-red-200'
};

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

export function ApprovalFlows() {
  const [pending, setPending] = useState<TradeApproval[]>([]);
  const [history, setHistory] = useState<TradeApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('pending');

  const fetchApprovals = async () => {
    try {
      const response = await fetch('/api/agent/approvals');
      if (!response.ok) throw new Error('Failed to fetch approvals');
      const data: ApprovalsResponse = await response.json();
      setPending(data.pending);
      setHistory(data.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleApproval = async (id: string, status: 'approved' | 'declined') => {
    try {
      const response = await fetch('/api/agent/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id, 
          status, 
          notes: notes[id] || '' 
        })
      });
      if (!response.ok) throw new Error('Failed to update approval');
      setNotes(prev => ({ ...prev, [id]: '' }));
      await fetchApprovals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const renderSuggestionCard = (approval: TradeApproval, isHistory = false) => {
    const { suggestion } = approval;
    const isApproved = approval.status === 'approved';
    const isDeclined = approval.status === 'declined';
    
    return (
      <Card key={approval.id} className={isHistory ? 'opacity-75' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-muted">
                {positionIcons[suggestion.positionType]}
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className={suggestion.positionType === 'long' ? 'text-green-600' : 'text-red-600'}>
                    {suggestion.positionType === 'long' ? 'Buy' : 'Sell'}
                  </span>
                  {suggestion.tradeType !== 'stock' && (
                    <>
                      {suggestion.tradeType === 'call' ? 'Call' : 'Put'} 
                      <span className="text-muted-foreground">@</span>
                    </>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-base">
                    {suggestion.symbol}
                  </Badge>
                  <Badge variant="outline" className={riskColors[suggestion.riskLevel]}>
                    {suggestion.riskLevel} risk
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                    {suggestion.confidence}% confidence
                  </Badge>
                </div>
              </div>
            </div>
            
            {isHistory && (
              <Badge 
                variant="outline" 
                className={isApproved ? 
                  'bg-green-100 text-green-800 border-green-200' : 
                  'bg-red-100 text-red-800 border-red-200'
                }
              >
                {isApproved ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</> : 
                  <><XCircle className="h-3 w-3 mr-1" /> Declined</>}
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Size</p>
              <p className="text-lg font-semibold">{suggestion.suggestedSize} contracts</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Entry</p>
              <p className="text-lg font-semibold">${suggestion.entryPrice?.toFixed(2) || 'N/A'}</p>
            </div>
            {suggestion.strikePrice && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Strike</p>
                <p className="text-lg font-semibold">${suggestion.strikePrice}</p>
              </div>
            )}
            {suggestion.expiration && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Expiry</p>
                <p className="text-lg font-semibold">{new Date(suggestion.expiration).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </div>
            )}
          </div>
          
          <div className="p-4 bg-slate-50 rounded-lg border">
            <p className="text-sm font-medium mb-2">Agent Reasoning:</p>
            <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
          </div>
          
          {!isHistory && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (optional):</label>
              <Textarea
                placeholder="Add your notes before approving or declining..."
                value={notes[approval.id] || ''}
                onChange={(e) => setNotes(prev => ({ ...prev, [approval.id]: e.target.value }))}
                className="min-h-[80px]"
              />
            </div>
          )}
          
          {isHistory && approval.notes && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Notes:</p>
              <p className="text-sm">{approval.notes}</p>
            </div>
          )}
          
          {isHistory && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {approval.approvedBy}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {approval.approvedAt && formatTimestamp(approval.approvedAt)}
              </div>
            </div>
          )}
        </CardContent>
        
        {!isHistory && (
          <CardFooter className="gap-2 border-t bg-muted/50">
            <Button
              variant="outline"
              className="flex-1 border-red-200 hover:bg-red-50"
              onClick={() => handleApproval(approval.id, 'declined')}
            >
              <X className="h-4 w-4 mr-2 text-red-500" />
              Decline
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => handleApproval(approval.id, 'approved')}
            >
              <Check className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Activity className="h-8 w-8 animate-pulse mx-auto text-muted-foreground" />
          <p className="text-muted-foreground mt-2">Loading trade suggestions...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
          <p className="text-red-500 mt-2">Error loading approvals: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Trade Approvals
          {pending.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {pending.length} pending
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Review and approve trade suggestions from your agent
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="pending">
              Pending
              {pending.length > 0 && (
                <Badge variant="secondary" className="ml-2">{pending.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">
              History
              {history.length > 0 && (
                <Badge variant="secondary" className="ml-2">{history.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending" className="space-y-4">
            {pending.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No pending approvals. You're all caught up!</p>
                <p className="text-sm mt-1">Trade suggestions will appear here for your review.</p>
              </div>
            ) : (
              pending.map(approval => renderSuggestionCard(approval))
            )}
          </TabsContent>
          
          <TabsContent value="history" className="space-y-4">
            {history.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No approval history yet.</p>
              </div>
            ) : (
              history.map(approval => renderSuggestionCard(approval, true))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}