"use client"

import { useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"

export interface ShortcutConfig {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  action: () => void
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const { toast } = useToast()

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLElement &&
          event.target.isContentEditable)
      ) {
        return
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = shortcut.ctrl
          ? event.ctrlKey || event.metaKey
          : !event.ctrlKey && !event.metaKey
        const shiftMatch = shortcut.shift
          ? event.shiftKey
          : !event.shiftKey
        const altMatch = shortcut.alt ? event.altKey : !event.altKey

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault()
          event.stopPropagation()

          shortcut.action()
          toast({
            title: `Shortcut: ${shortcut.description}`,
            description: `Triggered with ${shortcut.ctrl ? "Ctrl/⌘+" : ""}${shortcut.shift ? "Shift+" : ""}${shortcut.alt ? "Alt+" : ""}${shortcut.key.toUpperCase()}`,
          })
          break
        }
      }
    }
  , [shortcuts, toast])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}

// Predefined shortcuts for the dashboard
export function useDashboardShortcuts({
  onRefresh,
  onExport,
  onAddPosition,
  onShowHelp,
}: {
  onRefresh?: () => void
  onExport?: () => void
  onAddPosition?: () => void
  onShowHelp?: () => void
}) {
  const shortcuts: ShortcutConfig[] = [
    {
      key: "r",
      ctrl: true,
      description: "Refresh data",
      action: onRefresh || (() => {}),
    },
    {
      key: "e",
      ctrl: true,
      description: "Export data",
      action: onExport || (() => {}),
    },
    {
      key: "n",
      ctrl: true,
      description: "Add new position",
      action: onAddPosition || (() => {}),
    },
    {
      key: "?",
      shift: true,
      description: "Show keyboard shortcuts",
      action: onShowHelp || (() => {}),
    },
  ]

  useKeyboardShortcuts(shortcuts)

  return shortcuts
}
