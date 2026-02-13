import { useState, useEffect, useCallback } from 'react'
import type { 
  AgentActivity, 
  Task, 
  TradeApproval, 
  AgentActionsResponse,
  TasksResponse,
  ApprovalsResponse 
} from '@/types/agent'

interface UseAgentData {
  activities: AgentActivity[]
  tasks: Task[]
  approvals: TradeApproval[]
  pendingApprovalsCount: number
  isLoading: boolean
  error: Error | null
  refetchAll: () => void
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'status'>) => Promise<Task>
  completeTask: (taskId: string, result?: string) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  approveTrade: (approvalId: string, notes?: string) => Promise<void>
  declineTrade: (approvalId: string, notes?: string) => Promise<void>
}

// Fetch agent activities
const fetchActivities = async (): Promise<AgentActivity[]> => {
  const response = await fetch('/api/agent/actions?limit=50')
  if (!response.ok) {
    throw new Error(`Failed to fetch activities: ${response.status}`)
  }
  const data: AgentActionsResponse = await response.json()
  return data.activities
}

// Fetch tasks
const fetchTasks = async (): Promise<Task[]> => {
  const response = await fetch('/api/agent/tasks')
  if (!response.ok) {
    throw new Error(`Failed to fetch tasks: ${response.status}`)
  }
  const data: TasksResponse = await response.json()
  return data.tasks
}

// Fetch approvals
const fetchApprovals = async (): Promise<TradeApproval[]> => {
  const response = await fetch('/api/agent/approvals')
  if (!response.ok) {
    throw new Error(`Failed to fetch approvals: ${response.status}`)
  }
  const data: ApprovalsResponse = await response.json()
  return [...data.pending, ...data.history]
}

export function useAgentData(pollingInterval: number = 30000): UseAgentData {
  const [activities, setActivities] = useState<AgentActivity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [approvals, setApprovals] = useState<TradeApproval[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      setError(null)
      const [activitiesData, tasksData, approvalsData] = await Promise.all([
        fetchActivities(),
        fetchTasks(),
        fetchApprovals()
      ])
      setActivities(activitiesData)
      setTasks(tasksData)
      setApprovals(approvalsData)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch agent data'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Polling
  useEffect(() => {
    const interval = setInterval(fetchAll, pollingInterval)
    return () => clearInterval(interval)
  }, [fetchAll, pollingInterval])

  // Add a new task
  const addTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'status'>): Promise<Task> => {
    const response = await fetch('/api/agent/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    })
    
    if (!response.ok) {
      throw new Error(`Failed to create task: ${response.status}`)
    }
    
    const newTask: Task = await response.json()
    setTasks(prev => [newTask, ...prev])
    return newTask
  }

  // Complete a task
  const completeTask = async (taskId: string, result?: string): Promise<void> => {
    const response = await fetch('/api/agent/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, status: 'completed', result })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to complete task: ${response.status}`)
    }
    
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: 'completed', completedAt: new Date().toISOString(), result }
        : t
    ))
  }

  // Delete a task
  const deleteTask = async (taskId: string): Promise<void> => {
    const response = await fetch(`/api/agent/tasks?id=${taskId}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      throw new Error(`Failed to delete task: ${response.status}`)
    }
    
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  // Approve a trade
  const approveTrade = async (approvalId: string, notes?: string): Promise<void> => {
    const response = await fetch('/api/agent/approvals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: approvalId, status: 'approved', notes, approvedBy: 'user' })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to approve trade: ${response.status}`)
    }
    
    setApprovals(prev => prev.map(a => 
      a.id === approvalId 
        ? { ...a, status: 'approved', approvedAt: new Date().toISOString(), notes }
        : a
    ))
  }

  // Decline a trade
  const declineTrade = async (approvalId: string, notes?: string): Promise<void> => {
    const response = await fetch('/api/agent/approvals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: approvalId, status: 'declined', notes, approvedBy: 'user' })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to decline trade: ${response.status}`)
    }
    
    setApprovals(prev => prev.map(a => 
      a.id === approvalId 
        ? { ...a, status: 'declined', approvedAt: new Date().toISOString(), notes }
        : a
    ))
  }

  const pendingApprovalsCount = approvals.filter(a => a.status === 'pending').length

  return {
    activities,
    tasks,
    approvals,
    pendingApprovalsCount,
    isLoading,
    error,
    refetchAll: fetchAll,
    addTask,
    completeTask,
    deleteTask,
    approveTrade,
    declineTrade
  }
}
