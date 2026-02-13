"use client"

import { useState, useEffect } from "react"
import { LayoutDashboard, Wallet, Bell, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

type TabId = "dashboard" | "positions" | "alerts" | "journal"

interface Tab {
  id: TabId
  label: string
  icon: React.ElementType
  badge?: number
}

const tabs: Tab[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "positions", label: "Positions", icon: Wallet },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "journal", label: "Journal", icon: BookOpen },
]

export default function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  // Hide/show on scroll for better UX on mobile
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight

      // Always show at bottom
      if (currentScrollY + windowHeight >= documentHeight - 50) {
        setIsVisible(true)
        return
      }

      // Show when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [lastScrollY])

  const handleTabClick = (tabId: TabId) => {
    onTabChange(tabId)
    // Small vibration feedback on mobile if supported
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10)
    }
  }

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-lg border-t transition-transform duration-300 ease-out md:hidden",
        "safe-area-inset-bottom pb-[env(safe-area-inset-bottom)]",
        isVisible ? "translate-y-0" : "translate-y-full"
      )}
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
      }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 rounded-xl transition-all duration-200",
                "min-h-[56px] min-w-[64px]", // Minimum touch target 44px
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "h-6 w-6 transition-transform duration-200",
                    isActive && "scale-110"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {/* Badge indicator */}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                )}
                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium mt-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Home indicator spacing for iOS */}
      <div className="h-[env(safe-area-inset-bottom)] bg-background" />
    </nav>
  )
}
