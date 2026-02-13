"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { PortfolioItem } from "@/types/dashboard"

interface CompactModeProps {
  positions: PortfolioItem[]
  loading?: boolean
}

function getDaysToExpiry(expiration: string): number {
  const expDate = new Date(expiration)
  const today = new Date()
  const diffTime = expDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

export default function CompactMode({ positions, loading = false }: CompactModeProps) {
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
  const daysToExpiry = getDaysToExpiry(currentPosition.expiration)

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
                  {currentPosition.symbol}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge variant={currentPosition.type === "Call" ? "default" : "secondary"}>
                    {currentPosition.type}
                  </Badge>
                  <span className="text-sm">
                    ${currentPosition.strike.toFixed(2)}
                  </span>
                </CardDescription>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${currentPosition.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {currentPosition.pnl >= 0 ? "+" : ""}
                  ${currentPosition.pnl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentPosition.quantity} contracts
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Greek Values Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Delta
                </div>
                <div className={`text-xl font-semibold ${currentPosition.delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {currentPosition.delta.toFixed(4)}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Gamma
                </div>
                <div className="text-xl font-semibold">
                  {currentPosition.gamma.toFixed(4)}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Theta
                </div>
                <div className="text-xl font-semibold">
                  {currentPosition.theta.toFixed(4)}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  IV
                </div>
                <div className="text-xl font-semibold">
                  {(currentPosition.iv * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Days to Expiry */}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground">
                Exp: {new Date(currentPosition.expiration).toLocaleDateString()}
              </div>
              <Badge 
                variant={daysToExpiry <= 7 ? "destructive" : "outline"}
                className="text-xs"
              >
                {daysToExpiry} day{daysToExpiry !== 1 ? "s" : ""} to expiry
              </Badge>
            </div>

            {/* Price Info */}
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div>
                <div className="text-xs text-muted-foreground">Avg Price</div>
                <div className="text-lg font-medium">
                  ${currentPosition.avgPrice.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Market Price</div>
                <div className="text-lg font-medium">
                  ${currentPosition.marketPrice.toFixed(2)}
                </div>
              </div>
            </div>
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
