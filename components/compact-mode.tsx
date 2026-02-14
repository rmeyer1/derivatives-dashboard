"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Edit3, XCircle, ArrowRightLeft } from "lucide-react"
import { Position } from "@/types/position"
import { cn } from "@/lib/utils"

interface CompactModeProps {
  positions: Position[]
  loading?: boolean
  onEdit?: (position: Position) => void
  onClose?: (position: Position) => void
  onRoll?: (position: Position) => void
}

function getDaysToExpiry(expirationDate: string): number {
  const expDate = new Date(expirationDate)
  const today = new Date()
  const diffTime = expDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

function getOptionTypeFromStrategy(strategy: string): 'Call' | 'Put' | 'Spread' | 'Mixed' {
  if (strategy.includes('Call')) return 'Call'
  if (strategy.includes('Put')) return 'Put'
  if (strategy.includes('Spread')) return 'Spread'
  return 'Mixed'
}

export default function CompactMode({ positions, loading = false, onEdit, onClose, onRoll }: CompactModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [translateX, setTranslateX] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : positions.length - 1))
    setTranslateX(0)
  }, [positions.length])

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < positions.length - 1 ? prev + 1 : 0))
    setTranslateX(0)
  }, [positions.length])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true)
    setStartX(e.touches[0].clientX)
    setTranslateX(0)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return
    const currentX = e.touches[0].clientX
    const diff = currentX - startX
    setTranslateX(diff)
  }, [isDragging, startX])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    
    const threshold = 50 // Minimum swipe distance
    if (translateX > threshold) {
      handlePrev()
    } else if (translateX < -threshold) {
      handleNext()
    }
    setTranslateX(0)
  }, [isDragging, translateX, handlePrev, handleNext])

  // Mouse events for desktop fallback
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setStartX(e.clientX)
    setTranslateX(0)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    const currentX = e.clientX
    const diff = currentX - startX
    setTranslateX(diff)
  }, [isDragging, startX])

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    
    const threshold = 50
    if (translateX > threshold) {
      handlePrev()
    } else if (translateX < -threshold) {
      handleNext()
    }
    setTranslateX(0)
  }, [isDragging, translateX, handlePrev, handleNext])

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      setTranslateX(0)
    }
  }, [isDragging])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrev()
      } else if (e.key === "ArrowRight") {
        handleNext()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handlePrev, handleNext])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading positions...</div>
      </div>
    )
  }

  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground text-center">
          <p className="text-lg font-medium">No positions</p>
          <p className="text-sm">Add positions to see them here</p>
        </div>
      </div>
    )
  }

  const currentPosition = positions[currentIndex]
  const daysToExpiry = getDaysToExpiry(currentPosition.expirationDate)
  const optionType = getOptionTypeFromStrategy(currentPosition.strategy)
  
  // Calculate P&L
  const pnl = currentPosition.unrealizedPNL ?? 0
  const isProfit = pnl >= 0
  
  // Determine badge variant based on option type
  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'Call': return 'default'
      case 'Put': return 'secondary'
      case 'Spread': return 'outline'
      default: return 'outline'
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Card Container */}
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <Card
          className="transition-transform duration-200 ease-out select-none"
          style={{
            transform: `translateX(${translateX}px)`,
          }}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">
                  {currentPosition.ticker}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge variant={getBadgeVariant(optionType)}>
                    {optionType}
                  </Badge>
                  <span className="text-sm">
                    ${currentPosition.shortStrike.toFixed(2)}
                    {currentPosition.longStrike && `/${currentPosition.longStrike.toFixed(2)}`}
                  </span>
                </CardDescription>
              </div>
              <div className="text-right">
                <div className={cn("text-2xl font-bold", isProfit ? "text-green-600" : "text-red-600")}>
                  {isProfit ? "+" : ""}
                  ${Math.abs(pnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentPosition.contracts} contract{currentPosition.contracts !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Strategy & Details */}
            <div className="bg-muted/50 rounded-lg p-3 mb-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Strategy
              </div>
              <div className="text-lg font-semibold">
                {currentPosition.strategy}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Entry Credit: ${currentPosition.entryCreditPerContract.toFixed(2)}/contract
              </div>
            </div>

            {/* Key Info Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Current Price
                </div>
                <div className="text-xl font-semibold">
                  {currentPosition.currentPrice 
                    ? `$${currentPosition.currentPrice.toFixed(2)}`
                    : 'N/A'
                  }
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  DTE
                </div>
                <div className={cn(
                  "text-xl font-semibold",
                  daysToExpiry <= 7 ? "text-red-600" : daysToExpiry <= 21 ? "text-orange-600" : ""
                )}>
                  {daysToExpiry}
                </div>
              </div>
            </div>

            {/* Days to Expiry */}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground">
                Exp: {new Date(currentPosition.expirationDate).toLocaleDateString()}
              </div>
              <Badge 
                variant={daysToExpiry <= 7 ? "destructive" : "outline"}
                className="text-xs"
              >
                {daysToExpiry} day{daysToExpiry !== 1 ? "s" : ""} to expiry
              </Badge>
            </div>

            {/* ITM Warning */}
            {currentPosition.itm && (
              <div className="mt-4 bg-red-50 text-red-700 px-3 py-2 rounded text-sm text-center">
                ⚠️ In-The-Money Position
              </div>
            )}

            {/* Action Buttons */}
            {currentPosition.status === 'open' && (onEdit || onClose || onRoll) && (
              <div className="flex gap-2 mt-4 pt-4 border-t">
                {onEdit && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => onEdit(currentPosition)}
                    className="flex-1"
                  >
                    <Edit3 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
                {onClose && (
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => onClose(currentPosition)}
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Close
                  </Button>
                )}
                {onRoll && (
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={() => onRoll(currentPosition)}
                    className="flex-1"
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-1" />
                    Roll
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between mt-4 px-2">
        {/* Prev Button - 44px touch target */}
        <button
          onClick={handlePrev}
          className="p-3 rounded-full bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Previous position"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Position Dots */}
        <div className="flex gap-2">
          {positions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2.5 h-2.5 rounded-full transition-colors min-h-[14px] min-w-[14px] ${
                index === currentIndex
                  ? "bg-primary"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              aria-label={`Go to position ${index + 1}`}
            />
          ))}
        </div>

        {/* Next Button - 44px touch target */}
        <button
          onClick={handleNext}
          className="p-3 rounded-full bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Next position"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Position Counter */}
      <div className="text-center mt-3 text-sm text-muted-foreground">
        {currentIndex + 1} of {positions.length}
      </div>

      {/* Swipe Hint */}
      <div className="text-center mt-2 text-xs text-muted-foreground/60">
        Swipe to navigate
      </div>
    </div>
  )
}
