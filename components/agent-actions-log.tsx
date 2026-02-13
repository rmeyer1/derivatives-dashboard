'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AgentActivity, AgentActionsResponse } from '@/types/agent';
import { 
  Search, 
  Bell, 
  TrendingUp, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2 
} from 'lucide-react';

const typeIcons: Record<string, React.ReactNode> = {
  research: <Search className="h-4 w-4" />,
  alert: <Bell className="h-4 w-4" />,
  trade_suggestion: <TrendingUp className="h-4 w-4" />,
  analysis: <Activity className="h-4 w-4" />,
  notification: <Bell className="h-4 w-4" />,
  system: <Activity className="h-4 w-4" />
};

const statusIcons: Record<string, React.ReactNode> = {
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  pending: <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />
};

const statusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-800 border-green-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  failed: 'bg-red-100 text-red-800 border-red-200'
};

const typeColors: Record<string, string> = {
  research: 'bg-blue-100 text-blue-800 border-blue-200',
  alert: 'bg-purple-100 text-purple-800 border-purple-200',
  trade_suggestion: 'bg-green-100 text-green-800 border-green-200',
  analysis: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  notification: 'bg-gray-100 text-gray-800 border-gray-200',
  system: 'bg-slate-100 text-slate-800 border-slate-200'
};

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AgentActionsLog() {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = async () => {
    try {
      const response = await fetch('/api/agent/actions');
      if (!response.ok) throw new Error('Failed to fetch activities');
      const data: AgentActionsResponse = await response.json();
      setActivities(data.activities);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    // Poll every 30 seconds
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground mt-2">Loading agent activities...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto text-red-500" />
          <p className="text-red-500 mt-2">Error loading activities: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Agent Activity Log
        </CardTitle>
        <CardDescription>
          Recent activities and actions from your trading agent
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No activities yet. Agent actions will appear here.
            </p>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  {typeIcons[activity.type] || <Activity className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{activity.description}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge 
                      variant="outline" 
                      className={typeColors[activity.type] || 'bg-gray-100'}
                    >
                      {activity.type.replace('_', ' ')}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={statusColors[activity.status]}
                    >
                      <span className="flex items-center gap-1">
                        {statusIcons[activity.status]}
                        {activity.status}
                      </span>
                    </Badge>
                    {activity.metadata?.ticker && (
                      <Badge variant="secondary">
                        ${activity.metadata.ticker}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimestamp(activity.timestamp)}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}