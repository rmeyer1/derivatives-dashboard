"use client"

import * as React from "react"
import { Download, FileJson, FileSpreadsheet } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"

interface DataExportProps {
  data: any[]
  filename?: string
}

export function DataExport({ data, filename = "portfolio" }: DataExportProps) {
  const { toast } = useToast()

  const getTimestamp = () => {
    const now = new Date()
    return now.toISOString().replace(/[:.]/g, "-").slice(0, 19)
  }

  const exportCSV = () => {
    if (!data || data.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no positions to export.",
        variant: "destructive",
      })
      return
    }

    const headers = Object.keys(data[0])
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header]
            // Escape values containing commas or quotes
            if (
              typeof value === "string" &&
              (value.includes(",") || value.includes('"'))
            ) {
              return `"${value.replace(/"/g, '""')}"`
            }
            return value ?? ""
          })
          .join(",")
      ),
    ]

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}-${getTimestamp()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Export successful",
      description: `Exported ${data.length} positions to CSV.`,
    })
  }

  const exportJSON = () => {
    if (!data || data.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no positions to export.",
        variant: "destructive",
      })
      return
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}-${getTimestamp()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Export successful",
      description: `Exported ${data.length} positions to JSON.`,
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Export data">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCSV}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportJSON}>
          <FileJson className="mr-2 h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
