import { NextResponse } from "next/server"
import type { Task } from "@/types/agent"

// Mock data store - in production this would be a database
let tasks: Task[] = [
  {
    id: "1",
    type: "research",
    title: "Research AAPL",
    description: "Analyze AAPL technical and fundamental outlook",
    ticker: "AAPL",
    status: "completed",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: new Date(Date.now() - 3600000).toISOString(),
    result: "Bullish setup detected. Price above 50-day DMA, strong earnings expected."
  },
  {
    id: "2",
    type: "price_alert",
    title: "Alert: TSLA at $150",
    description: "Send notification when TSLA reaches $150",
    ticker: "TSLA",
    targetPrice: 150,
    status: "pending",
    createdAt: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: "3",
    type: "manual",
    title: "Review weekly positions",
    description: "Analyze current open positions for the week",
    status: "in_progress",
    createdAt: new Date(Date.now() - 1800000).toISOString()
  },
  {
    id: "4",
    type: "research",
    title: "Research NVDA earnings",
    description: "Research NVDA earnings setup for next week",
    ticker: "NVDA",
    status: "pending",
    createdAt: new Date(Date.now() - 60000).toISOString()
  },
  {
    id: "5",
    type: "manual",
    title: "Update risk parameters",
    status: "failed",
    createdAt: new Date(Date.now() - 43200000).toISOString(),
    result: "Failed to connect to risk management system"
  }
]

// GET /api/agent/tasks - Fetch all tasks
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    const status = searchParams.get('status') as Task['status'] | null
    const type = searchParams.get('type') as Task['type'] | null
    const ticker = searchParams.get('ticker')
    
    let filtered = [...tasks]
    
    if (status) {
      filtered = filtered.filter(t => t.status === status)
    }
    
    if (type) {
      filtered = filtered.filter(t => t.type === type)
    }
    
    if (ticker) {
      filtered = filtered.filter(t => t.ticker?.toUpperCase() === ticker.toUpperCase())
    }
    
    // Sort by createdAt descending
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    
    return NextResponse.json({
      tasks: filtered,
      total: filtered.length
    })
  } catch (error) {
    console.error("Error fetching tasks:", error)
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    )
  }
}

// POST /api/agent/tasks - Create a new task
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, title, description, ticker, targetPrice } = body
    
    if (!type || !title) {
      return NextResponse.json(
        { error: "Type and title are required" },
        { status: 400 }
      )
    }
    
    const newTask: Task = {
      id: Date.now().toString(),
      type,
      title,
      description,
      ticker: ticker?.toUpperCase(),
      targetPrice,
      status: "pending",
      createdAt: new Date().toISOString()
    }
    
    tasks.push(newTask)
    
    return NextResponse.json(newTask, { status: 201 })
  } catch (error) {
    console.error("Error creating task:", error)
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    )
  }
}

// PUT /api/agent/tasks/:id - Update a task
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, status, result } = body
    
    if (!id) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      )
    }
    
    const taskIndex = tasks.findIndex(t => t.id === id)
    
    if (taskIndex === -1) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      )
    }
    
    const updatedTask = {
      ...tasks[taskIndex],
      ...(status && { status }),
      ...(result && { result }),
      ...(status === 'completed' && { completedAt: new Date().toISOString() })
    }
    
    tasks[taskIndex] = updatedTask
    
    return NextResponse.json(updatedTask)
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    )
  }
}

// DELETE /api/agent/tasks/:id - Delete a task
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      )
    }
    
    const taskIndex = tasks.findIndex(t => t.id === id)
    
    if (taskIndex === -1) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      )
    }
    
    tasks.splice(taskIndex, 1)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting task:", error)
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    )
  }
}
