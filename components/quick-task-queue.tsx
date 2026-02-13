'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Task, TasksResponse, TaskType, TaskStatus } from '@/types/agent';
import { 
  Search, 
  Bell, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Play,
  Loader2,
  XCircle,
  AlertCircle,
  TrendingUp
} from 'lucide-react';

const typeLabels: Record<TaskType, string> = {
  research: 'Research',
  price_alert: 'Price Alert',
  manual: 'Manual Task'
};

const statusLabels: Record<TaskStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { 
    label: 'Pending', 
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <Clock className="h-3 w-3" />
  },
  in_progress: { 
    label: 'In Progress', 
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Loader2 className="h-3 w-3 animate-spin" />
  },
  completed: { 
    label: 'Completed', 
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle2 className="h-3 w-3" />
  },
  failed: { 
    label: 'Failed', 
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: <XCircle className="h-3 w-3" />
  }
};

export function QuickTaskQueue() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [researchTicker, setResearchTicker] = useState('');
  const [alertTicker, setAlertTicker] = useState('');
  const [alertPrice, setAlertPrice] = useState('');

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/agent/tasks');
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data: TasksResponse = await response.json();
      setTasks(data.tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  const createTask = async (type: TaskType, title: string, description: string, ticker?: string, targetPrice?: number) => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/agent/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title, description, ticker, targetPrice })
      });
      if (!response.ok) throw new Error('Failed to create task');
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchTicker.trim()) return;
    
    await createTask(
      'research',
      `Research ${researchTicker.toUpperCase()}`,
      `Deep dive analysis on ${researchTicker.toUpperCase()} - IV trends, technicals, and fundamentals`,
      researchTicker.toUpperCase()
    );
    setResearchTicker('');
  };

  const handleAlertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertTicker.trim() || !alertPrice.trim()) return;
    
    const price = parseFloat(alertPrice);
    if (isNaN(price)) return;

    await createTask(
      'price_alert',
      `Alert when ${alertTicker.toUpperCase()} hits $${price}`,
      `Notify when ${alertTicker.toUpperCase()} reaches target price of $${price}`,
      alertTicker.toUpperCase(),
      price
    );
    setAlertTicker('');
    setAlertPrice('');
  };

  const handleQuickAdd = async (type: TaskType, ticker: string) => {
    if (type === 'research') {
      await createTask(
        'research',
        `Research ${ticker}`,
        `Quick research on ${ticker}`,
        ticker
      );
    }
  };

  const deleteTask = async (id: string) => {
    try {
      const response = await fetch(`/api/agent/tasks?id=${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete task');
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const quickTickers = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'AMZN'];

  return (
    <div className="space-y-4">
      {/* Quick Add Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" />
              Research Ticker
            </CardTitle>
            <CardDescription>Get a comprehensive analysis on any ticker</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResearchSubmit} className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter ticker (e.g., AAPL)"
                  value={researchTicker}
                  onChange={(e) => setResearchTicker(e.target.value.toUpperCase())}
                  className="flex-1"
                />
                <Button type="submit" disabled={!researchTicker.trim() || submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {quickTickers.map(ticker => (
                  <Button
                    key={ticker}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuickAdd('research', ticker)}
                    disabled={submitting}
                  >
                    +${ticker}
                  </Button>
                ))}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Price Alert
            </CardTitle>
            <CardDescription>Get notified when a price target is hit</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAlertSubmit} className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Ticker"
                  value={alertTicker}
                  onChange={(e) => setAlertTicker(e.target.value.toUpperCase())}
                  className="w-24"
                />
                <Input
                  placeholder="Target $"
                  value={alertPrice}
                  onChange={(e) => setAlertPrice(e.target.value)}
                  type="number"
                  step="0.01"
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={!alertTicker.trim() || !alertPrice.trim() || submitting}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Task Queue
            {tasks.filter(t => t.status !== 'completed' && t.status !== 'failed').length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {tasks.filter(t => t.status !== 'completed' && t.status !== 'failed').length} active
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Pending and completed agent tasks</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-2">Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No tasks yet. Create a research or alert task above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const statusInfo = statusLabels[task.status];
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {statusInfo.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                        )}
                        {task.result && (
                          <p className="text-xs text-green-600 mt-1">{task.result}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className={statusInfo.color}>
                        {statusInfo.label}
                      </Badge>
                      {task.ticker && (
                        <Badge variant="secondary">${task.ticker}</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => deleteTask(task.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}