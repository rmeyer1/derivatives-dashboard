"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, Check, ListTodo, X, Bell, StickyNote } from "lucide-react"
import { useNotifications } from "@/lib/hooks/useNotifications"

interface QuickActionsProps {
  pendingAlerts?: number
  onAcknowledgeAll?: () => void
  onAddNote?: () => void
  onViewPending?: () => void
}

export default function QuickActions({
  pendingAlerts = 0,
  onAcknowledgeAll,
  onAddNote,
  onViewPending,
}: QuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { permission, requestPermission } = useNotifications()
  const hasPermission = permission === 'granted'
  const containerRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("touchstart", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
    }
  }, [isOpen])

  // Close on scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsOpen(false)
    }

    if (isOpen) {
      window.addEventListener("scroll", handleScroll, { passive: true })
    }

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [isOpen])

  const handleAcknowledge = async () => {
    if (onAcknowledgeAll) {
      onAcknowledgeAll()
    }
    setIsOpen(false)
  }

  const handleAddNote = () => {
    if (onAddNote) {
      onAddNote()
    }
    setIsOpen(false)
  }

  const handleViewPending = () => {
    if (onViewPending) {
      onViewPending()
    }
    setIsOpen(false)
  }

  const actions = [
    {
      id: "acknowledge",
      label: "Acknowledge All",
      icon: Check,
      onClick: handleAcknowledge,
      color: "bg-green-500 hover:bg-green-600",
    },
    {
      id: "add-note",
      label: "Add Quick Note",
      icon: StickyNote,
      onClick: handleAddNote,
      color: "bg-blue-500 hover:bg-blue-600",
    },
    {
      id: "view-pending",
      label: `View Pending ${pendingAlerts > 0 ? `(${pendingAlerts})` : ""}`,
      icon: ListTodo,
      onClick: handleViewPending,
      color: "bg-amber-500 hover:bg-amber-600",
      badge: pendingAlerts > 0 ? pendingAlerts : undefined,
    },
  ]

  return (
    <div
      ref={containerRef}
      className="fixed bottom-24 right-4 z-50 flex flex-col items-end md:hidden"
    >
      {/* Action Menu */}
      <div
        className={`flex flex-col items-end gap-3 mb-3 transition-all duration-300 ${
          isOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {actions.map((action) => (
          <div key={action.id} className="flex items-center gap-2">
            {/* Label */}
            <span className="bg-background border shadow-sm rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap opacity-90">
              {action.label}
            </span>

            {/* Action Button - Min 56px touch target */}
            <button
              onClick={action.onClick}
              className={`w-[56px] h-[56px] rounded-full text-white shadow-lg flex items-center justify-center transition-all active:scale-95 ${action.color}`}
              aria-label={action.label}
            >
              <action.icon className="h-6 w-6" />
              {action.badge && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {action.badge > 9 ? "9+" : action.badge}
                </span>
              )}
            </button>
          </div>
        ))}

        {/* Divider */}
        <div className="w-full border-t my-1"></div>

        {/* Subscribe to notifications */}
        {!hasPermission && (
          <div className="flex items-center gap-2">
            <span className="bg-background border shadow-sm rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap opacity-90">
              Enable Notifications
            </span>
            <button
              onClick={requestPermission}
              className="w-[56px] h-[56px] rounded-full bg-purple-500 hover:bg-purple-600 text-white shadow-lg flex items-center justify-center transition-all active:scale-95"
              aria-label="Enable notifications"
            >
              <Bell className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>

      {/* Main FAB - Min 56px touch target */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-[64px] h-[64px] rounded-full shadow-xl flex items-center justify-center transition-all duration-300 active:scale-95 ${
          isOpen
            ? "bg-destructive hover:bg-destructive/90 rotate-45"
            : "bg-primary hover:bg-primary/90"
        }`}
        aria-label={isOpen ? "Close quick actions" : "Open quick actions"}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="h-8 w-8 text-white" />
        ) : (
          <Plus className="h-8 w-8 text-white" />
        )}
      </button>

      {/* Hint text when FAB is visible but menu is closed */}
      {!isOpen && (
        <span className="text-xs text-muted-foreground mt-1 animate-pulse">
          Quick actions
        </span>
      )}
    </div>
  )
}
