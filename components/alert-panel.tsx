"use client"

import { useState, useEffect } from "react"
import { Alert as UIAlert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Alert } from "@/types/dashboard"

// Backend API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function AlertPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/alerts`)
        const data: Alert[] = await response.json()
        setAlerts(data)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching alerts:", error)
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <div>Loading alerts...</div>
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800 hover:bg-red-200"
      case "medium": return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
      case "low": return "bg-blue-100 text-blue-800 hover:bg-blue-200"
      default: return "bg-gray-100 text-gray-800 hover:bg-gray-200"
    }
  }

  const markAsRead = (id: string) => {
    setAlerts(alerts.map(alert => 
      alert.id === id ? {...alert, read: true} : alert
    ))
  }

  const markAllAsRead = () => {
    setAlerts(alerts.map(alert => ({...alert, read: true})))
  }

  const unreadCount = alerts.filter(alert => !alert.read).length

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Notifications {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount} unread
            </Badge>
          )}
        </h3>
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Mark all as read
          </button>
        )}
      </div>
      
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No alerts at this time
          </div>
        ) : (
          alerts.map((alert) => (
            <UIAlert 
              key={alert.id} 
              className={`${alert.read ? "opacity-75" : ""} ${getPriorityColor(alert.priority)}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTitle className="font-medium">{alert.title}</AlertTitle>
                    {!alert.read && (
                      <Badge variant="outline" className="h-4 px-1.5 py-0 text-xs">
                        New
                      </Badge>
                    )}
                    <Badge variant="secondary" className={`h-4 px-1.5 py-0 text-xs ${
                      alert.priority === "high" ? "bg-destructive text-destructive-foreground" :
                      alert.priority === "medium" ? "bg-yellow-500 text-yellow-900" :
                      "bg-blue-500 text-blue-50"
                    }`}>
                      {alert.priority}
                    </Badge>
                  </div>
                  <AlertDescription className="mt-1">
                    {alert.description}
                  </AlertDescription>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {!alert.read && (
                <button 
                  onClick={() => markAsRead(alert.id)}
                  className="mt-2 text-xs underline hover:no-underline"
                >
                  Mark as read
                </button>
              )}
            </UIAlert>
          ))
        )}
      </div>
    </div>
  )
}