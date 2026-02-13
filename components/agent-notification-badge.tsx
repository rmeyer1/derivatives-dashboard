'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ApprovalsResponse } from '@/types/agent';
import { Bot, Bell } from 'lucide-react';

interface AgentNotificationBadgeProps {
  className?: string;
}

export function AgentNotificationBadge({ className }: AgentNotificationBadgeProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchPendingCount = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch('/api/agent/approvals');
      if (!response.ok) throw new Error('Failed to fetch');
      const data: ApprovalsResponse = await response.json();
      setPendingCount(data.pendingCount);
    } catch {
      // Silently fail - don't show badge on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingCount();
    // Poll every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  if (pendingCount === 0) return null;

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <Bot className="h-5 w-5" />
      {pendingCount > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold animate-pulse"
        >
          {pendingCount > 9 ? '9+' : pendingCount}
        </Badge>
      )}
    </div>
  );
}

// Simple notification icon with badge for header use
export function AgentNotificationIcon() {
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = async () => {
    try {
      const response = await fetch('/api/agent/approvals');
      if (!response.ok) throw new Error('Failed to fetch');
      const data: ApprovalsResponse = await response.json();
      setPendingCount(data.pendingCount);
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <Bell className="h-5 w-5" />
      {pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
      )}
    </div>
  );
}