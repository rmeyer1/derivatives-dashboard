"use client"

import * as React from "react"
import { Keyboard } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ShortcutConfig } from "@/lib/hooks/useKeyboardShortcuts"

interface KeyboardShortcutsHelpProps {
  shortcuts: ShortcutConfig[]
}

export function KeyboardShortcutsHelp({
  shortcuts,
}: KeyboardShortcutsHelpProps) {
  const [open, setOpen] = React.useState(false)

  const formatShortcut = (shortcut: ShortcutConfig) => {
    const parts: string[] = []
    if (shortcut.ctrl) parts.push("Ctrl")
    if (shortcut.meta) parts.push("⌘")
    if (shortcut.alt) parts.push("Alt")
    if (shortcut.shift) parts.push("Shift")
    parts.push(shortcut.key.toUpperCase())
    return parts.join("+")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Keyboard shortcuts">
          <Keyboard className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Press these shortcuts to quickly access dashboard features.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-3">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
              <kbd className="rounded border bg-muted px-2 py-1 text-xs font-mono font-semibold">
                {formatShortcut(shortcut)}
              </kbd>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Tip: Press Shift+? to quickly open this help.
        </div>
      </DialogContent>
    </Dialog>
  )
}
